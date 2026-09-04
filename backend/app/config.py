from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="NEXUS_",
        extra="ignore",
    )

    app_name: str = "NEXUS Arbitrage API"
    environment: str = "development"
    log_level: str = "INFO"
    admin_api_key: SecretStr | None = None
    cors_origins: str = "http://localhost:3000"
    scan_interval_seconds: float = 1.0
    symbols: str = "ETH/USDC,BTC/USDC,SOL/USDC"
    simulation_execution_enabled: bool = True
    live_trading_enabled: bool = False
    min_profit_usd: float = 1.0
    max_notional_usd: float = 10_000.0
    max_daily_loss_usd: float = 500.0
    max_slippage_bps: float = 30.0
    execution_cooldown_seconds: float = 10.0
    infrastructure_enabled: bool = False
    database_url: str = "postgresql+asyncpg://nexus:nexus@localhost:5432/nexus"
    redis_url: str = "redis://localhost:6379/0"
    nats_url: str = "nats://localhost:4222"
    otlp_endpoint: str = ""

    @property
    def symbol_list(self) -> list[str]:
        return [symbol.strip().upper() for symbol in self.symbols.split(",") if symbol.strip()]

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
