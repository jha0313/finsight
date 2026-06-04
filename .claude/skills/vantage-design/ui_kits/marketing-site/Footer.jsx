/* Vantage UI Kit — footer + legal band. */

function Footer() {
  const cols = [
    ["Company", ["About", "Careers", "Newsroom", "Investors"]],
    ["Products", ["Insight", "Portfolios", "Markets", "API"]],
    ["Individuals", ["Get started", "Pricing", "Learn", "Support"]],
    ["Institutions", ["Custody", "Compliance", "Desk", "Contact"]],
    ["Developers", ["Docs", "Status", "Changelog", "GitHub"]],
    ["Legal", ["Privacy", "Terms", "Disclosures", "Cookies"]],
  ];
  return (
    <footer style={{ background: "#fff", borderTop: "1px solid #dee1e6" }}>
      <Container style={{ padding: "64px 24px 32px" }}>
        <div className="footer-grid" style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 24, marginBottom: 48 }}>
          {cols.map(([h, links]) => (
            <div key={h}>
              <p style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, color: "#0a0b0d", margin: "0 0 16px" }}>{h}</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                {links.map((l) => (
                  <li key={l}><a href="#" onClick={(e) => e.preventDefault()} style={{
                    fontFamily: "var(--font-sans)", fontSize: 14, color: "#5b616e", textDecoration: "none",
                  }}>{l}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
          paddingTop: 32, borderTop: "1px solid #dee1e6", flexWrap: "wrap", gap: 16 }}>
          <Wordmark height={22} />
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "#7c828a", margin: 0, maxWidth: 720 }}>
            © 2026 Vantage Technologies, Inc. Vantage is a financial technology company, not a bank.
            AI insight is informational and not investment advice. Digital assets are volatile and may lose value.
          </p>
        </div>
      </Container>
    </footer>
  );
}

Object.assign(window, { Footer });
