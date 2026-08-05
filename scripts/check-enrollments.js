import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const students = JSON.parse(fs.readFileSync('./performance-tests/students.json', 'utf8'));

async function checkAndEnroll() {
  const examId = '3534d2bb-ac6f-4ee2-8174-64c38fe6a780';

  const { data: allUsers } = await supabaseAdmin
    .from('users')
    .select('id, email')
    .like('email', '%@avioratest.com');

  if (allUsers && allUsers.length > 0) {
    const enrollments = allUsers.map(u => ({
      exam_id: examId,
      student_id: u.id,
      enrolled_by: u.id,
    }));

    const { error: insertErr } = await supabaseAdmin
      .from('exam_enrollments')
      .upsert(enrollments, { onConflict: 'exam_id,student_id' });

    console.log("Enrolled Test Students in 3534d2bb-ac6f-4ee2-8174-64c38fe6a780:", insertErr || "SUCCESS");
  }
}

checkAndEnroll();
