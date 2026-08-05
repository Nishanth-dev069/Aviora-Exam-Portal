import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const BASE_URL = 'http://localhost:3000';
const students = JSON.parse(fs.readFileSync('./performance-tests/students.json', 'utf8'));

async function debugStartExam() {
  const student = students[0];

  // 1. Login
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
  const loginData = await loginRes.json();
  const token = loginData.session?.access_token;

  const cookies = [];
  if (rawCookieHeader) {
    const parts = rawCookieHeader.split(/, (?=[a-zA-Z0-9_%-]+=)/);
    parts.forEach(p => {
      const kv = p.split(';')[0];
      if (kv) cookies.push(kv);
    });
  }
  const cookieHeader = cookies.join('; ');

  console.log("Login Success:", loginRes.status, "Token:", !!token);

  // 2. Call POST /api/exam/start
  const examId = '3534d2bb-ac6f-4ee2-8174-64c38fe6a780';
  const startRes = await fetch(`${BASE_URL}/api/exam/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Cookie': cookieHeader,
    },
    body: JSON.stringify({ exam_id: examId }),
  });

  const startData = await startRes.json();
  console.log("Start Exam Status:", startRes.status);
  console.log("Start Exam Response Session ID:", startData.session?.id, "Error:", startData.error);
}

debugStartExam().catch(console.error);
