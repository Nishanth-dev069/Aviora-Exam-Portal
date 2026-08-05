import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

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

async function main() {
  console.log('🚀 Generating 1,000 unique performance test student accounts...');

  const studentsList = [];
  for (let i = 1; i <= 1000; i++) {
    const num = i.toString().padStart(4, '0');
    const deviceHex = i.toString().padStart(12, '0');
    studentsList.push({
      email: `student${num}@avioratest.com`,
      password: 'Password123!',
      device_id: `0194d2f8-7a8b-7000-8000-${deviceHex}`,
      device_info: {
        browser: 'Chrome 122',
        os: 'Windows 11',
        screen: '1920x1080',
      },
    });
  }

  // 1. Save students.json
  const studentsPath = path.resolve('performance-tests/students.json');
  fs.writeFileSync(studentsPath, JSON.stringify(studentsList, null, 2));
  console.log(`✅ Saved 1,000 unique student entries to performance-tests/students.json`);

  // 2. Batch Seed Users into Supabase
  console.log(`📋 Beginning Supabase Auth & Database Seeding for 1,000 Students...`);
  const targetExamId = '3534d2bb-ac6f-4ee2-8174-64c38fe6a780';
  let createdCount = 0;
  let updatedCount = 0;

  // Process in batches of 50 for efficiency
  const batchSize = 50;
  for (let i = 0; i < studentsList.length; i += batchSize) {
    const batch = studentsList.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (student, indexInBatch) => {
        const studentIndex = i + indexInBatch + 1;
        const studentNum = studentIndex.toString().padStart(4, '0');
        const fullName = `Test Student ${studentNum}`;
        const rollNumber = `TEST-ROLL-${studentNum}`;

        let userId = null;

        // Check existing user
        const { data: existingUser } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('email', student.email)
          .maybeSingle();

        if (existingUser) {
          userId = existingUser.id;
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            password: student.password,
            email_confirm: true,
          });
          updatedCount++;
        } else {
          const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: student.email,
            password: student.password,
            email_confirm: true,
            user_metadata: { full_name: fullName },
          });

          if (createError || !authData.user) {
            console.error(`❌ Failed to create auth user ${student.email}:`, createError);
            return;
          }
          userId = authData.user.id;
          createdCount++;
        }

        // Upsert public.users
        await supabaseAdmin.from('users').upsert({
          id: userId,
          email: student.email,
          role: 'student',
          status: 'active',
          force_password_change: false,
          deleted_at: null,
          updated_at: new Date().toISOString(),
        });

        // Upsert student_profiles with unique registered_device_id
        await supabaseAdmin.from('student_profiles').upsert(
          {
            user_id: userId,
            full_name: fullName,
            roll_number: rollNumber,
            registered_device_id: student.device_id,
            registered_device_info: {
              ...student.device_info,
              registered_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

        // Upsert exam_enrollments for active test exam
        await supabaseAdmin.from('exam_enrollments').upsert(
          {
            exam_id: targetExamId,
            student_id: userId,
            enrolled_by: userId,
          },
          { onConflict: 'exam_id,student_id' }
        );
      })
    );

    console.log(`  └─ Processed ${Math.min(i + batchSize, studentsList.length)} / 1,000 accounts...`);
  }

  console.log(`\n🎉 Seeding & Enrollment Completed Successfully!`);
  console.log(`   New Users Created: ${createdCount}`);
  console.log(`   Existing Users Updated: ${updatedCount}`);
  console.log(`   Total Unique Accounts Ready: 1,000`);
}

main().catch((err) => {
  console.error('Fatal error during student generation:', err);
  process.exit(1);
});
