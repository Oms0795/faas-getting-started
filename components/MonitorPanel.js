import { useEffect, useState } from 'react';

/* ===================================================== */
/*  MonitorPanel — BTC / ETH / TRON + gas + block + feed */
/* ===================================================== */

const STR = {
  es: {
    title: 'NET//MONITOR',
    network: 'RED',
    price: 'PRECIO',
    change24h: '24h',
    block: 'bloque',
    gas: 'gas',
    feed: 'eventos',
    refresh: 'actualizar',
    close: 'cerrar',
    loading: 'conectando…',
    error: 'sin señal',
    ethNetwork: 'ETHEREUM MAINNET',
  },
  en: {
    title: 'NET//MONITOR',
    network: 'NETWORK',
    price: 'PRICE',
    change24h: '24h',
    block: 'block',
    gas: 'gas',
    feed: 'events',
    refresh: 'refresh',
    close: 'close',
    loading: 'connecting…',
    error: 'no signal',
    ethNetwork: 'ETHEREUM MAINNET',
  },
};

function fmtPrice(n) {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function fmtChange(n) {
  if (n === null || n === undefined) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function fmtNumber(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString('en-US');
}

export default function MonitorPanel({ lang, events, meta, onClose }) {
  const t = STR[lang] || STR.es;
  const [prices, setPrices] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function loadPrices() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/price');
      if (!res.ok) throw new Error('price fetch failed');
      const data = await res.json();
      setPrices(data.prices);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPrices();
  }, []);

  const rows = [
    { id: 'BTC', label: 'BTC', color: '#ffcc33' },
    { id: 'ETH', label: 'ETH', color: '#22e5ff' },
    { id: 'TRON', label: 'TRON', color: '#39ff88' },
  ];

  return (
    <div className="monitor">
      <div className="monitor-header">
        <span>{'>>'} {t.title}</span>
        <button className="close" onClick={onClose} title={t.close}>
          ×
        </button>
      </div>

      <div className="monitor-grid">
        {rows.map((row) => {
          const p = prices?.[row.id];
          return (
            <div key={row.id} className="monitor-row" style={{ borderColor: row.color }}>
              <div className="row-label" style={{ color: row.color }}>
                {row.label}
              </div>
              <div className="row-value">{loading ? t.loading : fmtPrice(p?.price)}</div>
              <div className={`row-change ${p?.change >= 0 ? 'up' : 'down'}`}>
                {loading ? '—' : fmtChange(p?.change)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="network-box">
        <div className="network-title">{t.ethNetwork}</div>
        <div className="network-stats">
          <div>
            <small>{t.block}</small>
            <strong>{fmtNumber(meta?.blockNumber)}</strong>
          </div>
          <div>
            <small>{t.gas}</small>
            <strong>{meta?.gasPrice ? `${meta.gasPrice} gwei` : '—'}</strong>
          </div>
          <div>
            <small>{t.feed}</small>
            <strong>{fmtNumber(events?.length || 0)}</strong>
          </div>
        </div>
      </div>

      {error && <div className="monitor-error">{t.error}</div>}

      <div className="monitor-actions">
        <button className="refresh" onClick={loadPrices} disabled={loading}>
          {loading ? t.loading : `↻ ${t.refresh}`}
        </button>
      </div>

      <style jsx>{`
        .monitor {
          display: flex;
          flex-direction: column;
          gap: 12px;
          height: 100%;
        }
        .monitor-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-family: 'VT323', monospace;
          font-size: 20px;
          color: var(--magenta);
          letter-spacing: 0.04em;
        }
        .close {
          background: none;
          border: none;
          color: var(--dim);
          font-size: 20px;
          cursor: pointer;
          line-height: 1;
        }
        .close:hover {
          color: var(--magenta);
        }
        .monitor-grid {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .monitor-row {
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid var(--border);
          border-left-width: 4px;
          border-radius: 10px;
          padding: 12px 14px;
          display: grid;
          grid-template-columns: 1fr auto auto;
          align-items: center;
          gap: 10px;
        }
        .row-label {
          font-family: 'VT323', monospace;
          font-size: 18px;
          letter-spacing: 0.06em;
        }
        .row-value {
          color: var(--frost);
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
        }
        .row-change {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          padding: 3px 6px;
          border-radius: 4px;
          background: rgba(0, 0, 0, 0.3);
        }
        .row-change.up {
          color: var(--green);
        }
        .row-change.down {
          color: var(--magenta);
        }
        .network-box {
          background: rgba(34, 229, 255, 0.05);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 12px 14px;
        }
        .network-title {
          font-family: 'VT323', monospace;
          color: var(--cyan);
          font-size: 16px;
          margin-bottom: 8px;
          letter-spacing: 0.03em;
        }
        .network-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        .network-stats div {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .network-stats small {
          color: var(--dim);
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .network-stats strong {
          color: var(--frost);
          font-size: 12px;
          font-family: 'JetBrains Mono', monospace;
        }
        .monitor-error {
          color: var(--magenta);
          font-size: 12px;
          text-align: center;
          font-family: 'JetBrains Mono', monospace;
        }
        .monitor-actions {
          margin-top: auto;
          display: flex;
          justify-content: flex-end;
        }
        .refresh {
          background: rgba(34, 229, 255, 0.1);
          border: 1px solid var(--border);
          color: var(--cyan);
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          padding: 8px 12px;
          border-radius: 8px;
          cursor: pointer;
        }
        .refresh:hover {
          border-color: var(--cyan);
        }
        .refresh:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
