// Records a beat-aligned screen-capture tour of the LIVE Archon app with Playwright.
// The browser records a webm whose timeline is locked to FIXED absolute windows
// (see BEATS below) so the burned captions in scripts/captions.txt and the
// ElevenLabs voiceover (docs/narration.txt, ~161s) line up frame-for-frame.
//
// Crispness: we render at deviceScaleFactor 2 (supersampled text) and scroll the
// target panel into the CENTER of the frame for emphasis — NO ffmpeg zoom/upscale
// (that blurs and is not frame-verifiable).
//
// Every interaction is best-effort (wrapped in safe()) so a missing/renamed element
// never aborts the tour — the timeline still lands on every beat.
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "https://h0-archon.vercel.app";
// Absolute end of the closing beat. The fixed beats below are anchored to the
// caption file and never move; only the final close stretches to TARGET so the
// recorded video is always at least as long as the (regenerated) voiceover.
const TARGET = parseFloat(process.env.TARGET_SECONDS || "164");

// The document dropped on the agent-ledger to drive the live Bedrock run.
// CHOICE: a PURCHASE INVOICE (not the payslip). recomputeReport() MERGES uploads
// into the canonical close: a payslip is replaced-by-employee-id (EMP-001 already
// exists → identical merge → NO tile diff → no flash), and if its id parsed
// differently it would ADD a 4th employee and CORRUPT the €6,930 payroll figure
// shown in the very next beat. A purchase invoice folds in on TOP of the BI layer
// → reliably flashes the P&L / cash / EBITDA tiles AND leaves the payroll event
// untouched, so the payroll-truth beat still reads €3,994.74 / €6,930.
// One-line swap if you prefer the payslip: docs/demo/payslip_emp001_202601.pdf
const UPLOAD_DOC = "docs/demo/aws_invoice_202601.pdf";

// Fixed absolute beat boundaries (seconds), matched 1:1 to scripts/captions.txt.
const BEATS = {
  LAND_END: 20, // 0–20  Problem — landing page
  UPLOAD_END: 62, // 20–62 Upload centerpiece — drop doc, agents animate, tiles flash
  PAYROLL_END: 99, // 62–99 Payroll truth — €3,994.74 / €6,930 / €2,935.26 wedge
  SEARCH_END: 118, // 99–118 Completeness + search
  HOOD_END: 159, // 118–159 Under the hood — 8 agents, citations, evidence API
};

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

// Sleep until the tour clock reaches `sec` (no-op if we are already past it).
async function waitUntil(sec) {
  const ms = sec * 1000 - (Date.now() - t0);
  if (ms > 0) await sleep(ms);
}

// Smoothly scroll the window to an absolute Y over `ms` (ease-in-out).
async function smoothScrollTo(page, y, ms) {
  await page.evaluate(
    ([targetY, dur]) =>
      new Promise((res) => {
        const startY = window.scrollY;
        const dist = targetY - startY;
        const start = performance.now();
        function step(now) {
          const p = Math.min((now - start) / dur, 1);
          const eased = 0.5 - Math.cos(p * Math.PI) / 2;
          window.scrollTo(0, startY + dist * eased);
          if (p < 1) requestAnimationFrame(step);
          else res();
        }
        requestAnimationFrame(step);
      }),
    [y, ms],
  );
}

// Smooth-scroll a section (by id) into the vertical CENTER of the frame.
async function centerOn(page, id, ms = 1400) {
  await page.evaluate(
    ([sel, dur]) =>
      new Promise((res) => {
        const el = document.getElementById(sel);
        if (!el) return res();
        const rect = el.getBoundingClientRect();
        const targetY = window.scrollY + rect.top - (window.innerHeight - rect.height) / 2;
        const startY = window.scrollY;
        const dist = targetY - startY;
        const start = performance.now();
        function step(now) {
          const p = Math.min((now - start) / dur, 1);
          const eased = 0.5 - Math.cos(p * Math.PI) / 2;
          window.scrollTo(0, startY + dist * eased);
          if (p < 1) requestAnimationFrame(step);
          else res();
        }
        requestAnimationFrame(step);
      }),
    [id, ms],
  );
}

// Calm hold until `untilSec`: a SINGLE slow, single-direction drift (NO up/down
// oscillation — that jitter read as distracting), then pin the boundary exactly.
// On-screen content (agents firing, tiles flashing) carries the motion; the camera
// just settles and gently reveals. The 3rd arg is accepted for call-site
// compatibility but the drift is computed from the dwell length and capped.
async function dwellPan(page, untilSec, _amplitude = 0) {
  const remain = untilSec - elapsed();
  if (remain > 1.5) {
    const startY = await page.evaluate(() => window.scrollY);
    const drift = Math.min(220, Math.round(remain * 7)); // gentle, never scrolls a panel away
    await smoothScrollTo(page, Math.max(0, startY + drift), Math.round((remain - 0.5) * 1000));
  }
  await waitUntil(untilSec);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 2, // supersample text for crispness; record stays 1920×1080
  recordVideo: { dir: "video", size: { width: 1920, height: 1080 } },
});
const page = await ctx.newPage();

// ============================================================================
// 0–20s — PROBLEM: the landing page. Slow smooth-scroll down and back to top.
// ============================================================================
await safe("goto landing", async () => {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 45000 });
});
await sleep(3000); // let the hero settle / mount
await safe("scroll landing", async () => {
  await smoothScrollTo(page, 850, 3800);
  await sleep(800);
  await smoothScrollTo(page, 1750, 3800);
  await sleep(800);
  await smoothScrollTo(page, 2700, 3500);
  await sleep(600);
  await smoothScrollTo(page, 0, 1800);
});
await waitUntil(BEATS.LAND_END);

// ============================================================================
// 20–62s — UPLOAD CENTERPIECE: go to the dashboard, center the 8-agent ledger,
// drop a document on it, then HOLD while the agents animate and the tiles flash.
// ============================================================================
await safe("goto dashboard", async () => {
  await page.goto(BASE + "/dashboard", { waitUntil: "networkidle", timeout: 45000 });
});
await sleep(3500); // count-ups + charts animate, client components mount

// Pin the canonical month so on-screen figures match the narration. Use the
// native <select aria-label="Reporting period"> directly (getByLabel is ambiguous
// — a sr-only <span> shares the text). January is already the default, so this is
// belt-and-braces.
await safe("set period jan-2026", async () => {
  const sel = page.locator('select[aria-label="Reporting period"]').first();
  await sel.selectOption("2026-01");
  await sleep(600);
});

// Center the run-ledger tile (#agents) — the centerpiece panel.
await safe("center ledger", async () => {
  await centerOn(page, "agents", 1600);
  await sleep(700);
});

// Drop the document onto the ledger's (hidden) file input → live Bedrock run.
// On /dashboard this is the only <input type=file> (the /extract one is a separate page).
await safe("upload document", async () => {
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(UPLOAD_DOC);
  console.log(`uploaded ${UPLOAD_DOC} at t=${elapsed().toFixed(1)}s`);
});

// HOLD STEADY on the ledger while the eight agents fire (Extractor → … → Narrator).
// No drift here — the dropzone shows the uploaded filename chip ("📄 …pdf — reading…
// → read ✓") AND the 8 agents both need to stay in frame so the upload is clearly
// the cause of the run. The animation itself carries the motion.
await safe("watch agents animate", async () => {
  await centerOn(page, "agents", 900);
  await waitUntil(44);
});

// Pan up to the KPI tiles (#overview) to catch the flash + the updated values, and
// hold there for the rest of the beat (the KPI row is where revenue/EBITDA/cash
// flash; re-center once mid-beat so a layout reflow can't leave us off-target).
await safe("show flashed tiles", async () => {
  await centerOn(page, "overview", 1400);
  await sleep(2500);
  await centerOn(page, "overview", 700);
});
await dwellPan(page, BEATS.UPLOAD_END, 50);

// ============================================================================
// 62–99s — PAYROLL TRUTH: center the payroll panel; hold on the wedge figures.
// ============================================================================
await safe("center payroll", async () => {
  await centerOn(page, "payroll", 1800);
  await sleep(1500);
});
await dwellPan(page, BEATS.PAYROLL_END, 70);

// ============================================================================
// 99–118s — COMPLETENESS + SEARCH: the validation panel, then live search.
// ============================================================================
await safe("center validation", async () => {
  await centerOn(page, "validation", 1800);
});
await dwellPan(page, 110, 60);
await safe("live search", async () => {
  const box = page
    .getByPlaceholder(/search your uploaded documents/i)
    .or(page.getByLabel(/search your uploaded documents/i))
    .first();
  await box.click();
  await box.pressSequentially("invoice", { delay: 130 });
  await sleep(2500);
});
await dwellPan(page, BEATS.SEARCH_END, 40);

// ============================================================================
// 118–159s — UNDER THE HOOD: the 8-agent ledger + citations, then the evidence API.
// ============================================================================
await safe("dismiss search", async () => {
  await page.keyboard.press("Escape");
});
await safe("center agents + citations", async () => {
  await centerOn(page, "agents", 1800);
  await sleep(2000);
});
await dwellPan(page, 144, 70);
await safe("evidence api", async () => {
  await page.goto(BASE + "/api/evidence", { waitUntil: "networkidle", timeout: 30000 });
  await sleep(1000);
});
await waitUntil(BEATS.HOOD_END);

// ============================================================================
// 159s–end — CLOSE: back on the dashboard; gentle pan until the clock reaches TARGET.
// ============================================================================
await safe("close on dashboard", async () => {
  await page.goto(BASE + "/dashboard", { waitUntil: "networkidle", timeout: 30000 });
  await sleep(1500);
  await centerOn(page, "overview", 1400);
});
await dwellPan(page, TARGET, 80);

console.log(`tour wall-time: ${elapsed().toFixed(1)}s`);
await ctx.close(); // flushes the webm
await browser.close();
