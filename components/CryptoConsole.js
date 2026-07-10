import { useEffect, useMemo, useRef, useState } from 'react';

const STR = {
  es: {
    title: 'CRYPTO//NODE',
    feed: 'feed en vivo',
    waiting: 'esperando datos de la blockchain…',
    prompt: '>',
    placeholder: 'escribe un comando: hash, b64, hex, pass, uuid, help, clear',
    help: 'comandos: hash <texto>, b64 <texto>, hex <texto>, pass <longitud>, uuid, clear',
    welcome: 'Sistema criptográfico activo. Escribe "help" para ver comandos.',
    error: 'comando no reconocido',
    empty: 'entrada vacía',
    view: 'ver',
  },
  en: {
    title: 'CRYPTO//NODE',
    feed: 'live feed',
    waiting: 'waiting for blockchain data…',
    prompt: '>',
    placeholder: 'type a command: hash, b64, hex, pass, uuid, help, clear',
    help: 'commands: hash <text>, b64 <text>, hex <text>, pass <length>, uuid, clear',
    welcome: 'Cryptographic system active. Type "help" for commands.',
    error: 'unknown command',
    empty: 'empty input',
    view: 'view',
  },
};

async function digest(algo, text) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest(algo, enc.encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generatePassword(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => chars[b % chars.length])
    .join('');
}

function base64Encode(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

function base64Decode(text) {
  return decodeURIComponent(escape(atob(text)));
}

function textToHex(text) {
  return text
    .split('')
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join(' ');
}

function generateUuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return (
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

/* ---------------------------- Feed --------------------------------- */

function BlockchainFeed({ events, lang }) {
  const t = STR[lang];
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [events]);

  if (!events || events.length === 0) {
    return (
      <div className="feed">
        <div className="feed-header">{'>>'} {t.feed}</div>
        <div className="feed-empty">{t.waiting}</div>
        <style jsx>{`
          .feed {
            background: rgba(0, 0, 0, 0.25);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 10px;
            margin-bottom: 12px;
            font-family: 'JetBrains Mono', monospace;
            min-height: 120px;
          }
          .feed-header {
            font-size: 10px;
            color: var(--dim);
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: 8px;
          }
          .feed-empty {
            color: var(--dim);
            font-size: 11px;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="feed">
      <div className="feed-header">{'>>'} {t.feed}</div>
      <div className="feed-body" ref={listRef}>
        {events.map((e) => (
          <a
            key={e.id}
            className="feed-row"
            href={`https://etherscan.io/tx/${e.txHash}`}
            target="_blank"
            rel="noreferrer"
          >
            <span className="symbol">{e.symbol}</span>
            <span className="amount">{e.amount}</span>
            <span className="view">{t.view}</span>
          </a>
        ))}
      </div>
      <style jsx>{`
        .feed {
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 10px;
          margin-bottom: 12px;
          font-family: 'JetBrains Mono', monospace;
        }
        .feed-header {
          font-size: 10px;
          color: var(--dim);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 8px;
        }
        .feed-body {
          display: flex;
          flex-direction: column;
          gap: 6px;
          max-height: 140px;
          overflow-y: auto;
        }
        .feed-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          text-decoration: none;
          color: inherit;
          padding: 4px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        }
        .feed-row:hover {
          background: rgba(255, 255, 255, 0.03);
        }
        .symbol {
          color: var(--cyan);
          min-width: 50px;
        }
        .amount {
          color: var(--frost);
          flex: 1;
          word-break: break-all;
        }
        .view {
          color: var(--dim);
          font-size: 10px;
        }
        .feed-empty {
          color: var(--dim);
          font-size: 11px;
        }
      `}</style>
    </div>
  );
}

/* ---------------------------- Console ------------------------------ */

export default function CryptoConsole({ lang, events = [] }) {
  const t = STR[lang];
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([{ type: 'system', text: t.welcome }]);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  async function execute(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const [cmd, ...rest] = trimmed.split(/\s+/);
    const args = rest.join(' ');
    const out = { type: 'command', text: `> ${raw}` };

    if (cmd === 'clear') {
      setHistory([{ type: 'system', text: t.welcome }]);
      return;
    }

    let response = null;
    try {
      if (cmd === 'help') response = t.help;
      else if (cmd === 'hash') {
        if (!args) throw new Error(t.empty);
        response = await digest('SHA-256', args);
      } else if (cmd === 'b64') {
        if (!args) throw new Error(t.empty);
        response = base64Encode(args);
      } else if (cmd === 'hex') {
        if (!args) throw new Error(t.empty);
        response = textToHex(args);
      } else if (cmd === 'pass') {
        const len = Math.max(4, Math.min(128, Number(args) || 16));
        response = generatePassword(len);
      } else if (cmd === 'uuid') {
        response = generateUuid();
      } else {
        throw new Error(t.error);
      }
    } catch (e) {
      response = e.message || 'error';
    }

    setHistory((prev) => [...prev, out, { type: 'response', text: response }]);
  }

  function onKeyDown(e) {
    if (e.key === 'Enter') {
      execute(input);
      setInput('');
    }
  }

  return (
    <div className="console">
      <div className="console-head">{t.title}</div>
      <BlockchainFeed events={events} lang={lang} />
      <div className="console-body">
        {history.map((h, i) => (
          <div key={i} className={`line ${h.type}`}>
            {h.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="console-input-row">
        <span className="prompt">{t.prompt}</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t.placeholder}
          spellCheck={false}
        />
      </div>
      <style jsx>{`
        .console {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 260px;
        }
        .console-head {
          font-family: 'VT323', monospace;
          font-size: 20px;
          color: var(--cyan);
          letter-spacing: 0.04em;
          margin-bottom: 12px;
        }
        .console-body {
          flex: 1;
          overflow-y: auto;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: var(--frost);
          margin-bottom: 12px;
          max-height: 260px;
        }
        .line {
          margin-bottom: 6px;
          line-height: 1.4;
        }
        .line.command {
          color: var(--green);
        }
        .line.response {
          color: var(--frost);
          word-break: break-all;
        }
        .line.system {
          color: var(--dim);
        }
        .console-input-row {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 10px 12px;
        }
        .prompt {
          color: var(--cyan);
          font-family: 'JetBrains Mono', monospace;
        }
        .console-input-row input {
          flex: 1;
          background: none;
          border: none;
          outline: none;
          color: var(--frost);
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
}
