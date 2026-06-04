/* Vantage Product Kit — primitives (dark cyan-glow). Exports to window. */

function Icon({ name, size = 20, sw = 1.8, color = "currentColor", style }) {
  const P = {
    home:    <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></>,
    send:    <><path d="M4 11.5 20 4l-7.5 16-2.2-6.3L4 11.5Z"/></>,
    wallet:  <><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M16 12h2.5"/><path d="M3 9h13a2 2 0 0 1 2 2"/></>,
    pie:     <><path d="M12 3a9 9 0 1 0 9 9h-9V3Z"/><path d="M14 3.5A9 9 0 0 1 20.5 10H14V3.5Z"/></>,
    card:    <><rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M2.5 9.5h19"/><path d="M6 15h4"/></>,
    users:   <><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6"/><path d="M17.5 19a5.5 5.5 0 0 0-2.2-4.4"/></>,
    settings:<><circle cx="12" cy="12" r="3"/><path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8"/></>,
    bell:    <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10 20a2 2 0 0 0 4 0"/></>,
    search:  <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
    sparkles:<><path d="M12 3l1.7 4.6L18 9l-4.3 1.4L12 15l-1.7-4.6L6 9l4.3-1.4L12 3Z"/><path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/></>,
    upright: <><path d="M7 17 17 7"/><path d="M8 7h9v9"/></>,
    downleft:<><path d="M17 7 7 17"/><path d="M16 17H7V8"/></>,
    plus:    <><path d="M12 5v14M5 12h14"/></>,
    calendar:<><rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/></>,
    chevdown:<><path d="m6 9 6 6 6-6"/></>,
    chevright:<><path d="m9 6 6 6-6 6"/></>,
    x:       <><path d="M6 6 18 18M18 6 6 18"/></>,
    check:   <><path d="M5 12l4.5 4.5L19 7"/></>,
    shield:  <><path d="M12 2 4 5v6c0 5 3.5 8 8 11 4.5-3 8-6 8-11V5z"/></>,
    zap:     <><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></>,
    trend:   <><path d="M3 17l6-6 4 4 8-8"/><path d="M21 7h-5"/><path d="M21 7v5"/></>,
    globe:   <><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18"/></>,
    logout:  <><path d="M14 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8"/><path d="M16 16l4-4-4-4"/><path d="M20 12H9"/></>,
    menu:    <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    dots:    <><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></>,
    filter:  <><path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z"/></>,
    download:<><path d="M12 3v12M7 11l5 4 5-4"/><path d="M4 19h16"/></>,
    arrowr:  <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    lock:    <><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></>,
    eye:     <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>,
    repeat:  <><path d="M4 9a5 5 0 0 1 5-5h7"/><path d="m13 1 3 3-3 3"/><path d="M20 15a5 5 0 0 1-5 5H8"/><path d="m11 23-3-3 3-3"/></>,
    building:<><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/></>,
  }[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
         strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style}>{P}</svg>
  );
}

function Logo({ size = 26, mark = true, label = true }) {
  const d = size + 8;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      {mark && (
        <span style={{ width: d, height: d, borderRadius: d * 0.32, background: "var(--grad)",
          display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none",
          boxShadow: "0 4px 16px rgba(34,211,238,.45)" }}>
          <svg width={d * 0.5} height={d * 0.5} viewBox="0 0 24 24" fill="none" stroke="#04222b"
               strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17 12 6l7 11"/></svg>
        </span>
      )}
      {label && <span style={{ fontWeight: 600, fontSize: size * 0.82, letterSpacing: "-0.02em", color: "var(--text)" }}>Vantage</span>}
    </span>
  );
}

function GlowButton({ children, onClick, size = "md", icon, full, type }) {
  const [h, setH] = React.useState(false);
  const pad = size === "lg" ? "0 26px" : size === "sm" ? "0 16px" : "0 20px";
  const ht = size === "lg" ? 54 : size === "sm" ? 38 : 46;
  return (
    <button type={type} onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        position: "relative", height: ht, padding: pad, width: full ? "100%" : "auto",
        border: "none", cursor: "pointer", borderRadius: "var(--r-btn)", background: "var(--grad)",
        color: "var(--on-accent)", fontFamily: "var(--font)", fontWeight: 600, fontSize: size === "sm" ? 14 : 15,
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9,
        boxShadow: h ? "var(--glow-strong)" : "var(--glow)", transition: "box-shadow .2s, transform .12s, filter .2s",
        transform: h ? "translateY(-1px)" : "none", filter: h ? "brightness(1.05)" : "none",
      }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "var(--r-btn)",
        background: "linear-gradient(180deg, rgba(255,255,255,.45), rgba(255,255,255,0) 42%)", opacity: .6, pointerEvents: "none" }} />
      {icon && <Icon name={icon} size={size === "sm" ? 16 : 18} color="var(--on-accent)" sw={2.2} />}
      <span style={{ position: "relative" }}>{children}</span>
    </button>
  );
}

function GhostButton({ children, onClick, size = "md", icon, variant = "ghost", full }) {
  const [h, setH] = React.useState(false);
  const ht = size === "lg" ? 54 : size === "sm" ? 38 : 46;
  const pad = size === "lg" ? "0 24px" : size === "sm" ? "0 14px" : "0 18px";
  const bg = variant === "soft" ? (h ? "var(--surface-3)" : "var(--surface-2)") : (h ? "rgba(255,255,255,.06)" : "transparent");
  const bd = variant === "soft" ? "1px solid var(--border)" : "1px solid var(--border-strong)";
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ height: ht, padding: pad, width: full ? "100%" : "auto", cursor: "pointer", borderRadius: "var(--r-btn)",
        background: bg, border: bd, color: "var(--text)", fontFamily: "var(--font)", fontWeight: 600,
        fontSize: size === "sm" ? 14 : 15, display: "inline-flex", alignItems: "center", justifyContent: "center",
        gap: 9, transition: "background .15s" }}>
      {icon && <Icon name={icon} size={size === "sm" ? 16 : 18} />}
      {children}
    </button>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange && onChange(!on)} style={{
      width: 50, height: 30, borderRadius: 100, border: "none", cursor: "pointer", padding: 3,
      background: on ? "var(--grad)" : "var(--surface-3)", boxShadow: on ? "0 0 16px rgba(34,211,238,.5)" : "none",
      display: "flex", justifyContent: on ? "flex-end" : "flex-start", transition: "background .2s, box-shadow .2s" }}>
      <span style={{ width: 24, height: 24, borderRadius: 100, background: "#fff", display: "block",
        boxShadow: "0 2px 6px rgba(0,0,0,.4)", transition: "all .2s" }} />
    </button>
  );
}

function CheckBox({ on, onChange, size = 26 }) {
  return (
    <button onClick={() => onChange && onChange(!on)} style={{
      width: size, height: size, borderRadius: 8, cursor: "pointer", flex: "none",
      border: on ? "none" : "1.5px solid var(--border-strong)",
      background: on ? "var(--grad)" : "transparent", boxShadow: on ? "0 0 14px rgba(34,211,238,.45)" : "none",
      display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s" }}>
      {on && <Icon name="check" size={size * 0.62} color="var(--on-accent)" sw={3} />}
    </button>
  );
}

function Card({ children, style, pad = 24, glow, onClick, hover }) {
  const [h, setH] = React.useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-card)",
        padding: pad, position: "relative", cursor: onClick ? "pointer" : "default",
        boxShadow: glow ? "0 0 0 1px rgba(34,211,238,.18), 0 18px 50px rgba(0,0,0,.5)" : "0 10px 30px rgba(0,0,0,.35)",
        borderColor: hover && h ? "var(--border-strong)" : "var(--border)", transition: "border-color .2s",
        ...style }}>
      {children}
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <label style={{ display: "block" }}>
      {label && <span style={{ display: "block", fontSize: 14, color: "var(--text-2)", marginBottom: 8 }}>{label}</span>}
      {children}
      {hint && <span style={{ display: "block", fontSize: 12.5, color: "var(--text-faint)", marginTop: 7, lineHeight: 1.5 }}>{hint}</span>}
    </label>
  );
}

const inputStyle = {
  width: "100%", height: 52, background: "var(--input)", border: "1px solid var(--border)",
  borderRadius: "var(--r-input)", color: "var(--text)", fontFamily: "var(--font)", fontSize: 15,
  padding: "0 16px", outline: "none",
};

function Flag({ cc, size = 22 }) {
  const flags = {
    US: <g><rect width="24" height="24" fill="#b22234"/><rect y="2" width="24" height="2" fill="#fff"/><rect y="6" width="24" height="2" fill="#fff"/><rect y="10" width="24" height="2" fill="#fff"/><rect y="14" width="24" height="2" fill="#fff"/><rect y="18" width="24" height="2" fill="#fff"/><rect y="22" width="24" height="2" fill="#fff"/><rect width="11" height="13" fill="#3c3b6e"/></g>,
    AU: <g><rect width="24" height="24" fill="#00247d"/><path d="M0 0l11 7M11 0L0 7" stroke="#fff" strokeWidth="1.6"/><circle cx="17" cy="15" r="1.6" fill="#fff"/><circle cx="6" cy="18" r="1.3" fill="#fff"/><circle cx="19" cy="20" r="1" fill="#fff"/></g>,
    EU: <g><rect width="24" height="24" fill="#003399"/><circle cx="12" cy="12" r="6" fill="none" stroke="#ffcc00" strokeWidth="0" /><g fill="#ffcc00"><circle cx="12" cy="6" r="1"/><circle cx="12" cy="18" r="1"/><circle cx="6" cy="12" r="1"/><circle cx="18" cy="12" r="1"/><circle cx="8" cy="8" r="1"/><circle cx="16" cy="8" r="1"/><circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/></g></g>,
    GB: <g><rect width="24" height="24" fill="#012169"/><path d="M0 0l24 24M24 0L0 24" stroke="#fff" strokeWidth="3"/><path d="M12 0v24M0 12h24" stroke="#fff" strokeWidth="5"/><path d="M12 0v24M0 12h24" stroke="#c8102e" strokeWidth="3"/></g>,
  }[cc];
  return (
    <span style={{ width: size, height: size, borderRadius: 6, overflow: "hidden", flex: "none",
      display: "inline-block", boxShadow: "0 0 0 1px rgba(255,255,255,.1)" }}>
      <svg width={size} height={size} viewBox="0 0 24 24">{flags}</svg>
    </span>
  );
}

function Avatar({ src, name, size = 40, online }) {
  return (
    <span style={{ position: "relative", width: size, height: size, flex: "none", display: "inline-block" }}>
      <img src={src} alt={name} style={{ width: size, height: size, borderRadius: 100, objectFit: "cover", display: "block",
        boxShadow: "0 0 0 1px rgba(255,255,255,.1)" }} />
      {online && <span style={{ position: "absolute", right: 0, bottom: 0, width: size * 0.28, height: size * 0.28,
        borderRadius: 100, background: "var(--up)", border: "2px solid var(--surface)", boxShadow: "0 0 8px var(--up)" }} />}
    </span>
  );
}

Object.assign(window, { Icon, Logo, GlowButton, GhostButton, Toggle, CheckBox, Card, Field, inputStyle, Flag, Avatar });
