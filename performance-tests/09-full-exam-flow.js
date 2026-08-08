/* eslint-disable */
import { SharedArray } from 'k6/data';
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

// Production Exam Duration defaults to 30 Minutes (override with -e EXAM_DURATION=45m)
const examDuration = __ENV.EXAM_DURATION || '1h';

export const options = {
  stages: [
    { duration: '3m', target: 50 },             // Phase 1: 50 students arrive in waiting lobby
    { duration: '2m', target: 100 },            // Phase 1: Full 100 students in waiting room
    { duration: '1m', target: 100 },            // Phase 2: Exam Start Surge (100 students enter at T=0)
    { duration: examDuration, target: 100 },    // Phase 3: Realistic active exam taking (30m sustained)
    { duration: '3m', target: 25 },             // Phase 4: Staggered exam submission wave
    { duration: '1m', target: 0 },              // Phase 5: Dashboard review & exit
  ],
  thresholds: config.THRESHOLDS.LOAD,
};

export default function () {
  // =========================================================================
  // PHASE 1: PRE-EXAM ARRIVAL & WAITING LOBBY (T - 5m to T - 0m)
  // =========================================================================
  const session = getVUToken(students);
  if (!session.success || !session.token) {
    sleepRandom(1, 2);
    return;
  }

  // Load dashboard & start global lobby heartbeat
  loadDashboard(session);
  sendGlobalHeartbeat(session);

  // Realistic dwell time waiting for exam countdown to hit zero (5 to 12 seconds)
  sleepRandom(5, 12);

  // =========================================================================
  // PHASE 2: EXAM START SURGE (T = 0m)
  // =========================================================================
  const examResult = startExam(session, config.EXAM_ID);
  if (!examResult.success || !examResult.session) {
    sleepRandom(1, 2);
    return;
  }

  const sessionId = examResult.session.id;
  const submissionToken = examResult.session.submission_token;
  const questions = examResult.questions || [];

  // =========================================================================
  // PHASE 3: ACTIVE EXAM LIFECYCLE (10s Heartbeats + 10s Autosaves + Anti-Cheat)
  // =========================================================================
  if (questions.length > 0) {
    // Simulate progressively answering questions across multiple 10-second cycles
    const totalCycles = Math.min(10, questions.length);

    for (let qIndex = 0; qIndex < totalCycles; qIndex++) {
      // 1. Continuous 10-Second Active Session Heartbeat
      sendExamHeartbeat(session, sessionId);

      // 2. Realistic student think-time reading & solving question (8 to 15 seconds)
      sleepRandom(8, 15);

      // 3. 10-Second Autosave Batch (IndexedDB queue -> POST /api/exam/sync)
      const q = questions[qIndex];
      const selectedOption = q.options && q.options.length > 0
        ? q.options[qIndex % q.options.length].id
        : null;

      const mockAnswer = [{
        question_id: q.id,
        selected_option_id: selectedOption,
        is_marked_for_review: qIndex % 3 === 0,
        is_visited: true,
        time_spent_seconds: 20 + qIndex * 15,
        updated_at: new Date().toISOString(),
      }];

      syncAnswers(session, sessionId, generateUUID(), mockAnswer);

      // 4. Anti-Cheat Security Violation Event (stochastic 5% chance of window blur / tab switch)
      if (Math.random() < 0.05) {
        sendSecurityEvent(session, sessionId, 'window_blur', { duration_seconds: 2 });
      }

      // Small think pause before proceeding to the next question
      sleepRandom(3, 6);
    }
  }

  // Realistic review think-time before final submission
  sleepRandom(5, 10);

  // =========================================================================
  // PHASE 4: FINAL EXAM SUBMISSION & GRADING
  // =========================================================================
  submitExam(session, sessionId, submissionToken);

  // =========================================================================
  // PHASE 5: POST-EXAM DASHBOARD RESULT CHECK
  // =========================================================================
  sleepRandom(2, 4);
  loadDashboard(session);

  sleepRandom(5, 10);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data),
    'full-exam-flow-report.html': generateHTMLReport(data),
    'full-exam-flow-summary.json': JSON.stringify(data),
  };
}

function textSummary(data) {
  const duration = data.metrics.http_req_duration ? data.metrics.http_req_duration.values : {};
  const failed = data.metrics.http_req_failed ? data.metrics.http_req_failed.values : {};
  return `
=====================================================
  PRODUCTION END-TO-END EXAM SIMULATION (${examDuration})
=====================================================
  Target Domain  : ${config.BASE_URL}
  Total Requests : ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0}
  P95 Latency    : ${(duration['p(95)'] || 0).toFixed(2)} ms
  Failure Rate   : ${((failed.rate || 0) * 100).toFixed(2)} %
  Peak Students  : ${data.metrics.vus ? data.metrics.vus.values.max : 0}
  Exam Duration  : ${examDuration}
=====================================================
`;
}
