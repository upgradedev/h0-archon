// Domain types for the Archon finance-close pipeline.
// The current H0 demo exposes full SMB finance intelligence, while the typed
// payroll event remains the evidence-backed control finding inside that close:
//   - bank_confirmation : the net salary cash that left the company account
//   - payroll_register  : the full employer payroll cost (gross + employer IKA)
//   - payslip           : the per-employee payroll breakdown
//
// The bank confirmation alone *understates* the true employer payroll cost,
// because it never sees employer social-security (IKA) contributions or the
// tax withheld and remitted to the State. Archon fuses the three into one
// accurate PayrollEvent and surfaces that gap.

export type DocType = "bank_confirmation" | "payroll_register" | "payslip" | "unknown";

export interface ExtractedDocument {
  doc_id: string;
  doc_type: DocType;
  company: string;
  period: string; // YYYY-MM
  // Numeric payloads differ per doc type; all optional, all null-safe.
  bank_net_total?: number | null; // bank_confirmation: total net transfer out
  employer_cost_total?: number | null; // payroll_register: gross + employer IKA
  gross_total?: number | null; // payroll_register
  employer_ika_total?: number | null; // payroll_register
  employee_ika_total?: number | null; // payroll_register
  tax_withheld_total?: number | null; // payroll_register
  employee?: EmployeePayslip | null; // payslip
  payment_date?: string | null;
  source_filename: string;
}

export interface EmployeePayslip {
  employee_id: string;
  name: string;
  gross: number;
  employee_ika: number; // employee social-security contribution
  tax: number; // income tax withheld
  net: number; // what lands in the employee's bank account
  employer_ika: number; // employer-side social-security contribution
  employer_cost: number; // gross + employer_ika (true cost to the company)
}

export interface PayrollEvent {
  event_id: string;
  company: string;
  period: string;
  employee_count: number;
  bank_net_total: number; // from bank_confirmation
  gross_total: number; // from payroll_register
  employer_ika_total: number;
  employee_ika_total: number;
  tax_withheld_total: number;
  employer_cost_total: number; // THE accurate number (gross + employer IKA)
  // The headline insight: employer social-security contributions are completely
  // invisible on the bank salary-transfer confirmation, yet are ~28% of the net
  // figure the bank shows.
  cost_gap_amount: number; // employer_ika_total — the hidden employer-contribution wedge
  cost_gap_pct: number; // cost_gap_amount / bank_net_total * 100  (~28%)
  // Full reconciliation: everything the bank salary confirmation misses vs true cost.
  hidden_total: number; // employer_cost_total - bank_net_total
  employees: EmployeePayslip[];
  linked_docs: string[]; // doc_ids fused into this event
}

export interface ValidationResult {
  rule: string;
  description: string;
  passed: boolean;
  detail: string;
}

export interface AnalysisReport {
  event: PayrollEvent;
  validations: ValidationResult[];
  executive_summary: string;
  analysis_engine: string;
  generated_at: string;
  db_mode: "aws-dynamodb" | "aurora-postgres" | "embedded-demo";
}

// Audit trail of user-facing product interactions (document intake, Q&A).
// Persisted alongside reports so the app exposes a real activity history.
export type AuditActivityKind = "intake" | "ask";

export interface AuditActivity {
  activity_id: string;
  kind: AuditActivityKind;
  summary: string;
  details: Record<string, unknown>;
  created_at: string;
  db_mode: AnalysisReport["db_mode"];
}
