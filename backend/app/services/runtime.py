import asyncio
import contextlib
import logging
import random
from collections import deque
from datetime import UTC, datetime

from app.config import Settings
from app.connectors import SimulatedConnector
from app.metrics import OPPORTUNITIES, QUOTES, SCAN_DURATION, SIMULATED_TRADES
from app.schemas import (
    Alert,
    MarketQuote,
    Opportunity,
    PlatformStatus,
    RiskLimits,
    SimulatedTrade,
    StrategyConfig,
    Venue,
)
from app.services.infrastructure import InfrastructureServices
from app.services.market import MarketEngine
from app.services.opportunities import OpportunityEngine
from app.services.risk import RiskEngine

logger = logging.getLogger(__name__)


class PlatformRuntime:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.started_at = datetime.now(UTC)
        self.connectors = [SimulatedConnector(venue) for venue in Venue]
        self.market = MarketEngine(self.connectors, settings.symbol_list)
        self.infrastructure = InfrastructureServices(settings)
        self.opportunity_engine = OpportunityEngine()
        self.risk_limits = RiskLimits(
            max_notional_usd=settings.max_notional_usd,
            max_daily_loss_usd=settings.max_daily_loss_usd,
            max_slippage_bps=settings.max_slippage_bps,
            min_profit_usd=settings.min_profit_usd,
        )
        self.risk = RiskEngine(self.risk_limits)
        self.strategy = StrategyConfig(
            symbols=settings.symbol_list,
            notional_usd=min(1_000, settings.max_notional_usd),
            min_profit_usd=settings.min_profit_usd,
            max_slippage_bps=settings.max_slippage_bps,
        )
        self.quotes: deque[MarketQuote] = deque(maxlen=500)
        self.opportunities: deque[Opportunity] = deque(maxlen=500)
        self.trades: deque[SimulatedTrade] = deque(maxlen=500)
        self.alerts: deque[Alert] = deque(maxlen=200)
        self._subscribers: set[asyncio.Queue[dict[str, object]]] = set()
        self._task: asyncio.Task[None] | None = None
        self._last_execution = 0.0
        self._rng = random.Random("nexus-runtime")

    async def start(self) -> None:
        if self._task is None:
            await self.infrastructure.start()
            await self.scan_once()
            self._task = asyncio.create_task(self._run(), name="nexus-market-loop")

    async def stop(self) -> None:
        if self._task is None:
            return
        self._task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await self._task
        self._task = None
        await self.infrastructure.stop()

    async def _run(self) -> None:
        while True:
            await asyncio.sleep(self.settings.scan_interval_seconds)
            try:
                await self.scan_once()
            except Exception as error:
                logger.exception("Market scan iteration failed")
                self.alerts.append(
                    Alert(
                        severity="error",
                        message=f"Market scan iteration failed: {type(error).__name__}",
                    )
                )

    async def scan_once(self) -> None:
        with SCAN_DURATION.time():
            quotes = await self.market.collect()
            self.quotes.extend(quotes)
            current_quotes = self.latest_quotes()
            opportunities = self.opportunity_engine.detect(
                current_quotes,
                notional_usd=self.strategy.notional_usd,
                min_profit_usd=self.strategy.min_profit_usd,
                max_slippage_bps=self.strategy.max_slippage_bps,
            )
        QUOTES.set(len(current_quotes))
        OPPORTUNITIES.inc(len(opportunities))
        self.opportunities.extend(opportunities[:20])
        if self.strategy.enabled and opportunities:
            await self._maybe_simulate(opportunities[0])
        await self.publish(
            {
                "type": "market_update",
                "quotes": [quote.model_dump(mode="json") for quote in current_quotes],
                "opportunities": [
                    item.model_dump(mode="json") for item in opportunities[:10]
                ],
            }
        )

    async def _maybe_simulate(self, opportunity: Opportunity) -> None:
        if not self.settings.simulation_execution_enabled or not opportunity.executable:
            return
        now = asyncio.get_running_loop().time()
        if now - self._last_execution < self.settings.execution_cooldown_seconds:
            return
        decision = self.risk.evaluate(opportunity, list(self.trades))
        if not decision.approved:
            self.alerts.append(
                Alert(severity="warning", message="Risk rejected: " + ", ".join(decision.reasons))
            )
            return
        realized = opportunity.estimated_profit_usd * self._rng.uniform(0.82, 1.04)
        self.trades.append(
            SimulatedTrade(
                opportunity_id=opportunity.id,
                symbol=opportunity.symbol,
                buy_venue=opportunity.buy_venue,
                sell_venue=opportunity.sell_venue,
                notional_usd=opportunity.notional_usd,
                expected_profit_usd=opportunity.estimated_profit_usd,
                realized_profit_usd=round(realized, 4),
            )
        )
        SIMULATED_TRADES.inc()
        self._last_execution = now

    def latest_quotes(self) -> list[MarketQuote]:
        latest: dict[tuple[str, Venue], MarketQuote] = {}
        for quote in self.quotes:
            latest[(quote.symbol, quote.venue)] = quote
        return sorted(latest.values(), key=lambda item: (item.symbol, item.venue))

    def status(self) -> PlatformStatus:
        return PlatformStatus(
            mode="simulation",
            live_trading_enabled=self.settings.live_trading_enabled,
            scan_interval_seconds=self.settings.scan_interval_seconds,
            connectors=[connector.status() for connector in self.connectors],
            quotes=len(self.latest_quotes()),
            opportunities=len(self.opportunities),
            trades=len(self.trades),
            alerts=len(self.alerts),
            infrastructure=self.infrastructure.health,
            started_at=self.started_at,
        )

    def subscribe(self) -> asyncio.Queue[dict[str, object]]:
        queue: asyncio.Queue[dict[str, object]] = asyncio.Queue(maxsize=5)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue[dict[str, object]]) -> None:
        self._subscribers.discard(queue)

    async def publish(self, payload: dict[str, object]) -> None:
        await self.infrastructure.publish(payload)
        for queue in tuple(self._subscribers):
            if queue.full():
                with contextlib.suppress(asyncio.QueueEmpty):
                    queue.get_nowait()
            await queue.put(payload)
