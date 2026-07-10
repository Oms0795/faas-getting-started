import asyncio
import math
import random
import time
from datetime import UTC, datetime

from app.connectors.base import MarketConnector
from app.schemas import ConnectorStatus, MarketQuote, Venue

BASE_PRICES = {
    "ETH/USDC": 3_450.0,
    "BTC/USDC": 96_000.0,
    "SOL/USDC": 195.0,
}

VENUE_OFFSETS_BPS = {
    Venue.BINANCE: -0.8,
    Venue.COINBASE: 0.6,
    Venue.UNISWAP: 1.6,
    Venue.AERODROME: -1.4,
}


class SimulatedConnector(MarketConnector):
    def __init__(self, venue: Venue) -> None:
        self.venue = venue
        self._rng = random.Random(venue.value)
        self._last_update: datetime | None = None
        self._latency_ms = 0.0
        self._error: str | None = None

    async def fetch_quote(self, symbol: str) -> MarketQuote:
        started = time.perf_counter()
        await asyncio.sleep(self._rng.uniform(0.002, 0.018))
        base = BASE_PRICES.get(symbol, 100.0)
        wave = math.sin(time.time() / 7 + len(symbol)) * 2.2
        venue_offset = base * VENUE_OFFSETS_BPS[self.venue] / 10_000
        noise = self._rng.uniform(-0.35, 0.35)
        midpoint = base + wave + venue_offset + noise
        spread_bps = 1.2 if self.venue in {Venue.BINANCE, Venue.COINBASE} else 2.8
        half_spread = midpoint * spread_bps / 20_000
        self._latency_ms = (time.perf_counter() - started) * 1_000
        self._last_update = datetime.now(UTC)
        self._error = None
        return MarketQuote(
            venue=self.venue,
            symbol=symbol,
            bid=round(midpoint - half_spread, 6),
            ask=round(midpoint + half_spread, 6),
            bid_size=round(self._rng.uniform(2, 50), 4),
            ask_size=round(self._rng.uniform(2, 50), 4),
            latency_ms=round(self._latency_ms, 3),
            timestamp=self._last_update,
        )

    def status(self) -> ConnectorStatus:
        return ConnectorStatus(
            venue=self.venue,
            connected=self._error is None,
            latency_ms=round(self._latency_ms, 3),
            last_update=self._last_update,
            error=self._error,
        )
