---
name: testing-nexus-arbitrage
description: Run the NEXUS//OS arbitrage dashboard locally and verify its simulation data and backtest flow end-to-end.
---

# Testing NEXUS Arbitrage

## Devin Secrets Needed

- None for the local simulation flow.
- `NEXUS_ADMIN_KEY` is only needed when testing risk or strategy configuration
  writes.

## Local runtime

Use Node 20.19.0 and Python 3.12. Start the services in separate foreground
shells so logs remain available:

```bash
cd backend
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```bash
NEXUS_API_URL=http://127.0.0.1:8000 npm run dev -- --hostname 127.0.0.1 --port 3000
```

The main UI test does not need TimescaleDB, Redis, NATS, RPC keys, or wallet
credentials. Leave live trading disabled.

## Browser flow

1. Open `http://localhost:3000`.
2. Enter `admin` in the demo login and click `conectar`.
3. Click `Herramientas`, then the `Arbitraje` card.
4. Allow up to five seconds for the `/api/arbitrage` poll.
5. Verify the mode is `simulation`, status is `conectado`, and the Binance,
   Coinbase, Uniswap, and Aerodrome cards are connected with numeric latency.
6. Click `ejecutar backtest`.
7. Verify the deterministic result is
   `1 trades · $1 net · 0.11% win rate`.

Do not assert exact opportunity counts, top symbols, venue routes, profits, or
latencies because simulated market scans update them continuously.

## Troubleshooting

- If the UI shows `API desconectada`, confirm FastAPI is listening on port 8000
  and the frontend was started with `NEXUS_API_URL=http://127.0.0.1:8000`.
- If the demo login is already bypassed, clear the `nexus_user` local-storage
  key or use the visible `cerrar sesión` control.
- A GitHub Actions job with zero steps and no runner might not have executed.
  Inspect its check-run annotations for account, billing, or infrastructure
  errors before treating it as an application failure.
