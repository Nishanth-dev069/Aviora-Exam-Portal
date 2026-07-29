import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iciwchssqaftveufvtvi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljaXdjaHNzcWFmdHZldWZ2dHZpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDYyNDEwNiwiZXhwIjoyMTAwMjAwMTA2fQ.UJF9m3mEh7RduD4tYGHgZHC46KFrPhsI3yv8KVD22sQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('Starting seed...');

  // 1. Create Admin User
  const { data: adminAuth, error: adminErr } = await supabase.auth.admin.createUser({
    email: 'admin@aviora.com',
    password: 'Password123!',
    email_confirm: true,
  });
  
  if (adminErr) {
    if (adminErr.code === 'email_exists' || adminErr.message.includes('already been registered') || adminErr.message.includes('already exists')) {
       console.log('Admin already exists in auth.');
    } else {
       throw adminErr;
    }
  }
  
  let adminId = adminAuth?.user?.id;
  if (!adminId) {
    const { data: { users } } = await supabase.auth.admin.listUsers();
    adminId = users.find(u => u.email === 'admin@aviora.com').id;
  }

  const { error: adminUserErr } = await supabase.from('users').upsert({
    id: adminId,
    email: 'admin@aviora.com',
    role: 'admin',
    status: 'active',
    force_password_change: false
  });
  if (adminUserErr) console.error('Admin user table error:', adminUserErr);
  
  // 2. Create Student User
  const { data: studentAuth, error: studentErr } = await supabase.auth.admin.createUser({
    email: 'student@aviora.com',
    password: 'Password123!',
    email_confirm: true,
  });
  
  if (studentErr) {
    if (studentErr.code === 'email_exists' || studentErr.message.includes('already been registered') || studentErr.message.includes('already exists')) {
       console.log('Student already exists in auth.');
    } else {
       throw studentErr;
    }
  }

  let studentId = studentAuth?.user?.id;
  if (!studentId) {
    const { data: { users } } = await supabase.auth.admin.listUsers();
    studentId = users.find(u => u.email === 'student@aviora.com').id;
  }

  const { error: studentUserErr } = await supabase.from('users').upsert({
    id: studentId,
    email: 'student@aviora.com',
    role: 'student',
    status: 'active',
    force_password_change: false
  });
  if (studentUserErr) console.error('Student user table error:', studentUserErr);

  // 3. Create Batch
  let batchId;
  const { data: existingBatch } = await supabase.from('batches').select('id').eq('name', 'CS-2026 Batch A').maybeSingle();
  if (existingBatch) {
      batchId = existingBatch.id;
  } else {
      const { data: batch, error: batchErr } = await supabase.from('batches').insert({
        name: 'CS-2026 Batch A',
        description: 'Computer Science 2026 Cohort',
        status: 'active'
      }).select().single();
      if (batchErr) console.error('Batch error:', batchErr);
      batchId = batch?.id;
  }

  // Insert Student Profile
  const { error: profileErr } = await supabase.from('student_profiles').upsert({
    user_id: studentId,
    full_name: 'John Doe',
    roll_number: 'CS26001',
    batch_id: batchId
  }, { onConflict: 'user_id' });
  if (profileErr) console.error('Profile error:', profileErr);

  // 4. Create Question Bank
  let bankId;
  const { data: existingBank } = await supabase.from('question_banks').select('id').eq('name', 'Introduction to Computer Science').maybeSingle();
  if (existingBank) {
      bankId = existingBank.id;
  } else {
      const { data: bank, error: bankErr } = await supabase.from('question_banks').insert({
        name: 'Introduction to Computer Science',
        subject: 'Computer Science',
        created_by: adminId,
        status: 'active'
      }).select().single();
      if (bankErr) console.error('Bank err:', bankErr);
      bankId = bank?.id;
  }

  // 5. Create Questions
  const { data: existingQs } = await supabase.from('questions').select('id').eq('bank_id', bankId);
  if (existingQs && existingQs.length > 0) {
      console.log('Questions already exist, skipping question creation');
  } else {
      const questions = [
        {
          bank_id: bankId,
          content: 'What does CPU stand for?',
          type: 'mcq',
          difficulty: 'easy',
          subject: 'Computer Science',
          topic: 'Hardware',
          explanation: 'CPU stands for Central Processing Unit.',
          created_by: adminId,
          updated_by: adminId
        },
        {
          bank_id: bankId,
          content: 'Which of the following is not a programming language?',
          type: 'mcq',
          difficulty: 'easy',
          subject: 'Computer Science',
          topic: 'Software',
          explanation: 'HTML is a markup language, not a programming language in the strictest sense.',
          created_by: adminId,
          updated_by: adminId
        }
      ];

      for (const q of questions) {
        const { data: insertedQ, error: qErr } = await supabase.from('questions').insert(q).select().single();
        if (qErr) {
           console.error('Question err:', qErr);
           continue;
        }
        
        const qId = insertedQ.id;
        const isFirst = q.content.includes('CPU');
        
        const options = isFirst ? [
          { question_id: qId, content: 'Central Process Unit', is_correct: false, display_order: 1 },
          { question_id: qId, content: 'Computer Personal Unit', is_correct: false, display_order: 2 },
          { question_id: qId, content: 'Central Processing Unit', is_correct: true, display_order: 3 },
          { question_id: qId, content: 'Central Processor Unit', is_correct: false, display_order: 4 }
        ] : [
          { question_id: qId, content: 'Python', is_correct: false, display_order: 1 },
          { question_id: qId, content: 'Java', is_correct: false, display_order: 2 },
          { question_id: qId, content: 'HTML', is_correct: true, display_order: 3 },
          { question_id: qId, content: 'C++', is_correct: false, display_order: 4 }
        ];
        
        await supabase.from('question_options').insert(options);
      }
  }

  // 6. Create Exam
  const { data: existingExam } = await supabase.from('exams').select('id').eq('title', 'Midterm 1: Basics of CS').maybeSingle();
  if (existingExam) {
      console.log('Exam already exists, skipping exam creation');
  } else {
      const { data: examData, error: examErr } = await supabase.from('exams').insert({
        bank_id: bankId,
        title: 'Midterm 1: Basics of CS',
        subject: 'Computer Science',
        type: 'practice',
        duration_minutes: 30,
        total_questions: 2,
        marks_per_question: 10,
        negative_marks: 2,
        passing_marks: 10,
        status: 'active',
        created_by: adminId,
        updated_by: adminId
      }).select().single();

      if (examErr) {
        console.error('Exam error:', examErr);
      } else {
         const eId = examData.id;
         const { data: allQs } = await supabase.from('questions').select('id').eq('bank_id', bankId);
         for(let i=0; i<allQs.length; i++) {
             await supabase.from('exam_questions').insert({
                 exam_id: eId, question_id: allQs[i].id, base_order: i+1, marks: 10
             });
         }
         await supabase.from('exam_enrollments').insert({
             exam_id: eId, student_id: studentId, enrolled_by: adminId
         });
         console.log('Successfully created and enrolled in Exam:', examData.title);
      }
  }

  console.log('Seed completed successfully!');
}

seed().catch(console.error);
