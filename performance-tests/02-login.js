/* eslint-disable */
import { SharedArray } from 'k6/data';
import { config } from './config.js';
import { getStudentForVU, login, sleepRandom, generateHTMLReport } from './helpers.js';

// Load 100 student credentials once per test run
const students = new SharedArray('students', function () {
  return JSON.parse(open('./students.json'));
});

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: config.THRESHOLDS.SMOKE,
};

export default function () {
  // Select distinct student account per VU ID
  const student = getStudentForVU(students);

  // Execute login
  const { res, success, token, refreshToken } = login(student);

  // Think time between iterations
  sleepRandom(1, 2);
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
  LOGIN TEST SUMMARY
=====================================================
  Total Requests : ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0}
  P95 Latency    : ${(duration['p(95)'] || 0).toFixed(2)} ms
  Failure Rate   : ${((failed.rate || 0) * 100).toFixed(2)} %
=====================================================
`;
}
