# 🚀 Aviora Examination Portal - Production Performance Testing Suite

A production-grade, modular performance testing suite built with **Grafana k6** designed to stress-test and benchmark the Aviora Examination Portal under realistic concurrent student load.

---

## 🎯 Target Application

* **Production URL:** `https://portal.avioraaviation.in`
* **Default Exam ID:** `3534d2bb-ac6f-4ee2-8174-64c38fe6a780` (Override with `-e EXAM_ID=<uuid>`)
* **Core Endpoints Tested:**
  * `POST /api/auth/login` (Authentication & Device Session)
  * `GET /api/student/dashboard` (Profile & Scheduled Exams)
  * `POST /api/heartbeat` (Global Lobby Heartbeat)
  * `POST /api/exam/start` (Session Initialization & Question Shuffling)
  * `POST /api/exam/heartbeat` (**10-Second Active Session Heartbeat**)
  * `POST /api/exam/sync` (**10-Second Batch Autosave Queue**)
  * `POST /api/exam/security-event` (Anti-Cheat / Tab-Switch Logging)
  * `POST /api/exam/submit` (Final Exam Submission & Grading)

---

## 🏗️ Real Student Lifecycle Architecture

The test suite mirrors the exact client-side runtime behavior of the Aviora portal:

```
[Virtual Student]
       │
       ├──> POST /api/auth/login ──────────> [Supabase Auth + Device Check]
       │
       ├──> GET /api/student/dashboard ────> [Dashboard & Exam Schedule]
       │
       ├──> POST /api/exam/start ──────────> [RPC: create_exam_session + Signed URLs]
       │
       ├──> loop Every 10s: POST /api/exam/heartbeat ──> [Session Keep-Alive & Single-Device Enforcement]
       │
       ├──> loop Every 10s: POST /api/exam/sync ───────> [RPC: sync_exam_answers batch]
       │
       ├──> opt (5%): POST /api/exam/security-event ──> [Window Blur / Tab Switch Event]
       │
       └──> POST /api/exam/submit ─────────> [RPC: submit_exam_session Evaluation]
```

---

## 📁 File Structure

```
performance-tests/
├── config.js               # Centralized configuration, endpoints, headers, thresholds
├── helpers.js              # Reusable k6 API helpers, token caching, HTML report generator
├── students.json           # 100 pre-generated unique test student credentials & device IDs
│
├── 01-smoke.js             # Smoke test (5 VUs, 30s) across all 8 endpoints
├── 02-login.js             # Staggered login test (100 students arriving over 3m)
├── 02-login-realistic.js   # Single-iteration login benchmark (100 students logging in once)
├── 03-dashboard.js         # Waiting lobby load test with 10s global heartbeats
├── 04-start-exam.js        # Exam Start Surge (100 students starting at T=0)
├── 05-load.js              # Sustained 100-student active exam load test
├── 06-spike.js             # Sudden surge spike test (0 -> 150 VUs in 10s)
├── 07-stress.js            # Step-stress breakpoint test (50 -> 100 -> 200 -> 350 -> 500 VUs)
├── 08-soak.js              # Long-duration reliability test (1 to 2 hours sustained)
├── 09-full-exam-flow.js    # Master end-to-end production simulation (30 to 45 mins)
│
├── seed-test-students.js   # Node.js script to seed test accounts in Supabase
└── CLEANUP.sql             # SQL script to safely purge performance test data
```

---

## ⚡ Quick Start Guide

### Step 1: Install Grafana k6
* **Windows (winget):** `winget install k6`
* **Windows (Chocolatey):** `choco install k6`
* **macOS:** `brew install k6`
* **Linux:** `sudo apt-get install k6`

### Step 2: Ensure Test Students are Seeded
```bash
node performance-tests/seed-test-students.js
```

---

## 🏃 Running the Production Tests

All tests default to `https://portal.avioraaviation.in`. You can override the base URL or exam ID anytime with `-e BASE_URL=...` and `-e EXAM_ID=...`.

### 1. Smoke Sanity Test
Verifies all 8 production endpoints are responsive:
```bash
k6 run 01-smoke.js
```

### 2. Staggered Student Arrival & Login
Simulates 100 students arriving and logging in over 3 minutes:
```bash
k6 run 02-login.js
```

### 3. Dashboard Waiting Lobby Test
Tests 100 students in the lobby before exam start, sending 10s global heartbeats:
```bash
k6 run 03-dashboard.js
```

### 4. Exam Start Surge (Peak Instantaneous Load)
Simulates 100 students clicking **"Start Exam"** at the exact same time ($T=0$):
```bash
k6 run 04-start-exam.js
```

### 5. Sustained 100-Student Active Exam Test
Simulates 100 concurrent students actively answering questions with continuous 10s heartbeats and 10s autosaves:
```bash
k6 run 05-load.js
```

### 6. Spike Surge Test (150% Load)
Tests system elasticity with 150 students joining in 10 seconds:
```bash
k6 run 06-spike.js
```

### 7. Step-Stress Test (Finding the Breaking Point)
Ramps load from **50 $\to$ 100 $\to$ 200 $\to$ 350 $\to$ 500 VUs** in stages to identify maximum throughput:
```bash
k6 run 07-stress.js
```

### 8. Soak / Endurance Test (1 to 2 Hours)
Validates system memory stability, connection pool health, and continuous token refresh over an extended exam:
```bash
# Default (1 Hour):
k6 run 08-soak.js

# Custom (e.g. 2 Hours):
k6 run -e SOAK_DURATION=2h 08-soak.js
```

### 9. Master End-to-End Exam Simulation (30 to 45 Minutes)
Simulates the complete real-world examination timeline from entrance to graduation:
* **0–5m:** Pre-exam lobby & dashboard check
* **5m:** Start surge at $T=0$
* **5–35m:** 30 minutes of live exam taking (10s heartbeats, 10s autosaves, anti-cheat events)
* **35–38m:** Staggered submissions
* **38–40m:** Results retrieval
```bash
# Default (30 Minutes):
k6 run 09-full-exam-flow.js

# Custom (e.g. 45 Minutes or 1 Hour):
k6 run -e EXAM_DURATION=45m 09-full-exam-flow.js
```

---

## 📊 Reports & Visual Artifacts

After every test execution, k6 generates:
1. **Terminal Summary Output** with P95 latency and error rate.
2. **Interactive HTML Report** (e.g. `soak-test-report.html`, `full-exam-flow-report.html`).
3. **Structured JSON Metrics** (e.g. `full-exam-flow-summary.json`).

To view the generated HTML report in your browser:
```bash
# Windows
start full-exam-flow-report.html

# macOS
open full-exam-flow-report.html
```

---

## 🧹 Post-Testing Data Cleanup

When your performance testing is finished, execute [`CLEANUP.sql`](file:///c:/Users/Nishanth/Desktop/Aviora%20Exam%20Portal/performance-tests/CLEANUP.sql) in your Supabase SQL Editor. It safely deletes test sessions, answers, and audit logs without affecting real student records.
