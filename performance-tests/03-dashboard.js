/* eslint-disable */
import { SharedArray } from 'k6/data';
import { config } from './config.js';
import { getVUToken, loadDashboard, sendGlobalHeartbeat, sleepRandom, generateHTMLReport } from './helpers.js';

const students = new SharedArray('students', function () {
  return JSON.parse(open('./students.json'));
});

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // 50 students in waiting lobby
    { duration: '1m', target: 100 },   // 100 students waiting in lobby
    { duration: '2m', target: 100 },   // Sustained waiting room polling & heartbeats
    { duration: '30s', target: 0 },    // Transition to exam
  ],
  thresholds: config.THRESHOLDS.LOAD,
};

export default function () {
  // Authenticate ONCE per VU and reuse JWT access token + cookies
  const session = getVUToken(students);

  if (session.success && session.token) {
    // 1. Fetch dashboard data
    loadDashboard(session);

    // 2. Global heartbeat keeping session active while student waits in lobby
    sendGlobalHeartbeat(session);
  }

  // Realistic lobby think-time / refresh interval (8-12 seconds)
  sleepRandom(8, 12);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data),
    'dashboard-report.html': generateHTMLReport(data),
    'dashboard-summary.json': JSON.stringify(data),
  };
}

function textSummary(data) {
  const duration = data.metrics.http_req_duration ? data.metrics.http_req_duration.values : {};
  const failed = data.metrics.http_req_failed ? data.metrics.http_req_failed.values : {};
  return `
=====================================================
  DASHBOARD WAITING LOBBY LOAD TEST (100 STUDENTS)
=====================================================
  Total Requests : ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0}
  P95 Latency    : ${(duration['p(95)'] || 0).toFixed(2)} ms
  Failure Rate   : ${((failed.rate || 0) * 100).toFixed(2)} %
=====================================================
`;
}
