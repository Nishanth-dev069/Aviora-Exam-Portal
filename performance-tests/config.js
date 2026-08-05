/* eslint-disable */
/**
 * Centralized Configuration for Aviora Performance Tests
 * All test scripts import configuration from this file.
 */

export const config = {
  // Base Application URL (Override with -e BASE_URL=https://your-domain.com)
  BASE_URL: __ENV.BASE_URL || 'https://aviora-exam-portal.vercel.app',

  // API Endpoints
  LOGIN_ENDPOINT: '/api/auth/login',
  DASHBOARD_ENDPOINT: '/api/student/dashboard',
  START_EXAM_ENDPOINT: '/api/exam/start',
  SYNC_ENDPOINT: '/api/exam/sync',
  SUBMIT_ENDPOINT: '/api/exam/submit',

  // Target Exam ID for start/sync/submit tests (Override with -e EXAM_ID=uuid)
  EXAM_ID: __ENV.EXAM_ID || '3534d2bb-ac6f-4ee2-8174-64c38fe6a780',

  // Default Request Headers
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'k6-performance-testing-suite/1.0',
  },

  // Timeouts & HTTP Options
  TIMEOUTS: {
    requestTimeout: '30s',
  },

  // Standard Performance Thresholds
  THRESHOLDS: {
    SMOKE: {
      http_req_failed: ['rate<0.01'],    // Error rate must be less than 1%
      http_req_duration: ['p(95)<500'],  // 95% of requests must complete below 500ms
    },
    LOAD: {
      http_req_failed: ['rate<0.01'],
      http_req_duration: ['p(95)<500'],
      http_reqs: ['rate>50'],            // Must process at least 50 req/sec
    },
    SPIKE: {
      http_req_failed: ['rate<0.05'],    // Under extreme spike, allow up to 5% failures
      http_req_duration: ['p(95)<2000'], // Latency can degrade to 2000ms
    },
    STRESS: {
      http_req_failed: ['rate<0.05'],
      http_req_duration: ['p(95)<3000'],
    },
    SOAK: {
      http_req_failed: ['rate<0.01'],
      http_req_duration: ['p(95)<500'],
    },
  },
};