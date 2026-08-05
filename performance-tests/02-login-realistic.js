/* eslint-disable */
import { SharedArray } from 'k6/data';
import { config } from './config.js';
import { getStudentForVU, login, generateHTMLReport } from './helpers.js';

// Load student credentials once per test run
const students = new SharedArray('students', function () {
  return JSON.parse(open('./students.json'));
});

export const options = {
  scenarios: {
    exam_portal_login: {
      executor: 'per-vu-iterations',
      vus: 10,
      iterations: 1,
      maxDuration: '30s',
    },
  },
  thresholds: config.THRESHOLDS.SMOKE,
};

export default function () {
  // Select distinct student account per VU ID (each student logs in exactly once)
  const student = getStudentForVU(students);

  // Execute single login per student
  const { res, success, token } = login(student);
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
  REALISTIC EXAM PORTAL LOGIN SUMMARY (Per-VU 1 Iter)
=====================================================
  Total Requests : ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0}
  P95 Latency    : ${(duration['p(95)'] || 0).toFixed(2)} ms
  Failure Rate   : ${((failed.rate || 0) * 100).toFixed(2)} %
=====================================================
`;
}
