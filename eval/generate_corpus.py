"""
Labeled synthetic corpus generator for the Archon evaluation keystone.

For every document in every case it emits BOTH:
  (a) a RENDERED artifact (PDF via reportlab) — what a real OCR/vision
      extractor would have to read, and
  (b) GROUND-TRUTH structured labels — free, because we generate them.

The labels are written in the exact shape `lib/pipeline.ts::extract()` consumes
(`{company, period, payment_date, documents:[...]}`), so the perfect-extraction
ceiling can feed them straight into the real product pipeline.

Each case also carries:
  - expected_event       : the correct fusion of the *documents present* (spec
                           oracle for the pipeline's aggregation),
  - expected_validations : DOMAIN truth for R1-R4 (is this payroll actually
                           consistent?) — deliberately separate from the figures,
  - naive               : the bank-only "wrong number" a naive bookkeeper uses,
  - classification / artifacts maps for the extraction metrics.

Diversity: many companies x periods, varied headcounts/amounts/document mixes,
plus deliberate edge cases (missing docs, reconciliation breaks, non-standard
contribution rate, multi-page / noisy / alternate-layout / missing-field
renders). N is configurable.

Usage:
    pip install reportlab
    python eval/generate_corpus.py --n 40 --out eval/corpus/full --seed 7
    python eval/generate_corpus.py --n 6  --out eval/corpus/sample --seed 1 --kind sample

Everything is deterministic given --seed. PDF-only keeps it offline / CPU / light
(PDF satisfies the "PDF and/or PNG" requirement; PNG is a pluggable substrate).
"""

import argparse
import json
import random
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas

W, H = A4

# Greek statutory-style contribution rates used by the canonical sample dataset.
EMPLOYEE_IKA_RATE = 0.1387
EMPLOYER_IKA_RATE = 0.2229
# Illustrative ALTERNATE employer-contribution rate for the R2 brittleness case.
# NOT asserted as a specific statutory figure — it only needs to be a legitimate,
# internally-consistent rate that falls outside the pipeline's hardcoded band.
ALT_EMPLOYER_IKA_RATE = 0.2406

# Generic, sponsor-neutral synthetic SMB names (no real-org strings).
COMPANIES = [
    "Aigaio Foods AE", "Olympus Logistics IKE", "Kyklades Retail OE",
    "Thraki Agro SA", "Pindos Workshops IKE", "Ionian Trading AE",
    "Attica Bakeries OE", "Kriti Marine IKE", "Epirus Textiles AE",
    "Nestos Packaging OE", "Saronic Hospitality IKE", "Vardar Tools AE",
]

PERIODS = [
    f"{y}-{m:02d}" for y in (2025, 2026) for m in range(1, 13)
]

FIRST_NAMES = ["Georgios", "Maria", "Dimitrios", "Eleni", "Sofia", "Nikolaos",
               "Katerina", "Ioannis", "Anna", "Christos", "Despina", "Petros",
               "Vasiliki", "Andreas", "Foteini", "Stavros"]
LAST_NAMES = ["Papadopoulos", "Nikolaou", "Vlachos", "Georgiou", "Ioannou",
              "Makris", "Dimou", "Antoniou", "Petrou", "Samaras", "Lambrou",
              "Karras", "Spanou", "Raptis", "Fotiou", "Manos"]

ROLES = ["Senior Engineer", "Accountant", "Sales Lead", "Operations",
         "Junior Analyst", "Warehouse", "Driver", "Manager", "Technician",
         "Support", "Buyer", "QA"]


def r2(x: float) -> float:
    """Round to cents the same way the TS pipeline does (round-half-up at 1e-2)."""
    return round(x + 1e-9, 2)


# ---------------------------------------------------------------------------
# Per-employee truth from first principles (rounded to cents BEFORE summing).
# ---------------------------------------------------------------------------
def make_employee(rng: random.Random, idx: int, employer_rate: float) -> dict:
    gross = float(rng.randrange(8500, 42000, 50)) / 10.0  # 850.0 .. 4200.0, .x0
    employee_ika = r2(gross * EMPLOYEE_IKA_RATE)
    tax = r2(max(0.0, (gross - 1000.0) * 0.19))
    net = r2(gross - employee_ika - tax)
    employer_ika = r2(gross * employer_rate)
    employer_cost = r2(gross + employer_ika)
    return {
        "employee_id": f"EMP-{idx:03d}",
        "name": f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}",
        "role": rng.choice(ROLES),
        "gross": gross,
        "employee_ika": employee_ika,
        "tax": tax,
        "net": net,
        "employer_ika": employer_ika,
        "employer_cost": employer_cost,
    }


# ---------------------------------------------------------------------------
# Spec oracle: correct fusion of the documents PRESENT (mirrors pipeline spec,
# computed independently in Python; sums rounded per-employee fields).
# ---------------------------------------------------------------------------
def compute_expected_event(emitted_payslips: list, bank_net_total) -> dict:
    def s(key):
        return r2(sum(e[key] for e in emitted_payslips))

    gross_total = s("gross")
    employer_ika_total = s("employer_ika")
    employee_ika_total = s("employee_ika")
    tax_withheld_total = s("tax")
    employer_cost_total = r2(gross_total + employer_ika_total)
    payslip_net_total = s("net")
    # pipeline falls back to payslip net sum when no bank confirmation is present.
    bank = r2(bank_net_total if bank_net_total is not None else payslip_net_total)
    cost_gap_amount = employer_ika_total
    cost_gap_pct = r2((cost_gap_amount / bank) * 100) if bank else 0.0
    hidden_total = r2(employer_cost_total - bank)
    return {
        "employee_count": len(emitted_payslips),
        "bank_net_total": bank,
        "gross_total": gross_total,
        "employer_ika_total": employer_ika_total,
        "employee_ika_total": employee_ika_total,
        "tax_withheld_total": tax_withheld_total,
        "employer_cost_total": employer_cost_total,
        "cost_gap_amount": cost_gap_amount,
        "cost_gap_pct": cost_gap_pct,
        "hidden_total": hidden_total,
        "payslip_net_total": payslip_net_total,
    }


# ---------------------------------------------------------------------------
# PDF rendering helpers (compact; values printed so a real extractor could
# recover them).
# ---------------------------------------------------------------------------
def t(c, x, y, s, size=10, bold=False):
    c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
    c.drawString(x * cm, H - y * cm, str(s))


def ln(c, x1, y1, x2, y2):
    c.line(x1 * cm, H - y1 * cm, x2 * cm, H - y2 * cm)


def fmt_plain(v: float) -> str:
    return f"{v:,.2f}"


def fmt_greek(v: float) -> str:
    # 1.234,56 with euro sign — the "noisy_values" layout.
    s = f"{v:,.2f}"
    return "EUR " + s.replace(",", "\x00").replace(".", ",").replace("\x00", ".")


def render_bank(path, company, period, payment_date, beneficiaries, total, noisy=False):
    c = canvas.Canvas(str(path), pagesize=A4)
    fmt = fmt_greek if noisy else fmt_plain
    t(c, 2, 2, "PIRAEUS BANK SA", 14, bold=True)
    t(c, 2, 2.9, "BULK PAYROLL PAYMENT CONFIRMATION", 12, bold=True)
    ln(c, 2, 4, 19, 4)
    t(c, 2, 4.8, f"Company: {company}")
    t(c, 2, 5.6, f"Period: {period}")
    t(c, 2, 6.4, f"Execution date: {payment_date}")
    ln(c, 2, 7.2, 19, 7.2)
    t(c, 2, 7.9, "BENEFICIARY", bold=True)
    t(c, 14, 7.9, "AMOUNT (EUR)", bold=True)
    ln(c, 2, 8.3, 19, 8.3)
    y = 9.0
    for b in beneficiaries:
        t(c, 2, y, b["name"])
        t(c, 14, y, fmt(b["net"]))
        y += 0.7
        if y > 25:
            break
    ln(c, 2, y, 19, y)
    t(c, 2, y + 0.7, "TOTAL TRANSFER:", bold=True)
    t(c, 14, y + 0.7, fmt(total), bold=True)
    t(c, 2, y + 1.6, "Status: EXECUTED")
    c.save()


def render_register(path, company, period, payment_date, totals, headcount, alt_layout=False):
    c = canvas.Canvas(str(path), pagesize=A4)
    t(c, 2, 2, company, 14, bold=True)
    t(c, 2, 2.9, "PAYROLL REGISTER (MISTHODOSIA)", 12, bold=True)
    t(c, 2, 3.7, f"Period: {period}   Payment date: {payment_date}")
    t(c, 2, 4.5, f"Employees on register: {headcount}")
    ln(c, 2, 5.2, 19, 5.2)
    rows = [
        ("Gross total", totals["gross_total"]),
        ("Employee IKA total", totals["employee_ika_total"]),
        ("Tax withheld total", totals["tax_withheld_total"]),
        ("Employer IKA total", totals["employer_ika_total"]),
        ("Employer cost total (gross + employer IKA)", totals["employer_cost_total"]),
    ]
    if alt_layout:
        rows = list(reversed(rows))
    y = 6.0
    for label, val in rows:
        t(c, 2, y, label)
        t(c, 14, y, fmt_plain(val))
        y += 0.8
    c.save()


def render_payslip(path, company, period, emp, multi_page=False, omit_employer=False):
    c = canvas.Canvas(str(path), pagesize=A4)
    t(c, 2, 2, "PAYSLIP", 13, bold=True)
    t(c, 2, 2.9, company)
    t(c, 2, 3.7, f"Employee: {emp['name']}  ({emp['employee_id']})")
    t(c, 2, 4.5, f"Role: {emp['role']}    Period: {period}")
    ln(c, 2, 5.2, 19, 5.2)
    t(c, 2, 6.0, "Gross")
    t(c, 14, 6.0, fmt_plain(emp["gross"]))
    t(c, 2, 6.8, "Employee IKA")
    t(c, 14, 6.8, "-" + fmt_plain(emp["employee_ika"]))
    t(c, 2, 7.6, "Tax (FMY)")
    t(c, 14, 7.6, "-" + fmt_plain(emp["tax"]))
    ln(c, 2, 8.3, 19, 8.3)
    t(c, 2, 9.0, "NET PAY", bold=True)
    t(c, 14, 9.0, fmt_plain(emp["net"]), bold=True)
    if multi_page:
        c.showPage()
        t(c, 2, 2, "PAYSLIP (cont.)", 13, bold=True)
        t(c, 2, 3.0, f"Employee: {emp['name']}  ({emp['employee_id']})")
        y = 4.0
    else:
        y = 10.5
    if not omit_employer:
        ln(c, 2, y, 19, y)
        t(c, 2, y + 0.7, "Employer IKA", bold=True)
        t(c, 14, y + 0.7, fmt_plain(emp["employer_ika"]), bold=True)
        t(c, 2, y + 1.5, "Employer cost (gross + employer IKA)", bold=True)
        t(c, 14, y + 1.5, fmt_plain(emp["employer_cost"]), bold=True)
    c.save()


# ---------------------------------------------------------------------------
# Case builder
# ---------------------------------------------------------------------------
def build_case(case_id, out_root, rng, edge):
    company = rng.choice(COMPANIES)
    period = rng.choice(PERIODS)
    y, m = period.split("-")
    last_day = 28
    payment_date = f"{y}-{m}-{last_day}"

    employer_rate = ALT_EMPLOYER_IKA_RATE if edge == "non_standard_ika" else EMPLOYER_IKA_RATE
    n_true = rng.randint(1, 12) if edge != "missing_payslip" else rng.randint(4, 9)

    true_emps = [make_employee(rng, i + 1, employer_rate) for i in range(n_true)]
    true_net_sum = r2(sum(e["net"] for e in true_emps))

    # How many payslips are actually emitted (missing_payslip drops one).
    emitted_emps = true_emps[:-1] if edge == "missing_payslip" else true_emps

    # Bank total reflects the TRUE payroll (all employees) — that is what really
    # left the account; the bank cannot know a payslip was lost downstream.
    if edge == "missing_bank":
        bank_net_total = None
    elif edge == "bank_mismatch":
        bank_net_total = r2(true_net_sum * 1.06)  # ~6% reconciliation break
    else:
        bank_net_total = true_net_sum

    has_register = edge != "missing_register"
    has_bank = edge != "missing_bank"

    case_dir = out_root / case_id
    docs_dir = case_dir / "docs"
    docs_dir.mkdir(parents=True, exist_ok=True)

    documents = []          # structured labels (extract() shape)
    classification = {}     # doc_id -> true doc_type
    artifacts = {}          # doc_id -> rendered artifact relative path

    noisy = edge == "noisy_values"
    alt_layout = edge == "alt_layout"
    multi_page = edge == "multi_page"
    omit_field = edge == "missing_fields"

    # register totals reflect the TRUE headcount (so for missing_payslip the
    # register legitimately disagrees with the emitted payslips).
    reg_totals = compute_expected_event(true_emps, bank_net_total)

    if has_bank:
        fn = f"bank_confirmation_{period}.pdf"
        render_bank(docs_dir / fn, company, period, payment_date,
                    true_emps, r2(bank_net_total), noisy=noisy)
        did = "doc-bank-001"
        documents.append({
            "doc_id": did, "doc_type": "bank_confirmation",
            "source_filename": fn, "bank_net_total": r2(bank_net_total),
            "payment_date": payment_date,
        })
        classification[did] = "bank_confirmation"
        artifacts[did] = f"docs/{fn}"

    if has_register:
        fn = f"payroll_register_{period}.pdf"
        render_register(docs_dir / fn, company, period, payment_date,
                        reg_totals, n_true, alt_layout=alt_layout)
        did = "doc-register-001"
        documents.append({
            "doc_id": did, "doc_type": "payroll_register",
            "source_filename": fn,
            "gross_total": reg_totals["gross_total"],
            "employee_ika_total": reg_totals["employee_ika_total"],
            "tax_withheld_total": reg_totals["tax_withheld_total"],
            "employer_ika_total": reg_totals["employer_ika_total"],
            "employer_cost_total": reg_totals["employer_cost_total"],
            "register_employee_count": n_true,  # authoritative headcount (pipeline never reads it)
            "payment_date": payment_date,
        })
        classification[did] = "payroll_register"
        artifacts[did] = f"docs/{fn}"

    for i, emp in enumerate(emitted_emps):
        fn = f"payslip_{emp['employee_id']}_{period}.pdf"
        render_payslip(docs_dir / fn, company, period, emp,
                       multi_page=(multi_page and i == 0),
                       omit_employer=(omit_field and i == 0))
        did = f"doc-payslip-{i + 1:03d}"
        documents.append({
            "doc_id": did, "doc_type": "payslip",
            "source_filename": fn,
            "employee": {k: emp[k] for k in
                         ("employee_id", "name", "gross", "employee_ika",
                          "tax", "net", "employer_ika", "employer_cost")},
            "payment_date": payment_date,
        })
        classification[did] = "payslip"
        artifacts[did] = f"docs/{fn}"

    extracted = {
        "company": company, "period": period, "payment_date": payment_date,
        "documents": documents,
    }

    expected_event = compute_expected_event(emitted_emps, bank_net_total)

    # ---- DOMAIN truth for the four cross-document rules -------------------
    payslip_count = len(emitted_emps)
    register_count = n_true if has_register else payslip_count
    has_date = any(d.get("payment_date") for d in documents)

    if edge in ("bank_mismatch", "missing_payslip"):
        r1 = False  # bank reflects the full/true payroll; emitted payslips don't reconcile
    else:
        r1 = True   # standard, and missing_bank (defined fallback -> trivially consistent)
    r2_ = True      # a generalizing impl should accept any consistent legitimate rate
    r3 = has_date
    r4 = (register_count == payslip_count)

    expected_validations = {"R1": r1, "R2": r2_, "R3": r3, "R4": r4}

    # ---- Naive bookkeeping floor (bank-only = the wrong number) -----------
    naive = None
    if has_bank:
        bank_only = expected_event["bank_net_total"]
        true_cost = expected_event["employer_cost_total"]
        understatement = r2(true_cost - bank_only)         # = hidden_total
        naive = {
            "bank_only_payroll_cost": bank_only,
            "true_employer_cost": true_cost,
            "understatement_amount": understatement,
            "understatement_pct_of_true": r2(understatement / true_cost * 100) if true_cost else 0.0,
            "understatement_pct_of_bank": r2(understatement / bank_only * 100) if bank_only else 0.0,
            "employer_ika_wedge_pct_of_bank": expected_event["cost_gap_pct"],
        }

    ground_truth = {
        "case_id": case_id,
        "company": company,
        "period": period,
        "payment_date": payment_date,
        "edge_cases": [] if edge == "standard" else [edge],
        "document_mix": {"bank": has_bank, "register": has_register,
                         "payslips_emitted": payslip_count,
                         "employees_true": n_true},
        "extracted": extracted,
        "expected_event": expected_event,
        "expected_validations": expected_validations,
        "register_totals": reg_totals if has_register else None,
        "naive": naive,
        "classification": classification,
        "artifacts": artifacts,
    }

    (case_dir / "ground_truth.json").write_text(
        json.dumps(ground_truth, indent=2, ensure_ascii=False), encoding="utf-8")
    return ground_truth


# Edge-case schedule. The first six are the "finding" cases and are guaranteed
# present (the small committed sample uses exactly these).
SAMPLE_EDGES = [
    "standard", "missing_payslip", "non_standard_ika",
    "missing_bank", "bank_mismatch", "noisy_values",
]
EXTRA_EDGES = [
    "missing_register", "multi_page", "alt_layout", "missing_fields",
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=40)
    ap.add_argument("--out", default="eval/corpus/full")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--kind", choices=["full", "sample"], default="full")
    args = ap.parse_args()

    rng = random.Random(args.seed)
    out_root = Path(args.out)
    out_root.mkdir(parents=True, exist_ok=True)

    if args.kind == "sample":
        edges = SAMPLE_EDGES[: args.n] if args.n < len(SAMPLE_EDGES) else SAMPLE_EDGES
    else:
        # Guarantee one of every finding edge, fill the rest with a weighted mix
        # dominated by "standard".
        guaranteed = SAMPLE_EDGES + EXTRA_EDGES
        edges = list(guaranteed)
        weighted = (["standard"] * 6) + EXTRA_EDGES + ["bank_mismatch", "missing_bank"]
        while len(edges) < args.n:
            edges.append(rng.choice(weighted))
        edges = edges[: args.n]

    manifest = {"kind": args.kind, "seed": args.seed, "count": len(edges), "cases": []}
    for i, edge in enumerate(edges):
        case_id = f"case-{i + 1:04d}"
        gt = build_case(case_id, out_root, rng, edge)
        manifest["cases"].append({
            "case_id": case_id, "company": gt["company"], "period": gt["period"],
            "edge_cases": gt["edge_cases"],
            "documents": len(gt["extracted"]["documents"]),
        })
        print(f"  + {case_id}  {edge:<16} {gt['company']}  {gt['period']}  "
              f"({len(gt['extracted']['documents'])} docs)")

    (out_root / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nWrote {len(edges)} cases -> {out_root}/  (manifest.json)")


if __name__ == "__main__":
    main()
