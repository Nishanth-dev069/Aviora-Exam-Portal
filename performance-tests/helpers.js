/* eslint-disable */
import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';
import { config } from './config.js';

/**
 * Maps current Virtual User (VU) to a distinct student account from students.json.
 * Prevents account locking and duplicate login contention.
 */
export function getStudentForVU(students) {
  const index = (exec.vu.idInTest - 1) % students.length;
  return students[index];
}

/**
 * Performs student login against POST /api/auth/login
 */
export function login(student) {
  const url = `${config.BASE_URL}${config.LOGIN_ENDPOINT}`;
  const payload = JSON.stringify({
    email: student.email,
    password: student.password,
    device_id: student.device_id,
    device_info: student.device_info,
  });

  const params = {
    headers: config.DEFAULT_HEADERS,
    tags: { name: 'POST /api/auth/login' },
  };

  const res = http.post(url, payload, params);

  let data = null;
  try {
    data = res.json();
  } catch (e) { }

  const success = check(res, {
    'Login HTTP status is 200': (r) => r.status === 200,
    'Login success flag is true': () => data && data.success === true,
    'JWT access_token present': () => data && data.session && Boolean(data.session.access_token),
    'JWT refresh_token present': () => data && data.session && Boolean(data.session.refresh_token),
  });

  let cookieHeader = '';
  if (res && res.cookies) {
    const pairs = [];
    for (const name in res.cookies) {
      if (res.cookies[name] && res.cookies[name][0]) {
        pairs.push(`${name}=${res.cookies[name][0].value}`);
      }
    }
    cookieHeader = pairs.join('; ');
  }

  if (res.status !== 200) {
    console.log("================================");
    console.log(`VU: ${exec.vu.idInTest}`);
    console.log(`Status: ${res.status}`);
    console.log(`Body: ${res.body}`);
    console.log("================================");
  }
  return {
    res,
    success,
    token: data?.session?.access_token || null,
    refreshToken: data?.session?.refresh_token || null,
    user: data?.user || null,
    cookieHeader,
  };
}

// Per-VU memory cache to store JWT access tokens across loop iterations
let vuToken = null;
let vuRefreshToken = null;
let vuExpiresAt = 0;
let vuStudent = null;
let vuCookieHeader = '';

/**
 * Ensures each Virtual User (VU) authenticates ONCE, stores the JWT access token in VU memory,
 * and reuses it for all subsequent loop iterations.
 */
export function getVUToken(students) {
  const student = getStudentForVU(students);
  const nowSec = Math.floor(Date.now() / 1000);

  // If valid token is cached for this VU, return it immediately without hitting /api/auth/login
  if (vuToken && vuExpiresAt > nowSec + 60 && vuStudent?.email === student.email) {
    return { token: vuToken, cookieHeader: vuCookieHeader, student: vuStudent, success: true };
  }

  console.log("LOGIN CALLED", exec.vu.idInTest, exec.vu.iterationInScenario);
  // Authenticate once for this VU
  const authResult = login(student);
  if (authResult.success && authResult.token) {
    vuToken = authResult.token;
    vuRefreshToken = authResult.refreshToken;
    vuStudent = student;
    vuCookieHeader = authResult.cookieHeader || '';
    vuExpiresAt = nowSec + 3500;
    return { token: vuToken, cookieHeader: vuCookieHeader, student: vuStudent, success: true };
  }

  return { token: null, cookieHeader: '', student, success: false };
}

function getAuthHeaders(tokenOrSession) {
  let token = tokenOrSession;
  let cookieHeader = '';
  if (typeof tokenOrSession === 'object' && tokenOrSession !== null) {
    token = tokenOrSession.token;
    cookieHeader = tokenOrSession.cookieHeader || '';
  }
  const headers = Object.assign({}, config.DEFAULT_HEADERS, {
    Authorization: `Bearer ${token}`,
  });
  if (cookieHeader) {
    headers['Cookie'] = cookieHeader;
  }
  return headers;
}

/**
 * Loads student dashboard GET /api/student/dashboard
 */
export function loadDashboard(tokenOrSession) {
  const url = `${config.BASE_URL}${config.DASHBOARD_ENDPOINT}`;
  const params = {
    headers: getAuthHeaders(tokenOrSession),
    tags: { name: 'GET /api/student/dashboard' },
  };

  const res = http.get(url, params);

  let data = null;
  try {
    data = res.json();
  } catch (e) { }

  check(res, {
    'Dashboard HTTP status is 200': (r) => r.status === 200,
    'Dashboard profile loaded': () => data && data.profile && Boolean(data.profile.full_name),
  });

  return { res, data };
}

/**
 * Starts an exam session POST /api/exam/start
 */
export function startExam(tokenOrSession, examId) {
  const targetExamId = examId || config.EXAM_ID;
  const url = `${config.BASE_URL}${config.START_EXAM_ENDPOINT}`;
  const payload = JSON.stringify({ exam_id: targetExamId });

  const params = {
    headers: getAuthHeaders(tokenOrSession),
    tags: { name: 'POST /api/exam/start' },
  };

  const res = http.post(url, payload, params);

  let data = null;
  try {
    data = res.json();
  } catch (e) { }

  const success = check(res, {
    'Start Exam HTTP status is 200': (r) => r.status === 200,
    'Exam session created': () => data && data.session && Boolean(data.session.id),
    'Submission token generated': () => data && data.session && Boolean(data.session.submission_token),
    'Exam questions loaded': () => data && Array.isArray(data.questions),
  });

  return {
    res,
    success,
    session: data?.session || null,
    questions: data?.questions || [],
    exam: data?.exam || null,
  };
}

/**
 * Syncs student answers (autosave) POST /api/exam/sync
 */
export function syncAnswers(tokenOrSession, sessionId, syncId, answers) {
  const url = `${config.BASE_URL}${config.SYNC_ENDPOINT}`;
  const payload = JSON.stringify({
    session_id: sessionId,
    sync_id: syncId || `sync_${Date.now()}`,
    answers: answers || [],
  });

  const params = {
    headers: getAuthHeaders(tokenOrSession),
    tags: { name: 'POST /api/exam/sync' },
  };

  const res = http.post(url, payload, params);

  check(res, {
    'Autosave HTTP status is 200': (r) => r.status === 200,
  });

  return res;
}

/**
 * Submits an active exam session POST /api/exam/submit
 */
export function submitExam(tokenOrSession, sessionId, submissionToken) {
  const url = `${config.BASE_URL}${config.SUBMIT_ENDPOINT}`;
  const payload = JSON.stringify({
    session_id: sessionId,
    submission_token: submissionToken,
  });

  const params = {
    headers: getAuthHeaders(tokenOrSession),
    tags: { name: 'POST /api/exam/submit' },
  };

  const res = http.post(url, payload, params);

  let data = null;
  try {
    data = res.json();
  } catch (e) { }

  check(res, {
    'Submit Exam HTTP status is 200': (r) => r.status === 200,
    'Submission acknowledged': () => data && data.success === true,
  });

  return { res, data };
}

/**
 * Random pause between simulated student user actions (think-time)
 */
export function sleepRandom(minSec = 1, maxSec = 3) {
  const duration = Math.random() * (maxSec - minSec) + minSec;
  sleep(duration);
}

/**
 * Generic response validator helper
 */
export function validateResponse(res, expectedStatus = 200, checkName = 'HTTP Status OK') {
  return check(res, {
    [checkName]: (r) => r.status === expectedStatus,
  });
}

/**
 * Custom handleSummary function to output HTML & JSON reports
 */
export function generateHTMLReport(data) {
  const metrics = data.metrics;
  const reqDuration = metrics.http_req_duration ? metrics.http_req_duration.values : {};
  const reqFailed = metrics.http_req_failed ? metrics.http_req_failed.values : {};
  const vus = metrics.vus ? metrics.vus.values : {};

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Aviora Exam Portal - Performance Test Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
    .container { max-width: 1000px; margin: 0 auto; background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    h1 { color: #38bdf8; border-bottom: 2px solid #334155; padding-bottom: 12px; margin-top: 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin: 25px 0; }
    .card { background: #0f172a; padding: 20px; border-radius: 8px; border: 1px solid #334155; text-align: center; }
    .card .val { font-size: 28px; font-weight: bold; color: #4ade80; margin-top: 8px; }
    .card .val.warn { color: #facc15; }
    .card .val.error { color: #f87171; }
    .card .lbl { font-size: 14px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #334155; }
    th { background: #0f172a; color: #38bdf8; }
    .timestamp { font-size: 12px; color: #64748b; margin-top: 30px; text-align: right; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 Aviora Performance Test Executive Report</h1>
    <div class="grid">
      <div class="card">
        <div class="lbl">Total Requests</div>
        <div class="val">${metrics.http_reqs ? metrics.http_reqs.values.count : 0}</div>
      </div>
      <div class="card">
        <div class="lbl">P95 Latency</div>
        <div class="val ${(reqDuration['p(95)'] || 0) > 500 ? 'warn' : ''}">${(reqDuration['p(95)'] || 0).toFixed(2)} ms</div>
      </div>
      <div class="card">
        <div class="lbl">Failure Rate</div>
        <div class="val ${(reqFailed.rate || 0) > 0.01 ? 'error' : ''}">${((reqFailed.rate || 0) * 100).toFixed(2)} %</div>
      </div>
      <div class="card">
        <div class="lbl">Peak VUs</div>
        <div class="val">${vus.max || 0}</div>
      </div>
    </div>

    <h2>Detailed Metrics Breakdown</h2>
    <table>
      <thead>
        <tr>
          <th>Metric Name</th>
          <th>Average</th>
          <th>Min</th>
          <th>Med (P50)</th>
          <th>P90</th>
          <th>P95</th>
          <th>Max</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>HTTP Req Duration (ms)</strong></td>
          <td>${(reqDuration.avg || 0).toFixed(2)}</td>
          <td>${(reqDuration.min || 0).toFixed(2)}</td>
          <td>${(reqDuration.med || 0).toFixed(2)}</td>
          <td>${(reqDuration['p(90)'] || 0).toFixed(2)}</td>
          <td>${(reqDuration['p(95)'] || 0).toFixed(2)}</td>
          <td>${(reqDuration.max || 0).toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
    <div class="timestamp">Generated by Grafana k6 • Aviora Portal Suite</div>
  </div>
</body>
</html>`;
}
