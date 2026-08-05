/* eslint-disable */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const val = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = val;
        }
      }
    });
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabaseAnon = createClient(SUPABASE_URL, ANON_KEY);

async function verifyLogin() {
  console.log('🔍 Verifying test student authentication with Supabase Auth...');

  const studentsPath = path.resolve(__dirname, 'students.json');
  const students = JSON.parse(fs.readFileSync(studentsPath, 'utf8'));

  const testAccount = students[0]; // student001@test.com

  console.log(`🔐 Attempting signInWithPassword for: ${testAccount.email}`);

  const { data, error } = await supabaseAnon.auth.signInWithPassword({
    email: testAccount.email,
    password: testAccount.password,
  });

  if (error || !data.session) {
    console.error(`❌ Authentication FAILED for ${testAccount.email}:`, error);
    process.exit(1);
  }

  console.log(`✅ Authentication SUCCESSFUL!`);
  console.log(`   User ID: ${data.user.id}`);
  console.log(`   Email: ${data.user.email}`);
  console.log(`   Access Token Length: ${data.session.access_token.length} chars`);
  console.log(`   Registered Device ID: ${testAccount.device_id}`);
  console.log(`\n🎉 Verification Passed: Student can authenticate with Supabase Auth.`);
}

verifyLogin().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
