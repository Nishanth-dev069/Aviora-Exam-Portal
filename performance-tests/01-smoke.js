/* eslint-disable */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { config } from './config.js';
import { generateHTMLReport } from './helpers.js';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: config.THRESHOLDS.SMOKE,
};

export default function () {
  const url = `${config.BASE_URL}/login`;
  const response = http.get(url, {
    tags: { name: 'GET /login' },
    redirects: 5,
  });

  check(response, {
    'Status is 200, 302, 307, or 308': (r) => [200, 302, 307, 308].includes(r.status),
  });

  sleep(1);
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
  SMOKE TEST SUMMARY
=====================================================
  Total Requests : ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0}
  P95 Latency    : ${(duration['p(95)'] || 0).toFixed(2)} ms
  Failure Rate   : ${((failed.rate || 0) * 100).toFixed(2)} %
=====================================================
`;
}