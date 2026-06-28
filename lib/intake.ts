export interface IntakeFile {
  name: string;
  size: number;
  type?: string;
}

export interface ClassifiedIntakeFile extends IntakeFile {
  kind: "bank" | "sales" | "purchases" | "payroll" | "tax" | "unknown";
  role: string;
  confidence: number;
}

export interface IntakeResponse {
  received: number;
  accepted: number;
  coverage: string[];
  files: ClassifiedIntakeFile[];
  ready_for_close: boolean;
}

const rules: Array<{
  kind: ClassifiedIntakeFile["kind"];
  pattern: RegExp;
  role: string;
  confidence: number;
}> = [
  {
    kind: "bank",
    pattern: /bank|statement|alpha|cash|account/i,
    role: "Cash movements and closing balance",
    confidence: 0.96,
  },
  {
    kind: "sales",
    pattern: /sales|invoice|revenue|pos|target|goal/i,
    role: "Revenue, margin, owner goals",
    confidence: 0.94,
  },
  {
    kind: "purchases",
    pattern: /purchase|supplier|vendor|cogs|receipt|bill/i,
    role: "COGS and supplier concentration",
    confidence: 0.93,
  },
  {
    kind: "payroll",
    pattern: /payroll|payslip|misthodosia|salary|ika|employee/i,
    role: "Gross payroll, deductions, employer contributions",
    confidence: 0.97,
  },
  {
    kind: "tax",
    pattern: /tax|vat|mydata|filing/i,
    role: "Tax payable and compliance context",
    confidence: 0.9,
  },
];

export function classifyIntakeFile(file: IntakeFile): ClassifiedIntakeFile {
  const match = rules.find((rule) => rule.pattern.test(file.name));
  return {
    ...file,
    kind: match?.kind || "unknown",
    role: match?.role || "Review queue for manual classification",
    confidence: match?.confidence || 0.62,
  };
}

export function buildIntakeResponse(files: IntakeFile[]): IntakeResponse {
  const classified = files.map(classifyIntakeFile);
  const coverage = Array.from(new Set(classified.filter((file) => file.kind !== "unknown").map((file) => file.kind)));
  const required: ClassifiedIntakeFile["kind"][] = ["bank", "sales", "purchases", "payroll"];
  const readyForClose = required.every((kind) => coverage.includes(kind));

  return {
    received: files.length,
    accepted: classified.filter((file) => file.kind !== "unknown").length,
    coverage,
    files: classified,
    ready_for_close: readyForClose,
  };
}

export function sampleIntakeResponse(): IntakeResponse {
  return buildIntakeResponse([
    { name: "alpha_bank_statement_2026-05.pdf", size: 420_000, type: "application/pdf" },
    { name: "sales_targets_by_owner_2026-05.xlsx", size: 116_000, type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    { name: "supplier_purchases_2026-05.xlsx", size: 133_000, type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    { name: "misthodosia_register_2026-05.xlsx", size: 91_000, type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    { name: "employee_payslips_2026-05.zip", size: 730_000, type: "application/zip" },
  ]);
}
