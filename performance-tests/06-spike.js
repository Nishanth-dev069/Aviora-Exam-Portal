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
    { duration: '10s', target: 150 }, // Instant spike jump from 0 to 150 users in 10s
    { duration: '1m', target: 150 },  // Hold at peak spike load (150% capacity)
    { duration: '15s', target: 0 },   // Rapid recovery
  ],
  thresholds: config.THRESHOLDS.SPIKE,
};

export default function () {
  const session = getVUToken(students);

  if (session.success && session.token) {
    sleepRandom(0.5, 1.5);
    loadDashboard(session);

    sleepRandom(0.5, 1.5);
    const examResult = startExam(session, config.EXAM_ID);

    if (examResult.success && examResult.session) {
      const sessionId = examResult.session.id;
      const questions = examResult.questions || [];

      // Heartbeat under spike
      sendExamHeartbeat(session, sessionId);

      if (questions.length > 0) {
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
    }
  }

  sleepRandom(1, 3);
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
  SPIKE TEST SUMMARY (150 INSTANT CONCURRENT VUs)
=====================================================
  Total Requests : ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0}
  P95 Latency    : ${(duration['p(95)'] || 0).toFixed(2)} ms
  Failure Rate   : ${((failed.rate || 0) * 100).toFixed(2)} %
  Peak VUs       : ${data.metrics.vus ? data.metrics.vus.values.max : 0}
=====================================================
`;
}
