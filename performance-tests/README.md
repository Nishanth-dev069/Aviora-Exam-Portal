# 🚀 Aviora Examination Portal - Performance Testing Suite

A production-grade, modular performance testing suite built with **Grafana k6** designed to stress-test and benchmark the Aviora Examination Portal under realistic concurrent student load.

---

## 🏗️ Architecture Overview

The performance suite mirrors the exact production authentication and examination lifecycle:

```
[Virtual User] ──> POST /api/auth/login ──> [Supabase Auth + Device Check]
       │
       ├──> GET /api/student/dashboard ──> [Student Dashboard Data]
       │
       ├──> POST /api/exam/start ───────> [Session Creation & Question Fetch]
       │
       ├──> POST /api/exam/sync ────────> [Autosave Answer Sync]
       │
       └──> POST /api/exam/submit ──────> [Exam Evaluation & Submission]
```

---

## 📁 File Structure

```
performance-tests/
├── config.js               # Centralized configuration, endpoints, headers, thresholds
├── helpers.js              # Reusable k6 API helpers & HTML report generator
├── students.json           # 100 pre-generated unique test student credentials & device IDs
│
├── 01-smoke.js             # Smoke test (10 VUs, 30s)
├── 02-login.js             # Login test (10 VUs distinct accounts)
├── 03-dashboard.js         # Dashboard load test
├── 04-start-exam.js        # Exam start session initialization test
├── 05-load.js              # Sustained load test (100 VUs, 5-min hold)
├── 06-spike.js             # Spike test (0 -> 150 VUs in 10s)
├── 07-stress.js            # Stress test (100 -> 1000 VUs breaking point test)
├── 08-soak.js              # Soak test (100 VUs for 2 hours)
├── 09-full-exam-flow.js    # Complete end-to-end student exam journey
│
├── seed-test-students.sql  # SQL script to seed 100 student accounts in Supabase
└── CLEANUP.sql             # SQL script to safely purge performance test data
```

---

## ⚡ Quick Start Guide

### Step 1: Install Grafana k6
- **Windows (winget):** `winget install k6`
- **Windows (Chocolatey):** `choco install k6`
- **macOS:** `brew install k6`
- **Linux:** `sudo apt-get install k6`

### Step 2: Seed Test Data in Supabase
Open your Supabase SQL Editor and execute `seed-test-students.sql`.
This creates 100 student accounts (`student001@test.com` to `student100@test.com`) with pre-registered device IDs matching `students.json`.

---

## 🏃 Running Tests

### 1. Smoke Test
Verifies baseline API endpoint availability and HTTP 200 response codes.
```bash
k6 run 01-smoke.js
```

### 2. Login Test
Tests parallel authentication against `/api/auth/login` using distinct VU accounts.
```bash
k6 run 02-login.js
```

### 3. Dashboard Test
Measures student dashboard fetching latency and throughput under concurrent load.
```bash
k6 run 03-dashboard.js
```

### 4. Start Exam Test
Validates concurrent exam session creation and question payload retrieval.
```bash
k6 run 04-start-exam.js
```

### 5. Sustained Load Test (100 Concurrent Students)
Simulates peak exam traffic ramping up to 100 VUs with a 5-minute sustained hold.
```bash
k6 run 05-load.js
```

### 6. Spike Test (Sudden Traffic Surge)
Simulates 150 students logging in and starting exams simultaneously within 10 seconds.
```bash
k6 run 06-spike.js
```

### 7. Stress Test (Finding System Breaking Point)
Ramps load from 100 to 1,000 VUs in steps to determine max server capacity and bottleneck limits.
```bash
k6 run 07-stress.js
```

### 8. Soak Test (Reliability & Memory Leak Validation)
Runs 100 VUs for 2 hours to detect server memory leaks, connection exhaustion, or database slowdowns.
```bash
# Default (2 hours):
k6 run 08-soak.js

# Custom duration (e.g., 15 minutes):
k6 run -e SOAK_DURATION=15m 08-soak.js
```

### 9. Full Exam Flow (End-to-End Simulation)
Simulates realistic student behavior: Login → Dashboard → Start Exam → Answer & Sync → Submit → View Results.
```bash
k6 run 09-full-exam-flow.js
```

---

## 🔧 Overriding Environment Variables

You can pass custom target URLs or Exam IDs directly via environment variables:

```bash
k6 run -e BASE_URL=https://staging.aviora-exam.com -e EXAM_ID=your-published-exam-uuid 09-full-exam-flow.js
```

---

## 📊 Reports & Artifacts

After every test run, k6 generates:
1. **Console Summary Output** (`stdout`)
2. **Interactive HTML Report** (e.g., `load-test-report.html`)
3. **Structured JSON Metrics Summary** (e.g., `load-test-summary.json`)

To open the HTML report in your browser:
```bash
# Windows
start load-test-report.html

# macOS
open load-test-report.html
```

---

## 🧹 Post-Test Cleanup

When performance testing is complete, run `CLEANUP.sql` in your Supabase SQL Editor.
It safely deletes all test users (`%@test.com`), test sessions, answers, audit logs, and test results without modifying your database schema or production data.
