import { ExtractClient } from "./ExtractClient";

export const dynamic = "force-static";

export const metadata = {
  title: "Live extraction — Archon",
  description:
    "Watch AWS Bedrock vision read a real payroll document and score the structured result against ground truth.",
};

export default function ExtractPage() {
  return (
    <main className="main extract-page">
      <ExtractClient />
    </main>
  );
}
