/* eslint-disable */
import { SharedArray } from 'k6/data';
import { config } from './config.js';
import { getStudentForVU, login, loadDashboard, generateHTMLReport } from './helpers.js';

// Load 100 unique student credentials
const students = new SharedArray('students', function () {
  return JSON.parse(open('./students.json'));
});

export const options = {
  scenarios: {
    exam_portal_login: {
      executor: 'per-vu-iterations',
      vus: 100,
      iterations: 1,
      maxDuration: '2m',
    },
  },
  thresholds: config.THRESHOLDS.LOAD,
};

export default function () {
  // Select distinct student account per VU (100 distinct students)
  const student = getStudentForVU(students);

  // Execute exact single login per student
  const authResult = login(student);

  if (authResult.success && authResult.token) {
    loadDashboard(authResult);
  }
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data),
    'login-realistic-report.html': generateHTMLReport(data),
    'login-realistic-summary.json': JSON.stringify(data),
  };
}

function textSummary(data) {
  const duration = data.metrics.http_req_duration ? data.metrics.http_req_duration.values : {};
  const failed = data.metrics.http_req_failed ? data.metrics.http_req_failed.values : {};
  return `
=====================================================
  100-STUDENT SINGLE LOGIN TEST (1 ITERATION PER VU)
=====================================================
  Total Requests : ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0}
  P95 Latency    : ${(duration['p(95)'] || 0).toFixed(2)} ms
  Failure Rate   : ${((failed.rate || 0) * 100).toFixed(2)} %
=====================================================
`;
}
