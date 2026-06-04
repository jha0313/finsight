/* Vantage Product — Landing page (dark cyan-glow). Exports Landing. */

function LandingNav({ onEnter }) {
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(14px)",
      background: "rgba(6,8,11,.72)", borderBottom: "1px solid var(--border)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", height: 70, padding: "0 24px", display: "flex", alignItems: "center", gap: 32 }}>
        <Logo size={24} />
        <nav className="lp-navlinks" style={{ display: "flex", gap: 28, flex: 1, marginLeft: 16 }}>
          {["Product", "AI Insights", "Pricing", "Company"].map((x) => (
            <a key={x} href="#" onClick={(e) => e.preventDefault()} style={{ color: "var(--text-2)", textDecoration: "none", fontSize: 14.5, fontWeight: 500 }}>{x}</a>
          ))}
        </nav>
        <div className="lp-navcta" style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <a href="#" onClick={(e) => { e.preventDefault(); onEnter(); }} style={{ color: "var(--text)", textDecoration: "none", fontSize: 14.5, fontWeight: 600 }}>Sign in</a>
          <GlowButton size="sm" onClick={onEnter}>Open app</GlowButton>
        </div>
      </div>
    </header>
  );
}

function HeroMock() {
  return (
    <Card glow pad={0} style={{ overflow: "hidden", background: "var(--surface)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: "var(--text-3)" }}>Total balance</span>
        </span>
        <span style={{ display: "flex", gap: 6 }}>
          {["#fb7185", "#fbbf24", "#34d399"].map(c => <span key={c} style={{ width: 9, height: 9, borderRadius: 100, background: c, opacity: .5 }} />)}
        </span>
      </div>
      <div style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 4 }}>
          <span className="num" style={{ fontSize: 34, fontWeight: 600, color: "var(--text)" }}>$148,205.60</span>
          <span className="num up" style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 4 }}><Icon name="trend" size={15} color="var(--up)" />+8.4%</span>
        </div>
        <div style={{ marginTop: 10 }}><AreaChart data={[42, 48, 45, 60, 55, 72, 68, 90, 84, 100, 96, 118]} height={150} /></div>
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <div style={{ flex: 1, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 14px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--accent)" }}><Icon name="sparkles" size={14} color="var(--accent)" />AI insight</span>
            <p style={{ margin: "7px 0 0", fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>Inflows are up 12% — a good window to schedule the AUD payout.</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function Stat({ v, l }) {
  return (
    <div>
      <div className="num" style={{ fontSize: 30, fontWeight: 600, color: "var(--text)" }}>{v}</div>
      <div style={{ fontSize: 13.5, color: "var(--text-3)", marginTop: 4 }}>{l}</div>
    </div>
  );
}

function FeatureCard({ icon, title, body }) {
  return (
    <Card hover pad={26}>
      <span style={{ width: 46, height: 46, borderRadius: 13, background: "var(--grad-faint)", border: "1px solid rgba(34,211,238,.2)",
        display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", marginBottom: 18 }}>
        <Icon name={icon} size={22} color="var(--accent)" />
      </span>
      <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600, color: "var(--text)" }}>{title}</h3>
      <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "var(--text-3)" }}>{body}</p>
    </Card>
  );
}

function PriceTier({ name, price, per, features, cta, featured, onEnter }) {
  return (
    <Card glow={featured} pad={28} style={featured ? { borderColor: "rgba(34,211,238,.35)" } : {}}>
      {featured && <span style={{ position: "absolute", top: 20, right: 20, fontSize: 11, fontWeight: 600, letterSpacing: ".06em",
        textTransform: "uppercase", color: "var(--accent)", background: "var(--grad-faint)", border: "1px solid rgba(34,211,238,.25)", borderRadius: 100, padding: "4px 10px" }}>Popular</span>}
      <p style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{name}</p>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span className="num" style={{ fontSize: 40, fontWeight: 600, color: "var(--text)" }}>{price}</span>
        <span style={{ fontSize: 14, color: "var(--text-3)" }}>{per}</span>
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: "22px 0 26px", display: "flex", flexDirection: "column", gap: 12 }}>
        {features.map(f => <li key={f} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14, color: "var(--text-2)" }}>
          <span style={{ color: "var(--accent)", display: "flex" }}><Icon name="check" size={17} sw={2.4} color="var(--accent)" /></span>{f}</li>)}
      </ul>
      {featured ? <GlowButton full onClick={onEnter}>{cta}</GlowButton> : <GhostButton full variant="soft" onClick={onEnter}>{cta}</GhostButton>}
    </Card>
  );
}

function Landing({ onEnter }) {
  const feats = [
    { icon: "send", title: "Borderless payments", body: "Send and receive in 40+ currencies with mid-market FX and transparent fees — schedule or make recurring." },
    { icon: "sparkles", title: "AI that explains", body: "Every insight ships with its reasoning. Cash-flow forecasts, anomaly flags, and timing nudges you can audit." },
    { icon: "shield", title: "Bank-grade security", body: "Funds held with regulated partners, SOC 2 controls, and granular role permissions across your team." },
    { icon: "pie", title: "Spend intelligence", body: "Auto-categorized transactions and live budgets surface drift the moment it happens, not at month-end." },
    { icon: "card", title: "Issue cards instantly", body: "Virtual and physical cards with per-card limits, freeze in a tap, and real-time controls." },
    { icon: "repeat", title: "Reconcile in minutes", body: "Sync to your ledger, match invoices automatically, and export clean books on demand." },
  ];
  return (
    <div style={{ background: "var(--bg)", overflow: "hidden" }}>
      <LandingNav onEnter={onEnter} />

      {/* Hero */}
      <section style={{ position: "relative", maxWidth: 1200, margin: "0 auto", padding: "84px 24px 90px" }}>
        <div className="glow-orb" style={{ width: 520, height: 520, background: "rgba(34,170,238,.18)", top: -120, right: -80 }} />
        <div className="glow-orb" style={{ width: 420, height: 420, background: "rgba(46,230,246,.12)", top: 120, left: -160 }} />
        <div className="lp-hero" style={{ position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "1.02fr 0.98fr", gap: 56, alignItems: "center" }}>
          <div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--accent)",
              background: "var(--grad-faint)", border: "1px solid rgba(34,211,238,.2)", borderRadius: 100, padding: "6px 14px", marginBottom: 24 }}>
              <Icon name="sparkles" size={14} color="var(--accent)" /> AI-native finance for modern teams
            </span>
            <h1 className="lp-h1" style={{ margin: "0 0 20px", fontSize: 60, lineHeight: 1.04, letterSpacing: "-0.03em", fontWeight: 600, color: "var(--text)" }}>
              Move money with<br/><span style={{ background: "var(--grad)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>intelligence built in.</span>
            </h1>
            <p style={{ margin: "0 0 32px", fontSize: 18, lineHeight: 1.6, color: "var(--text-2)", maxWidth: 480 }}>
              One account for global payments, cards, and FX — with an AI layer that forecasts cash flow and tells you exactly when to act.
            </p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
              <GlowButton size="lg" icon="arrowr" onClick={onEnter}>Open your account</GlowButton>
              <GhostButton size="lg" icon="eye" onClick={onEnter}>View live demo</GhostButton>
            </div>
            <div style={{ display: "flex", gap: 28, marginTop: 40 }}>
              <Stat v="$4.2B+" l="Processed yearly" />
              <Stat v="40+" l="Currencies" />
              <Stat v="12k+" l="Teams onboard" />
            </div>
          </div>
          <HeroMock />
        </div>
      </section>

      {/* Logos strip */}
      <section style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", background: "var(--bg-2)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "26px 24px", display: "flex", alignItems: "center", gap: 40, flexWrap: "wrap", justifyContent: "center" }}>
          <span style={{ fontSize: 13, color: "var(--text-faint)" }}>Trusted by finance teams at</span>
          {["Northwind", "Lumen", "Apex Labs", "Vertex", "Cobalt", "Meridian"].map(b => (
            <span key={b} style={{ fontSize: 18, fontWeight: 600, color: "var(--text-faint)", letterSpacing: "-0.01em" }}>{b}</span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "96px 24px" }}>
        <div style={{ maxWidth: 620, marginBottom: 48 }}>
          <h2 className="lp-h2" style={{ margin: "0 0 14px", fontSize: 42, lineHeight: 1.1, letterSpacing: "-0.025em", fontWeight: 600, color: "var(--text)" }}>Everything your money does, in one place.</h2>
          <p style={{ margin: 0, fontSize: 17, color: "var(--text-3)", lineHeight: 1.6 }}>Payments, cards, FX, and reconciliation — unified, and quietly run by AI.</p>
        </div>
        <div className="lp-feat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
          {feats.map(f => <FeatureCard key={f.title} {...f} />)}
        </div>
      </section>

      {/* AI showcase */}
      <section style={{ background: "var(--bg-2)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", position: "relative", overflow: "hidden" }}>
        <div className="glow-orb" style={{ width: 480, height: 480, background: "rgba(42,141,255,.14)", bottom: -160, left: "50%" }} />
        <div className="lp-ai" style={{ maxWidth: 1200, margin: "0 auto", padding: "96px 24px", display: "grid", gridTemplateColumns: "0.95fr 1.05fr", gap: 56, alignItems: "center", position: "relative", zIndex: 1 }}>
          <div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--accent)", marginBottom: 18 }}>
              <Icon name="sparkles" size={15} color="var(--accent)" /> VANTAGE INTELLIGENCE
            </span>
            <h2 className="lp-h2" style={{ margin: "0 0 16px", fontSize: 40, lineHeight: 1.1, letterSpacing: "-0.025em", fontWeight: 600, color: "var(--text)" }}>An analyst that never sleeps.</h2>
            <p style={{ margin: "0 0 24px", fontSize: 17, color: "var(--text-2)", lineHeight: 1.65 }}>
              Ask in plain language, get answers grounded in your real transactions. Vantage forecasts runway, flags anomalies, and recommends the cheapest moment to move.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 14 }}>
              {["Cash-flow forecasting with confidence ranges", "Anomaly & duplicate-charge detection", "FX timing recommendations, explained"].map(x => (
                <li key={x} style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 15, color: "var(--text)" }}>
                  <span style={{ color: "var(--accent)", display: "flex" }}><Icon name="check" size={18} sw={2.4} color="var(--accent)" /></span>{x}</li>
              ))}
            </ul>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Card pad={20} style={{ background: "var(--surface)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: "var(--grad)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 14px rgba(34,211,238,.4)" }}><Icon name="sparkles" size={18} color="var(--on-accent)" /></span>
                <span style={{ fontSize: 14, color: "var(--text-3)" }}>You asked</span>
              </div>
              <p style={{ margin: "0 0 16px", fontSize: 16, color: "var(--text)", fontWeight: 500 }}>"Can we afford the AUD vendor payout this week?"</p>
              <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
                <p style={{ margin: "0 0 12px", fontSize: 14.5, color: "var(--text-2)", lineHeight: 1.6 }}>
                  Yes. Projected balance stays above your $80k buffer through Friday. Paying the <b style={{ color: "var(--accent)" }}>$450.00</b> AUD invoice now saves ~$6 vs. waiting — AUD/USD is favorable today.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <span className="num up" style={{ fontSize: 12.5 }}>Buffer safe</span>
                  <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>·</span>
                  <span className="num" style={{ fontSize: 12.5, color: "var(--accent)" }}>AUD 1.00 = 0.6453 USD</span>
                </div>
              </div>
            </Card>
            <Card pad={20}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 13.5, color: "var(--text-3)" }}>30-day forecast</span>
                <span className="num up" style={{ fontSize: 13 }}>+ $24,800 projected</span>
              </div>
              <AreaChart data={[60, 58, 64, 62, 70, 68, 78, 74, 86, 92, 88, 104]} height={96} />
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "96px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 className="lp-h2" style={{ margin: "0 0 12px", fontSize: 42, letterSpacing: "-0.025em", fontWeight: 600, color: "var(--text)" }}>Pricing that scales with you</h2>
          <p style={{ margin: 0, fontSize: 17, color: "var(--text-3)" }}>Start free. Upgrade when your desk does.</p>
        </div>
        <div className="lp-price-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, alignItems: "start" }}>
          <PriceTier name="Starter" price="$0" per="/mo" onEnter={onEnter} cta="Get started"
            features={["1 account · 5 currencies", "Daily AI summaries", "2 team members", "Standard FX rates"]} />
          <PriceTier name="Growth" price="$49" per="/mo" featured onEnter={onEnter} cta="Start free trial"
            features={["Unlimited currencies", "Real-time AI insights", "Unlimited members", "Mid-market FX", "Card issuing"]} />
          <PriceTier name="Scale" price="Custom" per="" onEnter={onEnter} cta="Talk to sales"
            features={["Dedicated FX desk", "Custom AI models", "SSO + audit logs", "SLA & support"]} />
        </div>
      </section>

      {/* CTA */}
      <section style={{ position: "relative", overflow: "hidden", borderTop: "1px solid var(--border)" }}>
        <div className="glow-orb" style={{ width: 600, height: 380, background: "rgba(34,170,238,.2)", top: -60, left: "50%", transform: "translateX(-50%)" }} />
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "104px 24px", textAlign: "center", position: "relative", zIndex: 1 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 48, letterSpacing: "-0.03em", fontWeight: 600, color: "var(--text)", lineHeight: 1.08 }}>Put your money on autopilot.</h2>
          <p style={{ margin: "0 0 32px", fontSize: 18, color: "var(--text-2)" }}>Open an account in minutes. No card required.</p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <GlowButton size="lg" icon="arrowr" onClick={onEnter}>Open your account</GlowButton>
            <GhostButton size="lg" onClick={onEnter}>Book a demo</GhostButton>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--border)", background: "var(--bg-2)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "56px 24px 28px" }}>
          <div className="lp-footer-grid" style={{ display: "grid", gridTemplateColumns: "1.4fr repeat(4,1fr)", gap: 24, marginBottom: 40 }}>
            <div><Logo size={22} /><p style={{ margin: "16px 0 0", fontSize: 13.5, color: "var(--text-faint)", lineHeight: 1.6, maxWidth: 240 }}>AI-native finance for modern teams.</p></div>
            {[["Product", ["Payments", "Cards", "FX", "Insights"]], ["Company", ["About", "Careers", "Blog", "Press"]], ["Resources", ["Docs", "API", "Status", "Support"]], ["Legal", ["Privacy", "Terms", "Security", "Compliance"]]].map(([h, ls]) => (
              <div key={h}>
                <p style={{ margin: "0 0 14px", fontSize: 13.5, fontWeight: 600, color: "var(--text-2)" }}>{h}</p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                  {ls.map(l => <li key={l}><a href="#" onClick={e => e.preventDefault()} style={{ fontSize: 13.5, color: "var(--text-faint)", textDecoration: "none" }}>{l}</a></li>)}
                </ul>
              </div>
            ))}
          </div>
          <div style={{ paddingTop: 24, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <span style={{ fontSize: 13, color: "var(--text-faint)" }}>© 2026 Vantage Technologies, Inc. Not a bank; banking services via regulated partners.</span>
            <span style={{ fontSize: 13, color: "var(--text-faint)" }}>Built for finance teams worldwide.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

Object.assign(window, { Landing });
