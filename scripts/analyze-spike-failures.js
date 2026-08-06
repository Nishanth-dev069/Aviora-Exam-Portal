import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const BASE_URL = 'http://localhost:3000';
const students = JSON.parse(fs.readFileSync('./performance-tests/students.json', 'utf8'));

async function runSpikeAnalysis() {
  console.log("🚀 Running 150 VU Spike Endpoint Failure Analysis...");

  const failures = [];
  const statusCounts = {};

  const vus = 150;
  const promises = [];

  for (let i = 0; i < vus; i++) {
    const student = students[i];
    promises.push((async () => {
      // 1. POST /api/auth/login
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

      const loginBody = await loginRes.text();
      statusCounts['POST /api/auth/login'] = statusCounts['POST /api/auth/login'] || {};
      statusCounts['POST /api/auth/login'][loginRes.status] = (statusCounts['POST /api/auth/login'][loginRes.status] || 0) + 1;

      if (!loginRes.ok) {
        failures.push({
          endpoint: 'POST /api/auth/login',
          status: loginRes.status,
          body: loginBody,
        });
        return;
      }

      let loginData = {};
      try { loginData = JSON.parse(loginBody); } catch (e) {}
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

      // 2. GET /api/student/dashboard
      const dashRes = await fetch(`${BASE_URL}/api/student/dashboard`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cookie': cookieHeader,
        },
      });

      const dashBody = await dashRes.text();
      statusCounts['GET /api/student/dashboard'] = statusCounts['GET /api/student/dashboard'] || {};
      statusCounts['GET /api/student/dashboard'][dashRes.status] = (statusCounts['GET /api/student/dashboard'][dashRes.status] || 0) + 1;

      if (!dashRes.ok) {
        failures.push({
          endpoint: 'GET /api/student/dashboard',
          status: dashRes.status,
          body: dashBody,
        });
      }

      // 3. POST /api/exam/start
      const startRes = await fetch(`${BASE_URL}/api/exam/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Cookie': cookieHeader,
        },
        body: JSON.stringify({ exam_id: '3534d2bb-ac6f-4ee2-8174-64c38fe6a780' }),
      });

      const startBody = await startRes.text();
      statusCounts['POST /api/exam/start'] = statusCounts['POST /api/exam/start'] || {};
      statusCounts['POST /api/exam/start'][startRes.status] = (statusCounts['POST /api/exam/start'][startRes.status] || 0) + 1;

      if (!startRes.ok) {
        failures.push({
          endpoint: 'POST /api/exam/start',
          status: startRes.status,
          body: startBody,
        });
      }
    })());
  }

  await Promise.all(promises);

  console.log("\n📊 STATUS COUNTS PER ENDPOINT:");
  console.log(JSON.stringify(statusCounts, null, 2));

  console.log("\n🚨 FAILURE SAMPLE BY TYPE & ENDPOINT:");
  const failureTypes = {};
  failures.forEach(f => {
    const key = `${f.endpoint} -> Status ${f.status}`;
    if (!failureTypes[key]) {
      failureTypes[key] = { count: 0, sampleBody: f.body };
    }
    failureTypes[key].count++;
  });

  console.log(JSON.stringify(failureTypes, null, 2));
}

runSpikeAnalysis().catch(console.error);
