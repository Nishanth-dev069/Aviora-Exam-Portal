import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const BASE_URL = 'http://localhost:3000';

async function triggerRateLimit() {
  console.log("🚀 Sending concurrent login requests to trigger raw auth error logging...");
  const promises = [];
  for (let i = 0; i < 35; i++) {
    promises.push(
      fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `student${(i + 1).toString().padStart(4, '0')}@avioratest.com`,
          password: 'WrongPassword123!',
        }),
      })
    );
  }
  const responses = await Promise.all(promises);
  console.log("Response statuses:", responses.map(r => r.status));
}

triggerRateLimit().catch(console.error);
