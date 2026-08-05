/* eslint-disable */
import { SharedArray } from 'k6/data';
import { config } from './config.js';
import { getVUToken, loadDashboard, startExam, sleepRandom, generateHTMLReport } from './helpers.js';

const students = new SharedArray('students', function () {
  return JSON.parse(open('./students.json'));
});

export const options = {
  stages: [
    { duration: '1m', target: 100 },  // Step 1: 100 VUs
    { duration: '1m', target: 200 },  // Step 2: 200 VUs
    { duration: '1m', target: 300 },  // Step 3: 300 VUs
    { duration: '1m', target: 500 },  // Step 4: 500 VUs
    { duration: '1m', target: 700 },  // Step 5: 700 VUs
    { duration: '1m', target: 1000 }, // Step 6: 1000 VUs
    { duration: '30s', target: 0 },   // Ramp-down
  ],
  thresholds: config.THRESHOLDS.STRESS,
};

export default function () {
  const session = getVUToken(students);

  if (session.success && session.token) {
    sleepRandom(0.5, 1);
    loadDashboard(session);

    sleepRandom(0.5, 1);
    startExam(session, config.EXAM_ID);
  }

  sleepRandom(1, 2);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data),
    'stress-test-report.html': generateHTMLReport(data),
    'stress-test-summary.json': JSON.stringify(data),
  };
}

function textSummary(data) {
  const duration = data.metrics.http_req_duration ? data.metrics.http_req_duration.values : {};
  const failed = data.metrics.http_req_failed ? data.metrics.http_req_failed.values : {};
  return `
=====================================================
  STRESS TEST SUMMARY (BREAKING POINT IDENTIFICATION)
=====================================================
  Total Requests : ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0}
  P95 Latency    : ${(duration['p(95)'] || 0).toFixed(2)} ms
  Failure Rate   : ${((failed.rate || 0) * 100).toFixed(2)} %
  Peak VUs       : ${data.metrics.vus ? data.metrics.vus.values.max : 0}
=====================================================
`;
}
