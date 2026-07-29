import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(url, key);

async function testMonitoring() {
  const { data: exams } = await supabaseAdmin.from('exams').select('id, title').is('deleted_at', null).limit(3);
  if (!exams || exams.length === 0) return console.log('No exams');

  const examId = exams[0].id;
  console.log('Testing examId:', examId, exams[0].title);

  // Fetch enrollments
  const { data: enrollments, error: err1 } = await supabaseAdmin
    .from('exam_enrollments')
    .select('id, student_id')
    .eq('exam_id', examId);

  console.log('Enrollments:', enrollments?.length, err1);

  // Fetch sessions
  const { data: sessions, error: err2 } = await supabaseAdmin
    .from('exam_sessions')
    .select('id, student_id, status, started_at, expires_at, submitted_at, last_synced_at, security_violations')
    .eq('exam_id', examId);

  console.log('Sessions:', sessions?.length, err2);

  const studentIds = Array.from(new Set([
    ...(enrollments?.map(e => e.student_id) || []),
    ...(sessions?.map(s => s.student_id) || [])
  ]));

  console.log('Distinct studentIds count:', studentIds.length);

  const { data: profiles, error: err3 } = studentIds.length > 0
    ? await supabaseAdmin.from('student_profiles').select('user_id, full_name, roll_number').in('user_id', studentIds)
    : { data: [], error: null };

  console.log('Profiles found:', profiles?.length, err3);

  const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

  const studentMap = new Map<string, any>();

  (enrollments || []).forEach((e: any) => {
    const p = profileMap.get(e.student_id);
    studentMap.set(e.student_id, {
      enrolled_id: e.id,
      student_id: e.student_id,
      full_name: p?.full_name || 'Enrolled Student',
      roll_number: p?.roll_number || '—',
      session_id: null,
      status: null,
      started_at: null,
      expires_at: null,
      submitted_at: null,
      last_synced_at: null,
      security_violations: 0,
    });
  });

  (sessions || []).forEach((s: any) => {
    const p = profileMap.get(s.student_id);
    const existing = studentMap.get(s.student_id) || {};
    studentMap.set(s.student_id, {
      enrolled_id: existing.enrolled_id || s.id,
      student_id: s.student_id,
      full_name: p?.full_name || existing.full_name || 'Student',
      roll_number: p?.roll_number || existing.roll_number || '—',
      session_id: s.id,
      status: s.status,
      started_at: s.started_at,
      expires_at: s.expires_at,
      submitted_at: s.submitted_at,
      last_synced_at: s.last_synced_at,
      security_violations: s.security_violations || 0,
    });
  });

  const finalData = Array.from(studentMap.values());
  console.log('Final Monitoring Data Count:', finalData.length);
  console.log('Sample Data:', JSON.stringify(finalData.slice(0, 3), null, 2));
}

testMonitoring();
