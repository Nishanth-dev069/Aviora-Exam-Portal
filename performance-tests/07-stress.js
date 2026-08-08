/* eslint-disable */
import { SharedArray } from 'k6/data';
import { config } from './config.js';
import {
  getVUToken,
  loadDashboard,
  startExam,
  sendExamHeartbeat,
  syncAnswers,
  generateUUID,
  sleepRandom,
  generateHTMLReport
} from './helpers.js';

const students = new SharedArray('students', function () {
  return JSON.parse(open('./students.json'));
});

export const options = {
  stages: [
    { duration: '45s', target: 50 },   // Step 1: 50 VUs (Baseline)
    { duration: '1m', target: 100 },   // Step 2: 100 VUs (Production Target)
    { duration: '1m', target: 200 },   // Step 3: 200 VUs (200% Load)
    { duration: '1m', target: 350 },   // Step 4: 350 VUs (High Stress)
    { duration: '1m', target: 500 },   // Step 5: 500 VUs (Breakpoint Saturation)
    { duration: '30s', target: 0 },    // Ramp-down
  ],
  thresholds: config.THRESHOLDS.STRESS,
};

export default function () {
  const session = getVUToken(students);

  if (session.success && session.token) {
    sleepRandom(0.5, 1);
    loadDashboard(session);

    sleepRandom(0.5, 1.5);
    const examResult = startExam(session, config.EXAM_ID);

    if (examResult.success && examResult.session) {
      const sessionId = examResult.session.id;
      const questions = examResult.questions || [];

      // Heartbeat
      sendExamHeartbeat(session, sessionId);

      // Autosave answer sync
      if (questions.length > 0) {
        const q = questions[0];
        const mockAnswer = [{
          question_id: q.id,
          selected_option_id: q.options && q.options.length > 0 ? q.options[0].id : null,
          is_marked_for_review: false,
          is_visited: true,
          time_spent_seconds: 15,
          updated_at: new Date().toISOString(),
        }];

        syncAnswers(session, sessionId, generateUUID(), mockAnswer);
      }
    }
  }

  sleepRandom(2, 4);
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
  STEP-STRESS TEST SUMMARY (BREAKPOINT & CAPACITY)
=====================================================
  Total Requests : ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0}
  P95 Latency    : ${(duration['p(95)'] || 0).toFixed(2)} ms
  Failure Rate   : ${((failed.rate || 0) * 100).toFixed(2)} %
  Peak VUs       : ${data.metrics.vus ? data.metrics.vus.values.max : 0}
=====================================================
`;
}
