"""Motor de ejecucion de flash loan arbitraje multi-cadena.
Interactua con el contrato FlashLoanArbitrage.sol desplegado en cada red.
Incluye gestion de riesgo, nonce management, y telemetria completa.
"""

import os
import sys
import json
import time
import asyncio
import logging
from datetime import datetime
from decimal import Decimal, getcontext

from web3 import Web3
from eth_abi import encode as abi_encode

from config import (
    REDES, RIESGO, CONTRATOS_DESPLEGADOS, CONTRACT_ABI,
    MODO_SIMULACION, PRIVATE_KEY,
    ROUTER_TYPE_V2, ROUTER_TYPE_V3,
    GRAY, RED, GREEN, YELLOW, BLUE, MAGENTA, CYAN, RESET,
)

getcontext().prec = 78


def obtener_prefijo_log():
    return f"{GRAY}[{datetime.now().strftime('%H:%M:%S')}]{RESET}"


# ===================================================================================
# GESTOR DE RIESGO
# ===================================================================================
class GestorRiesgo:
    """Control de riesgo con limites diarios, cooldowns y circuit breaker."""

    def __init__(self):
        self.limite_diario_usd = RIESGO['limite_diario_usd']
        self.max_exposicion_por_trade = RIESGO['max_exposicion_trade']
        self.max_perdida_consecutiva = RIESGO['max_perdidas_consecutivas']
        self.cooldown_post_trade_seg = RIESGO['cooldown_post_trade_seg']
        self.min_spread_profitable = RIESGO['min_spread_usd']
        self.max_spread_sospechoso = RIESGO['max_spread_sospechoso']
        self.max_slippage_pct = RIESGO['max_slippage_pct']

        self.gasto_diario_acumulado = Decimal("0")
        self.perdidas_consecutivas = 0
        self.ultimo_reset = datetime.utcnow().date()
        self.exposicion_actual = Decimal("0")
        self.historial_trades = []
        self.cooldowns = {}

        logging.info(
            f"[RIESGO] Init: limite_diario={self.limite_diario_usd} "
            f"max_exp={self.max_exposicion_por_trade} cooldown={self.cooldown_post_trade_seg}s"
        )

    def _reset_diario(self):
        hoy = datetime.utcnow().date()
        if hoy > self.ultimo_reset:
            logging.info(f"[RIESGO] Reset diario. Acumulado anterior: ${float(self.gasto_diario_acumulado):,.2f}")
            self.gasto_diario_acumulado = Decimal("0")
            self.perdidas_consecutivas = 0
            self.ultimo_reset = hoy

    def risk_ok(self, red, profit_neto_usd):
        """Evalua si un trade es seguro para ejecutar."""
        self._reset_diario()
        profit = Decimal(str(profit_neto_usd))

        if profit < self.min_spread_profitable:
            return False

        if profit > self.max_spread_sospechoso:
            logging.warning(f"[RIESGO] Profit sospechosamente alto en {red}: ${float(profit):,.2f}")
            return False

        if self.gasto_diario_acumulado + profit > self.limite_diario_usd:
            logging.warning(f"[RIESGO] Limite diario alcanzado: ${float(self.gasto_diario_acumulado):,.2f}")
            return False

        if self.perdidas_consecutivas >= self.max_perdida_consecutiva:
            logging.warning(f"[RIESGO] Circuit breaker: {self.perdidas_consecutivas} perdidas consecutivas")
            return False

        ahora = time.time()
        ultimo = self.cooldowns.get(red, 0)
        if (ahora - ultimo) < self.cooldown_post_trade_seg:
            return False

        return True

    def registrar_trade(self, red, exito, monto_usd, gas_cost_usd, tx_hash=""):
        self._reset_diario()
        self.cooldowns[red] = time.time()
        monto = Decimal(str(monto_usd))
        gas = Decimal(str(gas_cost_usd))

        trade = {
            'timestamp': datetime.utcnow().isoformat(),
            'red': red,
            'exito': exito,
            'monto_usd': float(monto),
            'gas_cost_usd': float(gas),
            'pnl': float(monto - gas) if exito else float(-gas),
            'tx_hash': tx_hash,
        }
        self.historial_trades.append(trade)

        if exito:
            self.gasto_diario_acumulado += monto
            self.perdidas_consecutivas = 0
            self.exposicion_actual = max(Decimal("0"), self.exposicion_actual - monto)
            logging.info(f"[RIESGO] EXITO {red}: +${float(monto):,.2f} gas=${float(gas):,.4f}")
        else:
            self.perdidas_consecutivas += 1
            self.gasto_diario_acumulado += gas
            logging.warning(f"[RIESGO] FALLO {red}: -${float(gas):,.4f} consecutivas={self.perdidas_consecutivas}")

    def obtener_stats(self):
        exitosas = sum(1 for t in self.historial_trades if t['exito'])
        fallidas = sum(1 for t in self.historial_trades if not t['exito'])
        pnl = sum(Decimal(str(t['pnl'])) for t in self.historial_trades)
        cooldowns_activos = sum(
            1 for ts in self.cooldowns.values()
            if (time.time() - ts) < self.cooldown_post_trade_seg
        )
        return {
            'ejecuciones_totales': len(self.historial_trades),
            'exitosas': exitosas,
            'fallidas': fallidas,
            'pnl_neto': float(pnl),
            'exposicion_actual': float(self.exposicion_actual),
            'limite_diario_restante': float(self.limite_diario_usd - self.gasto_diario_acumulado),
            'cooldowns_activos': cooldowns_activos,
            'perdidas_consecutivas': self.perdidas_consecutivas,
        }


# ===================================================================================
# MOTOR DE EJECUCION PRINCIPAL
# ===================================================================================
class MotorEjecucionPro:
    """
    Motor de ejecucion que interactua con el contrato FlashLoanArbitrage.sol.
    Construye la TX, la firma, la transmite, y espera confirmacion.
    """

    def __init__(self):
        self.risk = GestorRiesgo()
        self.cronometro_redes = {}
        self.conexiones_w3 = {}
        self.contratos = {}
        self.wallet_address = None
        self.private_key = None
        self.modo_simulacion = MODO_SIMULACION
        self.nonce_lock = asyncio.Lock()
        self.nonces = {}

    async def inicializar(self):
        """Inicializa conexiones Web3, wallet y contratos."""
        self.private_key = PRIVATE_KEY
        if not self.private_key:
            print(f"{obtener_prefijo_log()} {YELLOW}[MOTOR] PRIVATE_KEY ausente. Modo simulacion forzado.{RESET}")
            self.modo_simulacion = True
        else:
            try:
                account = Web3().eth.account.from_key(self.private_key)
                self.wallet_address = account.address
                print(
                    f"{obtener_prefijo_log()} {GREEN}[MOTOR] "
                    f"Wallet: {self.wallet_address[:6]}...{self.wallet_address[-4:]}{RESET}"
                )
            except Exception as e:
                print(f"{obtener_prefijo_log()} {RED}[MOTOR] Error wallet: {e}{RESET}")
                self.modo_simulacion = True

        if self.modo_simulacion:
            print(f"{obtener_prefijo_log()} {YELLOW}[MOTOR] MODO SIMULACION - No se transmiten TX reales{RESET}")

        # Conexiones y contratos por red
        for red, config in REDES.items():
            rpc_http = config.get('rpc_http', '')
            rpc_wss = config.get('rpc_wss', '')

            if rpc_http:
                w3 = Web3(Web3.HTTPProvider(rpc_http, request_kwargs={'timeout': 20}))
            elif rpc_wss:
                w3 = Web3(Web3.LegacyWebSocketProvider(
                    rpc_wss, websocket_kwargs={'ping_timeout': 10, 'close_timeout': 5}
                ))
            else:
                continue

            self.conexiones_w3[red] = w3

            contrato_addr = CONTRATOS_DESPLEGADOS.get(red, '')
            if contrato_addr:
                try:
                    self.contratos[red] = w3.eth.contract(
                        address=w3.to_checksum_address(contrato_addr),
                        abi=CONTRACT_ABI,
                    )
                    owner = await asyncio.to_thread(self.contratos[red].functions.owner().call)
                    print(
                        f"{obtener_prefijo_log()} {GREEN}[MOTOR] "
                        f"Contrato {red}: {contrato_addr[:10]}... (owner: {owner[:10]}...){RESET}"
                    )
                except Exception as e:
                    print(
                        f"{obtener_prefijo_log()} {RED}[MOTOR] "
                        f"Error verificando contrato {red}: {e}{RESET}"
                    )
                    self.contratos.pop(red, None)

        print(
            f"{obtener_prefijo_log()} {GREEN}[MOTOR] "
            f"{len(self.conexiones_w3)} conexiones | "
            f"{len(self.contratos)} contratos verificados{RESET}"
        )

    async def _obtener_nonce(self, red):
        async with self.nonce_lock:
            w3 = self.conexiones_w3.get(red)
            if not w3:
                return 0
            chain_id = REDES[red]['chain_id']
            try:
                nonce_actual = await asyncio.to_thread(
                    w3.eth.get_transaction_count, self.wallet_address, 'pending'
                )
                nonce_cached = self.nonces.get(chain_id, 0)
                nonce_final = max(nonce_actual, nonce_cached)
                self.nonces[chain_id] = nonce_final + 1
                return nonce_final
            except Exception:
                return self.nonces.get(chain_id, 0)

    async def _estimar_gas_price(self, red):
        """Retorna (eip1559_params, legacy_gas_price)."""
        w3 = self.conexiones_w3.get(red)
        if not w3:
            return None, None

        config = REDES[red]
        try:
            latest = await asyncio.to_thread(w3.eth.get_block, 'latest')
            base_fee = latest.get('baseFeePerGas')

            if base_fee is not None:
                max_priority = Web3.to_wei(float(config['max_priority_fee_gwei']), 'gwei')
                max_fee = base_fee * 2 + max_priority
                return {'maxFeePerGas': max_fee, 'maxPriorityFeePerGas': max_priority}, None
            else:
                gp = await asyncio.to_thread(lambda: w3.eth.gas_price)
                return None, gp
        except Exception:
            gp = await asyncio.to_thread(lambda: w3.eth.gas_price)
            return None, gp

    def _codificar_params_arbitraje(
        self, router_compra, router_venta, token_swap,
        fee_compra, fee_venta, amount_out_min_a, amount_out_min_b,
        tipo_router_compra, tipo_router_venta
    ):
        """
        Codifica los parametros del arbitraje para el contrato.
        Debe coincidir con el abi.decode del executeOperation del contrato.
        """
        return abi_encode(
            ['address', 'address', 'address', 'uint24', 'uint24', 'uint256', 'uint256', 'uint8', 'uint8'],
            [
                Web3.to_checksum_address(router_compra),
                Web3.to_checksum_address(router_venta),
                Web3.to_checksum_address(token_swap),
                fee_compra,
                fee_venta,
                amount_out_min_a,
                amount_out_min_b,
                tipo_router_compra,
                tipo_router_venta,
            ]
        )

    async def enviar_flashloan(
        self, red, token_base, token_swap,
        router_compra, router_venta,
        tipo_router_compra, tipo_router_venta,
        fee_compra, fee_venta,
        spread_usd, profit_neto_usd,
        precio_a, precio_b,
        flashloan_amount, contrato_addr,
    ):
        """
        Ejecuta un flash loan de arbitraje llamando al contrato desplegado.
        """
        config = REDES.get(red)
        if not config:
            logging.error(f"[MOTOR] Red no soportada: {red}")
            return

        self.cronometro_redes[red] = time.time()
        timestamp_inicio = time.time()

        logging.info(
            f"[MOTOR] === EJECUCION {red} === "
            f"Spread: ${spread_usd:,.4f} | Profit neto: ${profit_neto_usd:,.4f} | "
            f"Precios: ${precio_a:,.2f} / ${precio_b:,.2f} | "
            f"FL amount: {flashloan_amount}"
        )

        # --- SIMULACION ---
        if self.modo_simulacion:
            print(
                f"{obtener_prefijo_log()} {YELLOW}[SIMULACION] {red} - Flash loan simulado:{RESET}"
            )
            print(
                f"  {CYAN}Token base:{RESET} {token_base[:10]}... | "
                f"{CYAN}Token swap:{RESET} {token_swap[:10]}..."
            )
            print(
                f"  {CYAN}Router compra:{RESET} {router_compra[:10]}... ({'V2' if tipo_router_compra == 0 else 'V3'}) | "
                f"{CYAN}Router venta:{RESET} {router_venta[:10]}... ({'V2' if tipo_router_venta == 0 else 'V3'})"
            )
            print(
                f"  {CYAN}Spread:{RESET} ${spread_usd:,.4f} | "
                f"{CYAN}Profit neto:{RESET} ${profit_neto_usd:,.4f} | "
                f"{CYAN}FL amount:{RESET} {flashloan_amount / 1e6:,.2f} USDC"
            )
            print(
                f"  {CYAN}Fees:{RESET} compra={fee_compra} venta={fee_venta} | "
                f"{CYAN}Precios:{RESET} A=${precio_a:,.2f} B=${precio_b:,.2f}"
            )

            gas_est = config['gas_limit']
            gas_cost_sim = Decimal(gas_est) * Decimal("0.1e9") / Decimal(1E18) * Decimal("3450")
            profit_sim = Decimal(str(profit_neto_usd))

            if profit_sim > 0:
                print(f"  {GREEN}PROFITABLE: +${float(profit_sim):,.4f} (gas est: ${float(gas_cost_sim):,.4f}){RESET}")
                self.risk.registrar_trade(red, True, float(profit_sim), float(gas_cost_sim), "SIM")
            else:
                print(f"  {RED}NO PROFITABLE: ${float(profit_sim):,.4f}{RESET}")
                self.risk.registrar_trade(red, False, 0, float(gas_cost_sim), "SIM")

            elapsed = time.time() - timestamp_inicio
            print(f"  {GRAY}Tiempo: {elapsed:.3f}s{RESET}\n")
            sys.stdout.flush()
            return

        # --- PRODUCCION ---
        w3 = self.conexiones_w3.get(red)
        contrato = self.contratos.get(red)

        if not w3 or not self.wallet_address:
            logging.error(f"[MOTOR] No hay conexion o wallet para {red}")
            return

        if not contrato:
            logging.error(f"[MOTOR] No hay contrato desplegado para {red}")
            print(f"{obtener_prefijo_log()} {RED}[MOTOR] Contrato no desplegado en {red}. Despliega primero con deploy_contract.py{RESET}")
            return

        try:
            # 1. Calcular amount_out_min con slippage
            slippage = self.risk.max_slippage_pct / Decimal("100")
            amount_out_min_a = int(Decimal(flashloan_amount) * (Decimal("1") - slippage))
            amount_out_min_b = int(Decimal(flashloan_amount) * (Decimal("1") - slippage))

            # 2. Codificar parametros para el contrato
            params_encoded = self._codificar_params_arbitraje(
                router_compra=router_compra,
                router_venta=router_venta,
                token_swap=token_swap,
                fee_compra=fee_compra,
                fee_venta=fee_venta,
                amount_out_min_a=amount_out_min_a,
                amount_out_min_b=amount_out_min_b,
                tipo_router_compra=tipo_router_compra,
                tipo_router_venta=tipo_router_venta,
            )

            # 3. Construir TX via ABI del contrato
            tx_data = contrato.functions.ejecutarArbitraje(
                Web3.to_checksum_address(token_base),
                flashloan_amount,
                params_encoded,
            ).build_transaction({
                'from': self.wallet_address,
                'nonce': await self._obtener_nonce(red),
                'chainId': config['chain_id'],
                'gas': config['gas_limit'],
            })

            # 4. EIP-1559 o legacy gas
            eip1559, legacy = await self._estimar_gas_price(red)
            if eip1559:
                tx_data.update(eip1559)
            elif legacy:
                tx_data['gasPrice'] = legacy

            # 5. Estimar gas real
            try:
                gas_est = await asyncio.to_thread(w3.eth.estimate_gas, tx_data)
                tx_data['gas'] = int(gas_est * 1.25)  # 25% buffer
                print(
                    f"{obtener_prefijo_log()} {CYAN}[MOTOR] "
                    f"Gas estimado: {gas_est} (+25% = {tx_data['gas']}){RESET}"
                )
            except Exception as e:
                logging.warning(f"[MOTOR] estimate_gas fallo (puede revertir): {e}")
                print(
                    f"{obtener_prefijo_log()} {YELLOW}[MOTOR] "
                    f"estimate_gas fallo - TX probablemente revertira: {str(e)[:50]}{RESET}"
                )
                # Si estimate_gas falla, la TX probablemente revertira. Abortar.
                self.risk.registrar_trade(red, False, 0, 0, "EST_FAIL")
                return

            # 6. Firmar
            signed = w3.eth.account.sign_transaction(tx_data, self.private_key)

            # 7. Transmitir
            print(
                f"{obtener_prefijo_log()} {GREEN}[MOTOR] Transmitiendo TX a {red}...{RESET}"
            )
            tx_hash = await asyncio.to_thread(w3.eth.send_raw_transaction, signed.raw_transaction)
            tx_hash_hex = tx_hash.hex()

            explorer = config.get('explorer_tx', '')
            print(
                f"{obtener_prefijo_log()} {GREEN}[MOTOR] TX: {explorer}{tx_hash_hex}{RESET}"
            )
            logging.info(f"[MOTOR] TX enviada: {tx_hash_hex}")

            # 8. Esperar confirmacion
            print(f"{obtener_prefijo_log()} {CYAN}[MOTOR] Esperando confirmacion...{RESET}")

            try:
                receipt = await asyncio.wait_for(
                    asyncio.to_thread(
                        w3.eth.wait_for_transaction_receipt, tx_hash, timeout=120
                    ),
                    timeout=130,
                )

                gas_usado = receipt['gasUsed']
                gas_price_efectivo = receipt.get('effectiveGasPrice', legacy or 0)
                gas_cost_eth = Decimal(gas_usado) * Decimal(gas_price_efectivo) / Decimal(1E18)
                gas_cost_usd = gas_cost_eth * config.get('eth_price_ref', Decimal('3450'))

                if receipt['status'] == 1:
                    profit_real = Decimal(str(profit_neto_usd))
                    print(
                        f"{obtener_prefijo_log()} {GREEN}[MOTOR] "
                        f"TX EXITOSA {red}! Gas: {gas_usado} | "
                        f"Costo: ${float(gas_cost_usd):,.4f} | "
                        f"Profit: ${float(profit_real):,.4f}{RESET}"
                    )
                    self.risk.registrar_trade(red, True, float(profit_real), float(gas_cost_usd), tx_hash_hex)
                    logging.info(
                        f"[MOTOR] EXITO {red}: profit=${float(profit_real):,.4f} "
                        f"gas=${float(gas_cost_usd):,.4f} tx={tx_hash_hex}"
                    )
                else:
                    print(
                        f"{obtener_prefijo_log()} {RED}[MOTOR] "
                        f"TX REVERTIDA {red}! Gas perdido: ${float(gas_cost_usd):,.4f}{RESET}"
                    )
                    self.risk.registrar_trade(red, False, 0, float(gas_cost_usd), tx_hash_hex)
                    logging.error(f"[MOTOR] REVERT {red}: gas=${float(gas_cost_usd):,.4f} tx={tx_hash_hex}")

            except asyncio.TimeoutError:
                print(f"{obtener_prefijo_log()} {RED}[MOTOR] TIMEOUT {red}{RESET}")
                logging.error(f"[MOTOR] TIMEOUT {red}: tx={tx_hash_hex}")
                self.risk.registrar_trade(red, False, 0, 0, tx_hash_hex)

        except Exception as e:
            print(
                f"{obtener_prefijo_log()} {RED}[MOTOR] "
                f"Error critico {red}: {str(e)[:80]}{RESET}"
            )
            logging.critical(f"[MOTOR] Error critico {red}: {e}", exc_info=True)
            self.risk.registrar_trade(red, False, 0, 0, "ERROR")

        elapsed = time.time() - timestamp_inicio
        logging.info(f"[MOTOR] Ejecucion {red} completada en {elapsed:.3f}s")
        print(f"{obtener_prefijo_log()} {GRAY}[MOTOR] Tiempo: {elapsed:.3f}s{RESET}\n")
        sys.stdout.flush()

    def obtener_estadisticas(self):
        return self.risk.obtener_stats()

    def exportar_historial(self, filepath="historial_trades.json"):
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump({
                    'generado': datetime.utcnow().isoformat(),
                    'stats': self.obtener_estadisticas(),
                    'trades': self.risk.historial_trades,
                }, f, indent=2, ensure_ascii=False)
            logging.info(f"[MOTOR] Historial exportado a {filepath}")
        except Exception as e:
            logging.error(f"[MOTOR] Error exportando: {e}")
