from prometheus_client import Counter, Gauge, Histogram

SCAN_DURATION = Histogram(
    "nexus_scan_duration_seconds",
    "Time spent collecting quotes and detecting opportunities",
)
QUOTES = Gauge("nexus_quotes_current", "Current normalized quotes")
OPPORTUNITIES = Counter(
    "nexus_opportunities_total",
    "Detected arbitrage opportunities",
)
SIMULATED_TRADES = Counter(
    "nexus_simulated_trades_total",
    "Completed simulated trades",
)
