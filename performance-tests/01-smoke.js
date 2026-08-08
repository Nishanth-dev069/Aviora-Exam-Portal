/* eslint-disable */
import { SharedArray } from 'k6/data';
import { check } from 'k6';
import { config } from './config.js';
import {
  getVUToken,
  loadDashboard,
  sendGlobalHeartbeat,
  startExam,
  sendExamHeartbeat,
  syncAnswers,
  sendSecurityEvent,
  submitExam,
  generateUUID,
  sleepRandom,
  generateHTMLReport
} from './helpers.js';

const students = new SharedArray('students', function () {
  return JSON.parse(open('./students.json'));
});

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: config.THRESHOLDS.SMOKE,
};

export default function () {
  // Step 1: Login
  const session = getVUToken(students);
  if (!session.success || !session.token) {
    sleepRandom(1, 2);
    return;
  }

  // Step 2: Global Heartbeat & Dashboard
  sendGlobalHeartbeat(session);
  loadDashboard(session);

  // Step 3: Start Exam
  const examResult = startExam(session, config.EXAM_ID);
  if (!examResult.success || !examResult.session) {
    sleepRandom(1, 2);
    return;
  }

  const sessionId = examResult.session.id;
  const submissionToken = examResult.session.submission_token;
  const questions = examResult.questions;

  // Step 4: Exam Heartbeat (10-second interval verification)
  sendExamHeartbeat(session, sessionId);

  // Step 5: Answer Autosave Sync
  if (questions && questions.length > 0) {
    const q = questions[0];
    const mockAnswer = [{
      question_id: q.id,
      selected_option_id: q.options && q.options.length > 0 ? q.options[0].id : null,
      is_marked_for_review: false,
      is_visited: true,
      time_spent_seconds: 10,
      updated_at: new Date().toISOString(),
    }];

    syncAnswers(session, sessionId, generateUUID(), mockAnswer);
  }

  // Step 6: Anti-Cheat Security Event
  sendSecurityEvent(session, sessionId, 'window_blur', { reason: 'smoke_test_blur' });

  // Step 7: Exam Submission
  submitExam(session, sessionId, submissionToken);

  sleepRandom(2, 4);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data),
    'smoke-report.html': generateHTMLReport(data),
    'smoke-summary.json': JSON.stringify(data),
  };
}

function textSummary(data) {
  const duration = data.metrics.http_req_duration ? data.metrics.http_req_duration.values : {};
  const failed = data.metrics.http_req_failed ? data.metrics.http_req_failed.values : {};
  return `
=====================================================
  END-TO-END SMOKE TEST SUMMARY (PORTAL API SANITY)
=====================================================
  Total Requests : ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0}
  P95 Latency    : ${(duration['p(95)'] || 0).toFixed(2)} ms
  Failure Rate   : ${((failed.rate || 0) * 100).toFixed(2)} %
=====================================================
`;
}