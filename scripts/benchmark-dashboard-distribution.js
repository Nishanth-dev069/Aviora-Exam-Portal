import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const BASE_URL = process.env.BASE_URL || 'https://aviora-exam-portal.vercel.app';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing Supabase configuration env vars");
  process.exit(1);
}

const students = JSON.parse(fs.readFileSync('./performance-tests/students.json', 'utf8'));

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

// 1. Log in a student to acquire session JWT and device session cookie
async function authenticateStudent(student) {
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: student.email,
      password: student.password,
      device_id: student.device_id,
      device_info: student.device_info,
    }),
  });

  const rawCookieHeader = loginRes.headers.get('set-cookie') || '';
  const body = await loginRes.json().catch(() => ({}));

  if (!loginRes.ok || !body.session?.access_token) {
    console.error(`Login failed for student ${student.email}:`, body);
    return null;
  }

  // Parse cookies from Set-Cookie header
  const cookies = [];
  if (rawCookieHeader) {
    const parts = rawCookieHeader.split(/, (?=[a-zA-Z0-9_%-]+=)/);
    parts.forEach(p => {
      const kv = p.split(';')[0];
      if (kv) cookies.push(kv);
    });
  }

  return {
    accessToken: body.session.access_token,
    cookieHeader: cookies.join('; '),
  };
}

async function sendDashboardRequest(authData, reqNumber) {
  const tHttpStart = performance.now();
  try {
    const res = await fetch(`${BASE_URL}/api/student/dashboard`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData.accessToken}`,
        'Cookie': authData.cookieHeader,
        'User-Agent': 'Benchmark-Dashboard-Instrumenter/1.0',
      },
    });

    const tHttpTotal = performance.now() - tHttpStart;
    const body = await res.json().catch(() => ({}));

    const timing = body.timing || {
      jwt_verification: parseFloat(res.headers.get('X-Timing-Jwt-Verification') || '0'),
      session_verification: parseFloat(res.headers.get('X-Timing-Session-Verification') || '0'),
      user_lookup: parseFloat(res.headers.get('X-Timing-User-Lookup') || '0'),
      dashboard_query: parseFloat(res.headers.get('X-Timing-Dashboard-Query') || '0'),
      recent_exams_query: parseFloat(res.headers.get('X-Timing-Recent-Exams') || '0'),
      results_query: parseFloat(res.headers.get('X-Timing-Results-Query') || '0'),
      statistics_query: parseFloat(res.headers.get('X-Timing-Statistics-Query') || '0'),
      response_serialization: parseFloat(res.headers.get('X-Timing-Response-Serialization') || '0'),
      total: parseFloat(res.headers.get('X-Timing-Route-Total') || '0'),
    };

    return {
      reqNumber,
      status: res.status,
      success: res.ok,
      httpTotal: parseFloat(tHttpTotal.toFixed(2)),
      routeTotal: timing.total || parseFloat(tHttpTotal.toFixed(2)),
      jwtVerification: timing.jwt_verification || 0,
      sessionVerification: timing.session_verification || 0,
      userLookup: timing.user_lookup || 0,
      dashboardQuery: timing.dashboard_query || 0,
      recentExamsQuery: timing.recent_exams_query || 0,
      resultsQuery: timing.results_query || 0,
      statisticsQuery: timing.statistics_query || 0,
      serialization: timing.response_serialization || 0,
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
      jwtVerification: 0,
      sessionVerification: 0,
      userLookup: 0,
      dashboardQuery: 0,
      recentExamsQuery: 0,
      resultsQuery: 0,
      statisticsQuery: 0,
      serialization: 0,
    };
  }
}

async function runDashboardRcaBenchmark() {
  console.log(`================================================================`);
  console.log(`  AUTHENTICATING 10 TEST STUDENTS FOR DASHBOARD BENCHMARK`);
  console.log(`  Target URL: ${BASE_URL}/api/student/dashboard`);
  console.log(`================================================================\n`);

  const selectedStudents = students.slice(0, 10);
  const authPromises = selectedStudents.map(s => authenticateStudent(s));
  const authResults = await Promise.all(authPromises);

  const validAuths = authResults.filter(Boolean);
  if (validAuths.length < 10) {
    console.error(`Only ${validAuths.length} logins succeeded. Aborting benchmark.`);
    process.exit(1);
  }

  console.log(`All 10 students authenticated successfully.`);
  console.log(`Executing 10 Concurrent Requests to GET /api/student/dashboard...\n`);

  const promises = validAuths.map((auth, idx) => sendDashboardRequest(auth, idx + 1));
  const results = await Promise.all(promises);

  console.log(`PER-REQUEST TIMING BREAKDOWN (All 10 Requests):`);
  console.log(`-----------------------------------------------------------------------------------------------------------------------------------------`);
  console.log(`Req # | HTTP Total | Route Total | JWT Verification | Session Verification | User Lookup | Dashboard Q | Recent Exams Q | Results Q | Serialization`);
  console.log(`-----------------------------------------------------------------------------------------------------------------------------------------`);

  results.sort((a, b) => a.reqNumber - b.reqNumber).forEach(r => {
    console.log(
      `  ${String(r.reqNumber).padStart(2)}  | ` +
      `${String(r.httpTotal.toFixed(1) + 'ms').padStart(10)} | ` +
      `${String(r.routeTotal.toFixed(1) + 'ms').padStart(11)} | ` +
      `${String(r.jwtVerification.toFixed(1) + 'ms').padStart(16)} | ` +
      `${String(r.sessionVerification.toFixed(1) + 'ms').padStart(20)} | ` +
      `${String(r.userLookup.toFixed(1) + 'ms').padStart(11)} | ` +
      `${String(r.dashboardQuery.toFixed(1) + 'ms').padStart(11)} | ` +
      `${String(r.recentExamsQuery.toFixed(1) + 'ms').padStart(14)} | ` +
      `${String(r.resultsQuery.toFixed(1) + 'ms').padStart(9)} | ` +
      `${String(r.serialization.toFixed(1) + 'ms').padStart(13)}`
    );
  });
  console.log(`-----------------------------------------------------------------------------------------------------------------------------------------\n`);

  function computeStats(arr) {
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    const med = percentile(arr, 50);
    const p90 = percentile(arr, 90);
    const p95 = percentile(arr, 95);
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    return { avg, med, p90, p95, min, max };
  }

  const metrics = [
    { label: "HTTP Total (Client)", values: results.map(r => r.httpTotal) },
    { label: "Route Total (Server)", values: results.map(r => r.routeTotal) },
    { label: "JWT Verification", values: results.map(r => r.jwtVerification) },
    { label: "Session Verification", values: results.map(r => r.sessionVerification) },
    { label: "User Lookup", values: results.map(r => r.userLookup) },
    { label: "Dashboard Query", values: results.map(r => r.dashboardQuery) },
    { label: "Recent Exams Query", values: results.map(r => r.recentExamsQuery) },
    { label: "Results Query", values: results.map(r => r.resultsQuery) },
    { label: "Statistics Query", values: results.map(r => r.statisticsQuery) },
    { label: "Response Serialization", values: results.map(r => r.serialization) },
  ];

  console.log(`STATISTICAL DISTRIBUTION SUMMARY (GET /api/student/dashboard):`);
  console.log(`=========================================================================================================================`);
  console.log(`Operation Name           | Average   | Median    | P90       | P95       | Min       | Max`);
  console.log(`-------------------------------------------------------------------------------------------------------------------------`);

  metrics.forEach(m => {
    const s = computeStats(m.values);
    console.log(
      `${m.label.padEnd(24)} | ` +
      `${s.avg.toFixed(1).padStart(7)}ms | ` +
      `${s.med.toFixed(1).padStart(7)}ms | ` +
      `${s.p90.toFixed(1).padStart(7)}ms | ` +
      `${s.p95.toFixed(1).padStart(7)}ms | ` +
      `${s.min.toFixed(1).padStart(7)}ms | ` +
      `${s.max.toFixed(1).padStart(7)}ms`
    );
  });
  console.log(`=========================================================================================================================\n`);
}

runDashboardRcaBenchmark().catch(console.error);
