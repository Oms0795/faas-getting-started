from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def build_client() -> TestClient:
    settings = Settings(
        admin_api_key="test-admin-key",
        scan_interval_seconds=60,
        execution_cooldown_seconds=0,
        min_profit_usd=0,
    )
    return TestClient(create_app(settings))


def test_health_and_status() -> None:
    with build_client() as client:
        assert client.get("/health").json() == {"status": "ok"}
        response = client.get("/api/v1/status")
        assert response.status_code == 200
        payload = response.json()
        assert payload["mode"] == "simulation"
        assert len(payload["connectors"]) == 4
        assert payload["quotes"] == 12


def test_strategy_and_risk_can_be_updated() -> None:
    with build_client() as client:
        strategy = client.get("/api/v1/strategy").json()
        strategy["notional_usd"] = 2500
        assert client.put("/api/v1/strategy", json=strategy).status_code == 401
        response = client.put(
            "/api/v1/strategy",
            json=strategy,
            headers={"X-Nexus-Admin-Key": "test-admin-key"},
        )
        assert response.json()["notional_usd"] == 2500

        limits = client.get("/api/v1/risk").json()
        limits["max_notional_usd"] = 5000
        response = client.put(
            "/api/v1/risk",
            json=limits,
            headers={"X-Nexus-Admin-Key": "test-admin-key"},
        )
        assert response.json()["max_notional_usd"] == 5000


def test_backtest_is_deterministic() -> None:
    request = {
        "symbol": "ETH/USDC",
        "samples": 200,
        "notional_usd": 1000,
        "min_profit_usd": 0,
    }
    with build_client() as client:
        first = client.post("/api/v1/backtests/run", json=request)
        second = client.post("/api/v1/backtests/run", json=request)
        assert first.status_code == 200
        assert first.json() == second.json()
        assert first.json()["opportunities"] > 0
