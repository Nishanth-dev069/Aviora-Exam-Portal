/* eslint-disable */
import { SharedArray } from 'k6/data';
import exec from 'k6/execution';
import { config } from './config.js';
import { getVUToken, loadDashboard, startExam, syncAnswers, submitExam, sleepRandom, generateHTMLReport } from './helpers.js';

const students = new SharedArray('students', function () {
  return JSON.parse(open('./students.json'));
});

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '3m', target: 50 },
    { duration: '5m', target: 50 },
    { duration: '1m', target: 0 },
  ],
  thresholds: config.THRESHOLDS.LOAD,
};

export default function () {
  const session = getVUToken(students);
  if (!session.success || !session.token) {
    sleepRandom(1, 2);
    return;
  }

  // STEP 1: Load Dashboard
  loadDashboard(session);

  // Realistic Think Time: Student selects scheduled exam
  sleepRandom(2, 5);

  // STEP 2: Start Exam
  const examResult = startExam(session, config.EXAM_ID);
  if (!examResult.success || !examResult.session) {
    sleepRandom(1, 2);
    return;
  }

  const sessionId = examResult.session.id;
  const submissionToken = examResult.session.submission_token;
  const questions = examResult.questions;

  // STEP 3 & 4: Answer Questions & Periodic Autosave (Sync)
  if (questions && questions.length > 0) {
    const mockAnswers = questions.slice(0, 3).map((q, idx) => ({
      question_id: q.question_id || q.id,
      selected_option_id: q.options && q.options.length > 0 ? (q.options[idx % q.options.length].id || null) : null,
      is_marked_for_review: idx % 2 === 0,
      is_visited: true,
      time_spent_seconds: 15 + idx * 5,
      updated_at: new Date().toISOString(),
    }));

    // Think time answering questions
    sleepRandom(3, 7);

    // Autosave sync
    syncAnswers(session, sessionId, `sync_vu${exec.vu.idInTest}_${Date.now()}`, mockAnswers);
  }

  // Realistic Think Time: Student reviews answers before submission
  sleepRandom(2, 4);

  // STEP 5: Submit Exam
  submitExam(session, sessionId, submissionToken);

  // STEP 6: Reload Dashboard to View Result
  sleepRandom(1, 2);
  loadDashboard(session);

  sleepRandom(3, 6);
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
  FULL END-TO-END EXAM FLOW TEST SUMMARY
=====================================================
  Total Requests : ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0}
  P95 Latency    : ${(duration['p(95)'] || 0).toFixed(2)} ms
  Failure Rate   : ${((failed.rate || 0) * 100).toFixed(2)} %
=====================================================
`;
}
