# Archon H0 — Demo Recording Runsheet (manual, perfectly synced)

Total: **2:32**. The voiceover is fixed (`archon-voiceover.mp3`, from `docs/narration.txt`). Record the **screen only** while listening to the voiceover in headphones, follow the cues below, then mux the clean audio over it. Each row = a phrase you'll hear → what to have on screen at that moment.

## Pre-flight
1. Confirm live mode: `curl https://h0-archon.vercel.app/api/report` → `db_mode: "aws-dynamodb"`.
2. Tabs ready: **T1** live app (warmed); **T2** `https://h0-archon.vercel.app/api/evidence`; **T3** AWS Console → DynamoDB → Tables → `h0-archon-reports` → **Explore items** (signed in, showing `pk=REPORT` + `pk=ACTIVITY`).
3. On the dashboard, set the period to **May 2026** before you start (so the canonical €5,957/€9,111 are showing).
4. Record 1080p (OBS Studio recommended), browser zoom ~100–110%, bookmarks bar hidden.

## Runsheet

| Time | You'll hear (cue) | Have on screen |
|---|---|---|
| **0:00–0:20** | "Every month, a small-business owner closes their books… they correlate it all by hand." | **Landing page** hero; slow-scroll down through the sections and back to top. |
| **0:20–0:26** | "Here is the core problem. One payroll event produces three documents…" | Go to **/dashboard** (period = **May 2026**); scroll to the **Document intake** panel. |
| **0:26–0:52** | "The bank statement shows only the net amounts… the payroll register holds the full employer cost… the payslips break it down per employee… understates what payroll really cost." | Hold on **Document intake** — point at the three chips: **Bank confirmation · Payroll register · Payslips**. |
| **0:52–1:15** | "On our sample books, the bank shows **5,957**… the true employer cost is **9,111**… that gap never appears… **314,000**." | ⭐ **Payroll controls** panel (May): **Bank outflow €5,957 → True employer cost €9,111**, "Employer IKA hidden +€1,661 · 28%", "Total understated +€3,154". **Hold here** — this is the money shot. |
| **1:15–1:39** | "Archon fixes this… a pipeline of agents reads each one, links… validates… reconciles. The **Event Linker** recognises… reports the true figure… now takes seconds." | Scroll to the **8-agent run ledger**; point at **Event Linker** ("Fuse bank + register + payslips into one event"). (Optional: click **Run finance close** for the progress bar.) |
| **1:39–2:02** | "…the AI reads, a deterministic engine computes. **AWS Bedrock vision, Claude Sonnet 4.6**, reads the scanned documents; we measured **96.7%**… deterministic rules do the math." | Point at the ledger's **Extractor — "AWS Bedrock vision reads each document."** Then click **"See live extraction"** (/extract) to show the live Bedrock read + the 96.7% number. |
| **2:02–2:20** | "The dashboard is live on **AWS DynamoDB**: revenue net of tax, true employer cost per employee, multi-period trends, customer and supplier statements — and here is that exact data in the **evidence API**." | Quick montage: move the **period selector** (Jan→May) so **trends** animate; expand **Per-employee breakdown**; open **Account statements** → click a supplier (drawer). Then **T2** `/api/evidence` (`db_mode: aws-dynamodb`) **and T3 the AWS DynamoDB console** items view (`pk=REPORT` + `pk=ACTIVITY`) — *this is the mandatory AWS shot*. |
| **2:20–2:32** | "Three documents. One grounded financial truth. Measured, auditable, and shipped on the zero stack. Try it live." | End full-screen on the **dashboard**, then flash the URL **https://h0-archon.vercel.app**. |

## Combine (clean audio over your screen capture)
```bash
ffmpeg -i screen.mp4 -i archon-voiceover.mp3 -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -shortest demo.mp4
```
(If your screen capture has system/mic audio you don't want, this replaces it with the clean voiceover. `-shortest` trims to the 2:32 narration.)

## Honesty guardrails (keep on camera)
- During 0:52–1:15 stay on **May 2026**, not "All periods" — the €5,957/€9,111 figures must match the words.
- "28%" = the employer-IKA wedge; "€314k" = the corpus total — don't merge them.
- Say "measured 96.7%", not "99%+".

## Upload
YouTube, **Public**, paste the link into Devpost. Add a DynamoDB-console screenshot to the gallery too.
