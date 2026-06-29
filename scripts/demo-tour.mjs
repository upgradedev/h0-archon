// Records a guided screen-capture tour of the live Archon app with Playwright.
// The browser context records a webm; total wall-time ≈ TARGET_SECONDS so it can
// be muxed against the ElevenLabs narration. Every interaction is best-effort
// (wrapped in safe()) so a missing/renamed element never aborts the tour.
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "https://h0-archon.vercel.app";
const TARGET = parseFloat(process.env.TARGET_SECONDS || "170");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const elapsed = () => (Date.now() - t0) / 1000;

async function safe(label, fn) {
  try {
    await fn();
  } catch (e) {
    console.log(`step skipped [${label}]: ${e.message}`);
  }
}

// Smoothly scroll the page to a target Y over `ms`.
async function smoothScrollTo(page, y, ms) {
  await page.evaluate(
    ([targetY, dur]) =>
      new Promise((res) => {
        const startY = window.scrollY;
        const dist = targetY - startY;
        const start = performance.now();
        function step(now) {
          const p = Math.min((now - start) / dur, 1);
          const eased = 0.5 - Math.cos(p * Math.PI) / 2; // ease-in-out
          window.scrollTo(0, startY + dist * eased);
          if (p < 1) requestAnimationFrame(step);
          else res();
        }
        requestAnimationFrame(step);
      }),
    [y, ms],
  );
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  recordVideo: { dir: "video", size: { width: 1920, height: 1080 } },
});
const page = await ctx.newPage();

// ---- 1. Landing (~22s) — problem + hero ----
await safe("goto landing", async () => {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 45000 });
});
await sleep(3500);
await safe("scroll landing", async () => {
  await smoothScrollTo(page, 900, 4000);
  await sleep(1500);
  await smoothScrollTo(page, 1900, 4000);
  await sleep(1500);
  await smoothScrollTo(page, 3000, 4000);
  await sleep(1500);
  await smoothScrollTo(page, 0, 1500);
});
await sleep(1500);

// ---- 2. Dashboard overview (~25s) ----
await safe("goto dashboard", async () => {
  await page.goto(BASE + "/dashboard", { waitUntil: "networkidle", timeout: 45000 });
});
await sleep(5000); // let count-ups + charts animate
await safe("scroll kpis/pnl", async () => {
  await smoothScrollTo(page, 700, 3500);
  await sleep(3000);
});

// ---- 3. Multi-period: switch periods, watch trends (~20s) ----
await safe("period selector", async () => {
  const sel = page.getByLabel(/reporting period/i).first();
  await sel.scrollIntoViewIfNeeded();
  await sleep(1000);
  for (const opt of ["2026-01", "2026-03", "2026-05", "all"]) {
    await safe("selectOption " + opt, async () => {
      await sel.selectOption(opt);
      await sleep(2500);
    });
  }
});
await safe("scroll to trends", async () => {
  const trends = page.getByText(/trend/i).first();
  await trends.scrollIntoViewIfNeeded();
  await sleep(3000);
});

// ---- 4. P&L Sankey + cash flow (~15s) ----
await safe("scroll pnl/cash", async () => {
  await smoothScrollTo(page, 1400, 3500);
  await sleep(4000);
});

// ---- 5. Payroll controls + per-employee (~18s) ----
await safe("payroll section", async () => {
  await smoothScrollTo(page, 2300, 3500);
  await sleep(2500);
  const btn = page.getByRole("button", { name: /per-employee/i }).first();
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await sleep(4000);
});

// ---- 6. Account statements drill-down (~20s) ----
await safe("statements", async () => {
  const stmt = page.getByText(/account statements/i).first();
  await stmt.scrollIntoViewIfNeeded();
  await sleep(2500);
  // open the first counterparty row → drawer
  const row = page.locator("button").filter({ hasText: /€/ }).first();
  await safe("open drawer", async () => {
    await row.click();
    await sleep(4500);
    await page.keyboard.press("Escape");
    await sleep(1000);
  });
});

// ---- 7. Dark mode toggle (~8s) ----
await safe("dark mode", async () => {
  const toggle = page.getByRole("button", { name: /theme|dark|light|toggle/i }).first();
  await toggle.scrollIntoViewIfNeeded();
  await toggle.click();
  await sleep(3500);
  await smoothScrollTo(page, 300, 2000);
  await sleep(2000);
});

// ---- 8. AWS DynamoDB proof via the public evidence API (~12s) ----
await safe("evidence api", async () => {
  await page.goto(BASE + "/api/evidence", { waitUntil: "networkidle", timeout: 30000 });
  await sleep(6000);
});

// ---- Pad to TARGET with a gentle dashboard pan (no frozen frame) ----
if (TARGET - elapsed() > 1) {
  console.log(`padding ${(TARGET - elapsed()).toFixed(1)}s with a dashboard pan to reach ${TARGET}s`);
  await safe("closing dashboard pan", async () => {
    await page.goto(BASE + "/dashboard", { waitUntil: "networkidle", timeout: 30000 });
    await sleep(1500);
    let dir = 1;
    let y = 0;
    while (TARGET - elapsed() > 1.5) {
      y += dir * 700;
      if (y > 2600) {
        y = 2600;
        dir = -1;
      } else if (y < 0) {
        y = 0;
        dir = 1;
      }
      await smoothScrollTo(page, Math.max(0, y), 2500);
      await sleep(600);
    }
  });
}

console.log(`tour wall-time: ${elapsed().toFixed(1)}s`);
await ctx.close(); // flushes the webm
await browser.close();
