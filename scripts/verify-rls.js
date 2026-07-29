const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// IMPORTANT: Run this with node scripts/verify-rls.js

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE credentials in .env.local");
  process.exit(1);
}

// Clients
const adminClient = createClient(supabaseUrl, supabaseServiceKey);

async function runTests() {
  console.log("=== Starting RLS Verification Tests ===");

  // 1. Create Test Students A and B
  console.log("1. Provisioning Test Users...");
  const { data: userA, error: errA } = await adminClient.auth.admin.createUser({
    email: 'test_a_' + Date.now() + '@aviora.com',
    password: 'Password123!',
    email_confirm: true,
    user_metadata: { role: 'student', full_name: 'Test Student A' }
  });
  if (errA) throw errA;

  const { data: userB, error: errB } = await adminClient.auth.admin.createUser({
    email: 'test_b_' + Date.now() + '@aviora.com',
    password: 'Password123!',
    email_confirm: true,
    user_metadata: { role: 'student', full_name: 'Test Student B' }
  });
  if (errB) throw errB;

  console.log(`Created Student A: ${userA.user.id}`);
  console.log(`Created Student B: ${userB.user.id}`);

  // 2. Generate Anon Clients for both users
  const { data: sessionA } = await adminClient.auth.signInWithPassword({
    email: userA.user.email,
    password: 'Password123!'
  });
  const clientA = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${sessionA.session.access_token}` } }
  });

  const { data: sessionB } = await adminClient.auth.signInWithPassword({
    email: userB.user.email,
    password: 'Password123!'
  });
  const clientB = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${sessionB.session.access_token}` } }
  });

  const unauthClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  // --- TESTS ---
  console.log("\n--- Executing Tests ---");
  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name}`);
      failed++;
    }
  }

  // Test 1: Unauthenticated request gets 0 rows
  const { data: unauthData, error: unauthErr } = await unauthClient.from('student_profiles').select('*');
  assert(!unauthErr && unauthData.length === 0, "Unauthenticated requests get 0 rows from student_profiles");

  // Setup: Inject some dummy data as Admin so we can test RLS
  const { data: examData } = await adminClient.from('exams').insert({ title: 'RLS Test Exam', status: 'published', created_by: userA.user.id /* fake admin */ }).select().single();
  const { data: sessionDataA } = await adminClient.from('exam_sessions').insert({ student_id: userA.user.id, exam_id: examData.id, status: 'in_progress' }).select().single();
  const { data: sessionDataB } = await adminClient.from('exam_sessions').insert({ student_id: userB.user.id, exam_id: examData.id, status: 'in_progress' }).select().single();

  await adminClient.from('student_answers').insert([
    { session_id: sessionDataA.id, student_id: userA.user.id, question_id: '00000000-0000-0000-0000-000000000001' },
    { session_id: sessionDataB.id, student_id: userB.user.id, question_id: '00000000-0000-0000-0000-000000000001' }
  ]);

  // Test 2: Student A cannot read Student B's answers
  const { data: answersA } = await clientA.from('student_answers').select('*');
  assert(answersA.every(a => a.student_id === userA.user.id), "Student A cannot read Student B's answers (Rows are restricted to own ID)");

  // Test 3: Student A cannot read question options (is_correct data)
  // Our RPCs return question options without `is_correct` during exams, and RLS prevents direct access.
  const { data: optionsData, error: optionsErr } = await clientA.from('question_options').select('is_correct');
  assert((optionsData && optionsData.length === 0) || optionsErr, "Student A cannot read any question_options (is_correct) directly");

  // Cleanup
  console.log("\n--- Cleaning up Test Data ---");
  await adminClient.auth.admin.deleteUser(userA.user.id);
  await adminClient.auth.admin.deleteUser(userB.user.id);
  await adminClient.from('exams').delete().eq('id', examData.id);

  console.log(`\nTests Complete: ${passed} Passed, ${failed} Failed.`);
  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
