import fs from 'fs';

const logPath = 'C:\\Users\\Nishanth\\.gemini\\antigravity-ide\\brain\\3c2f4a35-af66-4255-b5d3-7608030cb21d\\.system_generated\\tasks\\task-575.log';
const logText = fs.readFileSync(logPath, 'utf8');

const lines = logText.split('\n');

let loginCalls = 0;
let login200 = 0;
let login429 = 0;

const vuSuccessMap = new Map(); // vuId -> iteration when success occurred
const reLoginAfterSuccessMap = new Map(); // vuId -> list of iterations where login called after success

lines.forEach(line => {
  if (line.includes('LOGIN ATTEMPT')) {
    loginCalls++;
    const match = line.match(/VU:\s*(\d+),\s*Iter:\s*(\d+)/);
    if (match) {
      const vuId = parseInt(match[1], 10);
      const iter = parseInt(match[2], 10);
      if (vuSuccessMap.has(vuId)) {
        if (!reLoginAfterSuccessMap.has(vuId)) {
          reLoginAfterSuccessMap.set(vuId, []);
        }
        reLoginAfterSuccessMap.get(vuId).push(iter);
      }
    }
  }

  if (line.includes('LOGIN SUCCESS & CACHED')) {
    login200++;
    const match = line.match(/VU:\s*(\d+)/);
    if (match) {
      const vuId = parseInt(match[1], 10);
      vuSuccessMap.set(vuId, true);
    }
  }

  if (line.includes('Status: 429')) {
    login429++;
  }
});

console.log("=== EMPIRICAL METRICS FROM LOG ===");
console.log("Total Calls to login():", loginCalls);
console.log("Total Successful Logins (HTTP 200):", login200);
console.log("Total Failed Logins (HTTP 429):", login429);
console.log("Unique VUs Authenticated:", vuSuccessMap.size);
console.log("VUs that called login() AFTER successful JWT cache:", reLoginAfterSuccessMap.size);

if (reLoginAfterSuccessMap.size > 0) {
  console.log("VUs re-logging after success:", Array.from(reLoginAfterSuccessMap.entries()));
} else {
  console.log("INVARIANT VERIFIED: 0 VUs executed login() after obtaining a cached JWT!");
}
