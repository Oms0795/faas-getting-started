# NEXUS//OS

Plataforma modular de monitorización y simulación de arbitraje con dashboard en tiempo real.
La operación real permanece deshabilitada por defecto: el sistema detecta oportunidades, aplica
controles de riesgo, ejecuta operaciones simuladas y permite backtesting antes de usar capital.

## Arquitectura

```text
Next.js dashboard
    │ REST
FastAPI + WebSocket
    ├── conectores normalizados
    ├── motor de mercado
    ├── detector de oportunidades
    ├── gestión de riesgo
    ├── simulación y backtesting
    └── eventos y métricas
         ├── TimescaleDB
         ├── Redis
         ├── NATS
         ├── Prometheus
         ├── Grafana
         └── Loki
```

### Componentes

- `pages/`, `components/`: dashboard NEXUS y panel de arbitraje.
- `backend/app/connectors/`: conectores con interfaz uniforme y telemetría de latencia.
- `backend/app/services/market.py`: recopilación asíncrona y normalización.
- `backend/app/services/opportunities.py`: spread neto de comisiones, slippage y red.
- `backend/app/services/risk.py`: límites de exposición, pérdidas y rentabilidad mínima.
- `backend/app/services/backtesting.py`: backtesting reproducible.
- `backend/app/services/infrastructure.py`: persistencia de eventos, caché y NATS.
- `tools/arbitrage/`: scanner EVM y contrato experimental recuperados del proyecto original.
- `infra/`: Prometheus, Grafana y Loki.

## Inicio rápido con Docker

```bash
docker compose up --build
```

Servicios:

| Servicio | URL |
| --- | --- |
| Dashboard | `http://localhost:3000` |
| API / OpenAPI | `http://localhost:8000/docs` |
| Prometheus | `http://localhost:9090` |
| Grafana | `http://localhost:3002` |
| NATS monitoring | `http://localhost:8222` |

Grafana usa `admin` / `admin` únicamente para desarrollo local.

## Desarrollo local

Requisitos: Node.js 20.19 o superior, Python 3.12 y Docker Compose.

```bash
npm ci
python3.12 -m venv backend/.venv
backend/.venv/bin/pip install -e './backend[dev]'
```

Terminal 1:

```bash
cd backend
.venv/bin/uvicorn app.main:app --reload
```

Terminal 2:

```bash
npm run dev
```

Sin Docker, la API funciona con almacenamiento en memoria y conectores simulados. Para activar
PostgreSQL, Redis y NATS, copia `backend/.env.example` a `backend/.env` y configura
`NEXUS_INFRASTRUCTURE_ENABLED=true`.

## API

- `GET /health`, `GET /ready`
- `GET /api/v1/status`
- `GET /api/v1/market/quotes`
- `GET /api/v1/opportunities`
- `GET /api/v1/trades`
- `GET /api/v1/alerts`
- `GET|PUT /api/v1/strategy`
- `GET|PUT /api/v1/risk`
- `POST /api/v1/backtests/run`
- `WS /ws/market`
- `GET /metrics`

## Calidad

```bash
npm run lint
npm run typecheck
npm run build
backend/.venv/bin/ruff check backend
backend/.venv/bin/pytest backend
docker compose config
```

## Seguridad y operación real

- `NEXUS_LIVE_TRADING_ENABLED=false` es el valor predeterminado.
- No se incluyen claves privadas ni credenciales reales.
- No existe garantía de rentabilidad. Los resultados simulados no representan ejecución real.
- Antes de habilitar capital: validar conectores reales, MEV, liquidez, slippage, gas, límites,
  contratos desplegados, alertas y procedimientos de parada de emergencia.

El módulo de `tools/arbitrage/` es experimental y está separado del API principal. Debe mantenerse
en simulación hasta completar auditorías de contrato, pruebas en testnet y validación operacional.
