import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const BASE_URL = process.env.BASE_URL || 'https://aviora-exam-portal.vercel.app';
const ENDPOINT = `${BASE_URL}/api/auth/login`;

const students = JSON.parse(fs.readFileSync('./performance-tests/students.json', 'utf8'));

// Helper for percentile calculation
function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

// Helper for standard deviation calculation
function stdDev(arr) {
  if (arr.length <= 1) return 0;
  const avg = arr.reduce((sum, val) => sum + val, 0) / arr.length;
  const squareDiffs = arr.map(val => Math.pow(val - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((sum, val) => sum + val, 0) / arr.length;
  return Math.sqrt(avgSquareDiff);
}

async function sendSingleLoginRequest(student, reqNumber) {
  const payload = {
    email: student.email,
    password: student.password,
    device_id: student.device_id,
    device_info: student.device_info,
  };

  const tHttpStart = performance.now();
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Benchmark-Per-Request-Instrumenter/1.0',
      },
      body: JSON.stringify(payload),
    });

    const tHttpTotal = performance.now() - tHttpStart;
    const body = await res.json().catch(() => ({}));

    const timing = body.timing || {
      supabase_auth: parseFloat(res.headers.get('X-Timing-Supabase-Auth') || '0'),
      user_lookup: parseFloat(res.headers.get('X-Timing-User-Lookup') || '0'),
      device_check: parseFloat(res.headers.get('X-Timing-Device-Check') || '0'),
      session_update: parseFloat(res.headers.get('X-Timing-Session-Update') || '0'),
      session_insert: parseFloat(res.headers.get('X-Timing-Session-Insert') || '0'),
      audit_log: parseFloat(res.headers.get('X-Timing-Audit-Log') || '0'),
      total: parseFloat(res.headers.get('X-Timing-Total') || '0'),
    };

    return {
      reqNumber,
      status: res.status,
      success: res.ok && body.success === true,
      httpTotal: parseFloat(tHttpTotal.toFixed(2)),
      routeTotal: timing.total || parseFloat(tHttpTotal.toFixed(2)),
      supabaseAuth: timing.supabase_auth || 0,
      userLookup: timing.user_lookup || 0,
      deviceCheck: timing.device_check || 0,
      sessionUpdate: timing.session_update || 0,
      sessionInsert: timing.session_insert || 0,
      auditLog: timing.audit_log || 0,
    };
  } catch (err) {
    const tHttpTotal = performance.now() - tHttpStart;
    return {
      reqNumber,
      status: 0,
      success: false,
      error: err.message,
      httpTotal: parseFloat(tHttpTotal.toFixed(2)),
      routeTotal: 0,
      supabaseAuth: 0,
      userLookup: 0,
      deviceCheck: 0,
      sessionUpdate: 0,
      sessionInsert: 0,
      auditLog: 0,
    };
  }
}

async function runPerRequestBenchmarkRun(runId) {
  console.log(`\n================================================================`);
  console.log(`  STARTING BENCHMARK RUN #${runId} (10 Concurrent VUs, 1 iter/VU)`);
  console.log(`  Target URL: ${ENDPOINT}`);
  console.log(`================================================================\n`);

  const selectedStudents = students.slice(0, 10);
  const promises = selectedStudents.map((s, index) => sendSingleLoginRequest(s, index + 1));

  const results = await Promise.all(promises);

  console.log(`PER-REQUEST TIMING BREAKDOWN (All 10 Requests):`);
  console.log(`-------------------------------------------------------------------------------------------------------------------------`);
  console.log(`Req # | HTTP Total | Route Total | Supabase Auth | User Lookup | Device Check | Session Update | Session Insert | Audit Log`);
  console.log(`-------------------------------------------------------------------------------------------------------------------------`);

  results.sort((a, b) => a.reqNumber - b.reqNumber).forEach(r => {
    console.log(
      `  ${String(r.reqNumber).padStart(2)}  | ` +
      `${String(r.httpTotal.toFixed(1) + 'ms').padStart(10)} | ` +
      `${String(r.routeTotal.toFixed(1) + 'ms').padStart(11)} | ` +
      `${String(r.supabaseAuth.toFixed(1) + 'ms').padStart(13)} | ` +
      `${String(r.userLookup.toFixed(1) + 'ms').padStart(11)} | ` +
      `${String(r.deviceCheck.toFixed(1) + 'ms').padStart(12)} | ` +
      `${String(r.sessionUpdate.toFixed(1) + 'ms').padStart(14)} | ` +
      `${String(r.sessionInsert.toFixed(1) + 'ms').padStart(14)} | ` +
      `${String(r.auditLog.toFixed(1) + 'ms').padStart(9)}`
    );
  });
  console.log(`-------------------------------------------------------------------------------------------------------------------------\n`);

  // Metrics Arrays
  const httpTotals = results.map(r => r.httpTotal);
  const routeTotals = results.map(r => r.routeTotal);
  const authTimes = results.map(r => r.supabaseAuth);
  const userLookups = results.map(r => r.userLookup);
  const deviceChecks = results.map(r => r.deviceCheck);
  const sessionUpdates = results.map(r => r.sessionUpdate);
  const sessionInserts = results.map(r => r.sessionInsert);
  const auditLogs = results.map(r => r.auditLog);

  function printStats(name, arr) {
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    const med = percentile(arr, 50);
    const p90 = percentile(arr, 90);
    const p95 = percentile(arr, 95);
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const sd = stdDev(arr);

    console.log(`${name.padEnd(20)} | Avg: ${avg.toFixed(1).padStart(7)}ms | Med: ${med.toFixed(1).padStart(7)}ms | P90: ${p90.toFixed(1).padStart(7)}ms | P95: ${p95.toFixed(1).padStart(7)}ms | Min: ${min.toFixed(1).padStart(7)}ms | Max: ${max.toFixed(1).padStart(7)}ms | StdDev: ${sd.toFixed(1).padStart(6)}ms`);
  }

  console.log(`STATISTICAL DISTRIBUTION SUMMARY (Run #${runId}):`);
  console.log(`=========================================================================================================================`);
  printStats("HTTP Total (Client)", httpTotals);
  printStats("Route Total (Server)", routeTotals);
  printStats("Supabase Auth", authTimes);
  printStats("User Lookup", userLookups);
  printStats("Device Check", deviceChecks);
  printStats("Session Update", sessionUpdates);
  printStats("Session Insert", sessionInserts);
  printStats("Audit Log", auditLogs);
  console.log(`=========================================================================================================================\n`);

  return { results, httpTotals, routeTotals, authTimes };
}

async function main() {
  await runPerRequestBenchmarkRun(1);
}

main().catch(console.error);
