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

// Production Soak Duration defaults to 1 Hour (override with -e SOAK_DURATION=2h)
const soakDuration = __ENV.SOAK_DURATION || '2h';

export const options = {
  stages: [
    { duration: '2m', target: 50 },             // Ramp-up to 50 students
    { duration: '3m', target: 100 },            // Full exam presence: 100 students
    { duration: soakDuration, target: 100 },    // Sustained 1-to-2 hour active exam load
    { duration: '2m', target: 0 },              // Gradual ramp-down
  ],
  thresholds: config.THRESHOLDS.SOAK,
};

export default function () {
  // 1. Authenticate & obtain session token
  const session = getVUToken(students);
  if (!session.success || !session.token) {
    sleepRandom(2, 4);
    return;
  }

  // 2. Fetch dashboard
  loadDashboard(session);
  sleepRandom(2, 5);

  // 3. Start or recover active exam session
  const examResult = startExam(session, config.EXAM_ID);
  if (!examResult.success || !examResult.session) {
    sleepRandom(2, 4);
    return;
  }

  const sessionId = examResult.session.id;
  const questions = examResult.questions || [];

  // 4. Long-Duration Sustained Taking Loop (Simulating continuous live exam engagement)
  for (let cycle = 0; cycle < 6; cycle++) {
    // 10-Second Active Session Heartbeat (Validates session keep-alive & detects token expiry)
    sendExamHeartbeat(session, sessionId);

    // Realistic student think-time reading & solving questions (8 to 15 seconds)
    sleepRandom(8, 15);

    // 10-Second Batch Autosave (Dexie IndexedDB -> POST /api/exam/sync)
    if (questions.length > 0) {
      const q = questions[cycle % questions.length];
      const selectedOption = q.options && q.options.length > 0
        ? q.options[cycle % q.options.length].id
        : null;

      const mockAnswer = [{
        question_id: q.id,
        selected_option_id: selectedOption,
        is_marked_for_review: cycle % 2 === 0,
        is_visited: true,
        time_spent_seconds: 25 + cycle * 15,
        updated_at: new Date().toISOString(),
      }];

      syncAnswers(session, sessionId, generateUUID(), mockAnswer);
    }

    // Occasional security check (5% probability of window blur)
    if (Math.random() < 0.05) {
      sendSecurityEvent(session, sessionId, 'window_blur', { duration_seconds: 2 });
    }

    sleepRandom(2, 5);
  }
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data),
    'soak-test-report.html': generateHTMLReport(data),
    'soak-test-summary.json': JSON.stringify(data),
  };
}

function textSummary(data) {
  const duration = data.metrics.http_req_duration ? data.metrics.http_req_duration.values : {};
  const failed = data.metrics.http_req_failed ? data.metrics.http_req_failed.values : {};
  return `
=====================================================
  SOAK / ENDURANCE TEST SUMMARY (${soakDuration} SUSTAINED)
=====================================================
  Target Domain  : ${config.BASE_URL}
  Total Requests : ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0}
  P95 Latency    : ${(duration['p(95)'] || 0).toFixed(2)} ms
  Failure Rate   : ${((failed.rate || 0) * 100).toFixed(2)} %
  Duration       : ${soakDuration} (100 Active Students)
=====================================================
`;
}
