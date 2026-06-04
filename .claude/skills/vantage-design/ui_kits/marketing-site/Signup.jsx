/* Vantage UI Kit — sign-up screen (light-canvas, demonstrates form components). */

function SignupScreen({ onBack, onDone }) {
  const [email, setEmail] = React.useState("");
  const [focus, setFocus] = React.useState(false);
  const valid = /\S+@\S+\.\S+/.test(email);
  return (
    <div style={{ minHeight: "100vh", background: "#fff", display: "flex", flexDirection: "column" }}>
      <TopNav onNav={onBack} />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <Badge>Get started</Badge>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 44, lineHeight: 1.05,
            letterSpacing: "-0.025em", color: "#0a0b0d", margin: "20px 0 8px" }}>Create your account</h1>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 16, color: "#5b616e", margin: "0 0 32px" }}>
            Start with one portfolio — no card required.
          </p>
          <label style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: "#0a0b0d", display: "block", marginBottom: 8 }}>Work email</label>
          <input
            value={email} onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
            placeholder="you@company.com"
            style={{
              width: "100%", boxSizing: "border-box", height: 48, borderRadius: 12,
              padding: focus ? "13px 15px" : "14px 16px",
              border: focus ? "2px solid #0052ff" : "1px solid #dee1e6",
              fontFamily: "var(--font-sans)", fontSize: 15, color: "#0a0b0d", outline: "none",
            }} />
          <div style={{ marginTop: 20 }}>
            <button disabled={!valid} onClick={onDone} style={{
              width: "100%", height: 56, borderRadius: 100, border: "none",
              fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 16,
              cursor: valid ? "pointer" : "not-allowed",
              background: valid ? "#0052ff" : "#a8b8cc", color: "#fff",
            }}>Continue</button>
          </div>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "#7c828a", margin: "20px 0 0", lineHeight: 1.5 }}>
            By continuing you agree to the Terms and acknowledge the Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}

function ConfirmScreen({ onBack }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0a0b0d", display: "flex", flexDirection: "column" }}>
      <TopNav dark onNav={onBack} />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
        <div style={{ maxWidth: 460 }}>
          <div style={{ width: 56, height: 56, borderRadius: 9999, background: "rgba(5,177,105,.16)",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#05b169", margin: "0 auto 24px" }}>
            <Icon name="check" size={28} stroke={3} />
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 44, letterSpacing: "-0.025em", color: "#fff", margin: "0 0 12px" }}>Check your inbox</h1>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 17, color: "#a8acb3", margin: "0 0 28px" }}>
            We sent a verification link to finish setting up your desk.
          </p>
          <Button variant="outline" dark onClick={onBack}>Back to home</Button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { SignupScreen, ConfirmScreen });
