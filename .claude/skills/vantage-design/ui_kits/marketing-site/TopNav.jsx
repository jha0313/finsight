/* Vantage UI Kit — Top navigation (light + on-dark variants, hamburger sheet). */

function TopNav({ dark = false, onNav }) {
  const [open, setOpen] = React.useState(false);
  const ink = dark ? "#fff" : "#0a0b0d";
  const items = ["Individuals", "Institutions", "Developers", "Insight", "Company"];
  return (
    <header style={{
      position: "relative", zIndex: 20,
      background: dark ? "transparent" : "#fff",
      borderBottom: dark ? "1px solid rgba(255,255,255,.08)" : "1px solid #dee1e6",
    }}>
      <div style={{
        maxWidth: 1200, margin: "0 auto", height: 64, padding: "0 24px",
        display: "flex", alignItems: "center", gap: 32,
      }}>
        <a href="#" onClick={(e) => { e.preventDefault(); onNav && onNav("home"); }}
           style={{ textDecoration: "none", flex: "none" }}>
          <Wordmark dark={dark} height={24} />
        </a>
        <nav className="nav-desktop" style={{ display: "flex", gap: 24, flex: 1 }}>
          {items.map((it) => (
            <a key={it} href="#" onClick={(e) => e.preventDefault()} style={{
              fontFamily: "var(--font-sans)", fontWeight: 500, fontSize: 14, color: ink,
              textDecoration: "none", opacity: .9,
            }}>{it}</a>
          ))}
        </nav>
        <div className="nav-desktop" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ color: ink, display: "flex", cursor: "pointer", opacity: .8 }}><Icon name="search" size={18} color={ink} /></span>
          <span style={{ color: ink, display: "flex", cursor: "pointer", opacity: .8 }}><Icon name="globe" size={18} color={ink} /></span>
          <a href="#" onClick={(e) => e.preventDefault()} style={{
            fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, color: ink, textDecoration: "none",
          }}>Sign in</a>
          <Button variant="primary" onClick={() => onNav && onNav("signup")}>Sign up</Button>
        </div>
        <button className="nav-mobile" onClick={() => setOpen(!open)} style={{
          display: "none", background: "transparent", border: "none", cursor: "pointer", color: ink,
        }}><Icon name={open ? "close" : "menu"} size={24} color={ink} /></button>
      </div>
      {open && (
        <div className="nav-mobile" style={{
          background: dark ? "#0a0b0d" : "#fff", borderTop: dark ? "1px solid rgba(255,255,255,.08)" : "1px solid #dee1e6",
          padding: "16px 24px", display: "flex", flexDirection: "column", gap: 4,
        }}>
          {items.map((it) => (
            <a key={it} href="#" onClick={(e) => e.preventDefault()} style={{
              fontFamily: "var(--font-sans)", fontWeight: 500, fontSize: 16, color: ink,
              textDecoration: "none", padding: "12px 0",
            }}>{it}</a>
          ))}
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <Button variant="secondary" dark={dark}>Sign in</Button>
            <Button variant="primary" onClick={() => onNav && onNav("signup")}>Sign up</Button>
          </div>
        </div>
      )}
    </header>
  );
}

Object.assign(window, { TopNav });
