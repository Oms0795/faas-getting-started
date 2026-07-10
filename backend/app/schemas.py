from datetime import UTC, datetime
from enum import StrEnum
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


def utc_now() -> datetime:
    return datetime.now(UTC)


class Venue(StrEnum):
    BINANCE = "binance"
    COINBASE = "coinbase"
    UNISWAP = "uniswap"
    AERODROME = "aerodrome"


class MarketQuote(BaseModel):
    venue: Venue
    symbol: str
    bid: float = Field(gt=0)
    ask: float = Field(gt=0)
    bid_size: float = Field(gt=0)
    ask_size: float = Field(gt=0)
    latency_ms: float = Field(ge=0)
    timestamp: datetime = Field(default_factory=utc_now)


class ConnectorStatus(BaseModel):
    venue: Venue
    connected: bool
    latency_ms: float = Field(ge=0)
    last_update: datetime | None = None
    reconnects: int = Field(default=0, ge=0)
    error: str | None = None


class Opportunity(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    symbol: str
    buy_venue: Venue
    sell_venue: Venue
    buy_price: float
    sell_price: float
    notional_usd: float
    gross_spread_bps: float
    fees_bps: float
    slippage_bps: float
    network_cost_usd: float
    estimated_profit_usd: float
    executable: bool
    reason: str
    timestamp: datetime = Field(default_factory=utc_now)


class RiskLimits(BaseModel):
    max_notional_usd: float = Field(default=10_000, gt=0)
    max_daily_loss_usd: float = Field(default=500, gt=0)
    max_slippage_bps: float = Field(default=30, gt=0)
    min_profit_usd: float = Field(default=1, ge=0)
    max_consecutive_losses: int = Field(default=3, ge=1)


class RiskDecision(BaseModel):
    approved: bool
    reasons: list[str]


class StrategyConfig(BaseModel):
    enabled: bool = True
    symbols: list[str] = Field(default_factory=lambda: ["ETH/USDC"])
    notional_usd: float = Field(default=1_000, gt=0)
    min_profit_usd: float = Field(default=1, ge=0)
    max_slippage_bps: float = Field(default=20, gt=0)


class SimulatedTrade(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    opportunity_id: UUID
    symbol: str
    buy_venue: Venue
    sell_venue: Venue
    notional_usd: float
    expected_profit_usd: float
    realized_profit_usd: float
    mode: str = "simulation"
    status: str = "filled"
    timestamp: datetime = Field(default_factory=utc_now)


class Alert(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    severity: str
    message: str
    timestamp: datetime = Field(default_factory=utc_now)


class BacktestRequest(BaseModel):
    symbol: str = "ETH/USDC"
    samples: int = Field(default=500, ge=50, le=10_000)
    notional_usd: float = Field(default=1_000, gt=0, le=100_000)
    min_profit_usd: float = Field(default=1, ge=0)


class BacktestResult(BaseModel):
    symbol: str
    samples: int
    opportunities: int
    executed_trades: int
    gross_profit_usd: float
    estimated_costs_usd: float
    net_profit_usd: float
    win_rate: float
    max_drawdown_usd: float


class PlatformStatus(BaseModel):
    mode: str
    live_trading_enabled: bool
    scan_interval_seconds: float
    connectors: list[ConnectorStatus]
    quotes: int
    opportunities: int
    trades: int
    alerts: int
    infrastructure: dict[str, str]
    started_at: datetime
