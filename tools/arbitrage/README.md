# Módulo de Arbitraje Multi-Cadena

> **ADVERTENCIA DE SEGURIDAD**: Este módulo es **educativo/experimental**. El arbitraje real con flash loans requiere un contrato desplegado, capital para gas, protección contra MEV/sandwich y una estrategia probada. El modo simulación no transmite transacciones reales.

## Estructura

- `config.py` – selectores EVM, tokens, pools, redes y parámetros de riesgo.
- `motor_ejecucion.py` – gestor de riesgo, firma y transmisión de transacciones.
- `scanner.py` – monitoreo de spreads y disparador de flash loans.
- `FlashLoanArbitrage.sol` – contrato Solidity para Aave V3 flash loans.
- `.env.example` – variables de entorno necesarias.
- `requirements.txt` – dependencias Python.

## Instalación

```bash
cd nexus-os/tools/arbitrage
cp .env.example .env
# Edita .env con tus RPCs y, SOLO para producción, PRIVATE_KEY y contratos.
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Ejecución en simulación

```bash
python scanner.py
```

En simulación se leen los precios de los pools pero no se envían transacciones.

## Pasar a producción

1. Despliega `FlashLoanArbitrage.sol` en cada red con la dirección del `PoolAddressesProvider` de Aave V3.
2. Rellena `CONTRACT_*` y `PRIVATE_KEY` en `.env`.
3. Cambia `MODO_SIMULACION=false`.
4. Asegúrate de tener gas nativo (ETH/MATIC) en la wallet.

## Notas técnicas

- Los pools están configurados para ETH/USD aproximado. Verifica las direcciones en el explorador correspondiente.
- `token0` debe ser la dirección menor en orden lexicográfico (`0x... < 0x...`).
- `invertir_precio` se usa cuando `token0` es el stable (por ejemplo USDC/WETH) para obtener el precio en USD/ETH.
