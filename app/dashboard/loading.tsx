// Route-level loading state shown while the server component awaits the
// latest report from AWS DynamoDB (or recomputes the deterministic pipeline).
export default function Loading() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0b1120",
        color: "#94a3b8",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>
          Running the finance close…
        </div>
        <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
          Intake · classify · extract · link · validate · report · analyze
        </div>
      </div>
    </main>
  );
}
