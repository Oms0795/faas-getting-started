// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ============================================================================
// INTERFACES MINIMAS INLINE (sin dependencias externas)
// ============================================================================

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface IPoolAddressesProvider {
    function getPool() external view returns (address);
}

interface IPool {
    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external;

    function FLASHLOAN_PREMIUM_TOTAL() external view returns (uint128);
}

interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function getAmountsOut(
        uint256 amountIn,
        address[] calldata path
    ) external view returns (uint256[] memory amounts);
}

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(
        ExactInputSingleParams calldata params
    ) external payable returns (uint256 amountOut);
}

// ============================================================================
// CONTRATO PRINCIPAL DE ARBITRAJE VIA FLASH LOAN (Aave V3)
// ============================================================================

contract FlashLoanArbitrage {
    address public owner;
    address public immutable POOL;

    uint8 public constant ROUTER_V2 = 0;
    uint8 public constant ROUTER_V3 = 1;

    event ArbitrageExecuted(
        address indexed asset,
        uint256 borrowed,
        uint256 profit,
        address routerA,
        address routerB
    );

    event SwapExecuted(
        address indexed router,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "UNAUTHORIZED");
        _;
    }

    modifier onlyPool() {
        require(msg.sender == POOL, "CALLER_NOT_POOL");
        _;
    }

    constructor(address _poolAddressesProvider) {
        owner = msg.sender;
        POOL = IPoolAddressesProvider(_poolAddressesProvider).getPool();
    }

    // ========================================================================
    // CALLBACK DE AAVE V3 - Se ejecuta automaticamente al recibir el flash loan
    // ========================================================================
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external onlyPool returns (bool) {
        require(initiator == address(this), "INVALID_INITIATOR");

        // Decodificar parametros del arbitraje
        (
            address routerA,
            address routerB,
            address tokenIntermediate,
            uint24 feeA,
            uint24 feeB,
            uint256 amountOutMinA,
            uint256 amountOutMinB,
            uint8 routerTypeA,
            uint8 routerTypeB
        ) = abi.decode(
            params,
            (address, address, address, uint24, uint24, uint256, uint256, uint8, uint8)
        );

        uint256 totalDebt = amount + premium;

        // Paso 1: Swap asset -> tokenIntermediate en Router A
        uint256 intermediateAmount = _executeSwap(
            routerA,
            routerTypeA,
            asset,
            tokenIntermediate,
            feeA,
            amount,
            amountOutMinA
        );

        // Paso 2: Swap tokenIntermediate -> asset en Router B
        uint256 finalAmount = _executeSwap(
            routerB,
            routerTypeB,
            tokenIntermediate,
            asset,
            feeB,
            intermediateAmount,
            amountOutMinB
        );

        // Verificar que el arbitraje es profitable
        require(finalAmount >= totalDebt, "ARBITRAGE_NOT_PROFITABLE");

        // Aprobar repago al Pool de Aave
        IERC20(asset).approve(POOL, totalDebt);

        // Transferir profit al owner
        uint256 profit = finalAmount - totalDebt;
        if (profit > 0) {
            IERC20(asset).transfer(owner, profit);
        }

        emit ArbitrageExecuted(asset, amount, profit, routerA, routerB);
        return true;
    }

    // ========================================================================
    // EJECUCION DE SWAP UNIVERSAL (V2 y V3)
    // ========================================================================
    function _executeSwap(
        address router,
        uint8 routerType,
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint256 amountOutMin
    ) internal returns (uint256 amountOut) {
        // Aprobar tokens al router
        IERC20(tokenIn).approve(router, amountIn);

        if (routerType == ROUTER_V2) {
            // Swap V2: SushiSwap, Camelot V2, QuickSwap V2
            address[] memory path = new address[](2);
            path[0] = tokenIn;
            path[1] = tokenOut;

            uint256[] memory amounts = IUniswapV2Router(router)
                .swapExactTokensForTokens(
                    amountIn,
                    amountOutMin,
                    path,
                    address(this),
                    block.timestamp + 300
                );

            amountOut = amounts[amounts.length - 1];
        } else {
            // Swap V3: Uniswap V3, Camelot V3 (Algebra), QuickSwap V3
            amountOut = ISwapRouter(router).exactInputSingle(
                ISwapRouter.ExactInputSingleParams({
                    tokenIn: tokenIn,
                    tokenOut: tokenOut,
                    fee: fee,
                    recipient: address(this),
                    deadline: block.timestamp + 300,
                    amountIn: amountIn,
                    amountOutMinimum: amountOutMin,
                    sqrtPriceLimitX96: 0
                })
            );
        }

        emit SwapExecuted(router, tokenIn, tokenOut, amountIn, amountOut);
    }

    // ========================================================================
    // PUNTO DE ENTRADA: llamado por el bot Python para iniciar flash loan
    // ========================================================================
    function ejecutarArbitraje(
        address asset,
        uint256 amount,
        bytes calldata params
    ) external onlyOwner {
        IPool(POOL).flashLoanSimple(
            address(this),
            asset,
            amount,
            params,
            0 // referralCode
        );
    }

    // ========================================================================
    // FUNCIONES DE CONSULTA ON-CHAIN (para pre-validacion desde Python)
    // ========================================================================
    function consultarAmountsOutV2(
        address router,
        uint256 amountIn,
        address tokenIn,
        address tokenOut
    ) external view returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        try IUniswapV2Router(router).getAmountsOut(amountIn, path) returns (
            uint256[] memory amounts
        ) {
            return amounts[amounts.length - 1];
        } catch {
            return 0;
        }
    }

    function consultarPremiumFlashLoan() external view returns (uint128) {
        return IPool(POOL).FLASHLOAN_PREMIUM_TOTAL();
    }

    // ========================================================================
    // FUNCIONES DE EMERGENCIA
    // ========================================================================
    function rescatarTokens(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "NO_BALANCE");
        IERC20(token).transfer(owner, balance);
    }

    function rescatarETH() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "NO_ETH");
        (bool ok, ) = owner.call{value: balance}("");
        require(ok, "ETH_TRANSFER_FAILED");
    }

    function transferirOwnership(address nuevoOwner) external onlyOwner {
        require(nuevoOwner != address(0), "ZERO_ADDRESS");
        owner = nuevoOwner;
    }

    receive() external payable {}
}
