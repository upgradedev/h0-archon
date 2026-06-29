import Link from "next/link";

// Marketing landing — the front door for judges. Intentionally STATIC and
// server-only: zero DB reads, zero pipeline calls, so it can never white-screen
// the demo. The product itself lives at /dashboard; the live wow at /extract.
export const dynamic = "force-static";

export const metadata = {
  title: "Archon — agentic finance intelligence for SMBs",
  description:
    "The bank statement understates true payroll cost by ~28%. Archon reads the documents with AWS Bedrock vision and a deterministic engine computes auditable books.",
};

const FEATURES = [
  {
    title: "Reads the real documents",
    body: "AWS Bedrock vision (Claude Sonnet 4.6) extracts bank confirmations, payroll registers and payslips — Greek or English, scanned or digital. Measured 96.7% field accuracy against ground truth.",
    tag: "AI extraction",
  },
  {
    title: "Computes books you can audit",
    body: "A deterministic CFO rules engine fuses the documents into one accurate financial event. Every figure is rule-derived and traceable — no LLM guessing the numbers.",
    tag: "Deterministic engine",
  },
  {
    title: "Finds the hidden 28%",
    body: "The bank salary transfer never sees employer IKA. Archon links the three payroll documents and surfaces the true employer cost the bank statement hides.",
    tag: "Event fusion",
  },
  {
    title: "Full monthly close",
    body: "P&L, account-statement movement, sales versus goal, purchase concentration and payroll controls — one boardroom-ready close, not a single toy metric.",
    tag: "Finance close",
  },
  {
    title: "Source-backed and explainable",
    body: "Seven-agent run ledger, document-intake coverage, source citations and an Ask-Archon Q&A panel — the analysis shows its work.",
    tag: "Auditability",
  },
  {
    title: "Serverless on Vercel + AWS",
    body: "Next.js on Vercel Functions, AWS DynamoDB single-table persistence, AWS Bedrock for vision. No servers to run; degrades gracefully when unconfigured.",
    tag: "Cloud-native",
  },
];

const STACK = [
  { name: "Next.js", role: "App + Functions on Vercel" },
  { name: "AWS DynamoDB", role: "Single-table report + activity store" },
  { name: "AWS Bedrock", role: "Claude Sonnet 4.6 vision extraction" },
  { name: "Deterministic engine", role: "Auditable CFO rules in Vercel Functions" },
];

const METRICS = [
  { value: "€3,154", label: "hidden employer cost per month a bank statement misses" },
  { value: "~28%", label: "employer-IKA wedge invisible on the salary transfer" },
  { value: "€314k", label: "true cost recovered across the document corpus" },
  { value: "96.7%", label: "measured field accuracy, real Bedrock vision" },
];

export default function LandingPage() {
  return (
    <main className="landing">
      <section className="hero">
        <div className="hero-inner">
          <span className="hero-eyebrow">Agentic finance intelligence · Vercel + AWS</span>
          <h1 className="hero-title">
            Your bank statement understates payroll cost by{" "}
            <span className="hero-accent">~28%</span>.
          </h1>
          <p className="hero-lede">
            That is <strong>€3,154 a month</strong> of employer cost the salary
            transfer never shows — and <strong>€314k</strong> across our document
            corpus. Archon reads the underlying documents with{" "}
            <strong>AWS Bedrock vision</strong> and a{" "}
            <strong>deterministic engine</strong> computes the auditable books.
          </p>
          <div className="hero-ctas">
            <Link href="/dashboard" className="primary lg">
              Open the dashboard
            </Link>
            <Link href="/extract" className="secondary lg">
              Try live extraction →
            </Link>
          </div>
          <p className="hero-foot">
            No login. Public demo for judges. Live at{" "}
            <code>h0-archon.vercel.app</code>.
          </p>
        </div>

        <div className="hero-card">
          <div className="hero-card-head">
            <span className="tag">The wedge</span>
            <span className="status">Kyklades Retail OE · 2026-07</span>
          </div>
          <div className="wedge-rows">
            <div className="wedge-row">
              <span>Bank confirmation (what you see)</span>
              <strong>€5,957</strong>
            </div>
            <div className="wedge-row hidden">
              <span>+ employer IKA (hidden)</span>
              <strong>€3,154</strong>
            </div>
            <div className="wedge-row total">
              <span>True employer cost</span>
              <strong>€9,111</strong>
            </div>
          </div>
          <p className="wedge-note">
            Three documents, one truth. The bank statement alone would book the
            payroll close 28% light.
          </p>
        </div>
      </section>

      <section className="value-strip">
        <p className="value-prop">
          <strong>AI reads the documents</strong> (AWS Bedrock vision, 96.7%
          field accuracy) <span className="arrow">→</span>{" "}
          <strong>a deterministic engine computes auditable books</strong>.
        </p>
        <p className="value-sub">
          The LLM never invents a number. It transcribes; rules compute. That is
          what makes the close trustworthy.
        </p>
      </section>

      <section className="metrics-band">
        {METRICS.map((m) => (
          <div key={m.label} className="metric-card">
            <div className="metric-value">{m.value}</div>
            <div className="metric-label">{m.label}</div>
          </div>
        ))}
      </section>

      <section className="features">
        <h2 className="section-h2">Built like a product, not a demo</h2>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <article key={f.title} className="feature-card">
              <span className="feature-tag">{f.tag}</span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="stack-strip">
        <h2 className="section-h2">Serverless on Vercel + AWS</h2>
        <div className="stack-grid">
          {STACK.map((s) => (
            <div key={s.name} className="stack-card">
              <strong>{s.name}</strong>
              <span>{s.role}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-band">
        <h2>See the full monthly close — and watch the AI read a real document.</h2>
        <div className="hero-ctas">
          <Link href="/dashboard" className="primary lg">
            Run the finance close
          </Link>
          <Link href="/extract" className="secondary lg">
            Live extraction demo
          </Link>
        </div>
      </section>

      <footer className="landing-foot">
        <span>Archon · agentic SMB finance intelligence</span>
        <span>
          <a href="https://github.com/upgradedev/h0-archon" target="_blank" rel="noreferrer">
            GitHub
          </a>{" "}
          · MIT
        </span>
      </footer>
    </main>
  );
}
