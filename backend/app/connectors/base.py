from abc import ABC, abstractmethod

from app.schemas import ConnectorStatus, MarketQuote, Venue


class MarketConnector(ABC):
    venue: Venue

    @abstractmethod
    async def fetch_quote(self, symbol: str) -> MarketQuote:
        raise NotImplementedError

    @abstractmethod
    def status(self) -> ConnectorStatus:
        raise NotImplementedError
