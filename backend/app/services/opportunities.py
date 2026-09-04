from collections import defaultdict
from itertools import permutations

from app.schemas import MarketQuote, Opportunity, Venue

TAKER_FEES_BPS = {
    Venue.BINANCE: 4.0,
    Venue.COINBASE: 6.0,
    Venue.UNISWAP: 5.0,
    Venue.AERODROME: 5.0,
}


class OpportunityEngine:
    def __init__(self, network_cost_usd: float = 0.25) -> None:
        self.network_cost_usd = network_cost_usd

    def detect(
        self,
        quotes: list[MarketQuote],
        notional_usd: float,
        min_profit_usd: float,
        max_slippage_bps: float,
    ) -> list[Opportunity]:
        grouped: dict[str, list[MarketQuote]] = defaultdict(list)
        for quote in quotes:
            grouped[quote.symbol].append(quote)

        opportunities: list[Opportunity] = []
        for symbol, symbol_quotes in grouped.items():
            for buy, sell in permutations(symbol_quotes, 2):
                if buy.venue == sell.venue or sell.bid <= buy.ask:
                    continue
                gross_spread_bps = (sell.bid - buy.ask) / buy.ask * 10_000
                fees_bps = TAKER_FEES_BPS[buy.venue] + TAKER_FEES_BPS[sell.venue]
                available_usd = min(buy.ask_size * buy.ask, sell.bid_size * sell.bid)
                liquidity_ratio = min(1.0, available_usd / notional_usd)
                slippage_bps = round((1 - liquidity_ratio) * 25 + 2, 4)
                gross_profit = notional_usd * gross_spread_bps / 10_000
                fees = notional_usd * fees_bps / 10_000
                slippage = notional_usd * slippage_bps / 10_000
                estimated_profit = gross_profit - fees - slippage - self.network_cost_usd
                executable = (
                    estimated_profit >= min_profit_usd
                    and slippage_bps <= max_slippage_bps
                    and liquidity_ratio >= 0.5
                )
                reason = "approved" if executable else "profit, slippage, or liquidity threshold"
                opportunities.append(
                    Opportunity(
                        symbol=symbol,
                        buy_venue=buy.venue,
                        sell_venue=sell.venue,
                        buy_price=buy.ask,
                        sell_price=sell.bid,
                        notional_usd=notional_usd,
                        gross_spread_bps=round(gross_spread_bps, 4),
                        fees_bps=fees_bps,
                        slippage_bps=slippage_bps,
                        network_cost_usd=self.network_cost_usd,
                        estimated_profit_usd=round(estimated_profit, 4),
                        executable=executable,
                        reason=reason,
                    )
                )
        return sorted(opportunities, key=lambda item: item.estimated_profit_usd, reverse=True)
