from app.schemas import Opportunity, RiskDecision, RiskLimits, SimulatedTrade


class RiskEngine:
    def __init__(self, limits: RiskLimits) -> None:
        self.limits = limits

    def evaluate(
        self,
        opportunity: Opportunity,
        trades: list[SimulatedTrade],
    ) -> RiskDecision:
        reasons: list[str] = []
        if opportunity.notional_usd > self.limits.max_notional_usd:
            reasons.append("notional exceeds configured maximum")
        if opportunity.slippage_bps > self.limits.max_slippage_bps:
            reasons.append("estimated slippage exceeds configured maximum")
        if opportunity.estimated_profit_usd < self.limits.min_profit_usd:
            reasons.append("estimated profit is below configured minimum")

        daily_pnl = sum(trade.realized_profit_usd for trade in trades)
        if daily_pnl <= -self.limits.max_daily_loss_usd:
            reasons.append("daily loss limit reached")

        consecutive_losses = 0
        for trade in reversed(trades):
            if trade.realized_profit_usd >= 0:
                break
            consecutive_losses += 1
        if consecutive_losses >= self.limits.max_consecutive_losses:
            reasons.append("consecutive loss limit reached")
        return RiskDecision(approved=not reasons, reasons=reasons)
