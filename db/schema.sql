-- ===========================================================================
-- Archon-on-AWS — Aurora PostgreSQL schema
-- Target: Amazon Aurora PostgreSQL (Serverless v2 or provisioned), PostgreSQL 15+
-- Also runs unchanged on local PostgreSQL 14+ for development.
--
-- Apply with:
--   psql "$DATABASE_URL" -f db/schema.sql
-- ===========================================================================

CREATE TABLE IF NOT EXISTS documents (
    doc_id          TEXT PRIMARY KEY,
    company         TEXT        NOT NULL,
    period          TEXT        NOT NULL,         -- YYYY-MM
    doc_type        TEXT        NOT NULL,         -- bank_confirmation | payroll_register | payslip
    source_filename TEXT        NOT NULL,
    payload         JSONB       NOT NULL,         -- raw extracted fields
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_company_period ON documents (company, period);

CREATE TABLE IF NOT EXISTS payroll_events (
    event_id            TEXT PRIMARY KEY,
    company             TEXT        NOT NULL,
    period              TEXT        NOT NULL,
    employee_count      INTEGER     NOT NULL,
    bank_net_total      NUMERIC(14,2) NOT NULL,  -- visible on bank confirmation
    gross_total         NUMERIC(14,2) NOT NULL,
    employee_ika_total  NUMERIC(14,2) NOT NULL,
    tax_withheld_total  NUMERIC(14,2) NOT NULL,
    employer_ika_total  NUMERIC(14,2) NOT NULL,  -- hidden employer-contribution wedge
    employer_cost_total NUMERIC(14,2) NOT NULL,  -- the accurate cost = gross + employer IKA
    cost_gap_amount     NUMERIC(14,2) NOT NULL,  -- employer_ika_total
    cost_gap_pct        NUMERIC(6,2)  NOT NULL,  -- ~28%
    hidden_total        NUMERIC(14,2) NOT NULL,  -- employer_cost_total - bank_net_total
    linked_docs         JSONB       NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (company, period)
);

CREATE TABLE IF NOT EXISTS employee_payroll (
    id              BIGSERIAL PRIMARY KEY,
    event_id        TEXT        NOT NULL REFERENCES payroll_events (event_id) ON DELETE CASCADE,
    employee_id     TEXT        NOT NULL,
    name            TEXT        NOT NULL,
    gross           NUMERIC(12,2) NOT NULL,
    employee_ika    NUMERIC(12,2) NOT NULL,
    tax             NUMERIC(12,2) NOT NULL,
    net             NUMERIC(12,2) NOT NULL,
    employer_ika    NUMERIC(12,2) NOT NULL,
    employer_cost   NUMERIC(12,2) NOT NULL,
    UNIQUE (event_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_payroll_event ON employee_payroll (event_id);

CREATE TABLE IF NOT EXISTS validation_results (
    id          BIGSERIAL PRIMARY KEY,
    event_id    TEXT        NOT NULL REFERENCES payroll_events (event_id) ON DELETE CASCADE,
    rule        TEXT        NOT NULL,
    description TEXT        NOT NULL,
    passed      BOOLEAN     NOT NULL,
    detail      TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_validation_event ON validation_results (event_id);

CREATE TABLE IF NOT EXISTS audit_activity (
    activity_id TEXT PRIMARY KEY,
    kind        TEXT        NOT NULL,         -- intake | ask
    summary     TEXT        NOT NULL,
    details     JSONB       NOT NULL,
    db_mode     TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_activity_created_at
    ON audit_activity (created_at DESC);
