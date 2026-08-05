import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error("Missing environment variables");
  process.exit(1);
}

const students = JSON.parse(fs.readFileSync('./performance-tests/students.json', 'utf8'));

async function testSingleLogin(student, label = "Single") {
  console.log(`\n--- Starting Login Test: ${label} (${student.email}) ---`);

  // Stage 1: Validation
  const t0 = performance.now();
  // Zod parsing simulated
  const tValidation = performance.now() - t0;

  // Stage 2: Supabase Auth (signInWithPassword)
  const tAuthStart = performance.now();
  const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
    email: student.email,
    password: student.password,
  });
  const tAuth = performance.now() - tAuthStart;

  if (authError || !authData.session) {
    console.error("Auth Failed:", authError);
    return null;
  }

  const userId = authData.user.id;

  // Stage 3: User Lookup
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const tUserLookupStart = performance.now();
  const { data: userProfile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('id, email, role, status, deleted_at, force_password_change')
    .eq('id', userId)
    .single();
  const tUserLookup = performance.now() - tUserLookupStart;

  // Stage 4: Device Check
  const tDeviceCheckStart = performance.now();
  const { data: profile } = await supabaseAdmin
    .from('student_profiles')
    .select('registered_device_id, registered_device_info')
    .eq('user_id', userId)
    .maybeSingle();
  const tDeviceCheck = performance.now() - tDeviceCheckStart;

  // Stage 5: Active Session Lookup & Update (Termination)
  const tSessionUpdateStart = performance.now();
  const { error: terminateError } = await supabaseAdmin
    .from('active_sessions')
    .update({
      status: 'terminated',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('status', 'active');
  const tSessionUpdate = performance.now() - tSessionUpdateStart;

  // Stage 6: Session Creation
  const tSessionCreationStart = performance.now();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data: newSession, error: sessionError } = await supabaseAdmin
    .from('active_sessions')
    .insert({
      user_id: userId,
      token_hash: 'test_hash_' + Date.now() + Math.random(),
      device_info: student.device_info,
      ip_address: '127.0.0.1',
      status: 'active',
      last_active_at: new Date().toISOString(),
      expires_at: expiresAt,
    })
    .select('id')
    .single();
  const tSessionCreation = performance.now() - tSessionCreationStart;

  // Stage 7: Audit Log Insert (Measuring actual execution time if awaited vs async)
  const tAuditLogStart = performance.now();
  const { error: auditError } = await supabaseAdmin.from('audit_logs').insert({
    actor_id: userId,
    actor_role: userProfile?.role || 'student',
    action: 'student.login',
    resource_type: 'user',
    resource_id: userId,
    metadata: { test: true },
    ip_address: '127.0.0.1',
  });
  const tAuditLog = performance.now() - tAuditLogStart;

  // Stage 8: Cookie Creation
  const tCookie = 0.5;

  const tTotal = tValidation + tAuth + tUserLookup + tDeviceCheck + tSessionUpdate + tSessionCreation + tAuditLog + tCookie;

  const breakdown = {
    Validation: tValidation,
    SupabaseAuth: tAuth,
    UserLookup: tUserLookup,
    DeviceCheck: tDeviceCheck,
    SessionTermination: tSessionUpdate,
    SessionCreation: tSessionCreation,
    AuditLog: tAuditLog,
    CookieCreation: tCookie,
    Total: tTotal,
  };

  console.log(`Validation: ${tValidation.toFixed(1)}ms`);
  console.log(`Supabase Auth: ${tAuth.toFixed(1)}ms`);
  console.log(`User Lookup: ${tUserLookup.toFixed(1)}ms`);
  console.log(`Device Check: ${tDeviceCheck.toFixed(1)}ms`);
  console.log(`Session Termination: ${tSessionUpdate.toFixed(1)}ms`);
  console.log(`Session Creation: ${tSessionCreation.toFixed(1)}ms`);
  console.log(`Audit Log: ${tAuditLog.toFixed(1)}ms`);
  console.log(`Cookie Creation: ${tCookie.toFixed(1)}ms`);
  console.log(`Total: ${tTotal.toFixed(1)}ms`);

  return breakdown;
}

async function runBenchmark() {
  console.log("=== COLD START / FIRST REQUEST MEASUREMENT ===");
  const coldStart = await testSingleLogin(students[0], "Cold Start (Req 1)");

  console.log("\n=== WARM / SUBSEQUENT REQUEST MEASUREMENTS ===");
  const warm1 = await testSingleLogin(students[1], "Warm (Req 2)");
  const warm2 = await testSingleLogin(students[2], "Warm (Req 3)");

  console.log("\n=== CONCURRENT LOGIN SIMULATION (10 Concurrent VUs) ===");
  const tConcStart = performance.now();
  const promises = students.slice(0, 10).map((s, idx) => testSingleLogin(s, `VU ${idx + 1}`));
  const results = await Promise.all(promises);
  const tConcTotal = performance.now() - tConcStart;

  console.log(`\n10 Concurrent Logins Total Wall Time: ${tConcTotal.toFixed(1)}ms`);

  // Calculate averages across 10 concurrent requests
  const validResults = results.filter(Boolean);
  const avg = {
    Validation: validResults.reduce((acc, r) => acc + r.Validation, 0) / validResults.length,
    SupabaseAuth: validResults.reduce((acc, r) => acc + r.SupabaseAuth, 0) / validResults.length,
    UserLookup: validResults.reduce((acc, r) => acc + r.UserLookup, 0) / validResults.length,
    DeviceCheck: validResults.reduce((acc, r) => acc + r.DeviceCheck, 0) / validResults.length,
    SessionTermination: validResults.reduce((acc, r) => acc + r.SessionTermination, 0) / validResults.length,
    SessionCreation: validResults.reduce((acc, r) => acc + r.SessionCreation, 0) / validResults.length,
    AuditLog: validResults.reduce((acc, r) => acc + r.AuditLog, 0) / validResults.length,
    CookieCreation: validResults.reduce((acc, r) => acc + r.CookieCreation, 0) / validResults.length,
    Total: validResults.reduce((acc, r) => acc + r.Total, 0) / validResults.length,
  };

  console.log("\n==============================================");
  console.log("AVERAGE TIMINGS UNDER 10 VU CONCURRENCY:");
  console.log("==============================================");
  console.log(`Validation:          ${avg.Validation.toFixed(1)} ms (${((avg.Validation / avg.Total) * 100).toFixed(1)}%)`);
  console.log(`Supabase Auth:       ${avg.SupabaseAuth.toFixed(1)} ms (${((avg.SupabaseAuth / avg.Total) * 100).toFixed(1)}%)`);
  console.log(`User Lookup:         ${avg.UserLookup.toFixed(1)} ms (${((avg.UserLookup / avg.Total) * 100).toFixed(1)}%)`);
  console.log(`Device Check:        ${avg.DeviceCheck.toFixed(1)} ms (${((avg.DeviceCheck / avg.Total) * 100).toFixed(1)}%)`);
  console.log(`Session Termination: ${avg.SessionTermination.toFixed(1)} ms (${((avg.SessionTermination / avg.Total) * 100).toFixed(1)}%)`);
  console.log(`Session Creation:    ${avg.SessionCreation.toFixed(1)} ms (${((avg.SessionCreation / avg.Total) * 100).toFixed(1)}%)`);
  console.log(`Audit Log:           ${avg.AuditLog.toFixed(1)} ms (${((avg.AuditLog / avg.Total) * 100).toFixed(1)}%)`);
  console.log(`Cookie Creation:     ${avg.CookieCreation.toFixed(1)} ms (${((avg.CookieCreation / avg.Total) * 100).toFixed(1)}%)`);
  console.log(`TOTAL AVERAGE:       ${avg.Total.toFixed(1)} ms`);
  console.log("==============================================");
}

runBenchmark().catch(console.error);
