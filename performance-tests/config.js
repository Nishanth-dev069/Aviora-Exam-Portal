/* eslint-disable */
/**
 * Centralized Configuration for Aviora Performance Tests
 * Target Domain: https://portal.avioraaviation.in
 * All test scripts import configuration from this file.
 */

export const config = {
  // Base Application URL (Override with -e BASE_URL=https://your-domain.com)
  BASE_URL: __ENV.BASE_URL || 'https://portal.avioraaviation.in',

  // API Endpoints matching exact Next.js App Router endpoints
  LOGIN_ENDPOINT: '/api/auth/login',
  DASHBOARD_ENDPOINT: '/api/student/dashboard',
  START_EXAM_ENDPOINT: '/api/exam/start',
  HEARTBEAT_ENDPOINT: '/api/exam/heartbeat',
  GLOBAL_HEARTBEAT_ENDPOINT: '/api/heartbeat',
  SYNC_ENDPOINT: '/api/exam/sync',
  SECURITY_EVENT_ENDPOINT: '/api/exam/security-event',
  SUBMIT_ENDPOINT: '/api/exam/submit',

  // Target Exam ID for start/sync/submit tests (Override with -e EXAM_ID=uuid)
  EXAM_ID: __ENV.EXAM_ID || '3534d2bb-ac6f-4ee2-8174-64c38fe6a780',

  // Real Student Timing Cadences (in seconds)
  CADENCE: {
    HEARTBEAT_INTERVAL: 10,     // Client heartbeat runs every 10 seconds
    AUTOSAVE_INTERVAL: 10,      // SyncEngine batch queue interval
    THINK_TIME_MIN: 8,          // Realistic student read/think time per question (min)
    THINK_TIME_MAX: 20,         // Realistic student read/think time per question (max)
    EXAM_START_SPREAD: 15,      // Seconds spread during start-of-exam rush
  },

  // Default Request Headers
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'k6-aviora-performance-suite/2.0 (RealStudentSimulation)',
  },

  // Timeouts & HTTP Options
  TIMEOUTS: {
    requestTimeout: '30s',
  },

  // Standard Performance Thresholds based on Production SLAs
  THRESHOLDS: {
    SMOKE: {
      http_req_failed: ['rate<0.01'],    // Error rate must be less than 1%
      http_req_duration: ['p(95)<800'],  // 95% of requests must complete below 800ms
    },
    LOAD: {
      http_req_failed: ['rate<0.01'],
      http_req_duration: ['p(95)<600'],  // 95% of requests below 600ms
      http_reqs: ['rate>10'],            // Must sustain active student throughput
    },
    SPIKE: {
      http_req_failed: ['rate<0.05'],    // Under sudden surge, allow up to 5% failures
      http_req_duration: ['p(95)<2500'], // Latency can degrade to 2500ms
    },
    STRESS: {
      http_req_failed: ['rate<0.05'],
      http_req_duration: ['p(95)<3000'],
    },
    SOAK: {
      http_req_failed: ['rate<0.01'],
      http_req_duration: ['p(95)<600'],
    },
  },
};