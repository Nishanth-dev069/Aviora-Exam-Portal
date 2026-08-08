/* eslint-disable */
import { SharedArray } from 'k6/data';
import { config } from './config.js';
import {
  getVUToken,
  loadDashboard,
  startExam,
  sendExamHeartbeat,
  syncAnswers,
  sendSecurityEvent,
  generateUUID,
  sleepRandom,
  generateHTMLReport
} from './helpers.js';

const students = new SharedArray('students', function () {
  return JSON.parse(open('./students.json'));
});

export const options = {
  stages: [
    { duration: '30s', target: 30 },   // Wave 1: 30 students start
    { duration: '1m', target: 75 },    // Wave 2: 75 students active
    { duration: '1m', target: 100 },   // Full exam hall: 100 concurrent students
    { duration: '5m', target: 100 },   // Sustained 100 students answering with 10s heartbeats & autosaves
    { duration: '1m', target: 0 },     // Ramp-down
  ],
  thresholds: config.THRESHOLDS.LOAD,
};

export default function () {
  const session = getVUToken(students);
  if (!session.success || !session.token) {
    sleepRandom(1, 2);
    return;
  }

  // 1. Initial Dashboard Check
  loadDashboard(session);
  sleepRandom(1, 3);

  // 2. Start Exam
  const examResult = startExam(session, config.EXAM_ID);
  if (!examResult.success || !examResult.session) {
    sleepRandom(1, 2);
    return;
  }

  const sessionId = examResult.session.id;
  const questions = examResult.questions || [];

  // 3. Active Exam Answering Loop (Simulating continuous 10s heartbeat + 10s autosave cadence)
  let answerIndex = 0;
  for (let cycle = 0; cycle < 4; cycle++) {
    // Tick 1: Heartbeat (every 10s)
    sendExamHeartbeat(session, sessionId);

    // Realistic think-time reading & selecting option (5-8 seconds)
    sleepRandom(5, 8);

    // Tick 2: Autosave batch (sync answers)
    if (questions.length > 0) {
      const q = questions[answerIndex % questions.length];
      const selectedOption = q.options && q.options.length > 0
        ? q.options[answerIndex % q.options.length].id
        : null;

      const mockAnswer = [{
        question_id: q.id,
        selected_option_id: selectedOption,
        is_marked_for_review: answerIndex % 3 === 0,
        is_visited: true,
        time_spent_seconds: 15 + cycle * 10,
        updated_at: new Date().toISOString(),
      }];

      syncAnswers(session, sessionId, generateUUID(), mockAnswer);
      answerIndex++;
    }

    // Occasional security violation simulation (5% chance of window blur / tab switch)
    if (Math.random() < 0.05) {
      sendSecurityEvent(session, sessionId, 'window_blur', { duration_seconds: 2 });
    }

    // Remaining pause to complete 10-second sync window
    sleepRandom(2, 4);
  }
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
  SUSTAINED 100-STUDENT EXAM LOAD TEST SUMMARY
=====================================================
  Total Requests : ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0}
  P95 Latency    : ${(duration['p(95)'] || 0).toFixed(2)} ms
  Failure Rate   : ${((failed.rate || 0) * 100).toFixed(2)} %
  Peak VUs       : ${data.metrics.vus ? data.metrics.vus.values.max : 0}
=====================================================
`;
}
