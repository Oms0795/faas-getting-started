import { useEffect, useRef } from 'react';

/* =================================================================== */
/*  Globe3D — globo wireframe 3D renderizado en Canvas puro            */
/*  Optimizado para móvil: pocos segmentos, sin dependencias externas. */
/* =================================================================== */

const COLORS = {
  cyan: '#22e5ff',
  magenta: '#ff3df0',
  green: '#39ff88',
  violet: '#7b5bff',
  amber: '#ffcc33',
};

const PALETTE = [COLORS.cyan, COLORS.magenta, COLORS.green, COLORS.violet, COLORS.amber];

function colorForId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export default function Globe3D({ events = [], onClick }) {
  const canvasRef = useRef(null);
  const eventsRef = useRef(events);
  const onClickRef = useRef(onClick);

  useEffect(() => {
    eventsRef.current = events;
    onClickRef.current = onClick;
  }, [events, onClick]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = null;
    let paused = false;

    let yaw = 0.3;
    let pitch = 0.4;
    let targetYaw = 0.3;
    let targetPitch = 0.4;
    let dragging = false;
    let dragDist = 0;
    let lastX = 0;
    let lastY = 0;

    let points = [];
    let segments = [];
    let nodes = [];

    const MERIDIANS = 12;
    const PARALLELS = 8;
    const RADIUS = 150;

    function initGeometry() {
      points = [];
      segments = [];
      nodes = [];

      for (let p = 0; p < PARALLELS; p++) {
        const phi = (Math.PI * (p + 1)) / (PARALLELS + 1);
        for (let m = 0; m < MERIDIANS; m++) {
          const theta = (2 * Math.PI * m) / MERIDIANS;
          points.push({
            x: RADIUS * Math.sin(phi) * Math.cos(theta),
            y: RADIUS * Math.cos(phi),
            z: RADIUS * Math.sin(phi) * Math.sin(theta),
          });
        }
      }

      for (let m = 0; m < MERIDIANS; m++) {
        for (let p = 0; p < PARALLELS - 1; p++) {
          const idx = p * MERIDIANS + m;
          const next = (p + 1) * MERIDIANS + m;
          segments.push({ a: idx, b: next });
        }
      }

      for (let p = 0; p < PARALLELS; p++) {
        for (let m = 0; m < MERIDIANS; m++) {
          const idx = p * MERIDIANS + m;
          const next = p * MERIDIANS + ((m + 1) % MERIDIANS);
          segments.push({ a: idx, b: next });
        }
      }

      for (let i = 0; i < 16; i++) {
        const phi = Math.acos(2 * Math.random() - 1);
        const theta = 2 * Math.PI * Math.random();
        const r = RADIUS + 12 + Math.random() * 18;
        nodes.push({
          x: r * Math.sin(phi) * Math.cos(theta),
          y: r * Math.cos(phi),
          z: r * Math.sin(phi) * Math.sin(theta),
          color: Math.random() > 0.6 ? COLORS.magenta : COLORS.green,
          pulse: Math.random() * Math.PI * 2,
        });
      }
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function rotate(p, yaw, pitch) {
      const cY = Math.cos(yaw);
      const sY = Math.sin(yaw);
      const x1 = p.x * cY - p.z * sY;
      const z1 = p.x * sY + p.z * cY;
      const cP = Math.cos(pitch);
      const sP = Math.sin(pitch);
      const y2 = p.y * cP - z1 * sP;
      const z2 = p.y * sP + z1 * cP;
      return { x: x1, y: y2, z: z2 };
    }

    function project(p) {
      const focal = 500;
      const distance = 380;
      const scale = focal / (focal + p.z + distance);
      return {
        x: width / 2 + p.x * scale,
        y: height / 2 + p.y * scale,
        scale,
        z: p.z,
      };
    }

    function latLonToPoint(lat, lon, radius) {
      const latRad = (lat * Math.PI) / 180;
      const lonRad = (lon * Math.PI) / 180;
      return {
        x: radius * Math.cos(latRad) * Math.cos(lonRad),
        y: radius * Math.sin(latRad),
        z: radius * Math.cos(latRad) * Math.sin(lonRad),
      };
    }

    function drawRing() {
      const r = RADIUS + 30;
      const segments = 64;
      const t = new Array(segments).fill(0).map((_, i) => {
        const theta = (2 * Math.PI * i) / segments;
        return { x: r * Math.cos(theta), y: 0, z: r * Math.sin(theta) };
      });
      const proj = t.map((p) => project(rotate(p, yaw, pitch)));
      ctx.beginPath();
      proj.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.strokeStyle = 'rgba(123, 91, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    let frame = 0;
    function render() {
      if (paused) {
        raf = requestAnimationFrame(render);
        return;
      }
      frame++;
      yaw += 0.0025;
      pitch += 0.0012;
      yaw += (targetYaw - yaw) * 0.05;
      pitch += (targetPitch - pitch) * 0.05;

      ctx.clearRect(0, 0, width, height);

      const grad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        RADIUS * 0.2,
        width / 2,
        height / 2,
        width * 0.8
      );
      grad.addColorStop(0, 'rgba(34, 229, 255, 0.02)');
      grad.addColorStop(1, 'rgba(5, 6, 10, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      drawRing();

      const tPoints = points.map((p) => project(rotate(p, yaw, pitch)));
      const tNodes = nodes.map((n) => {
        const p = rotate(n, yaw * 1.3, pitch * 0.8);
        return project(p);
      });

      const segs = segments.map((s) => {
        const pa = tPoints[s.a];
        const pb = tPoints[s.b];
        const z = (pa.z + pb.z) / 2;
        return { pa, pb, z };
      });
      segs.sort((a, b) => a.z - b.z);

      ctx.lineWidth = 0.8;
      segs.forEach((s) => {
        if (s.pa.z < -180 || s.pb.z < -180) return;
        const alpha = Math.max(0.06, 0.35 - (s.z + RADIUS) / (RADIUS * 4));
        ctx.beginPath();
        ctx.moveTo(s.pa.x, s.pa.y);
        ctx.lineTo(s.pb.x, s.pb.y);
        ctx.strokeStyle = `rgba(34, 229, 255, ${alpha})`;
        ctx.stroke();
      });

      tPoints.forEach((p) => {
        if (p.z < -180) return;
        const size = Math.max(0.8, 1.5 * p.scale);
        const alpha = Math.max(0.2, 0.75 - (p.z + RADIUS) / (RADIUS * 3));
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(34, 229, 255, ${alpha})`;
        ctx.fill();
      });

      tNodes.forEach((n, i) => {
        if (n.z < -180) return;
        const pulse = Math.sin(frame * 0.05 + nodes[i].pulse) * 0.5 + 0.5;
        const size = Math.max(1, (2 + pulse * 2) * n.scale);
        ctx.beginPath();
        ctx.arc(n.x, n.y, size, 0, Math.PI * 2);
        ctx.fillStyle = nodes[i].color;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(n.x, n.y, size + 4, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.05 + pulse * 0.1})`;
        ctx.stroke();
      });

      // eventos de blockchain
      const now = Date.now();
      const liveEvents = eventsRef.current || [];
      const eventMarkers = [];
      for (const ev of liveEvents) {
        const p = latLonToPoint(ev.lat, ev.lon, RADIUS + 6);
        const r = rotate(p, yaw, pitch);
        const pr = project(r);
        const age = now - (ev.createdAt || now);
        eventMarkers.push({ pr, ev, age });
      }
      // dibujar primero los más lejanos
      eventMarkers.sort((a, b) => a.pr.z - b.pr.z);

      for (const { pr, ev, age } of eventMarkers) {
        if (pr.z < -RADIUS) continue;
        const life = 12000;
        const alpha = Math.min(1, Math.max(0, 1 - age / life));
        if (alpha <= 0.01) continue;
        const pulse = Math.sin(frame * 0.12 + (ev.id || '').charCodeAt(0)) * 0.5 + 0.5;
        const base = Math.max(2, 5 * pr.scale);
        const color = ev.color || colorForId(ev.id || 'x');

        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, base + pulse * 4, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(pr.x, pr.y, base, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        const label = `${ev.symbol || 'TOK'} ${ev.amount || ''}`;
        ctx.font = `500 10px 'JetBrains Mono', monospace`;
        ctx.fillStyle = '#d8faff';
        ctx.fillText(label, pr.x + base + 5, pr.y + 3);
        ctx.globalAlpha = 1;
      }

      raf = requestAnimationFrame(render);
    }

    function onMouseDown(e) {
      dragging = true;
      dragDist = 0;
      lastX = e.clientX;
      lastY = e.clientY;
    }
    function onMouseMove(e) {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      dragDist += Math.hypot(dx, dy);
      targetYaw += dx * 0.005;
      targetPitch -= dy * 0.005;
      lastX = e.clientX;
      lastY = e.clientY;
    }
    function onMouseUp() {
      if (dragging && dragDist < 8 && onClickRef.current) {
        onClickRef.current();
      }
      dragging = false;
    }
    function onTouchStart(e) {
      dragging = true;
      dragDist = 0;
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
    }
    function onTouchMove(e) {
      if (!dragging) return;
      const dx = e.touches[0].clientX - lastX;
      const dy = e.touches[0].clientY - lastY;
      dragDist += Math.hypot(dx, dy);
      targetYaw += dx * 0.008;
      targetPitch -= dy * 0.008;
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
    }
    function onTouchEnd() {
      if (dragging && dragDist < 12 && onClickRef.current) {
        onClickRef.current();
      }
      dragging = false;
    }
    function onVisibility() {
      paused = document.hidden;
    }
    function onResize() {
      resize();
    }

    initGeometry();
    resize();
    raf = requestAnimationFrame(render);

    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  return (
    <div className="globe-wrap">
      <canvas ref={canvasRef} className="globe-canvas" />
      <div className="globe-overlay" />
      <style jsx>{`
        .globe-wrap {
          position: relative;
          width: 100%;
          height: 100%;
          min-height: 260px;
          overflow: hidden;
          border-radius: 16px;
          background: radial-gradient(circle at center, rgba(34, 229, 255, 0.06), var(--void) 70%);
          isolation: isolate;
        }
        .globe-canvas {
          width: 100%;
          height: 100%;
          display: block;
          cursor: grab;
        }
        .globe-canvas:active {
          cursor: grabbing;
        }
        .globe-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: repeating-linear-gradient(
            0deg,
            rgba(255, 255, 255, 0.015) 0px,
            rgba(255, 255, 255, 0.015) 1px,
            transparent 1px,
            transparent 3px
          );
          mix-blend-mode: overlay;
        }
      `}</style>
    </div>
  );
}
