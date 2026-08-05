/* eslint-disable */
import { SharedArray } from 'k6/data';
import { config } from './config.js';
import { getVUToken, startExam, sleepRandom, generateHTMLReport } from './helpers.js';

const students = new SharedArray('students', function () {
  return JSON.parse(open('./students.json'));
});

export const options = {
  vus: 10,
  duration: '45s',
  thresholds: config.THRESHOLDS.LOAD,
};

export default function () {
  // Authenticate ONCE per VU and reuse JWT access token + cookies for all subsequent iterations
  const session = getVUToken(students);

  if (session.success && session.token) {
    startExam(session, config.EXAM_ID);
  }

  sleepRandom(1, 3);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data),
    'start-exam-report.html': generateHTMLReport(data),
    'start-exam-summary.json': JSON.stringify(data),
  };
}

function textSummary(data) {
  const duration = data.metrics.http_req_duration ? data.metrics.http_req_duration.values : {};
  const failed = data.metrics.http_req_failed ? data.metrics.http_req_failed.values : {};
  return `
=====================================================
  START EXAM PERFORMANCE TEST SUMMARY
=====================================================
  Total Requests : ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0}
  P95 Latency    : ${(duration['p(95)'] || 0).toFixed(2)} ms
  Failure Rate   : ${((failed.rate || 0) * 100).toFixed(2)} %
=====================================================
`;
}
