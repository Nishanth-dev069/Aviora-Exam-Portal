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

  if (res.status !== 200 && res.status !== 429) {
    console.log(`[VU ${exec.vu.idInTest}] Non-200 Login Status: ${res.status}`);
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
 * Includes a robust retry-backoff mechanism if initial login hits burst rate limiting.
 */
export function getVUToken(students) {
  const student = getStudentForVU(students);
  const nowSec = Math.floor(Date.now() / 1000);

  // If valid token is cached for this VU, return it immediately without hitting /api/auth/login
  if (vuToken && vuExpiresAt > nowSec + 60 && vuStudent?.email === student.email) {
    return { token: vuToken, cookieHeader: vuCookieHeader, student: vuStudent, success: true };
  }

  // Stagger initial login requests slightly during rapid VU ramp-ups
  if (!vuToken && exec.vu.iterationInScenario === 0) {
    sleep(Math.random() * 1.5);
  }

  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    attempts++;

    const authResult = login(student);

    if (authResult.success && authResult.token) {
      vuToken = authResult.token;
      vuRefreshToken = authResult.refreshToken;
      vuStudent = student;
      vuCookieHeader = authResult.cookieHeader || '';
      vuExpiresAt = nowSec + 3500;
      return { token: vuToken, cookieHeader: vuCookieHeader, student: vuStudent, success: true };
    }

    sleep(1.5 + Math.random() * 2.0);
  }

  return { token: null, cookieHeader: '', student, success: false };
}

export function getAuthHeaders(tokenOrSession) {
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
    'Exam questions loaded': () => data && Array.isArray(data.questions) && data.questions.length > 0,
  });

  if (res.status !== 200) {
    console.log(`[START_EXAM_FAIL] VU=${exec.vu.idInTest} status=${res.status} duration=${res.timings.duration}ms body=${res.body}`);
  }

  return {
    res,
    success,
    session: data?.session || null,
    questions: data?.questions || [],
    exam: data?.exam || null,
  };
}

/**
 * Sends active exam session heartbeat POST /api/exam/heartbeat (every 10s in production)
 */
export function sendExamHeartbeat(tokenOrSession, sessionId) {
  const url = `${config.BASE_URL}${config.HEARTBEAT_ENDPOINT}`;
  const payload = JSON.stringify({
    session_id: sessionId || 'dashboard',
  });

  const params = {
    headers: getAuthHeaders(tokenOrSession),
    tags: { name: 'POST /api/exam/heartbeat' },
  };

  const res = http.post(url, payload, params);

  let data = null;
  try {
    data = res.json();
  } catch (e) { }

  const success = check(res, {
    'Heartbeat HTTP status is 200': (r) => r.status === 200,
    'Heartbeat response valid': () => data && data.valid === true,
  });

  return { res, success, data };
}

/**
 * Sends global app heartbeat POST /api/heartbeat
 */
export function sendGlobalHeartbeat(tokenOrSession) {
  const url = `${config.BASE_URL}${config.GLOBAL_HEARTBEAT_ENDPOINT}`;
  const payload = JSON.stringify({});

  const params = {
    headers: getAuthHeaders(tokenOrSession),
    tags: { name: 'POST /api/heartbeat' },
  };

  const res = http.post(url, payload, params);

  let data = null;
  try {
    data = res.json();
  } catch (e) { }

  const success = check(res, {
    'Global Heartbeat HTTP status is 200': (r) => r.status === 200,
    'Global Heartbeat valid': () => data && data.valid === true,
  });

  return { res, success, data };
}

/**
 * UUID generator for k6
 */
export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Syncs student answers (autosave batch) POST /api/exam/sync (runs every 10s in production)
 */
export function syncAnswers(tokenOrSession, sessionId, syncId, answers, securityEvents = [], securityViolations = 0) {
  const url = `${config.BASE_URL}${config.SYNC_ENDPOINT}`;
  const payload = JSON.stringify({
    session_id: sessionId,
    sync_id: syncId || generateUUID(),
    answers: answers || [],
    security_events: securityEvents,
    security_violations: securityViolations,
  });

  const params = {
    headers: getAuthHeaders(tokenOrSession),
    tags: { name: 'POST /api/exam/sync' },
  };

  const res = http.post(url, payload, params);

  let data = null;
  try {
    data = res.json();
  } catch (e) { }

  if (res.status !== 200) {
    console.log(`[SYNC_FAIL] VU=${exec.vu.idInTest} status=${res.status} duration=${res.timings.duration}ms body=${res.body}`);
  }

  const success = check(res, {
    'Autosave Sync HTTP status is 200': (r) => r.status === 200,
  });

  return { res, success, data };
}

/**
 * Sends anti-cheat security violation event POST /api/exam/security-event
 */
export function sendSecurityEvent(tokenOrSession, sessionId, eventType = 'window_blur', eventData = {}) {
  const url = `${config.BASE_URL}${config.SECURITY_EVENT_ENDPOINT}`;
  const payload = JSON.stringify({
    session_id: sessionId,
    event_type: eventType,
    event_data: eventData,
    occurred_at: new Date().toISOString(),
  });

  const params = {
    headers: getAuthHeaders(tokenOrSession),
    tags: { name: 'POST /api/exam/security-event' },
  };

  const res = http.post(url, payload, params);

  let data = null;
  try {
    data = res.json();
  } catch (e) { }

  const success = check(res, {
    'Security Event HTTP status is 200': (r) => r.status === 200,
    'Security violation acknowledged': () => data && data.success === true,
  });

  return { res, success, data };
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

  const success = check(res, {
    'Submit Exam HTTP status is 200': (r) => r.status === 200,
    'Submission acknowledged': () => data && (data.success === true || Boolean(data.id || data.session_id)),
  });

  if (res.status !== 200) {
    console.log(`[SUBMIT_FAIL] VU=${exec.vu.idInTest} status=${res.status} duration=${res.timings.duration}ms body=${res.body}`);
  }

  return { res, success, data };
}

/**
 * Random pause between simulated student user actions (think-time)
 */
export function sleepRandom(minSec = 1, maxSec = 3) {
  const duration = Math.random() * (maxSec - minSec) + minSec;
  sleep(duration);
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
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0b1120; color: #f8fafc; margin: 0; padding: 20px; }
    .container { max-width: 1100px; margin: 0 auto; background: #1e293b; padding: 32px; border-radius: 12px; box-shadow: 0 20px 35px rgba(0,0,0,0.6); border: 1px solid #334155; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #334155; padding-bottom: 16px; margin-bottom: 24px; }
    h1 { color: #38bdf8; margin: 0; font-size: 26px; }
    .badge { background: #0284c7; color: white; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 18px; margin: 24px 0; }
    .card { background: #0f172a; padding: 20px; border-radius: 8px; border: 1px solid #334155; text-align: center; }
    .card .val { font-size: 30px; font-weight: 700; color: #4ade80; margin-top: 8px; }
    .card .val.warn { color: #facc15; }
    .card .val.error { color: #f87171; }
    .card .lbl { font-size: 13px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; background: #0f172a; border-radius: 8px; overflow: hidden; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #334155; }
    th { background: #1e293b; color: #38bdf8; font-size: 14px; }
    tr:last-child td { border-bottom: none; }
    .footer { font-size: 12px; color: #64748b; margin-top: 30px; text-align: right; border-top: 1px solid #334155; padding-top: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚀 Aviora Examination Portal • Performance Report</h1>
      <span class="badge">Target: portal.avioraaviation.in</span>
    </div>
    <div class="grid">
      <div class="card">
        <div class="lbl">Total Requests</div>
        <div class="val">${metrics.http_reqs ? metrics.http_reqs.values.count : 0}</div>
      </div>
      <div class="card">
        <div class="lbl">P95 Response Time</div>
        <div class="val ${(reqDuration['p(95)'] || 0) > 600 ? 'warn' : ''}">${(reqDuration['p(95)'] || 0).toFixed(1)} ms</div>
      </div>
      <div class="card">
        <div class="lbl">Failure Rate</div>
        <div class="val ${(reqFailed.rate || 0) > 0.01 ? 'error' : ''}">${((reqFailed.rate || 0) * 100).toFixed(2)} %</div>
      </div>
      <div class="card">
        <div class="lbl">Peak Active Students</div>
        <div class="val">${vus.max || 0}</div>
      </div>
    </div>

    <h2>Detailed Latency Breakdown (ms)</h2>
    <table>
      <thead>
        <tr>
          <th>Metric</th>
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
          <td><strong>HTTP Request Duration</strong></td>
          <td>${(reqDuration.avg || 0).toFixed(1)} ms</td>
          <td>${(reqDuration.min || 0).toFixed(1)} ms</td>
          <td>${(reqDuration.med || 0).toFixed(1)} ms</td>
          <td>${(reqDuration['p(90)'] || 0).toFixed(1)} ms</td>
          <td>${(reqDuration['p(95)'] || 0).toFixed(1)} ms</td>
          <td>${(reqDuration.max || 0).toFixed(1)} ms</td>
        </tr>
      </tbody>
    </table>

    <div class="footer">
      Generated automatically by Grafana k6 • Aviora Production Performance Suite
    </div>
  </div>
</body>
</html>`;
}
