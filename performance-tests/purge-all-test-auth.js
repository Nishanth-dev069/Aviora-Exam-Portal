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

async function listAndDeleteAllTestAuthUsers() {
  console.log('Listing all auth users from Supabase Auth GoTrue engine...');

  let page = 1;
  let hasMore = true;
  let deletedCount = 0;

  while (hasMore) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 });

    if (error || !data || !data.users || data.users.length === 0) {
      hasMore = false;
      break;
    }

    const testUsers = data.users.filter(u => u.email && (u.email.includes('@test.com') || u.email.includes('student')));

    console.log(`Page ${page}: Found ${data.users.length} total users, ${testUsers.length} test users to delete.`);

    for (const u of testUsers) {
      console.log(`Deleting auth user: ${u.id} - ${u.email}`);
      await supabaseAdmin.from('student_profiles').delete().eq('user_id', u.id).catch(() => {});
      await supabaseAdmin.from('active_sessions').delete().eq('user_id', u.id).catch(() => {});
      await supabaseAdmin.from('users').delete().eq('id', u.id).catch(() => {});
      await supabaseAdmin.auth.admin.deleteUser(u.id).catch(err => console.error('Delete auth user err:', err));
      deletedCount++;
    }

    if (data.users.length < 100) {
      hasMore = false;
    } else {
      page++;
    }
  }

  console.log(`Total test auth users deleted: ${deletedCount}`);
}

listAndDeleteAllTestAuthUsers().catch(console.error);
