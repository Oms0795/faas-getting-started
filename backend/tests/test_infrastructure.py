from unittest.mock import AsyncMock

import pytest

from app.config import Settings
from app.services.infrastructure import InfrastructureServices


@pytest.mark.asyncio
async def test_publish_continues_when_redis_is_unavailable() -> None:
    infrastructure = InfrastructureServices(Settings())
    infrastructure.cache = AsyncMock()
    infrastructure.message_bus = AsyncMock()
    infrastructure.cache.set.side_effect = ConnectionError("redis unavailable")

    await infrastructure.publish({"type": "market_update"})

    assert infrastructure.health["redis"] == "unavailable"
    infrastructure.message_bus.publish.assert_awaited_once()
