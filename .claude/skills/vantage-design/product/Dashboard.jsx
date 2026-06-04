/* Vantage Product — Dashboard (dark cyan-glow). Exports Dashboard. */

function Initials({ name, size = 38, online }) {
  const init = name.split(" ").map(w => w[0]).slice(0, 2).join("");
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <span style={{ position: "relative", flex: "none", display: "inline-block" }}>
      <span style={{ width: size, height: size, borderRadius: 100, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.36, fontWeight: 600, color: "#fff",
        background: `linear-gradient(135deg, hsl(${hue} 70% 52%), hsl(${(hue + 40) % 360} 70% 44%))`,
        boxShadow: "0 0 0 1px rgba(255,255,255,.08)" }}>{init}</span>
      {online && <span style={{ position: "absolute", right: 0, bottom: 0, width: size * 0.28, height: size * 0.28, borderRadius: 100, background: "var(--up)", border: "2px solid var(--surface)", boxShadow: "0 0 8px var(--up)" }} />}
    </span>
  );
}

function Sidebar({ page, setPage, onExit }) {
  const items = [["Overview", "home"], ["Payments", "send"], ["Cards", "card"], ["Insights", "sparkles"], ["Team", "users"], ["Settings", "settings"]];
  return (
    <aside style={{ width: 248, flex: "none", borderRight: "1px solid var(--border)", background: "var(--bg-2)",
      display: "flex", flexDirection: "column", padding: "22px 16px", position: "sticky", top: 0, height: "100vh" }}>
      <div style={{ padding: "0 8px 22px" }}><Logo size={23} /></div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        {items.map(([l, ic]) => {
          const active = page === l;
          return (
            <button key={l} onClick={() => setPage(l)} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 12, cursor: "pointer",
              border: "none", textAlign: "left", fontSize: 14.5, fontWeight: 500, fontFamily: "var(--font)",
              color: active ? "var(--text)" : "var(--text-3)",
              background: active ? "var(--grad-faint)" : "transparent",
              boxShadow: active ? "inset 0 0 0 1px rgba(34,211,238,.2)" : "none", transition: "all .15s" }}>
              <Icon name={ic} size={19} color={active ? "var(--accent)" : "var(--text-3)"} />{l}
            </button>
          );
        })}
      </nav>
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "8px 8px" }}>
          <Initials name="Ava Chen" size={36} online />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Ava Chen</div>
            <div style={{ fontSize: 12, color: "var(--text-faint)" }}>Acme Inc.</div>
          </div>
          <button onClick={onExit} title="Sign out" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-3)", display: "flex", padding: 4 }}>
            <Icon name="logout" size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function Topbar({ onTransfer }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "22px 32px", borderBottom: "1px solid var(--border)",
      position: "sticky", top: 0, zIndex: 30, background: "rgba(6,8,11,.78)", backdropFilter: "blur(12px)" }}>
      <div style={{ flex: 1 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text)" }}>Overview</h1>
        <p style={{ margin: "2px 0 0", fontSize: 13.5, color: "var(--text-faint)" }}>Welcome back, Ava — here's where your money stands.</p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className="db-search" style={{ display: "flex", alignItems: "center", gap: 9, height: 44, padding: "0 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 100, color: "var(--text-faint)", fontSize: 14 }}>
          <Icon name="search" size={17} /> <span>Search</span>
        </div>
        <button style={{ width: 44, height: 44, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-2)", position: "relative" }}>
          <Icon name="bell" size={19} />
          <span style={{ position: "absolute", top: 10, right: 11, width: 7, height: 7, borderRadius: 100, background: "var(--accent)", boxShadow: "0 0 8px var(--accent)" }} />
        </button>
        <GlowButton icon="send" onClick={onTransfer}>Send money</GlowButton>
      </div>
    </div>
  );
}

function KpiCard({ label, value, delta, up, data }) {
  return (
    <Card pad={20} hover>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontSize: 13.5, color: "var(--text-3)" }}>{label}</span>
        <span className={"num " + (up ? "up" : "down")} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 3 }}>
          <Icon name={up ? "upright" : "downleft"} size={13} color={up ? "var(--up)" : "var(--down)"} />{delta}</span>
      </div>
      <div className="num" style={{ fontSize: 27, fontWeight: 600, color: "var(--text)", margin: "8px 0 10px" }}>{value}</div>
      <Sparkline data={data} width={200} height={32} color={up ? "var(--up)" : "var(--down)"} />
    </Card>
  );
}

const TXNS = [
  { name: "Figma", cat: "Software", date: "Today, 14:22", amt: "-$144.00", up: false, ic: "card", status: "Completed" },
  { name: "Stripe payout", cat: "Income", date: "Today, 09:10", amt: "+$8,420.50", up: true, ic: "downleft", status: "Completed" },
  { name: "David Smith", cat: "Vendor · AUD", date: "Yesterday", amt: "-$450.00", up: false, ic: "send", status: "Scheduled" },
  { name: "AWS", cat: "Infrastructure", date: "16 Jan", amt: "-$2,108.33", up: false, ic: "building", status: "Completed" },
  { name: "Northwind Ltd", cat: "Invoice", date: "15 Jan", amt: "+$12,500.00", up: true, ic: "downleft", status: "Completed" },
];

function TransactionsCard() {
  return (
    <Card pad={0}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 22px 14px" }}>
        <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 600, color: "var(--text)" }}>Recent activity</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 9, color: "var(--text-2)", fontSize: 13, cursor: "pointer", fontFamily: "var(--font)" }}><Icon name="filter" size={14} />Filter</button>
          <button style={{ display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 9, color: "var(--text-2)", fontSize: 13, cursor: "pointer", fontFamily: "var(--font)" }}><Icon name="download" size={14} />Export</button>
        </div>
      </div>
      <div>
        {TXNS.map((t, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 22px", borderTop: "1px solid var(--border)" }}>
            <span style={{ width: 38, height: 38, borderRadius: 11, flex: "none", background: t.up ? "rgba(52,211,153,.12)" : "var(--surface-2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: t.up ? "var(--up)" : "var(--text-2)" }}>
              <Icon name={t.ic} size={18} color={t.up ? "var(--up)" : "var(--text-2)"} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 500, color: "var(--text)" }}>{t.name}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>{t.cat} · {t.date}</div>
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 500, padding: "4px 9px", borderRadius: 100,
              color: t.status === "Scheduled" ? "var(--warn)" : "var(--text-3)",
              background: t.status === "Scheduled" ? "rgba(251,191,36,.12)" : "var(--surface-2)", border: "1px solid var(--border)" }}>{t.status}</span>
            <span className={"num " + (t.up ? "up" : "")} style={{ fontSize: 14.5, fontWeight: 500, width: 110, textAlign: "right", color: t.up ? "var(--up)" : "var(--text)" }}>{t.amt}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AiInsights({ onTransfer }) {
  const items = [
    { ic: "trend", tone: "var(--up)", bg: "rgba(52,211,153,.12)", title: "Inflows up 12% this week", body: "Stripe payouts are trending above forecast. Runway extends to 9.2 months." },
    { ic: "zap", tone: "var(--accent)", bg: "var(--grad-faint)", title: "Good time to pay the AUD invoice", body: "AUD/USD is favorable today — paying David Smith now saves ~$6.", action: "Pay now" },
    { ic: "shield", tone: "var(--warn)", bg: "rgba(251,191,36,.12)", title: "Duplicate charge flagged", body: "Two $144 Figma charges in 24h. Review before they settle." },
  ];
  return (
    <Card pad={0} glow>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 20px", borderBottom: "1px solid var(--border)" }}>
        <span style={{ width: 32, height: 32, borderRadius: 9, background: "var(--grad)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 14px rgba(34,211,238,.4)" }}><Icon name="sparkles" size={17} color="var(--on-accent)" /></span>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text)", flex: 1 }}>AI insights</h3>
        <span style={{ fontSize: 11.5, color: "var(--accent)", background: "var(--grad-faint)", border: "1px solid rgba(34,211,238,.2)", borderRadius: 100, padding: "3px 9px" }}>Live</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", gap: 13, padding: "16px 20px", borderTop: i ? "1px solid var(--border)" : "none" }}>
            <span style={{ width: 36, height: 36, flex: "none", borderRadius: 10, background: it.bg, display: "flex", alignItems: "center", justifyContent: "center", color: it.tone }}><Icon name={it.ic} size={18} color={it.tone} /></span>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{it.title}</div>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-3)", lineHeight: 1.55 }}>{it.body}</p>
              {it.action && <button onClick={onTransfer} style={{ marginTop: 9, background: "transparent", border: "none", color: "var(--accent)", fontSize: 13.5, fontWeight: 600, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 5, fontFamily: "var(--font)" }}>{it.action}<Icon name="arrowr" size={14} color="var(--accent)" /></button>}
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: 14, borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--input)", border: "1px solid var(--border)", borderRadius: 12, padding: "0 14px", height: 46 }}>
          <Icon name="sparkles" size={16} color="var(--text-faint)" />
          <span style={{ fontSize: 14, color: "var(--text-faint)", flex: 1 }}>Ask about your finances…</span>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--grad)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="arrowr" size={15} color="var(--on-accent)" /></span>
        </div>
      </div>
    </Card>
  );
}

function BalanceCard() {
  const [range, setRange] = React.useState("3M");
  const sets = {
    "1M": [88, 84, 90, 86, 96, 92, 104],
    "3M": [42, 48, 45, 60, 55, 72, 68, 90, 84, 100, 96, 118],
    "1Y": [30, 38, 35, 52, 60, 58, 72, 80, 76, 95, 110, 132],
  };
  return (
    <Card pad={24}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <span style={{ fontSize: 14, color: "var(--text-3)" }}>Total balance</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
            <span className="num" style={{ fontSize: 40, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.02em" }}>$148,205.60</span>
            <span className="num up" style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 4 }}><Icon name="trend" size={15} color="var(--up)" />+8.4%</span>
          </div>
          <span style={{ fontSize: 13, color: "var(--text-faint)" }}>Across 4 accounts · 3 currencies</span>
        </div>
        <div style={{ display: "flex", gap: 4, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 100, padding: 4 }}>
          {["1M", "3M", "1Y"].map(r => (
            <button key={r} onClick={() => setRange(r)} style={{ height: 30, padding: "0 14px", borderRadius: 100, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, fontFamily: "var(--font)", color: range === r ? "var(--on-accent)" : "var(--text-3)",
              background: range === r ? "var(--grad)" : "transparent", boxShadow: range === r ? "0 0 12px rgba(34,211,238,.35)" : "none" }}>{r}</button>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 18 }}><AreaChart data={sets[range]} height={200} /></div>
    </Card>
  );
}

function AccountsCard({ onTransfer }) {
  const accts = [
    { cc: "US", name: "USD · Access Account", bal: "$32,346.09" },
    { cc: "EU", name: "EUR · Operating", bal: "€18,902.44" },
    { cc: "AU", name: "AUD · Payouts", bal: "A$9,120.00" },
  ];
  return (
    <Card pad={0}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 14px" }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text)" }}>Accounts</h3>
        <button style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "none", color: "var(--accent)", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)" }}><Icon name="plus" size={15} color="var(--accent)" />Add</button>
      </div>
      {accts.map((a, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 20px", borderTop: "1px solid var(--border)" }}>
          <Flag cc={a.cc} size={30} />
          <span style={{ flex: 1, fontSize: 14, color: "var(--text-2)" }}>{a.name}</span>
          <span className="num" style={{ fontSize: 14.5, fontWeight: 500, color: "var(--text)" }}>{a.bal}</span>
        </div>
      ))}
      <div style={{ padding: 16, borderTop: "1px solid var(--border)", display: "flex", gap: 10 }}>
        <GhostButton size="sm" variant="soft" icon="send" full onClick={onTransfer}>Send</GhostButton>
        <GhostButton size="sm" variant="soft" icon="repeat" full onClick={onTransfer}>Convert</GhostButton>
      </div>
    </Card>
  );
}

function SpendCard() {
  const segs = [
    { label: "Software", value: 38, color: "#2ee6f6" },
    { label: "Payroll", value: 30, color: "#2a8dff" },
    { label: "Infra", value: 20, color: "#a78bfa" },
    { label: "Other", value: 12, color: "#475569" },
  ];
  return (
    <Card pad={20}>
      <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "var(--text)" }}>Spend breakdown</h3>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ position: "relative", flex: "none" }}>
          <Donut segments={segs} size={124} thickness={15} />
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>This month</span>
            <span className="num" style={{ fontSize: 17, fontWeight: 600, color: "var(--text)" }}>$24.8k</span>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
          {segs.map(s => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 9, height: 9, borderRadius: 100, background: s.color }} />
              <span style={{ flex: 1, fontSize: 13.5, color: "var(--text-2)" }}>{s.label}</span>
              <span className="num" style={{ fontSize: 13, color: "var(--text-3)" }}>{s.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function Dashboard({ onExit, onTransfer, page, setPage }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <Sidebar page={page} setPage={setPage} onExit={onExit} />
      <main style={{ flex: 1, minWidth: 0 }}>
        <Topbar onTransfer={onTransfer} />
        <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1320, margin: "0 auto" }}>
          <div className="db-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
            <KpiCard label="30-day income" value="$96,420" delta="11.2%" up data={[20, 28, 24, 36, 40, 52, 60, 72]} />
            <KpiCard label="30-day spend" value="$24,810" delta="3.4%" up={false} data={[60, 52, 56, 44, 48, 40, 36, 30]} />
            <KpiCard label="Net runway" value="9.2 mo" delta="0.6 mo" up data={[40, 42, 44, 46, 48, 52, 56, 60]} />
          </div>
          <div className="db-main" style={{ display: "grid", gridTemplateColumns: "1.65fr 1fr", gap: 20, alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <BalanceCard />
              <TransactionsCard />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <AiInsights onTransfer={onTransfer} />
              <AccountsCard onTransfer={onTransfer} />
              <SpendCard />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

Object.assign(window, { Dashboard, Initials });
