/* Vantage Product — Transfer modal, recreated from the reference. Exports TransferModal. */

function RowToggle({ label, on, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0" }}>
      <span style={{ fontSize: 16, color: "var(--text)" }}>{label}</span>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

function Selector({ children, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, height: 64, padding: "0 18px",
      background: "var(--input)", border: "1px solid var(--border)", borderRadius: "var(--r-input)", cursor: "pointer" }}>
      {children}
      <Icon name="chevdown" size={20} color="var(--text-3)" />
    </div>
  );
}

function TransferModal({ open, onClose }) {
  const [schedule, setSchedule] = React.useState(true);
  const [recur, setRecur] = React.useState(false);
  const [convert, setConvert] = React.useState(true);
  const [amount, setAmount] = React.useState("450.00");
  const [comment, setComment] = React.useState("");

  if (!open) return null;
  const divider = <div style={{ height: 1, background: "var(--border)", margin: "6px 0" }} />;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(3,5,8,.72)",
      backdropFilter: "blur(6px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 20px", overflowY: "auto" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, background: "var(--surface)",
        border: "1px solid var(--border-strong)", borderRadius: "var(--r-card)", boxShadow: "0 30px 90px rgba(0,0,0,.6), 0 0 0 1px rgba(34,211,238,.06)",
        position: "relative", overflow: "hidden" }}>
        <div className="glow-orb" style={{ width: 320, height: 220, background: "rgba(34,170,238,.16)", bottom: -120, right: -80 }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 24px 16px", position: "relative", zIndex: 1 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "var(--text)" }}>Send money</h2>
            <p style={{ margin: "3px 0 0", fontSize: 13.5, color: "var(--text-faint)" }}>Review the details before you pay.</p>
          </div>
          <button onClick={onClose} style={{ width: 38, height: 38, borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-2)" }}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <div style={{ padding: "0 24px 8px", position: "relative", zIndex: 1 }}>
          {/* From account */}
          <Field label="From">
            <Selector>
              <span style={{ width: 38, height: 38, borderRadius: 9, background: "var(--grad-faint)", border: "1px solid rgba(34,211,238,.2)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Icon name="card" size={19} color="var(--accent)" /></span>
              <span style={{ flex: 1, fontSize: 16, color: "var(--text)" }}>Access Account</span>
              <span className="num" style={{ fontSize: 15, color: "var(--text-2)" }}>$32,346.09</span>
            </Selector>
          </Field>

          {/* Transfer to */}
          <div style={{ marginTop: 18 }}>
            <Field label="Transfer to">
              <Selector>
                <Initials name="David Smith" size={36} online />
                <span style={{ flex: 1, display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
                  <span style={{ fontSize: 16, color: "var(--text)", fontWeight: 500 }}>David Smith</span>
                  <span style={{ fontSize: 13.5, color: "var(--text-faint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>davidsmith@gmail.com</span>
                </span>
              </Selector>
            </Field>
          </div>

          <div style={{ marginTop: 14 }}>{divider}</div>

          <RowToggle label="Schedule transfer for later on" on={schedule} onChange={setSchedule} />
          <RowToggle label="Make transfer reoccurring" on={recur} onChange={setRecur} />

          {/* Amount + Date */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 8 }}>
            <Field label="Amount">
              <div style={{ ...inputStyle, display: "flex", alignItems: "center", gap: 8, padding: "0 16px" }}>
                <span style={{ color: "var(--text-3)", fontSize: 16 }}>$</span>
                <input value={amount} onChange={e => setAmount(e.target.value)} className="num"
                  style={{ background: "transparent", border: "none", outline: "none", color: "var(--text)", fontSize: 16, width: "100%" }} />
              </div>
            </Field>
            <Field label="Date">
              <div style={{ ...inputStyle, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, fontSize: 15.5, color: "var(--text)" }}>17 January, 2024</span>
                <Icon name="calendar" size={18} color="var(--text-3)" />
              </div>
            </Field>
          </div>

          {/* Comments */}
          <div style={{ marginTop: 16 }}>
            <Field label="Comments (optional)">
              <textarea value={comment} onChange={e => setComment(e.target.value.slice(0, 120))} placeholder="120 character limit"
                rows={2} style={{ ...inputStyle, height: "auto", padding: "13px 16px", resize: "none", lineHeight: 1.5, fontFamily: "var(--font)" }} />
            </Field>
          </div>

          <div style={{ marginTop: 14 }}>{divider}</div>

          {/* Convert currency */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0" }}>
            <span style={{ fontSize: 16, color: "var(--text)" }}>Convert currency with our service</span>
            <CheckBox on={convert} onChange={setConvert} size={26} />
          </div>

          {convert && (
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 16, padding: 18, marginBottom: 6 }}>
              <span style={{ display: "block", fontSize: 14, color: "var(--text-2)", marginBottom: 12 }}>Exchange Rate</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ ...inputStyle, flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
                  <Flag cc="AU" size={22} /><span className="num" style={{ fontSize: 16, color: "var(--text)" }}>1.00</span>
                </div>
                <span style={{ color: "var(--text-3)", fontSize: 18 }}>=</span>
                <div style={{ ...inputStyle, flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
                  <Flag cc="US" size={22} /><span className="num" style={{ fontSize: 16, color: "var(--text)" }}>0.6453</span>
                </div>
              </div>
              <p style={{ margin: "14px 0 0", fontSize: 13, color: "var(--text-faint)", lineHeight: 1.6 }}>
                In addition to the fee listed above, Acme Inc. also makes money through this <a href="#" onClick={e => e.preventDefault()} style={{ color: "var(--accent)", textDecoration: "none" }}>exchange rate</a> when we convert the currency.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: 14, padding: "16px 24px 24px", position: "relative", zIndex: 1 }}>
          <GhostButton variant="soft" full size="lg" onClick={onClose}>Cancel</GhostButton>
          <GlowButton full size="lg" icon="card" onClick={onClose}>Proceed to Pay</GlowButton>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TransferModal });
