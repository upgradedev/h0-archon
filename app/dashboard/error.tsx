"use client";

// Route-level error boundary. Prevents a thrown server/render error (e.g. a
// transient AWS DynamoDB read) from white-screening the app during the demo.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0b1120",
        color: "#e2e8f0",
        fontFamily: "system-ui, sans-serif",
        padding: "2rem",
      }}
    >
      <div style={{ maxWidth: 480, textAlign: "center" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>
          Archon hit a temporary error
        </h1>
        <p style={{ color: "#94a3b8", marginBottom: "1.5rem", lineHeight: 1.5 }}>
          The finance-close service could not load just now. This is usually a
          transient database read. Try again — the deterministic pipeline will
          recompute the report.
        </p>
        <button
          onClick={reset}
          style={{
            background: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: 8,
            padding: "0.6rem 1.4rem",
            fontSize: "0.95rem",
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    </main>
  );
}
