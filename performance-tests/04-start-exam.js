/* eslint-disable */
import { SharedArray } from 'k6/data';
import { config } from './config.js';
import { getVUToken, startExam, sendExamHeartbeat, sleepRandom, generateHTMLReport } from './helpers.js';

const students = new SharedArray('students', function () {
  return JSON.parse(open('./students.json'));
});

export const options = {
  stages: [
    { duration: '15s', target: 50 },   // 50 students click "Start Exam" in first 15 seconds
    { duration: '15s', target: 100 },  // All 100 students entering exam room simultaneously
    { duration: '1m', target: 100 },   // First minute of active exam session creation
    { duration: '15s', target: 0 },    // Cooldown
  ],
  thresholds: config.THRESHOLDS.LOAD,
};

export default function () {
  // Authenticate ONCE per VU
  const session = getVUToken(students);

  if (session.success && session.token) {
    // Exact moment student clicks "Start Exam"
    const examResult = startExam(session, config.EXAM_ID);

    if (examResult.success && examResult.session) {
      // First 10-second exam heartbeat immediately following start
      sleepRandom(1, 3);
      sendExamHeartbeat(session, examResult.session.id);
    }
  }

  // Realistic delay before next action
  sleepRandom(5, 10);
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
  EXAM START SURGE PERFORMANCE TEST (100 CONCURRENT)
=====================================================
  Total Requests : ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0}
  P95 Latency    : ${(duration['p(95)'] || 0).toFixed(2)} ms
  Failure Rate   : ${((failed.rate || 0) * 100).toFixed(2)} %
=====================================================
`;
}
