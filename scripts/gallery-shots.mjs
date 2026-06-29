// Captures clean 3:2 gallery screenshots of the LIVE Archon app (no captions, no
// chrome) for the Devpost image gallery. Viewport 1500x1000 at deviceScaleFactor 2
// => 3000x2000 PNGs (native 3:2, crisp). Every step is best-effort (safe()).
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "https://h0-archon.vercel.app";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function safe(label, fn) {
  try { await fn(); } catch (e) { console.log(`skip [${label}]: ${e.message}`); }
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1500, height: 1000 }, // 3:2
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

async function center(id, ms = 800) {
  await page.evaluate(
    ([sel, d]) =>
      new Promise((res) => {
        const el = document.getElementById(sel);
        if (!el) return res();
        const r = el.getBoundingClientRect();
        const ty = window.scrollY + r.top - (window.innerHeight - r.height) / 2;
        window.scrollTo(0, Math.max(0, ty));
        setTimeout(res, d);
      }),
    [id, ms],
  );
}
async function toTop() {
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(500);
}
async function shot(name) {
  await page.screenshot({ path: `gallery/${name}.png` });
  console.log(`shot ${name}`);
}

// 01 — landing hero
await safe("landing", async () => {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 45000 });
  await sleep(2500);
  await shot("01-landing");
});

// dashboard
await safe("dashboard", async () => {
  await page.goto(BASE + "/dashboard", { waitUntil: "networkidle", timeout: 45000 });
  await sleep(4000);
});
await safe("period", async () => {
  await page.locator('select[aria-label="Reporting period"]').first().selectOption("2026-01");
  await sleep(800);
});

// 02 — KPI overview
await safe("overview", async () => { await center("overview"); await sleep(700); await shot("02-overview"); });

// 03 — agent ledger (before upload)
await safe("ledger", async () => { await center("agents", 1200); await sleep(600); await shot("03-agent-ledger"); });

// 04 — upload: filename chip + agents firing
await safe("upload", async () => {
  await page.locator('input[type="file"]').first().setInputFiles("docs/demo/aws_invoice_202601.pdf");
  await sleep(5000); // let the chip show "reading…/read ✓" and agents animate
  await center("agents", 600);
  await sleep(500);
  await shot("04-upload-agents");
});

// 05 — payroll truth
await safe("payroll", async () => { await center("payroll", 1000); await sleep(800); await shot("05-payroll-truth"); });

// 06 — completeness / validation
await safe("validation", async () => { await center("validation", 1000); await sleep(800); await shot("06-completeness"); });

// 07 — documents-first search (number + date)
await safe("search", async () => {
  await toTop();
  const box = page.getByPlaceholder(/search your uploaded documents/i).first();
  await box.click();
  await box.pressSequentially("hotel", { delay: 120 });
  await sleep(2500);
  await shot("07-search");
  await page.keyboard.press("Escape");
});

// 08 — P&L
await safe("pnl", async () => { await center("pnl", 1000); await sleep(800); await shot("08-pnl"); });

// 09 — cash flow
await safe("cash", async () => { await center("cash", 1000); await sleep(800); await shot("09-cashflow"); });

console.log("gallery capture complete");
await ctx.close();
await browser.close();
