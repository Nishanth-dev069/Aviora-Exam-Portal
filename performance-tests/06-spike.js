/* eslint-disable */
import { SharedArray } from 'k6/data';
import { config } from './config.js';
import { getVUToken, loadDashboard, startExam, sleepRandom, generateHTMLReport } from './helpers.js';

const students = new SharedArray('students', function () {
  return JSON.parse(open('./students.json'));
});

export const options = {
  stages: [
    { duration: '10s', target: 150 }, // Instant spike jump to 150 users
    { duration: '1m', target: 150 },  // Hold at peak spike load
    { duration: '10s', target: 0 },   // Rapid ramp-down
  ],
  thresholds: config.THRESHOLDS.SPIKE,
};

export default function () {
  const session = getVUToken(students);

  if (session.success && session.token) {
    sleepRandom(0.5, 1);
    loadDashboard(session);

    sleepRandom(0.5, 1.5);
    startExam(session, config.EXAM_ID);
  }

  sleepRandom(1, 2);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data),
    'spike-test-report.html': generateHTMLReport(data),
    'spike-test-summary.json': JSON.stringify(data),
  };
}

function textSummary(data) {
  const duration = data.metrics.http_req_duration ? data.metrics.http_req_duration.values : {};
  const failed = data.metrics.http_req_failed ? data.metrics.http_req_failed.values : {};
  return `
=====================================================
  SPIKE TEST SUMMARY (150 INSTANT VUs)
=====================================================
  Total Requests : ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0}
  P95 Latency    : ${(duration['p(95)'] || 0).toFixed(2)} ms
  Failure Rate   : ${((failed.rate || 0) * 100).toFixed(2)} %
=====================================================
`;
}
