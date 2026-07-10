from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.dependencies import get_runtime
from app.schemas import Alert, MarketQuote, Opportunity, PlatformStatus, SimulatedTrade
from app.services.runtime import PlatformRuntime

router = APIRouter(tags=["platform"])
Runtime = Annotated[PlatformRuntime, Depends(get_runtime)]


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
async def ready(runtime: Runtime) -> dict[str, object]:
    return {"status": "ready", "connectors": len(runtime.connectors)}


@router.get("/api/v1/status", response_model=PlatformStatus)
async def status(runtime: Runtime) -> PlatformStatus:
    return runtime.status()


@router.get("/api/v1/market/quotes", response_model=list[MarketQuote])
async def quotes(runtime: Runtime) -> list[MarketQuote]:
    return runtime.latest_quotes()


@router.get("/api/v1/opportunities", response_model=list[Opportunity])
async def opportunities(
    runtime: Runtime,
    limit: int = 50,
) -> list[Opportunity]:
    return list(runtime.opportunities)[-max(1, min(limit, 200)) :][::-1]


@router.get("/api/v1/trades", response_model=list[SimulatedTrade])
async def trades(
    runtime: Runtime,
    limit: int = 50,
) -> list[SimulatedTrade]:
    return list(runtime.trades)[-max(1, min(limit, 200)) :][::-1]


@router.get("/api/v1/alerts", response_model=list[Alert])
async def alerts(
    runtime: Runtime,
    limit: int = 50,
) -> list[Alert]:
    return list(runtime.alerts)[-max(1, min(limit, 200)) :][::-1]
