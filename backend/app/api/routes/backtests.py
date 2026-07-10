from fastapi import APIRouter

from app.schemas import BacktestRequest, BacktestResult
from app.services.backtesting import BacktestEngine

router = APIRouter(prefix="/api/v1/backtests", tags=["backtests"])
engine = BacktestEngine()


@router.post("/run", response_model=BacktestResult)
async def run_backtest(request: BacktestRequest) -> BacktestResult:
    return engine.run(request)
