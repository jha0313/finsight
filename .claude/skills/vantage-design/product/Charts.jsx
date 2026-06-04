/* Vantage Product Kit — lightweight SVG data viz. Exports to window. */

function smoothPath(pts) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const cx = (x0 + x1) / 2;
    d += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
  }
  return d;
}

function AreaChart({ data, width = 640, height = 220, pad = 8 }) {
  const max = Math.max(...data) * 1.12, min = Math.min(...data) * 0.92;
  const w = width, h = height;
  const xs = (i) => pad + (i * (w - pad * 2)) / (data.length - 1);
  const ys = (v) => pad + (h - pad * 2) * (1 - (v - min) / (max - min));
  const pts = data.map((v, i) => [xs(i), ys(v)]);
  const line = smoothPath(pts);
  const area = `${line} L ${xs(data.length - 1)} ${h} L ${xs(0)} ${h} Z`;
  const lastX = xs(data.length - 1), lastY = ys(data[data.length - 1]);
  const id = "ag" + Math.round(max);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(34,211,238,.32)" />
          <stop offset="100%" stopColor="rgba(34,211,238,0)" />
        </linearGradient>
        <linearGradient id={id + "l"} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2ee6f6" /><stop offset="100%" stopColor="#2a8dff" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => <line key={g} x1={pad} x2={w - pad} y1={pad + (h - pad * 2) * g} y2={pad + (h - pad * 2) * g} stroke="rgba(255,255,255,.05)" />)}
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={`url(#${id}l)`} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r="4.5" fill="#2ee6f6" />
      <circle cx={lastX} cy={lastY} r="9" fill="rgba(46,230,246,.25)" />
    </svg>
  );
}

function MiniBars({ data, height = 44, color = "var(--grad)" }) {
  const max = Math.max(...data);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height }}>
      {data.map((v, i) => (
        <span key={i} style={{ flex: 1, height: `${(v / max) * 100}%`, minHeight: 3, borderRadius: "3px 3px 0 0",
          background: i === data.length - 1 ? "var(--grad)" : "rgba(255,255,255,.14)" }} />
      ))}
    </div>
  );
}

function Donut({ segments, size = 132, thickness = 16 }) {
  const r = (size - thickness) / 2, C = 2 * Math.PI * r;
  let acc = 0;
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={thickness} />
      {segments.map((s, i) => {
        const frac = s.value / total, len = frac * C;
        const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color}
          strokeWidth={thickness} strokeLinecap="round" strokeDasharray={`${len - 3} ${C - len + 3}`}
          strokeDashoffset={-acc * C} transform={`rotate(-90 ${size / 2} ${size / 2})`} />;
        acc += frac; return el;
      })}
    </svg>
  );
}

function Sparkline({ data, width = 90, height = 34, color = "#34d399" }) {
  const max = Math.max(...data), min = Math.min(...data);
  const xs = (i) => (i * width) / (data.length - 1);
  const ys = (v) => height - 3 - (height - 6) * (max === min ? .5 : (v - min) / (max - min));
  const pts = data.map((v, i) => [xs(i), ys(v)]);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={smoothPath(pts)} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

Object.assign(window, { AreaChart, MiniBars, Donut, Sparkline });
