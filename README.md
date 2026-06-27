# Archon H0: Vercel + AWS

Archon H0 is the fast Vercel + AWS challenge build of Archon. It keeps the core
business insight: a bank salary-transfer confirmation understates Greek payroll
cost because employer IKA contributions are invisible. The app fuses bank,
payroll-register, and payslip documents into one validated payroll event and
surfaces the hidden employer-cost gap.

## Stack

- Next.js app for Vercel
- AWS DynamoDB via `DYNAMODB_TABLE` for the fast serverless deployment path
- Optional AWS Aurora PostgreSQL fallback via `DATABASE_URL`
- Gemini narrator via REST, with deterministic fallback
- Embedded demo mode when no AWS database is configured

## Run

```bash
npm install
npm run build
npm run pipeline
npm run dev
```

Open `http://localhost:3000`.

## AWS Database

Fast H0 path:

```bash
DYNAMODB_TABLE=h0-archon-reports
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

Aurora fallback:

Create an Aurora PostgreSQL database and set:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB
PGSSLMODE=require
```

Then run:

```bash
npm run db:seed
```

The schema lives in `db/schema.sql`.

## Judge Path

1. Open the Vercel URL.
2. Press **Run Pipeline**.
3. Confirm the dashboard shows:
   - bank confirmation: EUR 5,957
   - true employer cost: EUR 9,111
   - hidden wedge: EUR 3,154
   - employer IKA gap: 27.9%
4. Open `/api/report` to verify the JSON API and persistence mode.
