/* Vantage UI Kit — content sections: features, live asset table, pricing, CTA band. */

function Container({ children, style }) {
  return <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", ...style }}>{children}</div>;
}

function FeatureGrid() {
  const feats = [
    { icon: "chart", t: "Signals, explained", b: "Every AI insight comes with the reasoning behind it — never a black-box score." },
    { icon: "shield", t: "Institutional-grade", b: "Custody, audit trails, and controls built for desks that answer to regulators." },
    { icon: "clock", t: "Always watching", b: "Continuous monitoring surfaces drift the moment it matters, not at month-end." },
  ];
  return (
    <section style={{ background: "#f7f7f7", padding: "96px 0" }}>
      <Container>
        <div style={{ maxWidth: 640, marginBottom: 48 }}>
          <Badge>Why Vantage</Badge>
          <h2 style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: 44, lineHeight: 1.09,
            letterSpacing: "-0.022em", color: "#0a0b0d", margin: "20px 0 0" }}>
            Intelligence you can audit.
          </h2>
        </div>
        <div className="feat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }}>
          {feats.map((f) => (
            <div key={f.t} style={{ background: "#fff", border: "1px solid #dee1e6", borderRadius: 24, padding: 32 }}>
              <div style={{ width: 44, height: 44, borderRadius: 9999, background: "#eef0f3",
                display: "flex", alignItems: "center", justifyContent: "center", color: "#0052ff", marginBottom: 20 }}>
                <Icon name={f.icon} size={22} />
              </div>
              <h3 style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 18, color: "#0a0b0d", margin: "0 0 8px" }}>{f.t}</h3>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.5, color: "#5b616e", margin: 0 }}>{f.b}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

const ASSETS = [
  { sym: "₿", name: "Bitcoin", tk: "BTC", price: "$67,412.08", chg: "+2.41%", up: true,  yellow: true },
  { sym: "Ξ", name: "Ethereum", tk: "ETH", price: "$3,188.40", chg: "−1.08%", up: false },
  { sym: "S", name: "Solana", tk: "SOL", price: "$172.95",   chg: "+5.20%", up: true },
  { sym: "X", name: "Ripple", tk: "XRP", price: "$0.6241",   chg: "−0.42%", up: false },
  { sym: "A", name: "Cardano", tk: "ADA", price: "$0.4519",  chg: "+1.13%", up: true },
];

function AssetTable() {
  const [tab, setTab] = React.useState("trending");
  const tabs = [["trending", "Trending"], ["gainers", "Top gainers"], ["watch", "Watchlist"]];
  const rows = tab === "gainers" ? [...ASSETS].filter(a => a.up) : ASSETS;
  return (
    <section style={{ background: "#fff", padding: "96px 0" }}>
      <Container>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
          <h2 style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: 36, letterSpacing: "-0.014em", color: "#0a0b0d", margin: 0 }}>Markets, watched by AI</h2>
          <div style={{ display: "flex", gap: 8, background: "#eef0f3", borderRadius: 100, padding: 4 }}>
            {tabs.map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{
                border: "none", cursor: "pointer", borderRadius: 100, padding: "8px 16px",
                fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14,
                background: tab === id ? "#fff" : "transparent", color: tab === id ? "#0a0b0d" : "#5b616e",
                boxShadow: tab === id ? "0 4px 12px rgba(0,0,0,.04)" : "none",
              }}>{label}</button>
            ))}
          </div>
        </div>
        <div>
          {rows.map((a, i) => (
            <div key={a.tk} className="asset-row" style={{
              display: "flex", alignItems: "center", gap: 16, padding: "16px 12px",
              borderBottom: i < rows.length - 1 ? "1px solid #dee1e6" : "none", borderRadius: 12,
            }}>
              <span style={{
                width: 36, height: 36, flex: "none", borderRadius: 9999,
                background: a.yellow ? "rgba(244,176,0,.16)" : "#eef0f3",
                color: a.yellow ? "#b07e00" : "#0a0b0d",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 15,
              }}>{a.sym}</span>
              <span style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <span style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 16, color: "#0a0b0d" }}>{a.name}</span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "#7c828a" }}>{a.tk}</span>
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 18, color: "#0a0b0d", width: 130, textAlign: "right" }}>{a.price}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 18, width: 90, textAlign: "right", color: a.up ? "#05b169" : "#cf202f" }}>{a.chg}</span>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function PricingTiers() {
  const std = ["Up to 3 portfolios", "Daily AI signals", "Email summaries"];
  const feat = ["Unlimited portfolios", "Real-time AI insight", "Audit trail + custody", "Dedicated desk support"];
  return (
    <section style={{ background: "#f7f7f7", padding: "96px 0" }}>
      <Container>
        <h2 style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: 44, letterSpacing: "-0.022em", color: "#0a0b0d", margin: "0 0 48px", textAlign: "center" }}>Plans for every desk</h2>
        <div className="pricing-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, maxWidth: 760, margin: "0 auto" }}>
          <div style={{ background: "#fff", border: "1px solid #dee1e6", borderRadius: 24, padding: 32 }}>
            <p style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 15, color: "#0a0b0d", margin: "0 0 12px" }}>Desk</p>
            <div><span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 36, color: "#0a0b0d" }}>$0</span><span style={{ color: "#7c828a", fontSize: 14 }}> / mo</span></div>
            <ul style={{ listStyle: "none", padding: 0, margin: "20px 0 24px", display: "flex", flexDirection: "column", gap: 10 }}>
              {std.map((s) => <li key={s} style={{ display: "flex", gap: 10, alignItems: "center", fontFamily: "var(--font-sans)", fontSize: 14, color: "#5b616e" }}><span style={{ color: "#0052ff", display: "flex" }}><Icon name="check" size={16} stroke={3} /></span>{s}</li>)}
            </ul>
            <Button variant="secondary">Start free</Button>
          </div>
          <div style={{ background: "#0a0b0d", borderRadius: 24, padding: 32 }}>
            <p style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 15, color: "#fff", margin: "0 0 12px" }}>Institution</p>
            <div><span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 36, color: "#fff" }}>$2,400</span><span style={{ color: "#a8acb3", fontSize: 14 }}> / mo</span></div>
            <ul style={{ listStyle: "none", padding: 0, margin: "20px 0 24px", display: "flex", flexDirection: "column", gap: 10 }}>
              {feat.map((s) => <li key={s} style={{ display: "flex", gap: 10, alignItems: "center", fontFamily: "var(--font-sans)", fontSize: 14, color: "#a8acb3" }}><span style={{ color: "#0052ff", display: "flex" }}><Icon name="check" size={16} stroke={3} /></span>{s}</li>)}
            </ul>
            <Button variant="primary">Talk to sales</Button>
          </div>
        </div>
      </Container>
    </section>
  );
}

function CTABand({ onNav }) {
  return (
    <section style={{ background: "#0a0b0d", padding: "96px 24px", textAlign: "center" }}>
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 52, lineHeight: 1.0, letterSpacing: "-0.025em", color: "#fff", margin: "0 0 16px" }}>Take control of your capital.</h2>
      <p style={{ fontFamily: "var(--font-sans)", fontSize: 18, color: "#a8acb3", margin: "0 0 32px" }}>Start with one portfolio. Scale to the whole desk.</p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <Button variant="primary" size="lg" onClick={() => onNav && onNav("signup")}>Get started</Button>
        <Button variant="outline" size="lg" dark>Talk to sales</Button>
      </div>
    </section>
  );
}

Object.assign(window, { Container, FeatureGrid, AssetTable, PricingTiers, CTABand });
