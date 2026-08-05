/* eslint-disable */
import { SharedArray } from 'k6/data';
import { config } from './config.js';
import { getVUToken, loadDashboard, startExam, sleepRandom, generateHTMLReport } from './helpers.js';

const students = new SharedArray('students', function () {
  return JSON.parse(open('./students.json'));
});

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp-up to 20 users
    { duration: '1m', target: 50 },   // Ramp-up to 50 users
    { duration: '2m', target: 100 },  // Ramp-up to 100 users
    { duration: '5m', target: 100 },  // Sustained hold at 100 concurrent users
    { duration: '1m', target: 0 },    // Ramp-down to 0
  ],
  thresholds: config.THRESHOLDS.LOAD,
};

export default function () {
  const session = getVUToken(students);

  if (session.success && session.token) {
    sleepRandom(1, 2);
    loadDashboard(session);

    sleepRandom(1, 3);
    startExam(session, config.EXAM_ID);
  }

  sleepRandom(2, 5);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data),
    'load-test-report.html': generateHTMLReport(data),
    'load-test-summary.json': JSON.stringify(data),
  };
}

function textSummary(data) {
  const duration = data.metrics.http_req_duration ? data.metrics.http_req_duration.values : {};
  const failed = data.metrics.http_req_failed ? data.metrics.http_req_failed.values : {};
  return `
=====================================================
  SUSTAINED LOAD TEST SUMMARY (100 CONCURRENT VUs)
=====================================================
  Total Requests : ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0}
  P95 Latency    : ${(duration['p(95)'] || 0).toFixed(2)} ms
  Failure Rate   : ${((failed.rate || 0) * 100).toFixed(2)} %
=====================================================
`;
}
