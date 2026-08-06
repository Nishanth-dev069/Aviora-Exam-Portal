/* eslint-disable */
import { SharedArray } from 'k6/data';
import { config } from './config.js';
import { getVUToken, loadDashboard, startExam, sleepRandom, generateHTMLReport } from './helpers.js';

const students = new SharedArray('students', function () {
  return JSON.parse(open('./students.json'));
});

// Soak duration defaults to 2 hours, can be overridden via CLI: -e SOAK_DURATION=15m
const soakDuration = __ENV.SOAK_DURATION || '1h';

export const options = {
  stages: [
    { duration: '2m', target: 100 },           // Ramp up to 100 VUs
    { duration: soakDuration, target: 100 },   // Sustained soak duration
    { duration: '2m', target: 0 },
    // Ramp down
  ],
  thresholds: config.THRESHOLDS.SOAK,
};

export default function () {
  const session = getVUToken(students);

  if (session.success && session.token) {
    sleepRandom(1, 3);
    loadDashboard(session);

    sleepRandom(2, 5);
    startExam(session, config.EXAM_ID);
  }

  sleepRandom(5, 10);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data),
    'soak-test-report.html': generateHTMLReport(data),
    'soak-test-summary.json': JSON.stringify(data),
  };
}

function textSummary(data) {
  const duration = data.metrics.http_req_duration ? data.metrics.http_req_duration.values : {};
  const failed = data.metrics.http_req_failed ? data.metrics.http_req_failed.values : {};
  return `
=====================================================
  SOAK TEST SUMMARY (LONG DURATION RELIABILITY)
=====================================================
  Total Requests : ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0}
  P95 Latency    : ${(duration['p(95)'] || 0).toFixed(2)} ms
  Failure Rate   : ${((failed.rate || 0) * 100).toFixed(2)} %
  Duration       : ${soakDuration}
=====================================================
`;
}
