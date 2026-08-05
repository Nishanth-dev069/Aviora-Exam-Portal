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
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function testCreateCleanStudent() {
  console.log('Testing auth.admin.createUser for student001@avioratest.com...');

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: 'student001@avioratest.com',
    password: 'Password123!',
    email_confirm: true,
  });

  if (error) {
    console.error('Error creating student001@avioratest.com:', JSON.stringify(error, null, 2));
  } else {
    console.log('SUCCESS! Created user ID:', data.user.id, 'Email:', data.user.email);
    // Cleanup
    await supabaseAdmin.auth.admin.deleteUser(data.user.id);
    console.log('Cleaned up user successfully!');
  }
}

testCreateCleanStudent().catch(console.error);
