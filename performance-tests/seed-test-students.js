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

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function seedPerformanceStudents() {
  console.log('🚀 Starting Performance Test Student Seeding via Supabase Admin API...');

  const studentsPath = path.resolve(__dirname, 'students.json');
  const students = JSON.parse(fs.readFileSync(studentsPath, 'utf8'));

  console.log(`📋 Found ${students.length} students in students.json`);

  let createdCount = 0;
  let updatedCount = 0;

  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    const studentNum = (i + 1).toString().padStart(3, '0');
    const fullName = `Test Student ${studentNum}`;
    const rollNumber = `TEST-ROLL-${studentNum}`;

    let userId = null;

    // Check if user already exists
    const { data: existingPublicUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', student.email)
      .maybeSingle();

    if (existingPublicUser) {
      userId = existingPublicUser.id;
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: student.password,
        email_confirm: true,
      });
      updatedCount++;
    } else {
      // Create user via Supabase Auth Admin API (Same exact production code path as src/app/api/admin/students/route.ts)
      const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: student.email,
        password: student.password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

      if (createError || !authData.user) {
        console.error(`❌ Failed to create auth user ${student.email}:`, createError);
        continue;
      }

      userId = authData.user.id;
      createdCount++;
    }

    // 2. Upsert into public.users
    const { error: userError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: userId,
        email: student.email,
        role: 'student',
        status: 'active',
        force_password_change: false,
        deleted_at: null,
        updated_at: new Date().toISOString(),
      });

    if (userError) {
      console.error(`❌ Failed to upsert public.users for ${student.email}:`, userError);
      continue;
    }

    // 3. Upsert into public.student_profiles
    const { error: profileError } = await supabaseAdmin
      .from('student_profiles')
      .upsert({
        user_id: userId,
        full_name: fullName,
        roll_number: rollNumber,
        registered_device_id: student.device_id,
        registered_device_info: {
          ...student.device_info,
          registered_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (profileError) {
      console.error(`❌ Failed to upsert student_profiles for ${student.email}:`, profileError);
      continue;
    }

    if ((i + 1) % 20 === 0 || i === students.length - 1) {
      console.log(`✅ Progress: ${i + 1}/${students.length} accounts created.`);
    }
  }

  console.log(`\n🎉 Seeding Complete!`);
  console.log(`   Created New Users: ${createdCount}`);
  console.log(`   Updated Existing Users: ${updatedCount}`);
}

seedPerformanceStudents().catch((err) => {
  console.error('Fatal error during seeding:', err);
  process.exit(1);
});
