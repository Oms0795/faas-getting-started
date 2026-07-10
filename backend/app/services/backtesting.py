import math
import random

from app.schemas import BacktestRequest, BacktestResult


class BacktestEngine:
    def run(self, request: BacktestRequest) -> BacktestResult:
        rng = random.Random(f"{request.symbol}:{request.samples}:{request.notional_usd}")
        equity = 0.0
        peak = 0.0
        max_drawdown = 0.0
        opportunities = 0
        executed = 0
        gross_profit = 0.0
        costs = 0.0

        for index in range(request.samples):
            spread_bps = 8 + math.sin(index / 11) * 7 + rng.uniform(-5, 5)
            if spread_bps <= 0:
                continue
            opportunities += 1
            gross = request.notional_usd * spread_bps / 10_000
            trade_cost = request.notional_usd * rng.uniform(7, 12) / 10_000 + 0.25
            net = gross - trade_cost
            if net < request.min_profit_usd:
                continue
            executed += 1
            gross_profit += gross
            costs += trade_cost
            equity += net
            peak = max(peak, equity)
            max_drawdown = max(max_drawdown, peak - equity)

        net_profit = gross_profit - costs
        return BacktestResult(
            symbol=request.symbol,
            samples=request.samples,
            opportunities=opportunities,
            executed_trades=executed,
            gross_profit_usd=round(gross_profit, 2),
            estimated_costs_usd=round(costs, 2),
            net_profit_usd=round(net_profit, 2),
            win_rate=round(executed / opportunities * 100, 2) if opportunities else 0,
            max_drawdown_usd=round(max_drawdown, 2),
        )
