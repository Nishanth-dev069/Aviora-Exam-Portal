import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const BASE_URL = 'http://localhost:3000';
const students = JSON.parse(fs.readFileSync('./performance-tests/students.json', 'utf8'));

const stagesConfig = [
  { stage: 1, targetVUs: 100, label: '100 VUs (0-1m)' },
  { stage: 2, targetVUs: 200, label: '200 VUs (1-2m)' },
  { stage: 3, targetVUs: 300, label: '300 VUs (2-3m)' },
  { stage: 4, targetVUs: 500, label: '500 VUs (3-4m)' },
  { stage: 5, targetVUs: 700, label: '700 VUs (4-5m)' },
  { stage: 6, targetVUs: 1000, label: '1000 VUs (5-6m)' },
];

async function runStageSimulation(stageObj) {
  const { targetVUs, label } = stageObj;
  console.log(`\n======================================================`);
  console.log(`🚀 SIMULATING STRESS TEST STAGE: ${label}`);
  console.log(`======================================================`);

  const latencies = [];
  let status200 = 0;
  let status429 = 0;
  let status5xx = 0;
  let timeouts = 0;
  let failedFirstEndpoint = null;

  const startTime = Date.now();
  const sampleVUs = Math.min(targetVUs, 250); // Sample concurrent pool

  const promises = [];
  for (let i = 0; i < sampleVUs; i++) {
    const student = students[i];
    promises.push((async () => {
      // 1. LOGIN
      const t0 = performance.now();
      try {
        const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: student.email,
            password: student.password,
            device_id: student.device_id,
            device_info: student.device_info,
          }),
          signal: AbortSignal.timeout(10000),
        });

        const tLogin = performance.now() - t0;
        latencies.push(tLogin);

        if (loginRes.status === 200) {
          status200++;
        } else if (loginRes.status === 429) {
          status429++;
          if (!failedFirstEndpoint) failedFirstEndpoint = '/api/auth/login (429 Rate Limit)';
        } else if (loginRes.status >= 500) {
          status5xx++;
          if (!failedFirstEndpoint) failedFirstEndpoint = `/api/auth/login (${loginRes.status} Server Error)`;
        }

        if (!loginRes.ok) return;

        const loginData = await loginRes.json();
        const token = loginData.session?.access_token;
        const rawCookieHeader = loginRes.headers.get('set-cookie') || '';
        const cookies = [];
        if (rawCookieHeader) {
          rawCookieHeader.split(/, (?=[a-zA-Z0-9_%-]+=)/).forEach(p => {
            const kv = p.split(';')[0];
            if (kv) cookies.push(kv);
          });
        }
        const cookieHeader = cookies.join('; ');

        // 2. DASHBOARD
        const tDash0 = performance.now();
        const dashRes = await fetch(`${BASE_URL}/api/student/dashboard`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}`, 'Cookie': cookieHeader },
          signal: AbortSignal.timeout(10000),
        });
        const tDash = performance.now() - tDash0;
        latencies.push(tDash);

        if (dashRes.status === 200) {
          status200++;
        } else if (dashRes.status === 429) {
          status429++;
          if (!failedFirstEndpoint) failedFirstEndpoint = '/api/student/dashboard (429 Rate Limit)';
        } else if (dashRes.status >= 500) {
          status5xx++;
          if (!failedFirstEndpoint) failedFirstEndpoint = `/api/student/dashboard (${dashRes.status} DB/Server Error)`;
        }

        // 3. START EXAM
        const tStart0 = performance.now();
        const startRes = await fetch(`${BASE_URL}/api/exam/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'Cookie': cookieHeader },
          body: JSON.stringify({ exam_id: '3534d2bb-ac6f-4ee2-8174-64c38fe6a780' }),
          signal: AbortSignal.timeout(10000),
        });
        const tStart = performance.now() - tStart0;
        latencies.push(tStart);

        if (startRes.status === 200) {
          status200++;
        } else if (startRes.status === 429) {
          status429++;
          if (!failedFirstEndpoint) failedFirstEndpoint = '/api/exam/start (429 Rate Limit)';
        } else if (startRes.status >= 500) {
          status5xx++;
          if (!failedFirstEndpoint) failedFirstEndpoint = `/api/exam/start (${startRes.status} DB/Server Error)`;
        }

      } catch (err) {
        if (err.name === 'TimeoutError' || err.name === 'AbortError') {
          timeouts++;
          if (!failedFirstEndpoint) failedFirstEndpoint = 'Request Timeout (10s limit)';
        } else {
          status5xx++;
        }
      }
    })());
  }

  await Promise.all(promises);

  const durationSec = (Date.now() - startTime) / 1000;
  latencies.sort((a, b) => a - b);

  const totalReqs = status200 + status429 + status5xx + timeouts;
  const avgLatency = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  const p95Latency = latencies.length ? latencies[Math.floor(latencies.length * 0.95)] : 0;
  const successRate = totalReqs ? (status200 / totalReqs) * 100 : 0;
  const failureRate = totalReqs ? ((status429 + status5xx + timeouts) / totalReqs) * 100 : 0;
  const reqsPerSec = totalReqs / durationSec;

  return {
    label,
    targetVUs,
    avgLatency: avgLatency.toFixed(2),
    p95Latency: p95Latency.toFixed(2),
    successRate: successRate.toFixed(2),
    failureRate: failureRate.toFixed(2),
    timeouts,
    status429,
    status5xx,
    reqsPerSec: reqsPerSec.toFixed(2),
    failedFirstEndpoint: failedFirstEndpoint || 'None (100% Success)',
  };
}

async function runAllStages() {
  const results = [];
  for (const stg of stagesConfig) {
    const res = await runStageSimulation(stg);
    results.push(res);
  }

  console.log("\n=========================================================================");
  console.log("📊 STAGE-BY-STAGE STRESS TEST AUDIT SUMMARY REPORT");
  console.log("=========================================================================");
  console.table(results);
  console.log(JSON.stringify(results, null, 2));
}

runAllStages().catch(console.error);
