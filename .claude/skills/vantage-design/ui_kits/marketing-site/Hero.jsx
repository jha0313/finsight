/* Vantage UI Kit — signature dark hero with layered floating product-UI cards. */

function Sparkline({ heights, color = "#0052ff" }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 56, marginTop: 16 }}>
      {heights.map((h, i) => (
        <span key={i} style={{
          flex: 1, height: h + "%", borderRadius: "3px 3px 0 0",
          background: `linear-gradient(${color}, rgba(0,82,255,.2))`, display: "block",
        }} />
      ))}
    </div>
  );
}

function ProductCardDark({ style, title, meta, big, sub, children }) {
  return (
    <div style={{
      background: "#16181c", borderRadius: 24, padding: 24, boxSizing: "border-box",
      border: "1px solid rgba(255,255,255,.06)", ...style,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>{title}</span>
        <span style={{ color: "#a8acb3", fontSize: 12, fontFamily: "var(--font-mono)" }}>{meta}</span>
      </div>
      {big && <div style={{ color: "#fff", fontSize: 34, fontFamily: "var(--font-mono)", fontWeight: 500, letterSpacing: "-.01em" }}>{big}</div>}
      {sub && <div style={{ color: "#05b169", fontFamily: "var(--font-mono)", fontSize: 14, marginTop: 4 }}>{sub}</div>}
      {children}
    </div>
  );
}

function HeroDark({ onNav }) {
  return (
    <section style={{ background: "#0a0b0d", position: "relative", overflow: "hidden" }}>
      <div style={{
        maxWidth: 1200, margin: "0 auto", padding: "96px 24px",
        display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 48, alignItems: "center",
      }} className="hero-grid">
        <div>
          <div style={{ marginBottom: 24 }}><Badge tone="dark">AI Insight</Badge></div>
          <h1 className="hero-h1" style={{
            fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 72, lineHeight: 1.0,
            letterSpacing: "-0.025em", color: "#fff", margin: "0 0 24px",
          }}>Intelligence,<br/>quietly.</h1>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 18, lineHeight: 1.5, color: "#a8acb3", maxWidth: 460, margin: "0 0 32px" }}>
            Explainable AI insight over your portfolios and markets — built for the desks that answer to regulators.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Button variant="primary" size="lg" onClick={() => onNav && onNav("signup")}>Get started</Button>
            <Button variant="outline" size="lg" dark>View demo</Button>
          </div>
        </div>
        <div style={{ position: "relative", minHeight: 340 }} className="hero-cards">
          <ProductCardDark
            title="Allocation" meta="AI · live"
            style={{ position: "absolute", width: 260, right: 0, top: 8, transform: "rotate(4deg)", opacity: .8 }}
            big="7 signals" sub="Rebalance suggested" />
          <ProductCardDark
            title="Portfolio" meta="24h"
            style={{ position: "absolute", width: 340, left: 0, top: 64, boxShadow: "0 24px 60px rgba(0,0,0,.5)" }}
            big="$1.24M" sub="+ $28,400 · +2.34%">
            <Sparkline heights={[40, 55, 48, 70, 62, 85, 78, 100]} />
          </ProductCardDark>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { HeroDark, ProductCardDark, Sparkline });
