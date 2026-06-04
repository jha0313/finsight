/* Vantage UI Kit — shared primitives. Exports to window for cross-file use. */

/* Inline line-icons hand-matched to Lucide geometry (2px, rounded) */
function Icon({ name, size = 20, stroke = 2, color = "currentColor" }) {
  const p = {
    search:   <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
    globe:    <><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18"/></>,
    chart:    <><path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 5-6"/></>,
    shield:   <><path d="M12 2 4 5v6c0 5 3.5 8 8 11 4.5-3 8-6 8-11V5z"/></>,
    clock:    <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></>,
    spark:    <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/></>,
    check:    <><path d="M5 12l5 5L20 6"/></>,
    arrow:    <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    menu:     <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    close:    <><path d="M6 6l12 12M18 6 6 18"/></>,
    lock:     <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
  }[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {p}
    </svg>
  );
}

function Wordmark({ dark = false, height = 26 }) {
  const ink = dark ? "#ffffff" : "#0a0b0d";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <span style={{
        width: height + 6, height: height + 6, borderRadius: 9999, background: "#0052ff",
        display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none"
      }}>
        <svg width={(height + 6) * 0.5} height={(height + 6) * 0.5} viewBox="0 0 24 24" fill="none"
             stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 17 L12 6 L19 17"/>
        </svg>
      </span>
      <span style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: height * 0.84,
        letterSpacing: "-0.02em", color: ink }}>Vantage</span>
    </span>
  );
}

function Button({ variant = "primary", size = "md", children, onClick, dark = false }) {
  const base = {
    fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 16, lineHeight: 1.15,
    border: "none", cursor: "pointer", borderRadius: 100,
    height: size === "lg" ? 56 : 44, padding: size === "lg" ? "0 32px" : "0 20px",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    transition: "background .15s, box-shadow .15s, opacity .15s", whiteSpace: "nowrap",
  };
  const styles = {
    primary:   { ...base, background: "#0052ff", color: "#fff" },
    secondary: { ...base, background: dark ? "#16181c" : "#eef0f3", color: dark ? "#fff" : "#0a0b0d" },
    outline:   { ...base, background: "transparent", color: dark ? "#fff" : "#0a0b0d",
                 border: dark ? "1px solid rgba(255,255,255,.4)" : "1px solid #dee1e6" },
    text:      { ...base, background: "transparent", color: "#0052ff", padding: "0 4px" },
  }[variant];
  const [hover, setHover] = React.useState(false);
  const hoverStyle = hover && variant === "primary" ? { background: "#003ecc" }
                   : hover && variant === "secondary" && !dark ? { background: "#e4e7ec" }
                   : hover && variant === "text" ? { opacity: .7 } : {};
  return (
    <button style={{ ...styles, ...hoverStyle }} onClick={onClick}
            onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {children}
    </button>
  );
}

function Badge({ children, tone = "default" }) {
  const tones = {
    default: { background: "#eef0f3", color: "#0a0b0d" },
    blue:    { background: "rgba(0,82,255,.1)", color: "#0052ff" },
    dark:    { background: "#16181c", color: "#fff" },
  }[tone];
  return (
    <span style={{
      ...tones, fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 12,
      letterSpacing: ".04em", textTransform: "uppercase", borderRadius: 100, padding: "6px 14px",
      display: "inline-block",
    }}>{children}</span>
  );
}

Object.assign(window, { Icon, Wordmark, Button, Badge });
