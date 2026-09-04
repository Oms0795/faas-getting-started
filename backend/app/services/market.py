import asyncio

from app.connectors.base import MarketConnector
from app.schemas import MarketQuote


class MarketEngine:
    def __init__(self, connectors: list[MarketConnector], symbols: list[str]) -> None:
        self.connectors = connectors
        self.symbols = symbols

    async def collect(self) -> list[MarketQuote]:
        tasks = [
            connector.fetch_quote(symbol)
            for symbol in self.symbols
            for connector in self.connectors
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return [result for result in results if isinstance(result, MarketQuote)]
