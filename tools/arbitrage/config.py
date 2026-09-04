"""Configuracion centralizada de produccion para el motor de arbitraje multi-cadena.
Todas las direcciones, selectores y parametros de red en un solo lugar.
"""

import os
from decimal import Decimal
from dotenv import load_dotenv

load_dotenv()

# ===================================================================================
# SELECTORES EVM (keccak256 de la firma de funcion, primeros 4 bytes)
# ===================================================================================
SELECTOR_SLOT0 = '0x3850c7bd'           # slot0() - Uniswap V3, Aerodrome Slipstream
SELECTOR_GLOBAL_STATE = '0xe76c01e4'    # globalState() - Algebra (Camelot V3, QuickSwap V3)
SELECTOR_GET_RESERVES = '0x0902f1ac'    # getReserves() - Uniswap V2, SushiSwap, Camelot V2
SELECTOR_EJECUTAR = '0x6a686c04'        # ejecutarArbitraje(address,uint256,bytes)

# Pad selectores a 32 bytes para eth_call
CALLDATA_SLOT0 = SELECTOR_SLOT0 + '0' * 56
CALLDATA_GLOBAL_STATE = SELECTOR_GLOBAL_STATE + '0' * 56
CALLDATA_GET_RESERVES = SELECTOR_GET_RESERVES + '0' * 56

# ===================================================================================
# TIPOS DE POOL Y ROUTER
# ===================================================================================
POOL_TYPE_V3_UNI = 'v3_uniswap'     # usa slot0(), sqrtPriceX96
POOL_TYPE_V3_ALGEBRA = 'v3_algebra'  # usa globalState(), sqrtPriceX96
POOL_TYPE_V2 = 'v2'                  # usa getReserves(), reservas

ROUTER_TYPE_V2 = 0  # swapExactTokensForTokens
ROUTER_TYPE_V3 = 1  # exactInputSingle

# ===================================================================================
# TOKENS PRINCIPALES POR RED
# ===================================================================================
TOKENS = {
    'ARBITRUM': {
        'WETH':  '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
        'USDC':  '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',  # USDC nativo
        'USDCe': '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',  # USDC.e bridged
        'USDT':  '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        'ARB':   '0x912CE59144191C1204E64559FE8253a0e49E6548',
    },
    'BASE': {
        'WETH': '0x4200000000000000000000000000000000000006',
        'USDC': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',  # USDC nativo
        'USDbC': '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',  # USDbC bridged
    },
    'POLYGON': {
        'WETH':  '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
        'USDC':  '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',  # USDC nativo
        'USDCe': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',  # USDC.e bridged
        'WMATIC':'0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
        'USDT':  '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    },
}

# ===================================================================================
# CONFIGURACION DE REDES
# ===================================================================================
REDES = {
    'ARBITRUM': {
        'chain_id': 42161,
        'rpc_http': os.getenv('HTTP_ARBITRUM', ''),
        'rpc_wss': os.getenv('WSS_ARBITRUM', ''),
        'explorer_tx': 'https://arbiscan.io/tx/',
        'aave_pool_provider': '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb',
        'gas_limit': 700000,
        'max_priority_fee_gwei': Decimal('0.1'),
        'eth_price_ref': Decimal('3450'),
    },
    'BASE': {
        'chain_id': 8453,
        'rpc_http': os.getenv('HTTP_BASE', ''),
        'rpc_wss': os.getenv('WSS_BASE', ''),
        'explorer_tx': 'https://basescan.org/tx/',
        'aave_pool_provider': '0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D',
        'gas_limit': 600000,
        'max_priority_fee_gwei': Decimal('0.005'),
        'eth_price_ref': Decimal('3450'),
    },
    'POLYGON': {
        'chain_id': 137,
        'rpc_http': os.getenv('HTTP_POLYGON', ''),
        'rpc_wss': os.getenv('WSS_POLYGON', ''),
        'explorer_tx': 'https://polygonscan.com/tx/',
        'aave_pool_provider': '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb',
        'gas_limit': 800000,
        'max_priority_fee_gwei': Decimal('30'),
        'eth_price_ref': Decimal('3450'),
    },
}

# ===================================================================================
# CONFIGURACION DE POOLS DE MONITOREO
#
# IMPORTANTE: Verificar TODAS las direcciones de pool en el block explorer
# correspondiente antes de operar en produccion. Los pools pueden migrar
# o perder liquidez. Confirmar token0/token1 y fee tier.
#
# token0 es siempre la direccion menor (hex).
# El decoder necesita saber el orden para calcular el precio correctamente.
# ===================================================================================
POOLS = {
    'ARBITRUM': [
        {
            'name': 'Uniswap V3',
            'pool': '0xC6962004f452bE9203591991D15f6b388e09E8D0',   # WETH/USDC 0.05%
            'type': POOL_TYPE_V3_UNI,
            'fee': 500,
            'router': '0xE592427A0AEce92De3Edee1F18E0157C05861564',  # Uniswap V3 SwapRouter
            'router_type': ROUTER_TYPE_V3,
            'token0': TOKENS['ARBITRUM']['WETH'],   # 0x82... < 0xaf...
            'token1': TOKENS['ARBITRUM']['USDC'],
            'token0_decimals': 18,
            'token1_decimals': 6,
            'invertir_precio': False,  # token0=WETH: precio = USDC/WETH (precio ETH en USD)
        },
        {
            'name': 'Camelot V3',
            'pool': '0xb1026b8e7276e7ac75410f1fcbbe21796e8f7526',   # WETH/USDC Camelot V3 (Algebra)
            'type': POOL_TYPE_V3_ALGEBRA,
            'fee': 500,
            'router': '0x1F721E2E82F6676FCE4eA07A5958cF098D339e18',  # Camelot V3 Router
            'router_type': ROUTER_TYPE_V3,
            'token0': TOKENS['ARBITRUM']['WETH'],
            'token1': TOKENS['ARBITRUM']['USDC'],
            'token0_decimals': 18,
            'token1_decimals': 6,
            'invertir_precio': False,
        },
    ],
    'BASE': [
        {
            'name': 'Uniswap V3',
            'pool': '0xd0b53D9277642d899DF5C87A3966A349A798F224',   # WETH/USDC 0.05%
            'type': POOL_TYPE_V3_UNI,
            'fee': 500,
            'router': '0x2626664c2603336E57B271c5C0b26F421741e481',  # Uniswap V3 SwapRouter02 (Base)
            'router_type': ROUTER_TYPE_V3,
            'token0': TOKENS['BASE']['WETH'],   # 0x42... < 0x83...
            'token1': TOKENS['BASE']['USDC'],
            'token0_decimals': 18,
            'token1_decimals': 6,
            'invertir_precio': False,
        },
        {
            'name': 'Aerodrome CL',
            'pool': '0xb4CB800910B228ED3d0834cF79D697127BBB00e5',   # WETH/USDC Aerodrome Slipstream
            'type': POOL_TYPE_V3_UNI,   # Aerodrome Slipstream usa slot0() compatible Uni V3
            'fee': 500,
            'router': '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43',  # Aerodrome Router
            'router_type': ROUTER_TYPE_V2,  # Aerodrome Router usa interfaz V2
            'token0': TOKENS['BASE']['WETH'],
            'token1': TOKENS['BASE']['USDC'],
            'token0_decimals': 18,
            'token1_decimals': 6,
            'invertir_precio': False,
        },
    ],
    'POLYGON': [
        {
            'name': 'Uniswap V3',
            'pool': '0x45dDa9cb7c25131DF268515131f647d726f50608',   # USDC/WETH 0.05%
            'type': POOL_TYPE_V3_UNI,
            'fee': 500,
            'router': '0xE592427A0AEce92De3Edee1F18E0157C05861564',  # Uniswap V3 SwapRouter
            'router_type': ROUTER_TYPE_V3,
            'token0': TOKENS['POLYGON']['USDC'],   # 0x3c... < 0x7c...
            'token1': TOKENS['POLYGON']['WETH'],
            'token0_decimals': 6,
            'token1_decimals': 18,
            'invertir_precio': True,  # token0=USDC: precio raw = WETH/USDC, invertir para ETH/USD
        },
        {
            'name': 'QuickSwap V3',
            'pool': '0x55caabb0d2b704fd0ef8192a7e35d8837e678207',   # USDCe/WETH QuickSwap V3 (Algebra)
            'type': POOL_TYPE_V3_ALGEBRA,
            'fee': 500,
            'router': '0xf5b509bB0909a69B1c207E495f687a596C168E12',  # QuickSwap V3 SwapRouter
            'router_type': ROUTER_TYPE_V3,
            'token0': TOKENS['POLYGON']['USDCe'],
            'token1': TOKENS['POLYGON']['WETH'],
            'token0_decimals': 6,
            'token1_decimals': 18,
            'invertir_precio': True,
        },
    ],
}

# ===================================================================================
# PARAMETROS DE RIESGO (desde .env o defaults conservadores)
# ===================================================================================
RIESGO = {
    'limite_diario_usd': Decimal(os.getenv('LIMITE_DIARIO_USD', '5000')),
    'max_exposicion_trade': Decimal(os.getenv('MAX_EXPOSICION_TRADE', '2000')),
    'max_perdidas_consecutivas': int(os.getenv('MAX_PERDIDAS_CONSECUTIVAS', '3')),
    'cooldown_post_trade_seg': int(os.getenv('COOLDOWN_POST_TRADE', '120')),
    'min_spread_usd': Decimal(os.getenv('MIN_SPREAD_USD', '0.50')),
    'max_spread_sospechoso': Decimal(os.getenv('MAX_SPREAD_SOSPECHOSO', '500')),
    'max_slippage_pct': Decimal(os.getenv('MAX_SLIPPAGE_PCT', '0.5')),
    'flashloan_amount_usdc': int(os.getenv('FLASHLOAN_AMOUNT_USDC', '10000')),  # Monto base del flash loan
}

# ===================================================================================
# ABI MINIMA DEL CONTRATO FlashLoanArbitrage (solo funciones que llama el bot)
# ===================================================================================
CONTRACT_ABI = [
    {
        "inputs": [
            {"name": "asset", "type": "address"},
            {"name": "amount", "type": "uint256"},
            {"name": "params", "type": "bytes"}
        ],
        "name": "ejecutarArbitraje",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "router", "type": "address"},
            {"name": "amountIn", "type": "uint256"},
            {"name": "tokenIn", "type": "address"},
            {"name": "tokenOut", "type": "address"}
        ],
        "name": "consultarAmountsOutV2",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "consultarPremiumFlashLoan",
        "outputs": [{"name": "", "type": "uint128"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"name": "token", "type": "address"}],
        "name": "rescatarTokens",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "rescatarETH",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [{"name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "POOL",
        "outputs": [{"name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    },
]

# ===================================================================================
# DIRECCION DEL CONTRATO DESPLEGADO (por red)
# ===================================================================================
CONTRATOS_DESPLEGADOS = {
    'ARBITRUM': os.getenv('CONTRACT_ARBITRUM', ''),
    'BASE': os.getenv('CONTRACT_BASE', ''),
    'POLYGON': os.getenv('CONTRACT_POLYGON', ''),
}

# ===================================================================================
# MODO DE OPERACION
# ===================================================================================
MODO_SIMULACION = os.getenv('MODO_SIMULACION', 'true').lower() == 'true'
PRIVATE_KEY = os.getenv('PRIVATE_KEY', '')

# ===================================================================================
# COLORES ANSI
# ===================================================================================
GRAY    = "\033[1;30m"
RED     = "\033[1;31m"
GREEN   = "\033[1;32m"
YELLOW  = "\033[1;33m"
BLUE    = "\033[1;34m"
MAGENTA = "\033[1;35m"
CYAN    = "\033[1;36m"
RESET   = "\033[0m"
