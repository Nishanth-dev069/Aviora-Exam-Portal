/* eslint-disable */
import { SharedArray } from 'k6/data';
import { config } from './config.js';
import { getVUToken, loadDashboard, sendGlobalHeartbeat, sleepRandom, generateHTMLReport } from './helpers.js';

// Load 100 unique student credentials
const students = new SharedArray('students', function () {
  return JSON.parse(open('./students.json'));
});

export const options = {
  stages: [
    { duration: '30s', target: 25 },  // Wave 1: 25 students arrive & authenticate
    { duration: '1m', target: 75 },   // Wave 2: 75 students authenticated & in lobby
    { duration: '1m', target: 100 },  // Full exam hall: 100 students authenticated & active
    { duration: '30s', target: 0 },   // Transition into exam room
  ],
  thresholds: config.THRESHOLDS.LOAD,
};

export default function () {
  // 1. Authenticate ONCE per Virtual User (JWT + Cookie cached in VU memory)
  // This accurately models a student logging in once at the exam hall entrance.
  const session = getVUToken(students);

  if (session.success && session.token) {
    // 2. Student lands on dashboard & views upcoming exams
    loadDashboard(session);

    // 3. Global session heartbeat keeping student active in lobby
    sendGlobalHeartbeat(session);
  }

  // Realistic dwell time on dashboard before next lobby status check (8 to 15 seconds)
  sleepRandom(8, 15);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data),
    'login-report.html': generateHTMLReport(data),
    'login-summary.json': JSON.stringify(data),
  };
}

function textSummary(data) {
  const duration = data.metrics.http_req_duration ? data.metrics.http_req_duration.values : {};
  const failed = data.metrics.http_req_failed ? data.metrics.http_req_failed.values : {};
  return `
=====================================================
  100-STUDENT REALISTIC ARRIVAL & LOGIN SUMMARY
=====================================================
  Total Requests : ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0}
  P95 Latency    : ${(duration['p(95)'] || 0).toFixed(2)} ms
  Failure Rate   : ${((failed.rate || 0) * 100).toFixed(2)} %
  Peak VUs       : ${data.metrics.vus ? data.metrics.vus.values.max : 0}
=====================================================
`;
}
