import { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import ToolsPanel from '../components/ToolsPanel';
import Globe3D from '../components/Globe3D';
import CryptoConsole from '../components/CryptoConsole';
import MonitorPanel from '../components/MonitorPanel';

/* ================================================================== */
/*  NEXUS//OS — panel de control estilo terminal hacker (multicolor)   */
/*                                                                      */
/*  Paleta:                                                             */
/*   --void   #05060a   fondo                                          */
/*   --panel  rgba(9,14,18,.72)  cristal de terminal                   */
/*   --border rgba(90,230,220,.18)                                     */
/*   --cyan   #22e5ff   acento primario                                */
/*   --magenta#ff3df0   acento secundario                               */
/*   --green  #39ff88   acento terciario / "ok"                         */
/*   --amber  #ffcc33   advertencia                                     */
/*   --violet #7b5bff   detalle                                         */
/*   --frost  #d8faff   texto principal                                 */
/*   --dim    #6f96a0   texto secundario                                */
/*                                                                      */
/*  Tipografía: 'VT323' (display, look CRT) + 'JetBrains Mono' (cuerpo) */
/* ================================================================== */

const STRINGS = {
  es: {
    brand: 'NEXUS//OS',
    loginTitle: 'ACCESO AL SISTEMA',
    loginSub: 'Autenticación requerida para continuar',
    user: 'usuario',
    remember: 'recordar sesión',
    demoHint: 'demo: admin',
    enter: 'conectar',
    verifying: 'verificando…',
    nav: { resumen: 'Resumen', actividad: 'Actividad', analisis: 'Análisis', tools: 'Herramientas', ajustes: 'Ajustes' },
    logout: 'cerrar sesión',
    stats: { visitors: 'Visitantes hoy', revenue: 'Ingresos del mes', uptime: 'Disponibilidad', weather: 'Clima exterior' },
    weeklyActivity: 'Actividad semanal',
    recentActivity: 'Actividad reciente',
    monthlyTrend: 'Tendencia mensual',
    exportCsv: 'exportar .csv',
    settingsTitle: 'ajustes del sistema',
    language: 'idioma',
    colorMode: 'modo de color',
    multicolor: 'multicolor',
    mono: 'monocromo',
    notifications: 'notificaciones',
    markAllRead: 'marcar todo leído',
    noNotifications: 'sin notificaciones nuevas',
    toolsTitle: 'herramientas del sistema',
    toolsCategory: 'categoría',
    toolsAll: 'todas',
    toolsSearch: 'buscar herramienta…',
    toolsEmpty: 'no se encontraron herramientas',
    cmdPlaceholder: 'escribe un comando o busca…',
    noResults: 'sin resultados',
    loadingLabel: 'cargando datos…',
    weatherLoading: 'consultando satélite…',
    weatherError: 'sin señal — datos en caché',
    system: 'sistema',
    danger: 'zona de riesgo',
    online: 'en línea',
    close: 'cerrar',
  },
  en: {
    brand: 'NEXUS//OS',
    loginTitle: 'SYSTEM ACCESS',
    loginSub: 'Authentication required to continue',
    user: 'user',
    remember: 'remember session',
    demoHint: 'demo: admin',
    enter: 'connect',
    verifying: 'verifying…',
    nav: { resumen: 'Overview', actividad: 'Activity', analisis: 'Analytics', tools: 'Tools', ajustes: 'Settings' },
    logout: 'log out',
    stats: { visitors: 'Visitors today', revenue: 'Revenue this month', uptime: 'Uptime', weather: 'Outside weather' },
    weeklyActivity: 'Weekly activity',
    recentActivity: 'Recent activity',
    monthlyTrend: 'Monthly trend',
    exportCsv: 'export .csv',
    settingsTitle: 'system settings',
    language: 'language',
    colorMode: 'color mode',
    multicolor: 'multicolor',
    mono: 'monochrome',
    notifications: 'notifications',
    markAllRead: 'mark all read',
    noNotifications: 'no new notifications',
    toolsTitle: 'system tools',
    toolsCategory: 'category',
    toolsAll: 'all',
    toolsSearch: 'search tool…',
    toolsEmpty: 'no tools found',
    cmdPlaceholder: 'type a command or search…',
    noResults: 'no results',
    loadingLabel: 'loading data…',
    weatherLoading: 'pinging satellite…',
    weatherError: 'no signal — cached data',
    system: 'system',
    danger: 'danger zone',
    online: 'online',
    close: 'close',
  },
};

const NAV_ITEMS = ['resumen', 'actividad', 'analisis', 'tools', 'ajustes'];

const WEEK = [
  { d: { es: 'Lun', en: 'Mon' }, v: 42 },
  { d: { es: 'Mar', en: 'Tue' }, v: 68 },
  { d: { es: 'Mié', en: 'Wed' }, v: 55 },
  { d: { es: 'Jue', en: 'Thu' }, v: 80 },
  { d: { es: 'Vie', en: 'Fri' }, v: 95 },
  { d: { es: 'Sáb', en: 'Sat' }, v: 34 },
  { d: { es: 'Dom', en: 'Sun' }, v: 21 },
];

const MONTH_LABELS = {
  es: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};
const MONTHLY = [32, 40, 35, 50, 49, 60, 72, 68, 80, 75, 90, 88];

const INITIAL_NOTIFICATIONS = [
  { id: 1, es: 'Copia de seguridad completada', en: 'Backup completed successfully', read: false, time: '21:42' },
  { id: 2, es: 'Nuevo dispositivo conectado', en: 'New device connected', read: false, time: '19:10' },
  { id: 3, es: 'Informe semanal generado', en: 'Weekly report generated', read: false, time: '16:03' },
  { id: 4, es: 'Parche de seguridad aplicado', en: 'Security patch applied', read: true, time: '11:27' },
];

const RECENT_ACTIVITY = [
  { es: 'Copia de seguridad completada', en: 'Backup completed', time: '21:42' },
  { es: 'Nuevo dispositivo conectado', en: 'New device connected', time: '19:10' },
  { es: 'Informe semanal generado', en: 'Weekly report generated', time: '16:03' },
  { es: 'Actualización de seguridad aplicada', en: 'Security update applied', time: '11:27' },
];

const MATRIX_CHARS =
  'アイウエオカキクケコサシスセソ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$#%&@+=*<>/'.split('');

/* ---------------------------- MatrixRain ---------------------------- */

function MatrixRain({ colorMode }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let width = 0;
    let height = 0;
    let fontSize = 16;
    let columns = 0;
    let drops = [];
    let colors = [];
    let interval = null;
    let paused = false;

    const PALETTE_MULTI = ['#22e5ff', '#ff3df0', '#39ff88', '#ffcc33', '#7b5bff', '#ff5566'];
    const PALETTE_MONO = ['#39ff88', '#1fdc70', '#0fae55', '#67ffb0'];

    function setup() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      columns = Math.ceil(width / fontSize);
      drops = new Array(columns).fill(0).map(() => Math.floor(Math.random() * -40));
      const palette = colorMode === 'mono' ? PALETTE_MONO : PALETTE_MULTI;
      colors = new Array(columns).fill(0).map(() => palette[Math.floor(Math.random() * palette.length)]);
      ctx.fillStyle = '#05060a';
      ctx.fillRect(0, 0, width, height);
    }

    function draw() {
      if (paused) return;
      ctx.fillStyle = 'rgba(5,6,10,0.11)';
      ctx.fillRect(0, 0, width, height);
      ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
      for (let i = 0; i < columns; i++) {
        const char = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
        ctx.fillStyle = colors[i];
        ctx.fillText(char, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    }

    function onResize() {
      setup();
    }
    function onVisibility() {
      paused = document.hidden;
    }

    setup();
    interval = setInterval(draw, 45);
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [colorMode]);

  return <canvas ref={canvasRef} className="matrix-canvas" aria-hidden="true" />;
}

/* ---------------------------- Avatar ---------------------------- */

function Avatar({ name, size = 38 }) {
  const initials = (name || '?').trim().slice(0, 2).toUpperCase();
  return (
    <div className="avatar" style={{ width: size, height: size }}>
      <span>{initials}</span>
      <i className="ring" />
      <style jsx>{`
        .avatar {
          position: relative;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(34, 229, 255, 0.18), rgba(255, 61, 240, 0.18));
          border: 1px solid var(--border);
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          color: var(--frost);
          flex-shrink: 0;
        }
        .ring {
          position: absolute;
          bottom: -1px;
          right: -1px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--green);
          border: 2px solid var(--void);
          box-shadow: 0 0 6px var(--green);
        }
      `}</style>
    </div>
  );
}

/* ---------------------------- Notificaciones ---------------------------- */

function NotificationBell({ notifications, setNotifications, lang, t }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function markRead(id) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }
  function markAll() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return (
    <div className="bell-wrap" ref={ref}>
      <button className="bell" onClick={() => setOpen((o) => !o)} aria-label={t.notifications}>
        ⚡
        {unread > 0 && <span className="badge">{unread}</span>}
      </button>
      {open && (
        <div className="dropdown">
          <div className="dropdown-head">
            <span>{t.notifications}</span>
            <button onClick={markAll}>{t.markAllRead}</button>
          </div>
          {notifications.length === 0 ? (
            <p className="empty">{t.noNotifications}</p>
          ) : (
            <ul>
              {notifications.map((n) => (
                <li key={n.id} className={n.read ? 'read' : ''} onClick={() => markRead(n.id)}>
                  <span className="dot" />
                  <span className="ntext">{n[lang]}</span>
                  <span className="ntime">{n.time}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <style jsx>{`
        .bell-wrap {
          position: relative;
        }
        .bell {
          position: relative;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 10px;
          width: 38px;
          height: 38px;
          color: var(--cyan);
          font-size: 15px;
          cursor: pointer;
        }
        .badge {
          position: absolute;
          top: -5px;
          right: -5px;
          background: var(--magenta);
          color: #05060a;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          font-weight: 700;
          min-width: 16px;
          height: 16px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 3px;
        }
        .dropdown {
          position: absolute;
          right: 0;
          top: 46px;
          width: 280px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          backdrop-filter: blur(16px);
          z-index: 30;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
        }
        .dropdown-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          border-bottom: 1px solid var(--border);
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--dim);
        }
        .dropdown-head button {
          background: none;
          border: none;
          color: var(--cyan);
          font-size: 10px;
          cursor: pointer;
          font-family: 'JetBrains Mono', monospace;
        }
        .empty {
          padding: 18px 14px;
          font-size: 12px;
          color: var(--dim);
          margin: 0;
        }
        ul {
          list-style: none;
          margin: 0;
          padding: 6px;
          max-height: 260px;
          overflow-y: auto;
        }
        li {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 8px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 12px;
        }
        li:hover {
          background: rgba(255, 255, 255, 0.04);
        }
        li.read {
          opacity: 0.45;
        }
        .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--magenta);
          flex-shrink: 0;
        }
        li.read .dot {
          background: var(--dim);
        }
        .ntext {
          flex: 1;
          color: var(--frost);
        }
        .ntime {
          color: var(--dim);
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
        }
      `}</style>
    </div>
  );
}

/* ---------------------------- Paleta de comandos ---------------------------- */

function CommandPalette({ open, onClose, commands, t }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current && inputRef.current.focus(), 20);
    }
  }, [open]);

  if (!open) return null;

  const filtered = commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()));

  function runFirst() {
    if (filtered.length > 0) {
      filtered[0].action();
      onClose();
    }
  }

  return (
    <div className="palette-overlay" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <div className="palette-input-row">
          <span className="prompt">&gt;</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.cmdPlaceholder}
            onKeyDown={(e) => {
              if (e.key === 'Enter') runFirst();
              if (e.key === 'Escape') onClose();
            }}
          />
          <kbd>esc</kbd>
        </div>
        <ul>
          {filtered.length === 0 && <li className="empty">{t.noResults}</li>}
          {filtered.map((c) => (
            <li
              key={c.id}
              onClick={() => {
                c.action();
                onClose();
              }}
            >
              <span className="icon">{c.icon}</span>
              <span>{c.label}</span>
            </li>
          ))}
        </ul>
      </div>
      <style jsx>{`
        .palette-overlay {
          position: fixed;
          inset: 0;
          background: rgba(2, 3, 6, 0.65);
          backdrop-filter: blur(4px);
          z-index: 100;
          display: flex;
          justify-content: center;
          padding-top: 12vh;
        }
        .palette {
          width: min(520px, 92vw);
          height: fit-content;
          background: #0a0f14;
          border: 1px solid var(--cyan);
          border-radius: 14px;
          box-shadow: 0 0 0 1px rgba(34, 229, 255, 0.15), 0 30px 80px rgba(0, 0, 0, 0.6);
          overflow: hidden;
        }
        .palette-input-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
          border-bottom: 1px solid var(--border);
        }
        .prompt {
          color: var(--green);
          font-family: 'JetBrains Mono', monospace;
        }
        input {
          flex: 1;
          background: none;
          border: none;
          outline: none;
          color: var(--frost);
          font-family: 'JetBrains Mono', monospace;
          font-size: 14px;
        }
        kbd {
          font-size: 10px;
          color: var(--dim);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 2px 5px;
          font-family: 'JetBrains Mono', monospace;
        }
        ul {
          list-style: none;
          margin: 0;
          padding: 6px;
          max-height: 320px;
          overflow-y: auto;
        }
        li {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 10px;
          border-radius: 8px;
          font-size: 13px;
          color: var(--frost);
          cursor: pointer;
          font-family: 'JetBrains Mono', monospace;
        }
        li:hover {
          background: rgba(34, 229, 255, 0.08);
        }
        li.empty {
          color: var(--dim);
          cursor: default;
        }
        li.empty:hover {
          background: none;
        }
        .icon {
          color: var(--cyan);
          width: 16px;
        }
      `}</style>
    </div>
  );
}

/* ---------------------------- Login ---------------------------- */

function LoginView({ onSuccess, lang, setLang, t }) {
  const [user, setUser] = useState('');
  const [remember, setRemember] = useState(false);
  const [status, setStatus] = useState('idle');

  function submit(e) {
    e.preventDefault();
    if (status === 'verifying') return;
    setStatus('verifying');
    setTimeout(() => {
      onSuccess(user.trim() || 'admin', remember);
      setStatus('idle');
    }, 600);
  }

  return (
    <div className="login-overlay">
      <div className="login-card">
        <div className="login-icon">◈</div>
        <h2>{t.loginTitle}</h2>
        <p>{t.loginSub}</p>
        <form onSubmit={submit}>
          <label>
            <span>{t.user}</span>
            <input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              autoFocus
              spellCheck={false}
            />
          </label>
          <label className="remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>{t.remember}</span>
          </label>
          <button className="submit" disabled={status === 'verifying'}>
            {status === 'verifying' ? t.verifying : t.enter}
          </button>
        </form>
        <div className="demo-hint">{t.demoHint}</div>
        <div className="lang-toggle">
          <button className={lang === 'es' ? 'active' : ''} onClick={() => setLang('es')}>ES</button>
          <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
        </div>
      </div>
      <style jsx>{`
        .login-overlay {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          position: relative;
          z-index: 1;
        }
        .login-card {
          width: min(380px, 100%);
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 28px 24px;
          backdrop-filter: blur(18px);
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
        }
        .login-icon {
          color: var(--magenta);
          font-size: 36px;
          text-align: center;
          margin-bottom: 8px;
        }
        .login-card h2 {
          font-family: 'VT323', monospace;
          font-weight: 400;
          font-size: 28px;
          text-align: center;
          margin: 0 0 6px;
          color: var(--cyan);
          letter-spacing: 0.04em;
        }
        .login-card p {
          text-align: center;
          color: var(--dim);
          font-size: 12px;
          margin: 0 0 22px;
        }
        form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 11px;
          color: var(--dim);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-family: 'JetBrains Mono', monospace;
        }
        input[type='text'],
        input[type='password'],
        input {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 12px 12px;
          color: var(--frost);
          font-family: 'JetBrains Mono', monospace;
          font-size: 14px;
          outline: none;
        }
        input:focus {
          border-color: var(--cyan);
        }
        input:disabled {
          opacity: 0.5;
        }
        .remember {
          flex-direction: row;
          align-items: center;
          text-transform: none;
        }
        .remember input {
          width: 16px;
          height: 16px;
          accent-color: var(--cyan);
        }
        .error {
          color: var(--magenta);
          font-size: 12px;
          text-align: center;
          font-family: 'JetBrains Mono', monospace;
        }
        .submit {
          background: linear-gradient(135deg, rgba(34, 229, 255, 0.18), rgba(123, 91, 255, 0.25));
          border: 1px solid var(--border);
          color: var(--frost);
          padding: 13px;
          border-radius: 10px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          cursor: pointer;
          transition: 0.2s;
        }
        .submit:hover {
          border-color: var(--cyan);
        }
        .submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .demo-hint {
          text-align: center;
          color: var(--dim);
          font-size: 11px;
          margin-top: 14px;
          font-family: 'JetBrains Mono', monospace;
        }
        .lang-toggle {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-top: 18px;
        }
        .lang-toggle button {
          background: none;
          border: 1px solid var(--border);
          color: var(--dim);
          border-radius: 6px;
          padding: 5px 10px;
          font-size: 11px;
          cursor: pointer;
          font-family: 'JetBrains Mono', monospace;
        }
        .lang-toggle button.active {
          background: rgba(34, 229, 255, 0.14);
          color: var(--cyan);
          border-color: var(--cyan);
        }
      `}</style>
    </div>
  );
}

/* ---------------------------- WeeklyBars ---------------------------- */

function WeeklyBars({ mounted, lang }) {
  const max = Math.max(...WEEK.map((w) => w.v));
  return (
    <div className="weekly-bars">
      {WEEK.map((w, i) => (
        <div key={w.d[lang]} className="bar-wrap">
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                height: mounted ? `${(w.v / max) * 100}%` : '0%',
                transitionDelay: `${i * 60}ms`,
              }}
            />
          </div>
          <span className="bar-label">{w.d[lang]}</span>
        </div>
      ))}
      <style jsx>{`
        .weekly-bars {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 10px;
          height: 160px;
          padding-top: 10px;
        }
        .bar-wrap {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .bar-track {
          width: 100%;
          height: 120px;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 8px 8px 0 0;
          display: flex;
          align-items: flex-end;
          overflow: hidden;
        }
        .bar-fill {
          width: 100%;
          background: linear-gradient(180deg, var(--cyan), rgba(34, 229, 255, 0.2));
          border-radius: 8px 8px 0 0;
          transition: height 0.6s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .bar-label {
          font-size: 10px;
          color: var(--dim);
          font-family: 'JetBrains Mono', monospace;
        }
      `}</style>
    </div>
  );
}

/* ---------------------------- LineChart ---------------------------- */

function LineChart({ lang }) {
  const max = Math.max(...MONTHLY);
  const min = Math.min(...MONTHLY);
  const range = max - min || 1;
  const points = MONTHLY.map((v, i) => {
    const x = (i / (MONTHLY.length - 1)) * 100;
    const y = 100 - ((v - min) / range) * 80 - 10;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="line-chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="chart-svg">
        <defs>
          <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(34, 229, 255, 0.35)" />
            <stop offset="100%" stopColor="rgba(34, 229, 255, 0)" />
          </linearGradient>
        </defs>
        <polyline
          fill="none"
          stroke="var(--cyan)"
          strokeWidth="0.5"
          points={points}
          vectorEffect="non-scaling-stroke"
        />
        <polygon fill="url(#lineGradient)" points={`0,100 ${points} 100,100`} />
        {MONTHLY.map((v, i) => {
          const x = (i / (MONTHLY.length - 1)) * 100;
          const y = 100 - ((v - min) / range) * 80 - 10;
          return <circle key={i} cx={x} cy={y} r="0.8" fill="var(--frost)" />;
        })}
      </svg>
      <div className="line-labels">
        {MONTH_LABELS[lang].map((m, i) => (
          <span key={m} className={i % 3 === 0 ? '' : 'dim'}>
            {m}
          </span>
        ))}
      </div>
      <style jsx>{`
        .line-chart {
          height: 220px;
          position: relative;
        }
        .chart-svg {
          width: 100%;
          height: 180px;
          overflow: visible;
        }
        .line-labels {
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          color: var(--dim);
          font-family: 'JetBrains Mono', monospace;
          margin-top: 8px;
        }
        .line-labels .dim {
          opacity: 0.35;
        }
      `}</style>
    </div>
  );
}

/* ---------------------------- Dashboard ---------------------------- */

function DashboardView({
  user,
  onLogout,
  lang,
  setLang,
  colorMode,
  setColorMode,
  notifications,
  setNotifications,
  onOpenPalette,
}) {
  const [activeTab, setActiveTab] = useState('resumen');
  const [glitching, setGlitching] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [feedMeta, setFeedMeta] = useState(null);
  const [showMonitor, setShowMonitor] = useState(false);
  const t = STRINGS[lang];

  useEffect(() => {
    setMounted(true);
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    function onNav(e) {
      changeTab(e.detail);
    }
    window.addEventListener('nexus-nav', onNav);
    return () => window.removeEventListener('nexus-nav', onNav);
  }, []);

  useEffect(() => {
    async function fetchFeed() {
      try {
        const res = await fetch('/api/feed');
        if (!res.ok) return;
        const data = await res.json();
        if (data.meta) setFeedMeta(data.meta);
        if (Array.isArray(data.events)) {
          setEvents((prev) => {
            const map = new Map(prev.map((e) => [e.id, e]));
            for (const e of data.events) {
              map.set(e.id, { ...e, createdAt: e.createdAt || Date.now() });
            }
            const all = Array.from(map.values());
            all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            return all.slice(0, 40);
          });
        }
      } catch (e) {
        /* silenciar errores de red */
      }
    }
    fetchFeed();
    const i = setInterval(fetchFeed, 12000);
    return () => clearInterval(i);
  }, []);

  function changeTab(id) {
    setGlitching(true);
    setTimeout(() => {
      setActiveTab(id);
      setGlitching(false);
    }, 160);
  }

  function exportCSV() {
    const rows = [['month', 'value'], ...MONTH_LABELS[lang].map((m, i) => [m, MONTHLY[i]])];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'monthly_trend.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const timeStr = now.toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const dateStr = now.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="app-shell">
      <div className="scan-overlay" />

      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">◈</span>
          <span className="brand-name">{t.brand}</span>
        </div>
        <nav>
          {NAV_ITEMS.map((id) => (
            <button key={id} className={`nav-item ${activeTab === id ? 'active' : ''}`} onClick={() => changeTab(id)}>
              <span className="nav-icon">▸</span>
              <span>{t.nav[id]}</span>
            </button>
          ))}
        </nav>
        <button className="cmd-hint" onClick={onOpenPalette}>
          ⌘K
        </button>
        <button className="logout-desktop" onClick={onLogout}>
          {t.logout}
        </button>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <Avatar name={user} />
            <div>
              <h1>{t.brand}</h1>
              <p className="date">
                {dateStr} · {user}
              </p>
            </div>
          </div>
          <div className="topbar-right">
            <div className="clock">{timeStr}</div>
            <NotificationBell notifications={notifications} setNotifications={setNotifications} lang={lang} t={t} />
          </div>
        </header>

        <div className={`tab-content ${glitching ? 'glitch' : ''}`}>
          {activeTab === 'resumen' && (
            <>
              <section className="hero-globe">
                <div className="globe-panel">
                  <Globe3D events={events} onClick={() => setShowMonitor((s) => !s)} />
                </div>
                <div className="console-panel">
                  {showMonitor ? (
                    <MonitorPanel
                      lang={lang}
                      events={events}
                      meta={feedMeta}
                      onClose={() => setShowMonitor(false)}
                    />
                  ) : (
                    <CryptoConsole lang={lang} events={events} />
                  )}
                </div>
              </section>
              <section className="panels">
                <div className="panel chart-panel">
                  <h2>{t.weeklyActivity}</h2>
                  <WeeklyBars mounted={mounted} lang={lang} />
                </div>
                <div className="panel activity-panel">
                  <h2>{t.recentActivity}</h2>
                  <ul>
                    {RECENT_ACTIVITY.map((a) => (
                      <li key={a.time + a.es}>
                        <span className="dot" />
                        <span className="atext">{a[lang]}</span>
                        <span className="atime">{a.time}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            </>
          )}

          {activeTab === 'actividad' && (
            <section className="panel">
              <h2>{t.recentActivity}</h2>
              <ul className="full-log">
                {[...RECENT_ACTIVITY, ...RECENT_ACTIVITY].map((a, i) => (
                  <li key={i}>
                    <span className="dot" />
                    <span className="atext">{a[lang]}</span>
                    <span className="atime">{a.time}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {activeTab === 'analisis' && (
            <section className="panel">
              <div className="panel-head">
                <h2>{t.monthlyTrend}</h2>
                <button className="export-btn" onClick={exportCSV}>
                  ⬇ {t.exportCsv}
                </button>
              </div>
              <LineChart lang={lang} />
            </section>
          )}

          {activeTab === 'tools' && (
            <section className="panel tools-panel">
              <ToolsPanel lang={lang} />
            </section>
          )}

          {activeTab === 'ajustes' && (
            <section className="panel settings-panel">
              <h2>{t.settingsTitle}</h2>
              <div className="setting-row">
                <span>{t.language}</span>
                <div className="segmented">
                  <button className={lang === 'es' ? 'active' : ''} onClick={() => setLang('es')}>
                    ES
                  </button>
                  <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>
                    EN
                  </button>
                </div>
              </div>
              <div className="setting-row">
                <span>{t.colorMode}</span>
                <div className="segmented">
                  <button
                    className={colorMode === 'multicolor' ? 'active' : ''}
                    onClick={() => setColorMode('multicolor')}
                  >
                    {t.multicolor}
                  </button>
                  <button className={colorMode === 'mono' ? 'active' : ''} onClick={() => setColorMode('mono')}>
                    {t.mono}
                  </button>
                </div>
              </div>
              <div className="setting-row">
                <span>{t.exportCsv}</span>
                <button className="export-btn" onClick={exportCSV}>
                  ⬇ {t.exportCsv}
                </button>
              </div>
              <div className="danger-zone">
                <span>{t.danger}</span>
                <button className="logout-btn" onClick={onLogout}>
                  {t.logout}
                </button>
              </div>
            </section>
          )}
        </div>
      </main>

      <nav className="tabbar">
        {NAV_ITEMS.map((id) => (
          <button key={id} className={`tab-item ${activeTab === id ? 'active' : ''}`} onClick={() => changeTab(id)}>
            <span>▸</span>
            <small>{t.nav[id]}</small>
          </button>
        ))}
        <button className="tab-item" onClick={onLogout}>
          <span>⏻</span>
          <small>{t.logout}</small>
        </button>
      </nav>

      <style jsx>{`
        .app-shell {
          position: relative;
          min-height: 100dvh;
          display: flex;
          padding-bottom: env(safe-area-inset-bottom);
        }
        .scan-overlay {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 4;
          background: repeating-linear-gradient(
            0deg,
            rgba(255, 255, 255, 0.02) 0px,
            rgba(255, 255, 255, 0.02) 1px,
            transparent 1px,
            transparent 3px
          );
          mix-blend-mode: overlay;
        }
        .sidebar {
          display: none;
        }
        .main {
          flex: 1;
          padding: 20px 16px 96px;
          max-width: 1100px;
          margin: 0 auto;
          width: 100%;
        }
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          padding-top: 6px;
          gap: 10px;
        }
        .topbar-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        .topbar-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .topbar h1 {
          font-family: 'VT323', monospace;
          font-weight: 400;
          font-size: 24px;
          color: var(--cyan);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .date {
          color: var(--dim);
          font-size: 12px;
          margin: 2px 0 0;
          text-transform: capitalize;
          font-family: 'JetBrains Mono', monospace;
        }
        .clock {
          font-family: 'JetBrains Mono', monospace;
          color: var(--green);
          font-size: 14px;
          background: var(--panel);
          border: 1px solid var(--border);
          padding: 8px 12px;
          border-radius: 10px;
          backdrop-filter: blur(10px);
        }
        .tab-content {
          transition: opacity 0.16s ease, filter 0.16s ease;
        }
        .tab-content.glitch {
          opacity: 0.3;
          filter: hue-rotate(40deg) blur(1px);
        }
        .hero-globe {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          margin-bottom: 18px;
        }
        .globe-panel {
          min-height: 320px;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
        }
        .console-panel {
          min-height: 320px;
        }
        .panels {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .panel {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 18px;
          backdrop-filter: blur(14px);
        }
        .panel-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .panel h2 {
          font-family: 'VT323', monospace;
          font-weight: 400;
          font-size: 20px;
          letter-spacing: 0.02em;
          color: var(--frost);
          margin: 0 0 16px;
        }
        .export-btn {
          background: rgba(34, 229, 255, 0.08);
          border: 1px solid var(--border);
          color: var(--cyan);
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          padding: 7px 12px;
          border-radius: 8px;
          cursor: pointer;
          margin-bottom: 16px;
        }
        .export-btn:hover {
          border-color: var(--cyan);
        }
        .activity-panel ul,
        .full-log {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .activity-panel li,
        .full-log li {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
        }
        .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--cyan);
          flex-shrink: 0;
        }
        .atext {
          color: var(--frost);
          flex: 1;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
        }
        .atime {
          color: var(--dim);
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
        }
        .settings-panel {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .setting-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13px;
          color: var(--dim);
          font-family: 'JetBrains Mono', monospace;
        }
        .segmented {
          display: flex;
          border: 1px solid var(--border);
          border-radius: 8px;
          overflow: hidden;
        }
        .segmented button {
          background: none;
          border: none;
          color: var(--dim);
          padding: 7px 12px;
          font-size: 11px;
          cursor: pointer;
          font-family: 'JetBrains Mono', monospace;
        }
        .segmented button.active {
          background: rgba(34, 229, 255, 0.14);
          color: var(--cyan);
        }
        .danger-zone {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border: 1px solid rgba(255, 85, 102, 0.3);
          border-radius: 10px;
          padding: 12px 14px;
          color: #ff8f9a;
          font-size: 12px;
        }
        .logout-btn {
          background: rgba(255, 85, 102, 0.1);
          border: 1px solid rgba(255, 85, 102, 0.4);
          color: #ff8f9a;
          padding: 7px 12px;
          border-radius: 8px;
          font-size: 11px;
          cursor: pointer;
          font-family: 'JetBrains Mono', monospace;
        }
        .tabbar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          justify-content: space-around;
          background: rgba(5, 6, 10, 0.85);
          border-top: 1px solid var(--border);
          backdrop-filter: blur(16px);
          padding: 8px 4px calc(8px + env(safe-area-inset-bottom));
          z-index: 10;
        }
        .tab-item {
          background: none;
          border: none;
          color: var(--dim);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          font-size: 14px;
          cursor: pointer;
          padding: 4px 8px;
          font-family: 'JetBrains Mono', monospace;
        }
        .tab-item small {
          font-size: 9px;
        }
        .tab-item.active {
          color: var(--cyan);
        }
        .logout-desktop,
        .cmd-hint {
          display: none;
        }

        @media (min-width: 780px) {
          .sidebar {
            display: flex;
            flex-direction: column;
            width: 220px;
            padding: 24px 18px;
            border-right: 1px solid var(--border);
            background: rgba(8, 12, 20, 0.5);
            backdrop-filter: blur(14px);
          }
          .sidebar .brand {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 32px;
          }
          .brand-mark {
            color: var(--magenta);
          }
          .brand-name {
            font-family: 'JetBrains Mono', monospace;
            letter-spacing: 0.24em;
            font-size: 12px;
            color: var(--dim);
          }
          .nav-item {
            display: flex;
            align-items: center;
            gap: 10px;
            width: 100%;
            padding: 10px 12px;
            border-radius: 10px;
            border: none;
            background: none;
            color: var(--dim);
            font-size: 13px;
            cursor: pointer;
            margin-bottom: 4px;
            text-align: left;
            font-family: 'JetBrains Mono', monospace;
          }
          .nav-item:hover {
            background: rgba(255, 255, 255, 0.04);
            color: var(--frost);
          }
          .nav-item.active {
            background: rgba(34, 229, 255, 0.1);
            color: var(--cyan);
          }
          .nav-icon {
            font-size: 11px;
            width: 12px;
            color: var(--magenta);
          }
          .cmd-hint {
            display: block;
            margin-top: auto;
            background: none;
            border: 1px solid var(--border);
            color: var(--dim);
            padding: 8px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 11px;
            font-family: 'JetBrains Mono', monospace;
            margin-bottom: 8px;
          }
          .logout-desktop {
            display: block;
            background: none;
            border: 1px solid var(--border);
            color: var(--dim);
            padding: 10px;
            border-radius: 10px;
            cursor: pointer;
            font-size: 12px;
            font-family: 'JetBrains Mono', monospace;
          }
          .logout-desktop:hover {
            color: var(--frost);
            border-color: var(--cyan);
          }
          .tabbar {
            display: none;
          }
          .main {
            padding: 32px 40px 40px;
          }
          .hero-globe {
            grid-template-columns: 1.4fr 1fr;
          }
          .globe-panel {
            min-height: 420px;
          }
          .console-panel {
            min-height: 420px;
          }
          .panels {
            flex-direction: row;
          }
          .chart-panel {
            flex: 1.4;
          }
          .activity-panel {
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
}

/* ---------------------------- Home ---------------------------- */

export default function Home() {
  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState('');
  const [checking, setChecking] = useState(true);
  const [lang, setLang] = useState('es');
  const [colorMode, setColorMode] = useState('multicolor');
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const t = STRINGS[lang];

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('nexus_user');
      const savedLang = window.localStorage.getItem('nexus_lang');
      const savedMode = window.localStorage.getItem('nexus_color_mode');
      if (saved) {
        setUser(saved);
        setAuthed(true);
      }
      if (savedLang) setLang(savedLang);
      if (savedMode) setColorMode(savedMode);
    } catch (e) {
      /* almacenamiento no disponible */
    }
    setChecking(false);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('nexus_lang', lang);
      window.localStorage.setItem('nexus_color_mode', colorMode);
    } catch (e) {
      /* ignorar */
    }
  }, [lang, colorMode]);

  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if (e.key === 'Escape') setPaletteOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function handleLoginSuccess(name, remember) {
    setUser(name);
    setAuthed(true);
    if (remember) {
      try {
        window.localStorage.setItem('nexus_user', name);
      } catch (e) {
        /* ignorar */
      }
    }
  }

  function handleLogout() {
    setAuthed(false);
    setUser('');
    setPaletteOpen(false);
    try {
      window.localStorage.removeItem('nexus_user');
    } catch (e) {
      /* ignorar */
    }
  }

  const commands = useMemo(() => {
    if (!authed) return [];
    const base = NAV_ITEMS.map((id) => ({
      id: `nav-${id}`,
      label: `${t.nav[id]}`,
      icon: '▸',
      action: () => window.dispatchEvent(new CustomEvent('nexus-nav', { detail: id })),
    }));
    return [
      ...base,
      {
        id: 'toggle-lang',
        label: lang === 'es' ? 'Switch to English' : 'Cambiar a Español',
        icon: '◈',
        action: () => setLang(lang === 'es' ? 'en' : 'es'),
      },
      {
        id: 'toggle-mode',
        label: colorMode === 'multicolor' ? t.mono : t.multicolor,
        icon: '◉',
        action: () => setColorMode(colorMode === 'multicolor' ? 'mono' : 'multicolor'),
      },
      { id: 'logout', label: t.logout, icon: '⏻', action: handleLogout },
    ];
  }, [authed, lang, colorMode, t]);

  return (
    <>
      <Head>
        <title>NEXUS//OS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#05060a" />
      </Head>

      <MatrixRain colorMode={colorMode} />

      {checking ? (
        <div className="loading-screen">
          <span className="spinner" />
        </div>
      ) : authed ? (
        <DashboardView
          user={user}
          onLogout={handleLogout}
          lang={lang}
          setLang={setLang}
          colorMode={colorMode}
          setColorMode={setColorMode}
          notifications={notifications}
          setNotifications={setNotifications}
          onOpenPalette={() => setPaletteOpen(true)}
        />
      ) : (
        <LoginView onSuccess={handleLoginSuccess} lang={lang} setLang={setLang} t={t} />
      )}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} t={t} />

      <style jsx global>{`
        :root {
          --void: #05060a;
          --panel: rgba(9, 14, 18, 0.72);
          --border: rgba(90, 230, 220, 0.18);
          --cyan: #22e5ff;
          --magenta: #ff3df0;
          --green: #39ff88;
          --amber: #ffcc33;
          --violet: #7b5bff;
          --frost: #d8faff;
          --dim: #6f96a0;
        }
        * {
          box-sizing: border-box;
        }
        html,
        body {
          margin: 0;
          padding: 0;
          background: var(--void);
          color: var(--frost);
          font-family: 'JetBrains Mono', monospace;
          -webkit-font-smoothing: antialiased;
        }
        #__next {
          position: relative;
          z-index: 1;
        }
        .matrix-canvas {
          position: fixed;
          inset: 0;
          z-index: -1;
          pointer-events: none;
        }
        button {
          font-family: inherit;
        }
        .loading-screen {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          z-index: 1;
        }
        .spinner {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 2px solid var(--border);
          border-top-color: var(--cyan);
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .spinner {
            animation: none !important;
          }
        }
      `}</style>
    </>
  );
}
