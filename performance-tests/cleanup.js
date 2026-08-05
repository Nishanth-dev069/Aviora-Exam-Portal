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

async function purgeCorruptedTestUsers() {
  console.log('🧹 Purging test users ending in @test.com...');

  // Get all users from public.users ending in @test.com
  const { data: users, error } = await supabaseAdmin
    .from('users')
    .select('id, email')
    .like('email', '%@test.com');

  if (error || !users || users.length === 0) {
    console.log('No @test.com users found in public.users.');
  } else {
    console.log(`Found ${users.length} users to purge.`);
    const ids = users.map(u => u.id);

    // Delete student_profiles
    await supabaseAdmin.from('student_profiles').delete().in('user_id', ids);

    // Delete active_sessions
    await supabaseAdmin.from('active_sessions').delete().in('user_id', ids);

    // Delete audit_logs
    await supabaseAdmin.from('audit_logs').delete().in('actor_id', ids);

    // Delete public.users
    await supabaseAdmin.from('users').delete().in('id', ids);

    // Delete auth.users via admin API
    for (const u of users) {
      await supabaseAdmin.auth.admin.deleteUser(u.id).catch(() => {});
    }

    console.log(`✅ Successfully purged ${users.length} users.`);
  }
}

purgeCorruptedTestUsers().catch(console.error);
