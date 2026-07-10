import { useEffect, useMemo, useRef, useState } from 'react';

/* =================================================================== */
/*  NEXUS//OS — Módulo de Herramientas                                 */
/*                                                                     */
/*  Para añadir una nueva herramienta:                                 */
/*  1. Crea un objeto en TOOLS con id, title, desc, category, icon,    */
/*     componente (función) y color.                                   */
/*  2. Implementa el componente de la herramienta más abajo.           */
/*  3. El panel se encarga del resto: búsqueda, filtros y renderizado. */
/* =================================================================== */

const CATEGORIES = {
  crypto: { es: 'Criptografía', en: 'Cryptography', color: '#7b5bff' },
  encoding: { es: 'Codificación', en: 'Encoding', color: '#22e5ff' },
  system: { es: 'Sistema', en: 'System', color: '#39ff88' },
  utils: { es: 'Utilidades', en: 'Utilities', color: '#ffcc33' },
  blockchain: { es: 'Blockchain', en: 'Blockchain', color: '#ff3df0' },
};

const STR = {
  es: {
    title: 'herramientas del sistema',
    search: 'buscar herramienta…',
    all: 'todas',
    category: 'categoría',
    empty: 'no se encontraron herramientas',
    back: 'volver',
    run: 'ejecutar',
    copy: 'copiar',
    clear: 'limpiar',
    input: 'entrada',
    output: 'salida',
    result: 'resultado',
    loading: 'procesando…',
    copied: 'copiado',
    arbTitle: 'arbitraje multi-cadena',
    arbMode: 'modo',
    arbSimulation: 'simulación',
    arbProduction: 'producción',
    arbWarning: 'Este módulo Python no se ejecuta en el navegador. Usa `python scanner.py` en tools/arbitrage/ con el entorno configurado.',
    arbNetworks: 'redes monitoreadas',
    arbPools: 'pools',
    arbReadme: 'instrucciones',
    arbStatus: 'estado',
    arbIdle: 'inactivo',
    arbOnline: 'conectado',
    arbOffline: 'API desconectada',
    arbOpportunities: 'oportunidades',
    arbTrades: 'operaciones simuladas',
    arbProfit: 'beneficio estimado',
    arbBacktest: 'ejecutar backtest',
    arbNoData: 'sin oportunidades rentables todavía',
  },
  en: {
    title: 'system tools',
    search: 'search tool…',
    all: 'all',
    category: 'category',
    empty: 'no tools found',
    back: 'back',
    run: 'run',
    copy: 'copy',
    clear: 'clear',
    input: 'input',
    output: 'output',
    result: 'result',
    loading: 'processing…',
    copied: 'copied',
    arbTitle: 'multi-chain arbitrage',
    arbMode: 'mode',
    arbSimulation: 'simulation',
    arbProduction: 'production',
    arbWarning: 'This Python module cannot run in the browser. Use `python scanner.py` in tools/arbitrage/ with the configured environment.',
    arbNetworks: 'monitored networks',
    arbPools: 'pools',
    arbReadme: 'instructions',
    arbStatus: 'status',
    arbIdle: 'idle',
    arbOnline: 'connected',
    arbOffline: 'API offline',
    arbOpportunities: 'opportunities',
    arbTrades: 'simulated trades',
    arbProfit: 'estimated profit',
    arbBacktest: 'run backtest',
    arbNoData: 'no profitable opportunities yet',
  },
};

/* ---------------------------- Utilidades ---------------------------- */

async function digest(algo, text) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest(algo, enc.encode(text));
  const arr = Array.from(new Uint8Array(buf));
  return arr.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function useCopyButton() {
  const [copied, setCopied] = useState(false);
  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  }
  return { copied, copy };
}

function CopyButton({ text, label }) {
  const { copied, copy } = useCopyButton();
  return (
    <button className="tool-btn copy" onClick={() => copy(text)}>
      {copied ? '✓' : label}
    </button>
  );
}

/* ---------------------------- Herramientas --------------------------- */

function HashTool({ lang }) {
  const t = STR[lang];
  const [input, setInput] = useState('');
  const [algo, setAlgo] = useState('SHA-256');
  const [hash, setHash] = useState('');
  const [loading, setLoading] = useState(false);

  async function compute() {
    if (!input) return;
    setLoading(true);
    try {
      const res = await digest(algo, input);
      setHash(res);
    } catch (e) {
      setHash('Error');
    }
    setLoading(false);
  }

  return (
    <div className="tool-layout">
      <div className="tool-field">
        <label>{t.input}</label>
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={5} />
      </div>
      <div className="tool-row">
        <div className="tool-field">
          <label>algorithm</label>
          <select value={algo} onChange={(e) => setAlgo(e.target.value)}>
            <option>SHA-256</option>
            <option>SHA-1</option>
            <option>SHA-384</option>
            <option>SHA-512</option>
          </select>
        </div>
        <button className="tool-btn primary" onClick={compute} disabled={loading}>
          {loading ? t.loading : t.run}
        </button>
      </div>
      {hash && (
        <div className="tool-field">
          <label>{t.output}</label>
          <div className="tool-output">
            <code>{hash}</code>
            <CopyButton text={hash} label={t.copy} />
          </div>
        </div>
      )}
    </div>
  );
}

function Base64Tool({ lang }) {
  const t = STR[lang];
  const [mode, setMode] = useState('encode');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  function run() {
    setError('');
    try {
      if (mode === 'encode') {
        setOutput(btoa(unescape(encodeURIComponent(input))));
      } else {
        setOutput(decodeURIComponent(escape(atob(input))));
      }
    } catch (e) {
      setError('Invalid input');
      setOutput('');
    }
  }

  return (
    <div className="tool-layout">
      <div className="tool-row">
        <button className={`tool-btn ${mode === 'encode' ? 'active' : ''}`} onClick={() => setMode('encode')}>
          encode
        </button>
        <button className={`tool-btn ${mode === 'decode' ? 'active' : ''}`} onClick={() => setMode('decode')}>
          decode
        </button>
      </div>
      <div className="tool-field">
        <label>{t.input}</label>
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={6} />
      </div>
      <button className="tool-btn primary" onClick={run}>
        {t.run}
      </button>
      {error && <div className="tool-error">{error}</div>}
      {output && (
        <div className="tool-field">
          <label>{t.output}</label>
          <div className="tool-output">
            <code>{output}</code>
            <CopyButton text={output} label={t.copy} />
          </div>
        </div>
      )}
    </div>
  );
}

function PasswordTool({ lang }) {
  const t = STR[lang];
  const [length, setLength] = useState(16);
  const [password, setPassword] = useState('');
  const [opts, setOpts] = useState({ upper: true, lower: true, numbers: true, symbols: true });

  const chars = useMemo(() => {
    let s = '';
    if (opts.lower) s += 'abcdefghijklmnopqrstuvwxyz';
    if (opts.upper) s += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (opts.numbers) s += '0123456789';
    if (opts.symbols) s += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    return s || 'abcdefghijklmnopqrstuvwxyz';
  }, [opts]);

  function generate() {
    const buf = new Uint8Array(length);
    crypto.getRandomValues(buf);
    let pass = '';
    for (let i = 0; i < length; i++) {
      pass += chars[buf[i] % chars.length];
    }
    setPassword(pass);
  }

  return (
    <div className="tool-layout">
      <div className="tool-row">
        <div className="tool-field">
          <label>length</label>
          <input type="number" min={4} max={128} value={length} onChange={(e) => setLength(Number(e.target.value))} />
        </div>
      </div>
      <div className="tool-row checks">
        {Object.keys(opts).map((k) => (
          <label key={k} className="check">
            <input
              type="checkbox"
              checked={opts[k]}
              onChange={(e) => setOpts((o) => ({ ...o, [k]: e.target.checked }))}
            />
            <span>{k}</span>
          </label>
        ))}
      </div>
      <button className="tool-btn primary" onClick={generate}>
        {t.run}
      </button>
      {password && (
        <div className="tool-field">
          <label>{t.result}</label>
          <div className="tool-output">
            <code>{password}</code>
            <CopyButton text={password} label={t.copy} />
          </div>
        </div>
      )}
    </div>
  );
}

function JsonTool({ lang }) {
  const t = STR[lang];
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  function format() {
    setError('');
    try {
      const obj = JSON.parse(input);
      setOutput(JSON.stringify(obj, null, 2));
    } catch (e) {
      setError(e.message);
      setOutput('');
    }
  }

  function minify() {
    setError('');
    try {
      const obj = JSON.parse(input);
      setOutput(JSON.stringify(obj));
    } catch (e) {
      setError(e.message);
      setOutput('');
    }
  }

  return (
    <div className="tool-layout">
      <div className="tool-field">
        <label>{t.input}</label>
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={8} />
      </div>
      <div className="tool-row">
        <button className="tool-btn primary" onClick={format}>
          format
        </button>
        <button className="tool-btn" onClick={minify}>
          minify
        </button>
        <button className="tool-btn" onClick={() => { setInput(''); setOutput(''); setError(''); }}>
          {t.clear}
        </button>
      </div>
      {error && <div className="tool-error">{error}</div>}
      {output && (
        <div className="tool-field">
          <label>{t.output}</label>
          <div className="tool-output">
            <pre>{output}</pre>
            <CopyButton text={output} label={t.copy} />
          </div>
        </div>
      )}
    </div>
  );
}

function ClockTool({ lang }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  const fmt = { timeZone: 'UTC', hour12: false };
  const local = now.toLocaleString(lang === 'es' ? 'es-ES' : 'en-US');
  const utc = now.toLocaleString(lang === 'es' ? 'es-ES' : 'en-US', { ...fmt, timeZone: 'UTC' });
  const ts = Math.floor(now.getTime() / 1000);

  return (
    <div className="tool-layout">
      <div className="clock-grid">
        <div className="clock-card">
          <span className="label">local</span>
          <span className="value">{local}</span>
        </div>
        <div className="clock-card">
          <span className="label">UTC</span>
          <span className="value">{utc}</span>
        </div>
        <div className="clock-card">
          <span className="label">unix timestamp</span>
          <span className="value">{ts}</span>
          <CopyButton text={String(ts)} label="copy" />
        </div>
      </div>
    </div>
  );
}

function UuidTool({ lang }) {
  const t = STR[lang];
  const [uuid, setUuid] = useState('');

  function generate() {
    if (crypto.randomUUID) {
      setUuid(crypto.randomUUID());
    } else {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      setUuid(
        bytesToHex(bytes.slice(0, 4)) +
          '-' +
          bytesToHex(bytes.slice(4, 6)) +
          '-' +
          bytesToHex(bytes.slice(6, 8)) +
          '-' +
          bytesToHex(bytes.slice(8, 10)) +
          '-' +
          bytesToHex(bytes.slice(10, 16))
      );
    }
  }

  return (
    <div className="tool-layout">
      <button className="tool-btn primary" onClick={generate}>
        {t.run}
      </button>
      {uuid && (
        <div className="tool-field">
          <label>UUID</label>
          <div className="tool-output">
            <code>{uuid}</code>
            <CopyButton text={uuid} label={t.copy} />
          </div>
        </div>
      )}
    </div>
  );
}

function ArbitrageTool({ lang }) {
  const t = STR[lang];
  const [data, setData] = useState({
    online: false,
    status: null,
    opportunities: [],
    trades: [],
  });
  const [loading, setLoading] = useState(true);
  const [backtest, setBacktest] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch('/api/arbitrage');
        const payload = await response.json();
        if (active) setData(payload);
      } catch (error) {
        if (active) {
          setData({ online: false, status: null, opportunities: [], trades: [] });
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    const timer = setInterval(load, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  async function runBacktest() {
    setBacktest({ loading: true });
    try {
      const response = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          symbol: 'ETH/USDC',
          samples: 1000,
          notional_usd: 1000,
          min_profit_usd: 1,
        }),
      });
      setBacktest(await response.json());
    } catch (error) {
      setBacktest({ error: t.arbOffline });
    }
  }

  const connectors = data.status?.connectors || [];
  const topOpportunity = data.opportunities?.[0];

  return (
    <div className="tool-layout">
      <div className="arb-banner">
        <span className="arb-tag">{data.status?.mode || t.arbSimulation}</span>
        <span className={data.online ? 'arb-online' : 'arb-offline'}>
          {t.arbStatus}: {loading ? t.loading : data.online ? t.arbOnline : t.arbOffline}
        </span>
      </div>

      <div className="tool-field">
        <label>{t.arbNetworks}</label>
        <div className="arb-grid">
          {connectors.map((connector) => (
            <div key={connector.venue} className="arb-card">
              <strong>{connector.venue}</strong>
              <span>{connector.connected ? t.arbOnline : t.arbOffline}</span>
              <span>{connector.latency_ms.toFixed(2)} ms</span>
            </div>
          ))}
          {!connectors.length && <span className="arb-empty">{t.arbOffline}</span>}
        </div>
      </div>

      <div className="tool-field">
        <label>{t.arbOpportunities}</label>
        <div className="arb-stats">
          <div>
            <strong>{data.opportunities?.length || 0}</strong>
            <span>{t.arbOpportunities}</span>
          </div>
          <div>
            <strong>{data.trades?.length || 0}</strong>
            <span>{t.arbTrades}</span>
          </div>
          <div>
            <strong>
              ${topOpportunity ? topOpportunity.estimated_profit_usd.toFixed(2) : '0.00'}
            </strong>
            <span>{t.arbProfit}</span>
          </div>
        </div>
      </div>

      {topOpportunity ? (
        <div className="arb-opportunity">
          <strong>{topOpportunity.symbol}</strong>
          <span>{topOpportunity.buy_venue} → {topOpportunity.sell_venue}</span>
          <span>{topOpportunity.gross_spread_bps.toFixed(2)} bps</span>
          <span>${topOpportunity.estimated_profit_usd.toFixed(2)}</span>
        </div>
      ) : (
        <div className="tool-error arb-warn">{t.arbNoData}</div>
      )}

      <button className="tool-btn primary" onClick={runBacktest}>
        {backtest?.loading ? t.loading : t.arbBacktest}
      </button>
      {backtest && !backtest.loading && !backtest.error && (
        <div className="tool-output">
          <code>
            {backtest.executed_trades} trades · ${backtest.net_profit_usd} net · {backtest.win_rate}% win rate
          </code>
        </div>
      )}
      {backtest?.error && <div className="tool-error">{backtest.error}</div>}

      <style jsx>{`
        .arb-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .arb-tag {
          background: rgba(255, 204, 51, 0.12);
          border: 1px solid rgba(255, 204, 51, 0.4);
          color: #ffcc33;
          padding: 5px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-family: 'JetBrains Mono', monospace;
          text-transform: uppercase;
        }
        .arb-online,
        .arb-offline {
          font-size: 12px;
          font-family: 'JetBrains Mono', monospace;
        }
        .arb-online {
          color: #39ff88;
        }
        .arb-offline {
          color: #ff5566;
        }
        .arb-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 10px;
        }
        .arb-card {
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .arb-card strong {
          color: var(--cyan);
          font-family: 'VT323', monospace;
          font-size: 18px;
          letter-spacing: 0.03em;
        }
        .arb-card span {
          color: var(--dim);
          font-size: 11px;
          font-family: 'JetBrains Mono', monospace;
        }
        .arb-empty {
          color: var(--dim);
          font-size: 12px;
        }
        .arb-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .arb-stats > div {
          display: flex;
          flex-direction: column;
          gap: 3px;
          padding: 12px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.25);
        }
        .arb-stats strong {
          color: var(--cyan);
          font-family: 'VT323', monospace;
          font-size: 22px;
        }
        .arb-stats span {
          color: var(--dim);
          font-size: 10px;
          text-transform: uppercase;
        }
        .arb-opportunity {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          padding: 12px;
          border: 1px solid rgba(57, 255, 136, 0.3);
          border-radius: 10px;
          color: #39ff88;
          font-size: 12px;
        }
        .arb-warn {
          background: rgba(255, 61, 240, 0.06);
          border: 1px solid rgba(255, 61, 240, 0.25);
          border-radius: 10px;
          padding: 10px 12px;
        }
        @media (max-width: 650px) {
          .arb-stats,
          .arb-opportunity {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

function HexTool({ lang }) {
  const t = STR[lang];
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('toHex');
  const [output, setOutput] = useState('');

  function run() {
    try {
      if (mode === 'toHex') {
        setOutput(
          input
            .split('')
            .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
            .join(' ')
        );
      } else {
        setOutput(
          input
            .replace(/\s+/g, '')
            .match(/.{1,2}/g)
            ?.map((b) => String.fromCharCode(parseInt(b, 16)))
            .join('') || ''
        );
      }
    } catch (e) {
      setOutput('Error');
    }
  }

  return (
    <div className="tool-layout">
      <div className="tool-row">
        <button className={`tool-btn ${mode === 'toHex' ? 'active' : ''}`} onClick={() => setMode('toHex')}>
          text → hex
        </button>
        <button className={`tool-btn ${mode === 'fromHex' ? 'active' : ''}`} onClick={() => setMode('fromHex')}>
          hex → text
        </button>
      </div>
      <div className="tool-field">
        <label>{t.input}</label>
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={5} />
      </div>
      <button className="tool-btn primary" onClick={run}>
        {t.run}
      </button>
      {output && (
        <div className="tool-field">
          <label>{t.output}</label>
          <div className="tool-output">
            <code>{output}</code>
            <CopyButton text={output} label={t.copy} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------- Registro ----------------------------- */

const TOOLS = [
  {
    id: 'arbitrage',
    title: { es: 'Arbitraje', en: 'Arbitrage' },
    desc: { es: 'Scanner multi-cadena de flash loan arbitrage', en: 'Multi-chain flash loan arbitrage scanner' },
    category: 'blockchain',
    icon: '⬡',
    color: '#ff3df0',
    component: ArbitrageTool,
  },
  {
    id: 'hash',
    title: { es: 'Hash', en: 'Hash' },
    desc: { es: 'Genera hashes SHA de texto', en: 'Generate SHA hashes from text' },
    category: 'crypto',
    icon: '§',
    color: '#7b5bff',
    component: HashTool,
  },
  {
    id: 'base64',
    title: { es: 'Base64', en: 'Base64' },
    desc: { es: 'Codifica y decodifica Base64', en: 'Encode and decode Base64' },
    category: 'encoding',
    icon: '✉',
    color: '#22e5ff',
    component: Base64Tool,
  },
  {
    id: 'hex',
    title: { es: 'Hex', en: 'Hex' },
    desc: { es: 'Texto a hexadecimal y viceversa', en: 'Text to hex and vice versa' },
    category: 'encoding',
    icon: '0x',
    color: '#39ff88',
    component: HexTool,
  },
  {
    id: 'password',
    title: { es: 'Contraseña', en: 'Password' },
    desc: { es: 'Generador de contraseñas seguras', en: 'Secure password generator' },
    category: 'crypto',
    icon: '⚷',
    color: '#ffcc33',
    component: PasswordTool,
  },
  {
    id: 'json',
    title: { es: 'JSON', en: 'JSON' },
    desc: { es: 'Formatea y minifica JSON', en: 'Format and minify JSON' },
    category: 'utils',
    icon: '{ }',
    color: '#ff3df0',
    component: JsonTool,
  },
  {
    id: 'uuid',
    title: { es: 'UUID', en: 'UUID' },
    desc: { es: 'Genera UUIDs v4', en: 'Generate UUID v4' },
    category: 'system',
    icon: '⧉',
    color: '#22e5ff',
    component: UuidTool,
  },
  {
    id: 'clock',
    title: { es: 'Reloj', en: 'Clock' },
    desc: { es: 'Hora local, UTC y timestamp', en: 'Local time, UTC and timestamp' },
    category: 'system',
    icon: '◷',
    color: '#39ff88',
    component: ClockTool,
  },
];

/* ---------------------------- Panel principal ----------------------- */

export default function ToolsPanel({ lang }) {
  const t = STR[lang];
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return TOOLS.filter((tool) => {
      const matchCat = filter === 'all' || tool.category === filter;
      const text = `${tool.title[lang]} ${tool.desc[lang]}`.toLowerCase();
      const matchQuery = text.includes(q);
      return matchCat && matchQuery;
    });
  }, [filter, query, lang]);

  if (selected) {
    const tool = TOOLS.find((t) => t.id === selected);
    const Component = tool.component;
    return (
      <div className="tools-wrapper">
        <button className="back" onClick={() => setSelected(null)}>
          ← {t.back}
        </button>
        <div className="tool-header" style={{ '--accent': tool.color }}>
          <span className="icon" style={{ color: tool.color }}>
            {tool.icon}
          </span>
          <div>
            <h2>{tool.title[lang]}</h2>
            <p>{tool.desc[lang]}</p>
          </div>
        </div>
        <div className="tool-view">
          <Component lang={lang} />
        </div>
        <style jsx>{`
          .tools-wrapper {
            padding: 4px;
          }
          .back {
            background: none;
            border: 1px solid var(--border);
            color: var(--dim);
            border-radius: 8px;
            padding: 7px 12px;
            font-size: 12px;
            cursor: pointer;
            margin-bottom: 14px;
            font-family: 'JetBrains Mono', monospace;
          }
          .back:hover {
            color: var(--frost);
            border-color: var(--cyan);
          }
          .tool-header {
            display: flex;
            align-items: center;
            gap: 14px;
            margin-bottom: 18px;
            padding-bottom: 14px;
            border-bottom: 1px solid var(--border);
          }
          .tool-header .icon {
            width: 42px;
            height: 42px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid var(--border);
            border-radius: 10px;
            font-size: 18px;
          }
          .tool-header h2 {
            margin: 0;
            font-family: 'VT323', monospace;
            font-size: 24px;
            color: var(--cyan);
            letter-spacing: 0.02em;
          }
          .tool-header p {
            margin: 2px 0 0;
            color: var(--dim);
            font-size: 12px;
          }
          .tool-view {
            background: rgba(0, 0, 0, 0.2);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 18px;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="tools-wrapper">
      <h2 className="tools-title">{t.title}</h2>
      <div className="tools-bar">
        <input
          className="tools-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.search}
        />
        <div className="tools-cats">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
            {t.all}
          </button>
          {Object.keys(CATEGORIES).map((cat) => (
            <button key={cat} className={filter === cat ? 'active' : ''} onClick={() => setFilter(cat)}>
              {CATEGORIES[cat][lang]}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="empty">{t.empty}</p>
      ) : (
        <div className="tools-grid">
          {filtered.map((tool) => (
            <button
              key={tool.id}
              className="tool-card"
              style={{ '--accent': tool.color }}
              onClick={() => setSelected(tool.id)}
            >
              <span className="card-icon" style={{ color: tool.color }}>
                {tool.icon}
              </span>
              <h3>{tool.title[lang]}</h3>
              <p>{tool.desc[lang]}</p>
              <span className="card-cat" style={{ color: CATEGORIES[tool.category].color }}>
                {CATEGORIES[tool.category][lang]}
              </span>
            </button>
          ))}
        </div>
      )}
      <style jsx>{`
        .tools-title {
          font-family: 'VT323', monospace;
          font-weight: 400;
          font-size: 22px;
          color: var(--frost);
          margin: 0 0 18px;
          letter-spacing: 0.02em;
        }
        .tools-bar {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 18px;
        }
        .tools-search {
          width: 100%;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 11px 14px;
          color: var(--frost);
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          outline: none;
        }
        .tools-search:focus {
          border-color: var(--cyan);
        }
        .tools-cats {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .tools-cats button {
          background: none;
          border: 1px solid var(--border);
          color: var(--dim);
          border-radius: 20px;
          padding: 6px 12px;
          font-size: 11px;
          cursor: pointer;
          font-family: 'JetBrains Mono', monospace;
        }
        .tools-cats button.active {
          background: rgba(34, 229, 255, 0.12);
          color: var(--cyan);
          border-color: var(--cyan);
        }
        .tools-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 12px;
        }
        .tool-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 16px;
          text-align: left;
          cursor: pointer;
          transition: transform 0.12s ease, border-color 0.2s ease;
          position: relative;
          overflow: hidden;
        }
        .tool-card:hover {
          transform: translateY(-2px);
          border-color: var(--accent);
        }
        .tool-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--accent);
          opacity: 0.6;
        }
        .card-icon {
          display: block;
          font-size: 22px;
          margin-bottom: 10px;
        }
        .tool-card h3 {
          margin: 0 0 6px;
          font-family: 'VT323', monospace;
          font-size: 20px;
          color: var(--frost);
        }
        .tool-card p {
          margin: 0 0 10px;
          color: var(--dim);
          font-size: 11px;
          line-height: 1.4;
        }
        .card-cat {
          font-size: 10px;
          font-family: 'JetBrains Mono', monospace;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .empty {
          color: var(--dim);
          font-size: 13px;
          text-align: center;
          padding: 30px 0;
        }
        .tool-layout {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .tool-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .tool-field label {
          font-size: 10px;
          color: var(--dim);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-family: 'JetBrains Mono', monospace;
        }
        .tool-field input,
        .tool-field select,
        .tool-field textarea {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 11px 12px;
          color: var(--frost);
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          outline: none;
          resize: vertical;
        }
        .tool-field input:focus,
        .tool-field select:focus,
        .tool-field textarea:focus {
          border-color: var(--cyan);
        }
        .tool-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .tool-row.checks {
          gap: 14px;
        }
        .check {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--dim);
          font-size: 12px;
          cursor: pointer;
        }
        .check input {
          width: 16px;
          height: 16px;
          accent-color: var(--cyan);
        }
        .tool-btn {
          background: var(--panel);
          border: 1px solid var(--border);
          color: var(--frost);
          border-radius: 8px;
          padding: 9px 14px;
          font-size: 12px;
          cursor: pointer;
          font-family: 'JetBrains Mono', monospace;
          transition: 0.2s;
        }
        .tool-btn:hover {
          border-color: var(--cyan);
        }
        .tool-btn.primary {
          background: rgba(34, 229, 255, 0.12);
          border-color: var(--cyan);
          color: var(--cyan);
        }
        .tool-btn.primary:hover {
          background: rgba(34, 229, 255, 0.2);
        }
        .tool-btn.active {
          background: rgba(123, 91, 255, 0.18);
          border-color: var(--violet);
          color: var(--violet);
        }
        .tool-output {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 12px;
          word-break: break-all;
          min-height: 48px;
        }
        .tool-output code,
        .tool-output pre {
          flex: 1;
          margin: 0;
          color: var(--green);
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          white-space: pre-wrap;
        }
        .tool-error {
          color: var(--magenta);
          font-size: 12px;
          font-family: 'JetBrains Mono', monospace;
        }
        .clock-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }
        .clock-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .clock-card .label {
          font-size: 10px;
          color: var(--dim);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .clock-card .value {
          font-family: 'JetBrains Mono', monospace;
          color: var(--frost);
          font-size: 14px;
          word-break: break-all;
        }
        @media (min-width: 780px) {
          .tools-bar {
            flex-direction: row;
            align-items: center;
          }
          .tools-search {
            max-width: 260px;
          }
        }
      `}</style>
    </div>
  );
}
