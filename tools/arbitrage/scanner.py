"""Scanner multi-cadena de arbitraje en tiempo real.
Monitorea spreads entre DEXs en Arbitrum, Base y Polygon.
Transmite flash loans via contrato desplegado cuando detecta oportunidad profitable.
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
    REDES, POOLS, TOKENS, RIESGO, CONTRATOS_DESPLEGADOS,
    MODO_SIMULACION, PRIVATE_KEY,
    POOL_TYPE_V3_UNI, POOL_TYPE_V3_ALGEBRA, POOL_TYPE_V2,
    CALLDATA_SLOT0, CALLDATA_GLOBAL_STATE, CALLDATA_GET_RESERVES,
    ROUTER_TYPE_V2, ROUTER_TYPE_V3,
    GRAY, RED, GREEN, YELLOW, BLUE, MAGENTA, CYAN, RESET,
)

getcontext().prec = 78

try:
    from web3.middleware import ExtraDataToPOAMiddleware as poa_middleware
except ImportError:
    try:
        from web3.middleware import geth_poa_middleware as poa_middleware
    except ImportError:
        poa_middleware = None

# Configuracion ANSI
if os.name == 'nt':
    os.system("color")
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# --- LOGGING ---
logger = logging.getLogger()
logger.setLevel(logging.INFO)
if logger.hasHandlers():
    logger.handlers.clear()

file_handler = logging.FileHandler("auditoria_ejecucion.log", encoding='utf-8')
file_handler.setFormatter(logging.Formatter('%(asctime)s - [%(levelname)s] - %(message)s'))
logger.addHandler(file_handler)

stream_handler = logging.StreamHandler(sys.stdout)
stream_handler.setFormatter(logging.Formatter('%(message)s'))
logger.addHandler(stream_handler)

# --- MOTOR DE EJECUCION ---
try:
    from motor_ejecucion import MotorEjecucionPro
    ejecutor_maestro = MotorEjecucionPro()
except ImportError as e:
    print(f"{RED}[-] Error fatal al importar motor_ejecucion.py: {e}{RESET}")
    sys.exit(1)

congelador_visual = False
MAX_REASONABLE_SPREAD = Decimal("1000.00")


def usd(v):
    return f"${float(v):,.2f}"


def usd_c(v):
    return f"${float(v):,.4f}"


def obtener_prefijo_log():
    return f"{GRAY}[{datetime.now().strftime('%H:%M:%S')}]{RESET}"


# ===================================================================================
# DECODIFICADORES DE PRECIO EVM
# ===================================================================================

def decodificar_sqrtPriceX96(payload_bytes, d0, d1, invertir=False):
    """
    Decodifica sqrtPriceX96 de slot0() o globalState().
    Ambos devuelven sqrtPriceX96 como primer uint160 (32 bytes padded).

    Args:
        payload_bytes: Bytes crudos del eth_call
        d0: Decimales del token0
        d1: Decimales del token1
        invertir: Si True, devuelve 1/precio (para pools donde USDC es token0)
    Returns:
        Precio en USD/ETH o None si error
    """
    if not payload_bytes or len(payload_bytes) < 32:
        return None
    try:
        sqrt = int.from_bytes(payload_bytes[:32], byteorder='big')
        if sqrt == 0:
            return None

        # precio_raw = (sqrtPriceX96 / 2^96)^2
        # precio_ajustado = precio_raw * 10^(d0 - d1)
        precio_raw = (Decimal(sqrt) / Decimal(2**96)) ** 2
        factor_decimal = Decimal(10 ** (d0 - d1))
        precio = precio_raw * factor_decimal

        if precio <= 0:
            return None

        if invertir:
            precio = Decimal(1) / precio

        # Sanity check: ETH deberia estar entre $100 y $100,000
        if precio < 100 or precio > 100000:
            return None

        return precio
    except Exception:
        return None


def decodificar_reserves_v2(payload_bytes, d0, d1, invertir=False):
    """
    Decodifica getReserves() para pools V2.
    Retorna precio de token0 en terminos de token1.
    """
    if not payload_bytes or len(payload_bytes) < 64:
        return None
    try:
        r0 = int.from_bytes(payload_bytes[:32], byteorder='big')
        r1 = int.from_bytes(payload_bytes[32:64], byteorder='big')
        if r0 == 0 or r1 == 0:
            return None

        reserva0 = Decimal(r0) / Decimal(10**d0)
        reserva1 = Decimal(r1) / Decimal(10**d1)

        # precio = token1_per_token0
        precio = reserva1 / reserva0

        if invertir:
            precio = Decimal(1) / precio

        if precio < 100 or precio > 100000:
            return None

        return precio
    except Exception:
        return None


def obtener_calldata_pool(pool_config):
    """Retorna el calldata correcto segun el tipo de pool."""
    pool_type = pool_config['type']
    if pool_type == POOL_TYPE_V3_UNI:
        return CALLDATA_SLOT0
    elif pool_type == POOL_TYPE_V3_ALGEBRA:
        return CALLDATA_GLOBAL_STATE
    elif pool_type == POOL_TYPE_V2:
        return CALLDATA_GET_RESERVES
    return CALLDATA_SLOT0


def decodificar_precio_pool(payload_bytes, pool_config):
    """Decodifica el precio segun el tipo de pool."""
    pool_type = pool_config['type']
    d0 = pool_config['token0_decimals']
    d1 = pool_config['token1_decimals']
    invertir = pool_config.get('invertir_precio', False)

    if pool_type in (POOL_TYPE_V3_UNI, POOL_TYPE_V3_ALGEBRA):
        return decodificar_sqrtPriceX96(payload_bytes, d0, d1, invertir)
    elif pool_type == POOL_TYPE_V2:
        return decodificar_reserves_v2(payload_bytes, d0, d1, invertir)
    return None


# ===================================================================================
# CONEXION WEB3 CON RECONEXION AUTOMATICA
# ===================================================================================

class ConexionWeb3:
    """Wrapper de Web3 con reconexion automatica y fallback HTTP/WSS."""

    def __init__(self, red_nombre, config):
        self.red = red_nombre
        self.config = config
        self.w3 = None
        self.intentos_reconexion = 0
        self.max_intentos = 5
        self.usando_http = False
        self._conectar()

    def _conectar(self):
        rpc_http = self.config.get('rpc_http', '')
        rpc_wss = self.config.get('rpc_wss', '')

        # Preferir HTTP para polling (mas estable en produccion)
        if rpc_http:
            self.w3 = Web3(Web3.HTTPProvider(
                rpc_http,
                request_kwargs={'timeout': 15}
            ))
            self.usando_http = True
        elif rpc_wss:
            self.w3 = Web3(Web3.LegacyWebSocketProvider(
                rpc_wss,
                websocket_kwargs={'ping_timeout': 10, 'close_timeout': 5}
            ))
            self.usando_http = False
        else:
            raise ValueError(f"No hay RPC configurado para {self.red}")

        # POA middleware para Polygon
        if self.red == 'POLYGON' and poa_middleware and self.w3:
            self.w3.middleware_onion.inject(poa_middleware, layer=0)

        self.intentos_reconexion = 0

    async def reconectar(self):
        self.intentos_reconexion += 1
        if self.intentos_reconexion > self.max_intentos:
            wait_time = min(60, 2 ** self.intentos_reconexion)
            print(
                f"{obtener_prefijo_log()} {RED}[{self.red}] "
                f"Max reconexiones alcanzadas. Esperando {wait_time}s...{RESET}"
            )
            await asyncio.sleep(wait_time)
            self.intentos_reconexion = 0

        try:
            self._conectar()
            print(
                f"{obtener_prefijo_log()} {GREEN}[{self.red}] "
                f"Reconexion exitosa (intento #{self.intentos_reconexion}){RESET}"
            )
        except Exception as e:
            print(
                f"{obtener_prefijo_log()} {RED}[{self.red}] "
                f"Reconexion fallida: {str(e)[:40]}{RESET}"
            )

    async def eth_call(self, to, data):
        return await asyncio.to_thread(self.w3.eth.call, {'to': to, 'data': data})

    async def block_number(self):
        return await asyncio.to_thread(lambda: self.w3.eth.block_number)

    async def gas_price(self):
        return await asyncio.to_thread(lambda: self.w3.eth.gas_price)

    async def get_block(self, block_id='latest'):
        return await asyncio.to_thread(self.w3.eth.get_block, block_id)


# ===================================================================================
# BANNER
# ===================================================================================
def mostrar_banner():
    if os.name == 'nt':
        os.system('cls')
    else:
        sys.stdout.write('\033c')
        sys.stdout.flush()
    print(f"{CYAN}" + r" ██████╗ ███╗   ███╗ █████╗ ████████╗██╗ ██████╗██╗  ██╗   ███╗   ███╗██████╗██╗   ██╗" + f"{RESET}")
    print(f"{CYAN}" + r"██╔═══██╗████╗ ████║██╔══██╗╚══██╔══╝██║██╔════╝██║  ██║   ████╗ ████║██╔═══╝██║   ██║" + f"{RESET}")
    print(f"{CYAN}" + r"██║   ██║██╔████╔██║███████║   ██║   ██║██║     ███████║   ██╔████╔██║█████╗ ╚██╗ ██╔╝" + f"{RESET}")
    print(f"{CYAN}" + r"██║   ██║██║╚██╔╝██║██╔══██║   ██║   ██║██║     ██╔══██║   ██║╚██╔╝██║██╔══╝  ╚████╔╝ " + f"{RESET}")
    print(f"{CYAN}" + r"╚██████╔╝██║ ╚═╝ ██║██║  ██║   ██║   ██║╚██████╗██║  ██║   ██║ ╚═╝ ██║███████╗ ╚██╔╝  " + f"{RESET}")
    print(f"{CYAN}" + r" ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝ ╚═════╝╚═╝  ╚═╝   ╚═╝     ╚═╝╚══════╝  ╚═╝   " + f" {YELLOW}v4.0.0_PROD{RESET}")
    print(f"{YELLOW}{'=' * 87}{RESET}")
    modo_txt = f"{YELLOW}SIMULACION{RESET}" if MODO_SIMULACION else f"{RED}PRODUCCION{RESET}"
    print(f" {GREEN}ENGINE STATUS: ACTIVE{RESET} | {CYAN}MODE: {modo_txt}{RESET} | {MAGENTA}EVM: CRUDE RAW BYPASS{RESET}")
    print(f" {YELLOW}ANTI-SANDWICH PRIVATE INJECTION PIPELINE OPERATIONAL{RESET}")
    print(f"{YELLOW}{'=' * 87}\n{RESET}")
    sys.stdout.flush()


# ===================================================================================
# HILO GENERICO DE MONITOREO POR RED
# ===================================================================================

async def thread_red(red_nombre):
    """
    Hilo de monitoreo generico para cualquier red.
    Lee la configuracion de pools desde config.py y escanea spreads.
    """
    global congelador_visual

    config_red = REDES.get(red_nombre)
    pools = POOLS.get(red_nombre, [])

    if not config_red or len(pools) < 2:
        print(f"{obtener_prefijo_log()} {RED}[{red_nombre}] Config insuficiente (necesita >= 2 pools){RESET}")
        return

    # Verificar que hay RPC disponible
    if not config_red.get('rpc_http') and not config_red.get('rpc_wss'):
        print(f"{obtener_prefijo_log()} {RED}[{red_nombre}] No hay RPC configurado{RESET}")
        return

    color_red = {
        'ARBITRUM': CYAN,
        'BASE': BLUE,
        'POLYGON': MAGENTA,
    }.get(red_nombre, GRAY)

    try:
        conn = ConexionWeb3(red_nombre, config_red)
    except ValueError as e:
        print(f"{obtener_prefijo_log()} {RED}[{red_nombre}] {e}{RESET}")
        return

    pool_a = pools[0]
    pool_b = pools[1]
    addr_a = conn.w3.to_checksum_address(pool_a['pool'])
    addr_b = conn.w3.to_checksum_address(pool_b['pool'])
    calldata_a = obtener_calldata_pool(pool_a)
    calldata_b = obtener_calldata_pool(pool_b)

    # Tokens para flash loan
    usdc_addr = TOKENS[red_nombre].get('USDC', '')
    weth_addr = TOKENS[red_nombre].get('WETH', '')
    contrato_addr = CONTRATOS_DESPLEGADOS.get(red_nombre, '')

    backoff = 1.5
    errores_consecutivos = 0

    print(
        f"{obtener_prefijo_log()} {color_red}[{red_nombre}] "
        f"Monitoreando: {pool_a['name']} vs {pool_b['name']}{RESET}"
    )

    while True:
        try:
            if congelador_visual:
                await asyncio.sleep(0.5)
                continue

            # Consultas en paralelo
            bloque_task = asyncio.create_task(conn.block_number())
            res_a_task = asyncio.create_task(conn.eth_call(addr_a, calldata_a))
            res_b_task = asyncio.create_task(conn.eth_call(addr_b, calldata_b))
            gas_task = asyncio.create_task(conn.gas_price())

            bloque, res_a, res_b, gas_price_raw = await asyncio.gather(
                bloque_task, res_a_task, res_b_task, gas_task
            )

            # Decodificar precios
            precio_a = decodificar_precio_pool(res_a, pool_a)
            precio_b = decodificar_precio_pool(res_b, pool_b)

            if precio_a is None or precio_b is None:
                logging.debug(f"[{red_nombre}] Precio nulo: A={precio_a} B={precio_b}")
                await asyncio.sleep(2)
                continue

            # Calcular spread y profitabilidad
            spread = abs(precio_a - precio_b)
            eth_price_ref = config_red.get('eth_price_ref', Decimal('3450'))
            gas_limit = config_red['gas_limit']
            gas_cost_usd = (
                Decimal(gas_limit) * Decimal(gas_price_raw) / Decimal(1E18)
            ) * eth_price_ref

            # Profit neto estimado sobre el monto del flash loan
            flashloan_amount = Decimal(str(RIESGO['flashloan_amount_usdc']))
            spread_pct = spread / precio_a if precio_a > 0 else Decimal(0)
            profit_bruto = flashloan_amount * spread_pct
            premium_aave = flashloan_amount * Decimal('0.0005')  # 0.05% premium
            profit_neto = profit_bruto - gas_cost_usd - premium_aave

            errores_consecutivos = 0
            backoff = 1.5

            if profit_neto > 0 and spread < MAX_REASONABLE_SPREAD:
                t_actual = time.time()
                cron = ejecutor_maestro.cronometro_redes.get(red_nombre, 0)
                cooldown = RIESGO['cooldown_post_trade_seg']

                if (t_actual - cron) >= cooldown and ejecutor_maestro.risk.risk_ok(red_nombre, float(profit_neto)):
                    congelador_visual = True
                    print(
                        f"\n{obtener_prefijo_log()} {RED}[GATILLO VALIDADO] "
                        f"Transmitiendo flash loan a {red_nombre}...{RESET}"
                    )
                    print(
                        f"  {CYAN}Spread: {usd_c(spread)} | "
                        f"Profit bruto: {usd_c(profit_bruto)} | "
                        f"Gas: {usd_c(gas_cost_usd)} | "
                        f"Premium: {usd_c(premium_aave)} | "
                        f"Neto: {GREEN}{usd_c(profit_neto)}{RESET}"
                    )

                    # Determinar direccion del arbitraje
                    if precio_a < precio_b:
                        # Comprar en A (mas barato), vender en B (mas caro)
                        router_compra = pool_a['router']
                        router_venta = pool_b['router']
                        tipo_compra = pool_a['router_type']
                        tipo_venta = pool_b['router_type']
                        fee_compra = pool_a['fee']
                        fee_venta = pool_b['fee']
                    else:
                        # Comprar en B, vender en A
                        router_compra = pool_b['router']
                        router_venta = pool_a['router']
                        tipo_compra = pool_b['router_type']
                        tipo_venta = pool_a['router_type']
                        fee_compra = pool_b['fee']
                        fee_venta = pool_a['fee']

                    await ejecutor_maestro.enviar_flashloan(
                        red=red_nombre,
                        token_base=usdc_addr,
                        token_swap=weth_addr,
                        router_compra=router_compra,
                        router_venta=router_venta,
                        tipo_router_compra=tipo_compra,
                        tipo_router_venta=tipo_venta,
                        fee_compra=fee_compra,
                        fee_venta=fee_venta,
                        spread_usd=float(spread),
                        profit_neto_usd=float(profit_neto),
                        precio_a=float(precio_a),
                        precio_b=float(precio_b),
                        flashloan_amount=int(flashloan_amount * Decimal(1E6)),  # USDC 6 decimales
                        contrato_addr=contrato_addr,
                    )
                    congelador_visual = False
                else:
                    if (t_actual - cron) < cooldown:
                        restante = int(cooldown - (t_actual - cron))
                        print(
                            f"{obtener_prefijo_log()} {YELLOW}[{red_nombre} #{bloque}] "
                            f"OPORTUNIDAD pero cooldown activo ({restante}s) | "
                            f"Neto: {GREEN}{usd_c(profit_neto)}{RESET}"
                        )
            else:
                print(
                    f"{obtener_prefijo_log()} {GRAY}[{red_nombre} #{bloque}] "
                    f"{pool_a['name']}: {usd(precio_a)} | "
                    f"{pool_b['name']}: {usd(precio_b)} | "
                    f"Neto: {RED}{usd_c(profit_neto)}{RESET}"
                )

            sys.stdout.flush()
            await asyncio.sleep(backoff)

        except Exception as e:
            errores_consecutivos += 1
            backoff = min(30, 1.5 * (2 ** min(errores_consecutivos, 5)))

            print(
                f"{obtener_prefijo_log()} {RED}[{red_nombre} ERROR #{errores_consecutivos}] "
                f"{str(e)[:60]}...{RESET}"
            )
            logging.error(f"[{red_nombre}] Error: {e}", exc_info=(errores_consecutivos <= 2))
            sys.stdout.flush()

            if errores_consecutivos >= 5:
                print(
                    f"{obtener_prefijo_log()} {YELLOW}[{red_nombre}] "
                    f"Reconectando...{RESET}"
                )
                await conn.reconectar()

            await asyncio.sleep(backoff)


# ===================================================================================
# HILO DE TELEMETRIA Y ESTADISTICAS
# ===================================================================================
async def thread_telemetria():
    inicio_sesion = time.time()

    while True:
        await asyncio.sleep(60)
        try:
            uptime = int(time.time() - inicio_sesion)
            h, rem = divmod(uptime, 3600)
            m, s = divmod(rem, 60)

            stats = ejecutor_maestro.obtener_estadisticas()

            print(f"\n{YELLOW}{'=' * 87}{RESET}")
            pnl_color = GREEN if stats['pnl_neto'] >= 0 else RED
            print(
                f"{obtener_prefijo_log()} {CYAN}[TELEMETRIA] "
                f"Uptime: {h:02d}:{m:02d}:{s:02d} | "
                f"Ejecuciones: {stats['ejecuciones_totales']} | "
                f"Exitosas: {GREEN}{stats['exitosas']}{RESET} | "
                f"Fallidas: {RED}{stats['fallidas']}{RESET} | "
                f"P&L: {pnl_color}{usd(stats['pnl_neto'])} | "
                f"Exposicion: {usd(stats['exposicion_actual'])}"
            )
            print(f"{YELLOW}{'=' * 87}\n{RESET}")
            sys.stdout.flush()
        except Exception:
            pass


# ===================================================================================
# HILO DE HEARTBEAT
# ===================================================================================
async def thread_heartbeat():
    while True:
        await asyncio.sleep(30)
        for red_nombre, config in REDES.items():
            rpc = config.get('rpc_http') or config.get('rpc_wss')
            if not rpc:
                continue
            try:
                w3_check = Web3(Web3.HTTPProvider(rpc, request_kwargs={'timeout': 5})) if config.get('rpc_http') else Web3(Web3.LegacyWebSocketProvider(rpc, websocket_kwargs={'ping_timeout': 5, 'close_timeout': 3}))
                bloque = await asyncio.to_thread(lambda w=w3_check: w.eth.block_number)
                logging.debug(f"[HEARTBEAT] {red_nombre} OK - Bloque #{bloque}")
            except Exception as e:
                print(
                    f"{obtener_prefijo_log()} {RED}[HEARTBEAT] "
                    f"{red_nombre} SIN RESPUESTA: {str(e)[:40]}{RESET}"
                )
                logging.error(f"[HEARTBEAT] {red_nombre} desconectado: {e}")


# ===================================================================================
# VALIDACIONES PRE-ARRANQUE
# ===================================================================================
async def validar_prerequisitos():
    """Valida que todo este configurado antes de arrancar."""
    errores = []

    # Verificar RPCs
    redes_activas = []
    for red_nombre, config in REDES.items():
        if config.get('rpc_http') or config.get('rpc_wss'):
            redes_activas.append(red_nombre)
        else:
            print(f"{obtener_prefijo_log()} {YELLOW}[INIT] {red_nombre}: Sin RPC configurado (deshabilitada){RESET}")

    if not redes_activas:
        errores.append("No hay ninguna red con RPC configurado")

    # Verificar pools
    for red in redes_activas:
        pools = POOLS.get(red, [])
        if len(pools) < 2:
            errores.append(f"{red}: Necesita al menos 2 pools configurados ({len(pools)} encontrados)")

    # Verificar wallet
    if not MODO_SIMULACION:
        if not PRIVATE_KEY:
            errores.append("PRIVATE_KEY no configurada (necesaria para modo produccion)")
        for red in redes_activas:
            if not CONTRATOS_DESPLEGADOS.get(red):
                errores.append(f"CONTRACT_{red} no configurado (necesario para modo produccion)")

    if errores:
        print(f"\n{RED}{'=' * 60}{RESET}")
        print(f"{RED}ERRORES DE CONFIGURACION:{RESET}")
        for err in errores:
            print(f"  {RED}- {err}{RESET}")
        print(f"{RED}{'=' * 60}\n{RESET}")

        if not MODO_SIMULACION:
            print(f"{RED}Corrige los errores o activa MODO_SIMULACION=true{RESET}")
            sys.exit(1)

    return redes_activas


# ===================================================================================
# ORQUESTADOR PRINCIPAL
# ===================================================================================
async def main():
    mostrar_banner()

    print(f"{obtener_prefijo_log()} {GREEN}[INIT] Validando prerequisitos...{RESET}")
    redes_activas = await validar_prerequisitos()

    print(f"{obtener_prefijo_log()} {GREEN}[INIT] Inicializando motor de ejecucion...{RESET}")
    await ejecutor_maestro.inicializar()

    tasks = []
    for red in redes_activas:
        tasks.append(asyncio.create_task(thread_red(red)))

    print(
        f"{obtener_prefijo_log()} {GREEN}[INIT] "
        f"Redes activas: {', '.join(redes_activas)} "
        f"({len(tasks)} hilos de monitoreo){RESET}"
    )

    tasks.append(asyncio.create_task(thread_telemetria()))
    tasks.append(asyncio.create_task(thread_heartbeat()))

    print(f"{obtener_prefijo_log()} {GREEN}[INIT] Sistema operativo. Escaneando spreads...{RESET}\n")
    sys.stdout.flush()
    logging.info(f"[SESION] Motor iniciado: redes={', '.join(redes_activas)} modo={'SIM' if MODO_SIMULACION else 'PROD'}")

    try:
        await asyncio.gather(*tasks, return_exceptions=True)
    except KeyboardInterrupt:
        print(f"\n{obtener_prefijo_log()} {YELLOW}[SHUTDOWN] Deteniendo...{RESET}")
        stats_final = ejecutor_maestro.obtener_estadisticas()
        print(
            f"{obtener_prefijo_log()} {CYAN}[RESUMEN] "
            f"Ejecuciones: {stats_final['ejecuciones_totales']} | "
            f"P&L: {usd(stats_final['pnl_neto'])}{RESET}"
        )
        ejecutor_maestro.exportar_historial()
        logging.info(f"[SESION] Cierre limpio. Stats: {json.dumps(stats_final)}")
        for task in tasks:
            task.cancel()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print(f"\n{YELLOW}[EXIT] Motor detenido por el usuario.{RESET}")
    except Exception as e:
        print(f"\n{RED}[FATAL] Error irrecuperable: {e}{RESET}")
        logging.critical(f"[FATAL] {e}", exc_info=True)
        sys.exit(1)
