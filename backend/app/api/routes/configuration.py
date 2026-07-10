from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.dependencies import get_runtime
from app.schemas import RiskLimits, StrategyConfig
from app.services.risk import RiskEngine
from app.services.runtime import PlatformRuntime

router = APIRouter(prefix="/api/v1", tags=["configuration"])
Runtime = Annotated[PlatformRuntime, Depends(get_runtime)]


@router.get("/risk", response_model=RiskLimits)
async def get_risk(runtime: Runtime) -> RiskLimits:
    return runtime.risk_limits


@router.put("/risk", response_model=RiskLimits)
async def update_risk(
    limits: RiskLimits,
    runtime: Runtime,
) -> RiskLimits:
    runtime.risk_limits = limits
    runtime.risk = RiskEngine(limits)
    return limits


@router.get("/strategy", response_model=StrategyConfig)
async def get_strategy(runtime: Runtime) -> StrategyConfig:
    return runtime.strategy


@router.put("/strategy", response_model=StrategyConfig)
async def update_strategy(
    strategy: StrategyConfig,
    runtime: Runtime,
) -> StrategyConfig:
    runtime.strategy = strategy
    return strategy
