import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findActiveExam() {
  const { data: exams, error } = await supabaseAdmin
    .from('exams')
    .select('id, title, type, status')
    .limit(10);

  console.log("Exams in Database:", exams, "Error:", error);
}

findActiveExam();
