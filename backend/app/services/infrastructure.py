import json
import logging
from datetime import UTC, datetime

import nats
import redis.asyncio as redis
from nats.aio.client import Client as NatsClient
from sqlalchemy import JSON, Column, DateTime, MetaData, String, Table, insert
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.config import Settings

logger = logging.getLogger(__name__)

metadata = MetaData()
market_events = Table(
    "market_events",
    metadata,
    Column("created_at", DateTime(timezone=True), primary_key=True),
    Column("event_type", String(64), primary_key=True),
    Column("payload", JSON, nullable=False),
)


class InfrastructureServices:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.database: AsyncEngine | None = None
        self.cache: redis.Redis | None = None
        self.message_bus: NatsClient | None = None
        self.health = {
            "database": "disabled",
            "redis": "disabled",
            "nats": "disabled",
        }

    async def start(self) -> None:
        if not self.settings.infrastructure_enabled:
            return
        await self._start_database()
        await self._start_redis()
        await self._start_nats()

    async def _start_database(self) -> None:
        try:
            self.database = create_async_engine(
                self.settings.database_url,
                pool_pre_ping=True,
                connect_args={"timeout": 2},
            )
            async with self.database.begin() as connection:
                await connection.run_sync(metadata.create_all)
            self.health["database"] = "connected"
        except Exception:
            self.health["database"] = "unavailable"
            if self.database is not None:
                await self.database.dispose()
                self.database = None

    async def _start_redis(self) -> None:
        try:
            self.cache = redis.from_url(
                self.settings.redis_url,
                socket_connect_timeout=2,
                decode_responses=True,
            )
            await self.cache.ping()
            self.health["redis"] = "connected"
        except Exception:
            self.health["redis"] = "unavailable"
            if self.cache is not None:
                await self.cache.aclose()
                self.cache = None

    async def _start_nats(self) -> None:
        try:
            self.message_bus = await nats.connect(
                self.settings.nats_url,
                connect_timeout=2,
                max_reconnect_attempts=2,
            )
            self.health["nats"] = "connected"
        except Exception:
            self.health["nats"] = "unavailable"
            self.message_bus = None

    async def publish(self, payload: dict[str, object]) -> None:
        encoded = json.dumps(payload, default=str).encode()
        if self.cache is not None:
            try:
                await self.cache.set("nexus:last_market_event", encoded, ex=60)
                self.health["redis"] = "connected"
            except Exception:
                self.health["redis"] = "unavailable"
                logger.exception("Failed to publish market event to Redis")
        if self.message_bus is not None:
            try:
                await self.message_bus.publish("nexus.market.updates", encoded)
                self.health["nats"] = "connected"
            except Exception:
                self.health["nats"] = "unavailable"
                logger.exception("Failed to publish market event to NATS")
        if self.database is not None:
            try:
                async with self.database.begin() as connection:
                    await connection.execute(
                        insert(market_events).values(
                            created_at=datetime.now(UTC),
                            event_type=str(payload.get("type", "unknown")),
                            payload=payload,
                        )
                    )
                self.health["database"] = "connected"
            except Exception:
                self.health["database"] = "unavailable"
                logger.exception("Failed to persist market event")

    async def stop(self) -> None:
        if self.message_bus is not None:
            await self.message_bus.drain()
        if self.cache is not None:
            await self.cache.aclose()
        if self.database is not None:
            await self.database.dispose()
