# AVIORA Examination Portal — Product Requirements Document
**Version:** 1.0  
**Status:** Authoritative — Do Not Deviate Without Review  
**Project:** AVIORA Online Examination Portal  
**Builder:** ZYXEN  
**Stack:** Next.js 14 (App Router) · TypeScript · Supabase · Vercel · TailwindCSS · Dexie.js

---

## ABSOLUTE PRINCIPLES

Before reading anything else, internalize these. Every decision in this document flows from them.

1. **An answer is never lost.** Not for any reason. Not for any failure. This is the highest law of this system.
2. **The server is always the source of truth** for time, session state, and submission validity.
3. **The client is optimistic.** UI updates immediately. Persistence happens asynchronously in the background.
4. **Every failure has a designed response.** Nothing is left to chance or default browser behavior.
5. **Data integrity > Speed > UX.** In that exact order.
6. **No scope creep.** Build exactly what is specified. Nothing more, nothing less.

---

## PART 1 — PROJECT CONTEXT

### 1.1 What This System Is

AVIORA is an online examination portal for an aviation training institute. It allows students to take MCQ-based practice examinations and scheduled live examinations on tablets and desktop computers. Administrators manage students, questions, exams, and view results through a dedicated admin panel.

This is NOT a website. It is NOT an LMS. It is a **high-integrity online examination engine** where the consequences of data loss or system failure directly affect students' academic results. That responsibility defines every architectural and engineering decision.

### 1.2 Business Context

- Client: AVIORA (aviation training institute)
- Builder: ZYXEN
- Current student count: 50–100 concurrent during exams
- Target scale (Phase 1): 300–500 concurrent
- Primary devices: Android tablets, iOS tablets (iPad), Windows/Mac desktops
- Mobile phones: **explicitly prohibited**
- Exam subjects: Multiple aviation subjects (Air Law, Meteorology, Navigation, etc.), each with separate exams

### 1.3 Two Separate Applications

```
aviora.com                          portal.aviora.com
(Marketing Website)                 (Examination Portal)
─────────────────                   ──────────────────────────────────────
Static / ISR Next.js                Dynamic Next.js (App Router)
Content via TinaCMS                 Supabase backend
No database                         Supabase PostgreSQL
Separate Vercel project             Separate Vercel project
SEO-optimized                       Speed & reliability optimized
                     │
                     │  "Student Portal" button redirects here
                     ▼
```

Both applications are **separate Vercel deployments** — one deployment can never affect the other. They share **nothing** at the infrastructure level. The portal has its own Supabase project (Pro plan, $25/month).

### 1.4 Deployment Architecture

```
portal.aviora.com
        │
    Vercel Edge Network
        │
   Next.js Application (Vercel Functions)
        │
   Supabase (Pro Plan)
   ├── PostgreSQL (primary database)
   ├── Auth (JWT-based authentication)
   ├── Storage (private buckets only)
   └── Realtime (not used in Phase 1 — polling only)
```

---

## PART 2 — TECHNOLOGY STACK

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Framework | Next.js | 14.x | App Router, TypeScript, Server Components |
| Language | TypeScript | 5.x | Strict mode enabled. No `any`. |
| Database | Supabase PostgreSQL | Latest | Row Level Security enforced on every table |
| Auth | Supabase Auth | Latest | JWT + custom active_sessions table |
| Storage | Supabase Storage | Latest | All buckets private, signed URLs only |
| Hosting | Vercel | Latest | Pro plan recommended |
| Styling | Tailwind CSS | 3.x | No CSS-in-JS. Utility classes only. |
| Local DB | Dexie.js | 3.x | IndexedDB abstraction for offline exam state |
| Validation | Zod | Latest | Schema validation on all API inputs and outputs |
| State | Zustand | Latest | Minimal global state (auth, exam session) |
| HTTP Client | Native fetch | — | No Axios. Use Next.js route handlers. |
| Date/Time | date-fns | Latest | All dates in ISO 8601. Never use `new Date(string)` on Safari with non-ISO formats. |

---

## PART 3 — SYSTEM ARCHITECTURE

### 3.1 Repository Structure

```
aviora-portal/                          (single repository, single Vercel project)
├── src/
│   ├── app/                            (Next.js App Router)
│   │   ├── (auth)/                     (route group — no layout wrapping)
│   │   │   ├── login/
│   │   │   └── change-password/
│   │   ├── (student)/                  (route group — student layout)
│   │   │   ├── dashboard/
│   │   │   ├── exam/
│   │   │   │   ├── [sessionId]/        (active exam interface)
│   │   │   │   └── result/[sessionId]/ (result & review screen)
│   │   │   └── profile/
│   │   ├── (admin)/                    (route group — admin layout)
│   │   │   ├── students/
│   │   │   ├── batches/
│   │   │   ├── question-banks/
│   │   │   │   └── [bankId]/questions/
│   │   │   ├── exams/
│   │   │   │   └── [examId]/
│   │   │   ├── monitoring/
│   │   │   └── reports/
│   │   └── api/                        (Next.js Route Handlers)
│   │       ├── auth/
│   │       ├── student/
│   │       ├── exam/
│   │       │   ├── start/
│   │       │   ├── sync/
│   │       │   └── submit/
│   │       ├── admin/
│   │       └── result/
│   ├── components/
│   │   ├── exam/                       (exam engine components)
│   │   ├── admin/                      (admin panel components)
│   │   ├── student/                    (student portal components)
│   │   └── ui/                         (shared primitive components)
│   ├── lib/
│   │   ├── supabase/                   (client and server Supabase instances)
│   │   ├── db/                         (Dexie.js IndexedDB schema & operations)
│   │   ├── exam/                       (exam engine logic)
│   │   │   ├── randomizer.ts
│   │   │   ├── timer.ts
│   │   │   ├── sync-engine.ts
│   │   │   └── result-calculator.ts
│   │   ├── security/                   (anti-cheat, device detection)
│   │   ├── auth/                       (auth utilities, session management)
│   │   └── validators/                 (Zod schemas)
│   ├── hooks/                          (React hooks)
│   ├── stores/                         (Zustand stores)
│   ├── types/                          (TypeScript interfaces)
│   └── middleware.ts                   (Vercel middleware — auth, device detection, rate limiting)
├── supabase/
│   ├── migrations/                     (ordered SQL migration files)
│   └── seed.sql                        (development seed data)
└── public/
```

### 3.2 Routing and Access Control

| Route Pattern | Accessible By | Auth Check | Notes |
|---|---|---|---|
| `/login` | Unauthenticated only | Redirect to dashboard if logged in | |
| `/change-password` | First-login students | Force redirect if `force_password_change = true` | |
| `/dashboard` | Students only | Redirect to login if not authenticated | |
| `/exam/[sessionId]` | Student who owns session | Server-side ownership check | |
| `/exam/result/[sessionId]` | Student who owns session | Server-side ownership check | |
| `/profile` | Authenticated students | — | |
| `/admin/*` | Admin/super_admin roles only | Role check in middleware | |
| `/(any)` on mobile | Nobody | Device check in middleware | Redirect to device-blocked page |

### 3.3 Middleware Execution Order

Every request through the portal passes through `middleware.ts` in this exact order:

1. **Device Detection** — if mobile detected → redirect to `/device-blocked` (no exceptions)
2. **Authentication Check** — verify JWT validity
3. **Force Password Change** — if `force_password_change = true` and not on `/change-password` → redirect to `/change-password`
4. **Active Session Check** — verify user has an active row in `active_sessions`
5. **Role Authorization** — verify role matches route group
6. **Rate Limiting** — check request rate per IP and per user

---

## PART 4 — DATABASE SCHEMA

### 4.1 Design Principles

- **All primary keys are UUIDs** (`gen_random_uuid()`). Never sequential integers. This prevents IDOR attacks.
- **All timestamps are `timestamptz`** (with timezone). Always stored in UTC. Displayed in local time on client.
- **Soft deletes everywhere.** Every table has `deleted_at timestamptz NULL`. Hard deletes are never performed in application code.
- **Row Level Security is enabled on every table** from the moment it is created. Default policy: deny all. Explicit policies grant specific access.
- **Audit log writes on every meaningful mutation.** Handled via database triggers and application code.
- **No tenant_id.** AVIORA is a single-client system. A separate Supabase project will be created for any future client.

### 4.2 Complete Table Definitions

---

#### TABLE: `users`

The universal identity table. Every person in the system is a user, regardless of role.

```sql
CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text UNIQUE NOT NULL,
  role            text NOT NULL CHECK (role IN ('student', 'admin', 'super_admin')),
  status          text NOT NULL DEFAULT 'active' 
                    CHECK (status IN ('active', 'suspended', 'deactivated')),
  force_password_change boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz NULL
);

-- Indexes
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_status ON users(status) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Students can read their own record only
CREATE POLICY "students_read_own" ON users
  FOR SELECT TO authenticated
  USING (id = auth.uid() AND role = 'student');

-- Admins can read all non-deleted users
CREATE POLICY "admins_read_all" ON users
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'super_admin') 
      AND u.deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

-- Only admins can insert/update/soft-delete
CREATE POLICY "admins_write" ON users
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'super_admin') 
      AND u.deleted_at IS NULL
    )
  );

-- Students can update their own password (via force_password_change flow)
CREATE POLICY "students_update_own_password_flag" ON users
  FOR UPDATE TO authenticated
  USING (id = auth.uid() AND role = 'student')
  WITH CHECK (id = auth.uid() AND role = 'student');
```

**Business Rules:**
- `force_password_change` is set to `true` when admin creates an account or resets a password. When student changes their password, it is set to `false`.
- A user with `status = 'suspended'` cannot log in — checked in application middleware, not just RLS.
- `deleted_at` is set when admin "deletes" a student. The Supabase Auth user is NOT deleted (to preserve historical data). The application checks `deleted_at` on login.

---

#### TABLE: `student_profiles`

Extended profile information for students only.

```sql
CREATE TABLE student_profiles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name       text NOT NULL,
  roll_number     text NOT NULL UNIQUE,
  batch_id        uuid NULL REFERENCES batches(id) ON DELETE SET NULL,
  photo_url       text NULL,
  phone           text NULL,
  metadata        jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz NULL
);

-- Indexes
CREATE INDEX idx_student_profiles_user_id ON student_profiles(user_id);
CREATE INDEX idx_student_profiles_roll_number ON student_profiles(roll_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_student_profiles_batch_id ON student_profiles(batch_id) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students_read_own_profile" ON student_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "admins_full_access_profiles" ON student_profiles
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'super_admin') 
      AND u.deleted_at IS NULL
    )
  );
```

---

#### TABLE: `batches`

Named groupings of students. Used for assigning exams to groups.

```sql
CREATE TABLE batches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  description     text NULL,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz NULL
);

-- Indexes
CREATE INDEX idx_batches_status ON batches(status) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students_read_active_batches" ON batches
  FOR SELECT TO authenticated
  USING (status = 'active' AND deleted_at IS NULL);

CREATE POLICY "admins_full_access_batches" ON batches
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'super_admin') 
      AND u.deleted_at IS NULL
    )
  );
```

---

#### TABLE: `question_banks`

Containers for questions, organized by subject.

```sql
CREATE TABLE question_banks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  subject         text NOT NULL,
  description     text NULL,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by      uuid NOT NULL REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz NULL
);

-- Indexes
CREATE INDEX idx_question_banks_subject ON question_banks(subject) WHERE deleted_at IS NULL;
CREATE INDEX idx_question_banks_status ON question_banks(status) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE question_banks ENABLE ROW LEVEL SECURITY;

-- Students cannot access question banks directly
CREATE POLICY "admins_full_access_banks" ON question_banks
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'super_admin') 
      AND u.deleted_at IS NULL
    )
  );
```

---

#### TABLE: `questions`

Individual questions belonging to a question bank.

```sql
CREATE TABLE questions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id         uuid NOT NULL REFERENCES question_banks(id) ON DELETE RESTRICT,
  content         text NOT NULL,
  type            text NOT NULL DEFAULT 'mcq' CHECK (type IN ('mcq')),
  difficulty      text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  subject         text NOT NULL,
  topic           text NULL,
  tags            text[] NOT NULL DEFAULT '{}',
  explanation     text NULL,
  metadata        jsonb NOT NULL DEFAULT '{}',
  created_by      uuid NOT NULL REFERENCES users(id),
  updated_by      uuid NOT NULL REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz NULL
);

-- Indexes
CREATE INDEX idx_questions_bank_id ON questions(bank_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_questions_subject ON questions(subject) WHERE deleted_at IS NULL;
CREATE INDEX idx_questions_difficulty ON questions(difficulty) WHERE deleted_at IS NULL;
CREATE INDEX idx_questions_tags ON questions USING GIN(tags);

-- RLS
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- Students CANNOT read questions directly — they receive them only through exam sessions
CREATE POLICY "admins_full_access_questions" ON questions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'super_admin') 
      AND u.deleted_at IS NULL
    )
  );
```

**Critical Note:** The `explanation` field stores why the correct answer is correct — displayed to students on the answer review screen after submission. This is mandatory for every question.

---

#### TABLE: `question_options`

Answer options for each question. Separated from questions for clean randomization.

```sql
CREATE TABLE question_options (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id     uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  content         text NOT NULL,
  is_correct      boolean NOT NULL DEFAULT false,
  display_order   smallint NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_question_options_question_id ON question_options(question_id);

-- Constraint: exactly one correct option per question
-- This is enforced at application level during question creation.
-- A partial unique index helps as a database safety net:
CREATE UNIQUE INDEX idx_question_options_one_correct 
  ON question_options(question_id) WHERE is_correct = true;

-- RLS
ALTER TABLE question_options ENABLE ROW LEVEL SECURITY;

-- Students CANNOT read options directly
CREATE POLICY "admins_full_access_options" ON question_options
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'super_admin') 
      AND u.deleted_at IS NULL
    )
  );
```

**CRITICAL DESIGN RULE:** The correct answer is ALWAYS identified by `option UUID`, never by position ('A', 'B', 'C', 'D'). When options are randomized, their UUIDs remain constant. The evaluation logic compares `student_answers.selected_option_id` against `question_options.id WHERE is_correct = true`. Never compare against position letters.

---

#### TABLE: `exams`

Each exam record. Covers both practice and scheduled exams.

```sql
CREATE TABLE exams (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id         uuid NOT NULL REFERENCES question_banks(id) ON DELETE RESTRICT,
  title           text NOT NULL,
  subject         text NOT NULL,
  description     text NULL,
  instructions    text NULL,
  type            text NOT NULL CHECK (type IN ('practice', 'scheduled')),
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  total_questions integer NOT NULL CHECK (total_questions > 0),
  marks_per_question numeric(5,2) NOT NULL DEFAULT 1.0,
  negative_marks  numeric(5,2) NOT NULL DEFAULT 0.0,
  passing_marks   numeric(7,2) NULL,
  status          text NOT NULL DEFAULT 'draft' 
                    CHECK (status IN ('draft', 'scheduled', 'active', 'completed', 'archived')),
  scheduled_at    timestamptz NULL,
  ends_at         timestamptz NULL,
  settings        jsonb NOT NULL DEFAULT '{
    "randomize_questions": true,
    "randomize_options": true,
    "fullscreen_required": true,
    "max_tab_switches": 5,
    "auto_submit_on_max_violations": false,
    "show_result_immediately": true,
    "allow_question_review": true,
    "show_leaderboard_after": "exam_end",
    "watermark_enabled": true
  }',
  created_by      uuid NOT NULL REFERENCES users(id),
  updated_by      uuid NOT NULL REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz NULL
);

-- Indexes
CREATE INDEX idx_exams_type ON exams(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_exams_status ON exams(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_exams_scheduled_at ON exams(scheduled_at) WHERE deleted_at IS NULL AND type = 'scheduled';
CREATE INDEX idx_exams_subject ON exams(subject) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

-- Students can only see active/completed exams they are enrolled in
-- (actual read done through exam_enrollments join — but as a safety net:)
CREATE POLICY "students_read_active_exams" ON exams
  FOR SELECT TO authenticated
  USING (
    status IN ('active', 'completed')
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'student'
    )
  );

CREATE POLICY "admins_full_access_exams" ON exams
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'super_admin') 
      AND u.deleted_at IS NULL
    )
  );
```

**Settings JSONB Fields — Complete Reference:**

| Field | Type | Default | Description |
|---|---|---|---|
| `randomize_questions` | boolean | true | Shuffle question order per student |
| `randomize_options` | boolean | true | Shuffle option order per student |
| `fullscreen_required` | boolean | true | Enforce fullscreen on exam start |
| `max_tab_switches` | integer | 5 | Violations before auto-submit (0 = unlimited) |
| `auto_submit_on_max_violations` | boolean | false | Whether hitting max triggers auto-submit |
| `show_result_immediately` | boolean | true | Show result immediately after submission |
| `allow_question_review` | boolean | true | Allow answer review after submission |
| `show_leaderboard_after` | string | "exam_end" | "submission" or "exam_end" |
| `watermark_enabled` | boolean | true | Show dynamic watermark overlay |

---

#### TABLE: `exam_questions`

Permanent snapshot of which questions are in an exam. Created when exam is published. Never modified after creation.

```sql
CREATE TABLE exam_questions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id         uuid NOT NULL REFERENCES exams(id) ON DELETE RESTRICT,
  question_id     uuid NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  base_order      smallint NOT NULL,
  marks           numeric(5,2) NOT NULL DEFAULT 1.0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_exam_questions_exam_id ON exam_questions(exam_id);
CREATE UNIQUE INDEX idx_exam_questions_unique ON exam_questions(exam_id, question_id);

-- RLS
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;

-- Students cannot access this table directly
CREATE POLICY "admins_full_access_exam_questions" ON exam_questions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'super_admin') 
      AND u.deleted_at IS NULL
    )
  );
```

---

#### TABLE: `exam_enrollments`

Controls which students can access which exams.

```sql
CREATE TABLE exam_enrollments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id         uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrolled_by     uuid NOT NULL REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_exam_enrollments_exam_id ON exam_enrollments(exam_id);
CREATE INDEX idx_exam_enrollments_student_id ON exam_enrollments(student_id);
CREATE UNIQUE INDEX idx_exam_enrollments_unique ON exam_enrollments(exam_id, student_id);

-- RLS
ALTER TABLE exam_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students_read_own_enrollments" ON exam_enrollments
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "admins_full_access_enrollments" ON exam_enrollments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'super_admin') 
      AND u.deleted_at IS NULL
    )
  );
```

---

#### TABLE: `exam_sessions`

The most critical table. One row per student per exam attempt.

```sql
CREATE TABLE exam_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id             uuid NOT NULL REFERENCES exams(id) ON DELETE RESTRICT,
  student_id          uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status              text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'submitted', 'expired', 'terminated')),
  started_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL,
  submitted_at        timestamptz NULL,
  last_synced_at      timestamptz NULL,
  question_order      jsonb NOT NULL DEFAULT '[]',
  option_orders       jsonb NOT NULL DEFAULT '{}',
  submission_token    uuid NOT NULL DEFAULT gen_random_uuid(),
  device_info         jsonb NOT NULL DEFAULT '{}',
  ip_address          inet NULL,
  security_violations integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_exam_sessions_student_id ON exam_sessions(student_id);
CREATE INDEX idx_exam_sessions_exam_id ON exam_sessions(exam_id);
CREATE INDEX idx_exam_sessions_status ON exam_sessions(status);
CREATE INDEX idx_exam_sessions_expires_at ON exam_sessions(expires_at) WHERE status = 'active';

-- Constraint: one active/submitted session per student per exam
CREATE UNIQUE INDEX idx_exam_sessions_one_active 
  ON exam_sessions(exam_id, student_id) 
  WHERE status IN ('active', 'submitted');

-- RLS
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students_read_own_sessions" ON exam_sessions
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "students_update_own_active_sessions" ON exam_sessions
  FOR UPDATE TO authenticated
  USING (student_id = auth.uid() AND status = 'active')
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "admins_full_access_sessions" ON exam_sessions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'super_admin') 
      AND u.deleted_at IS NULL
    )
  );
```

**`question_order` format:**
```json
["uuid-q1", "uuid-q5", "uuid-q17", "uuid-q3", ...]
```
Array of question IDs in the randomized order for this specific student. Generated once at session creation. Immutable.

**`option_orders` format:**
```json
{
  "uuid-q1": ["uuid-opt-b", "uuid-opt-d", "uuid-opt-a", "uuid-opt-c"],
  "uuid-q5": ["uuid-opt-c", "uuid-opt-a", "uuid-opt-d", "uuid-opt-b"],
  ...
}
```
Map of question_id → array of option IDs in randomized order for this student. Generated once. Immutable.

**`device_info` format:**
```json
{
  "user_agent": "Mozilla/5.0...",
  "screen_width": 1280,
  "screen_height": 800,
  "device_type": "tablet",
  "os": "Android",
  "browser": "Chrome"
}
```

---

#### TABLE: `student_answers`

One row per student per question per session. Upserted on each autosave.

```sql
CREATE TABLE student_answers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          uuid NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  question_id         uuid NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  selected_option_id  uuid NULL REFERENCES question_options(id) ON DELETE RESTRICT,
  is_marked_for_review boolean NOT NULL DEFAULT false,
  is_visited          boolean NOT NULL DEFAULT false,
  time_spent_seconds  integer NOT NULL DEFAULT 0,
  answered_at         timestamptz NULL,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_student_answers_session_id ON student_answers(session_id);
CREATE INDEX idx_student_answers_question_id ON student_answers(question_id);
CREATE UNIQUE INDEX idx_student_answers_unique ON student_answers(session_id, question_id);

-- RLS
ALTER TABLE student_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students_read_own_answers" ON student_answers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM exam_sessions es 
      WHERE es.id = session_id AND es.student_id = auth.uid()
    )
  );

CREATE POLICY "students_upsert_own_answers" ON student_answers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM exam_sessions es 
      WHERE es.id = session_id 
      AND es.student_id = auth.uid() 
      AND es.status = 'active'
    )
  );

CREATE POLICY "admins_read_all_answers" ON student_answers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'super_admin') 
      AND u.deleted_at IS NULL
    )
  );
```

---

#### TABLE: `exam_results`

Computed once on submission. Never recomputed on page load.

```sql
CREATE TABLE exam_results (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL UNIQUE REFERENCES exam_sessions(id) ON DELETE RESTRICT,
  exam_id         uuid NOT NULL REFERENCES exams(id) ON DELETE RESTRICT,
  student_id      uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  total_score     numeric(7,2) NOT NULL,
  max_score       numeric(7,2) NOT NULL,
  percentage      numeric(5,2) NOT NULL,
  correct_count   integer NOT NULL,
  incorrect_count integer NOT NULL,
  unanswered_count integer NOT NULL,
  time_taken_seconds integer NOT NULL,
  is_passed       boolean NULL,
  computed_at     timestamptz NOT NULL DEFAULT now(),
  result_data     jsonb NOT NULL DEFAULT '{}'
);

-- Indexes
CREATE INDEX idx_exam_results_student_id ON exam_results(student_id);
CREATE INDEX idx_exam_results_exam_id ON exam_results(exam_id);
CREATE INDEX idx_exam_results_session_id ON exam_results(session_id);
CREATE INDEX idx_exam_results_percentage ON exam_results(percentage);

-- RLS
ALTER TABLE exam_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students_read_own_results" ON exam_results
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "admins_read_all_results" ON exam_results
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'super_admin') 
      AND u.deleted_at IS NULL
    )
  );

-- Only server-side (service role) can insert results
-- Application inserts via API route using service role key
```

**`result_data` format:**
```json
{
  "questions": [
    {
      "question_id": "uuid",
      "question_content": "What is...",
      "selected_option_id": "uuid-or-null",
      "selected_option_content": "Paris",
      "correct_option_id": "uuid",
      "correct_option_content": "London",
      "is_correct": false,
      "is_unanswered": false,
      "marks_awarded": -0.25,
      "explanation": "London is the capital because...",
      "time_spent_seconds": 42
    }
  ]
}
```

---

#### TABLE: `security_events`

Log of all anti-cheating events during an exam.

```sql
CREATE TABLE security_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  student_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type  text NOT NULL CHECK (event_type IN (
    'fullscreen_exit',
    'tab_switch',
    'focus_loss',
    'right_click_attempt',
    'keyboard_shortcut_blocked',
    'copy_attempt',
    'paste_attempt',
    'context_menu_blocked'
  )),
  duration_seconds integer NULL,
  event_data  jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_security_events_session_id ON security_events(session_id);
CREATE INDEX idx_security_events_student_id ON security_events(student_id);
CREATE INDEX idx_security_events_event_type ON security_events(event_type);
CREATE INDEX idx_security_events_occurred_at ON security_events(occurred_at);

-- RLS
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Students can insert their own events (via API route)
-- Students cannot read events (no self-monitoring)
CREATE POLICY "admins_read_all_security_events" ON security_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'super_admin') 
      AND u.deleted_at IS NULL
    )
  );
```

---

#### TABLE: `active_sessions`

Enforces single-device login. One active row per user at any time.

```sql
CREATE TABLE active_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      text NOT NULL,
  device_info     jsonb NOT NULL DEFAULT '{}',
  ip_address      inet NULL,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'terminated')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_active_at  timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL
);

-- Indexes
CREATE INDEX idx_active_sessions_user_id ON active_sessions(user_id) WHERE status = 'active';
CREATE INDEX idx_active_sessions_token_hash ON active_sessions(token_hash) WHERE status = 'active';
CREATE INDEX idx_active_sessions_expires_at ON active_sessions(expires_at) WHERE status = 'active';

-- RLS
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_active_session" ON active_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND status = 'active');

-- Only service role (API routes) manages active sessions
```

---

#### TABLE: `audit_logs`

Immutable append-only log of every meaningful action.

```sql
CREATE TABLE audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_role      text NOT NULL,
  action          text NOT NULL,
  resource_type   text NOT NULL,
  resource_id     uuid NULL,
  metadata        jsonb NOT NULL DEFAULT '{}',
  ip_address      inet NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs
CREATE POLICY "admins_read_audit_logs" ON audit_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'super_admin') 
      AND u.deleted_at IS NULL
    )
  );

-- Only service role can insert (no direct row writes from client)
```

**Standard Audit Actions:**

| Action | Resource Type | When |
|---|---|---|
| `student.login` | user | Student logs in |
| `student.logout` | user | Student logs out |
| `student.login_denied_device` | user | Login blocked (mobile) |
| `student.session_terminated` | active_session | Old session terminated on new login |
| `student.password_changed` | user | Student changes password |
| `admin.password_reset` | user | Admin resets student password |
| `admin.student_created` | user | Admin creates student account |
| `admin.student_suspended` | user | Admin suspends student |
| `exam.session_created` | exam_session | Student starts exam |
| `exam.session_submitted` | exam_session | Student submits exam |
| `exam.session_auto_submitted` | exam_session | Exam auto-submits on timer |
| `exam.session_expired` | exam_session | Exam session expired (student didn't submit) |
| `admin.question_created` | question | Admin creates question |
| `admin.question_edited` | question | Admin edits question |
| `admin.exam_published` | exam | Admin publishes exam |
| `admin.exam_archived` | exam | Admin archives exam |
| `admin.result_published` | exam | Admin publishes results |

---

## PART 5 — AUTHENTICATION & SESSION MANAGEMENT

### 5.1 Login Flow

```
1. Student submits email + password on /login

2. Server-side API route (/api/auth/login):
   a. Rate limit check: max 5 attempts per IP per 15 minutes
   b. Validate input with Zod schema
   c. Call Supabase Auth signInWithPassword()
   d. If failed: increment rate limit counter, return generic error 
      ("Invalid credentials") — never reveal which field was wrong
   e. If succeeded:
      i.  Fetch user record from users table
      ii. Check user.status — if 'suspended' or 'deactivated': 
          sign out immediately, return "Account suspended. Contact admin."
      iii.Check user.deleted_at — if not null: same as above
      iv. Terminate all existing active_sessions for this user
      v.  Create new active_sessions row
      vi. Write audit log: student.login
      vii.Return session data + force_password_change flag

3. Client receives response:
   a. If force_password_change = true: redirect to /change-password
   b. If role = 'student': redirect to /dashboard
   c. If role = 'admin' or 'super_admin': redirect to /admin/students

4. All subsequent requests pass JWT in Authorization header (Supabase handles this via client library)
```

### 5.1a Token Refresh Handling

When Supabase SSR refreshes an expired access token, middleware must update the user's active `active_sessions.token_hash` to the hash of the new access token (looked up by user_id, since only one active row exists per user), rather than treating the refresh as a session termination.

### 5.2 Single Device Enforcement

When a student logs in from Tablet B while an active session exists from Tablet A:

```
1. Login on Tablet B completes Supabase Auth successfully
2. API route finds existing active active_sessions rows for this user
3. All existing rows set to status = 'terminated'
4. New active_sessions row created for Tablet B
5. Tablet A's next API call (autosave, sync):
   - Middleware checks active_sessions for this token_hash
   - Finds no active row (was terminated)
   - Returns HTTP 401 with code: 'SESSION_TERMINATED'
6. Tablet A's exam interface shows overlay:
   "Your session was terminated because you logged in on another device.
    Your answers up to your last sync have been saved. Contact admin if this was unexpected."
7. Tablet A redirected to /login after 5 seconds
```

### 5.3 Force Password Change Flow

```
1. Admin creates account with temporary password
2. user.force_password_change = true is set in database
3. Student logs in successfully
4. Middleware detects force_password_change = true
5. All routes except /change-password redirect to /change-password
6. Student enters and confirms new password (min 8 chars, complexity rules)
7. Password updated via Supabase Auth
8. user.force_password_change = false updated in users table
9. Student redirected to /dashboard
```

### 5.4 Student Password Change (Self-Service)

Students can change their own password from their profile page at any time.

```
1. Student goes to /profile
2. Clicks "Change Password"
3. Enters current password + new password + confirm new password
4. API route validates current password via re-authentication
5. If valid: update password, write audit log
6. Return success
```

No email involved. No tokens. No external services. Simple, direct, cost-free.

### 5.5 Admin Password Reset

```
1. Admin goes to student record in admin panel
2. Clicks "Reset Password"
3. Admin enters a new temporary password (or system generates one)
4. API route updates Supabase Auth password
5. Sets user.force_password_change = true
6. Writes audit log: admin.password_reset
7. Admin communicates new password to student directly (out of band — WhatsApp, phone, in-person)
8. On next student login, force password change flow triggers
```

---

## PART 6 — DEVICE DETECTION & ACCESS CONTROL

### 6.1 Detection Logic

Executed in `middleware.ts` on every request to the portal, and also as a client-side check on page mount.

**Detection criteria (all evaluated together):**

```typescript
function detectDevice(request: Request): 'mobile' | 'tablet' | 'desktop' {
  const ua = request.headers.get('user-agent') || '';
  const width = /* extracted from viewport hint headers or client-reported */ 0;
  
  const isMobileUA = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isTabletUA = /iPad|Android.*Tablet|Tablet.*Android/i.test(ua);
  
  // Android phones vs tablets — tablets usually have larger viewport
  // On server, we rely on UA. On client, we use screen width.
  
  if (isTabletUA) return 'tablet';
  if (isMobileUA && !isTabletUA) return 'mobile';
  return 'desktop';
}
```

**Client-side check (runs on layout mount):**
```typescript
// More reliable than UA alone
const isPhone = (
  window.screen.width < 768 &&
  window.matchMedia('(pointer: coarse)').matches &&
  !window.matchMedia('(min-width: 768px)').matches
);
```

### 6.2 Mobile Blocking Behavior

If device is detected as phone:
- Redirect to `/device-blocked` page
- Page shows: clear message that examinations require a tablet or computer
- No portal content, no login form, no navigation
- Check re-runs on resize — if user rotates to landscape, recheck (do not unblock just for landscape)

### 6.3 Minimum Supported Viewport

- Minimum width: **768px** (portrait tablet)
- All UI must be fully functional and readable at 768px
- Tested breakpoints: 768px, 1024px, 1280px, 1440px

---

## PART 7 — STUDENT PORTAL

### 7.1 Dashboard (`/dashboard`)

**Data loaded on mount (single API call, precomputed):**
- Student profile (name, roll number, batch)
- Upcoming scheduled exams (enrolled, not yet started, within 48 hours)
- All scheduled exams student is enrolled in (past + upcoming)
- Available practice exams (by subject)
- Recent results (last 5, with score and date)

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ AVIORA Portal        [Student Name]    [Logout]      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Welcome back, [Name]                                │
│                                                      │
│  ┌─────────────────────┐  ┌────────────────────────┐│
│  │  UPCOMING EXAM      │  │  RECENT RESULTS        ││
│  │  [Exam Title]       │  │  Air Law Practice  73% ││
│  │  [Date & Time]      │  │  Navigation Mock   81% ││
│  │  [Duration]         │  │  Meteorology       69% ││
│  │  [Start Exam →]     │  │  [View All →]          ││
│  └─────────────────────┘  └────────────────────────┘│
│                                                      │
│  PRACTICE EXAMS                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Air Law  │ │ Meteoro..│ │Navigatio.│ │ POF    │ │
│  │ 40 Qs   │ │ 40 Qs   │ │ 40 Qs   │ │ 40 Qs  │ │
│  │ 45 min  │ │ 45 min  │ │ 45 min  │ │ 45 min │ │
│  │[Start →]│ │[Start →]│ │[Start →]│ │[Start→]│ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Performance requirement:** Dashboard must load in under 1 second on the target network. Analytics are precomputed and stored, not computed live.

### 7.2 Results History (`/results`)

List of all exams the student has taken with:
- Exam title
- Date taken
- Score and percentage
- Pass/Fail status
- Link to detailed review

### 7.3 Profile (`/profile`)

Displays:
- Profile photo (if uploaded)
- Full name, roll number, batch
- Change Password form

---

## PART 8 — EXAM ENGINE

### 8.1 Pre-Exam Checks (Server-Side, on "Start Exam" click)

All checks executed in a single API call before creating session:

1. **Enrollment check:** Student enrolled in this exam?
2. **Exam status check:** Exam is `active`?
3. **Time window check:** For scheduled exams — `now()` is between `scheduled_at` and `ends_at`?
4. **Existing session check:** Does an `active` or `submitted` session already exist for this student+exam? If `submitted`: show "Already submitted" message. If `active`: return existing session (recovery flow).
5. **Student status check:** Student account is active?

If all pass → proceed to session creation. If any fail → return specific error code.

### 8.2 Session Creation (Server-Side)

Everything wrapped in a PostgreSQL transaction:

```
BEGIN;
  1. Apply Fisher-Yates shuffle to question IDs from exam_questions
     (filtered to this exam, sorted by base_order, then shuffled)
  
  2. For each question, apply Fisher-Yates shuffle to its option IDs
     from question_options table
  
  3. INSERT into exam_sessions:
     - started_at = now()
     - expires_at = now() + (duration_minutes * INTERVAL '1 minute')
     - question_order = shuffled array of question IDs
     - option_orders = map of question_id → shuffled option IDs
     - submission_token = gen_random_uuid()
     - status = 'active'
  
  4. INSERT initial visited/answered state into student_answers:
     - One row per question, session_id set, all NULLs for answers
     - is_visited = false for all
  
  5. Write audit log: exam.session_created
COMMIT;
```

**What is returned to client:**
```json
{
  "session": {
    "id": "uuid",
    "exam_id": "uuid",
    "started_at": "2024-01-15T10:00:00.000Z",
    "expires_at": "2024-01-15T11:30:00.000Z",
    "submission_token": "uuid",
    "status": "active"
  },
  "exam": {
    "title": "Air Law Practice",
    "duration_minutes": 90,
    "settings": { ... }
  },
  "questions": [
    {
      "id": "uuid-q5",
      "content": "What does METAR stand for?",
      "options": [
        { "id": "uuid-opt-b", "content": "Meteorological Aerodrome Report" },
        { "id": "uuid-opt-d", "content": "Meteorological Air Terminal Report" },
        { "id": "uuid-opt-a", "content": "Meteorological Aviation Report" },
        { "id": "uuid-opt-c", "content": "Meteorological Aerodrome Routine" }
      ]
    }
  ],
  "server_time": "2024-01-15T10:00:00.000Z"
}
```

**CRITICAL:** The options array is already in the randomized order for this student. The correct answer is NOT indicated in this response. Clients never know which option is correct.

### 8.3 IndexedDB Storage (Client-Side, Immediate)

The moment session data is received, write ALL of it to IndexedDB via Dexie.js:

```typescript
// Dexie schema (simplified)
const db = new Dexie('AviosaExamDB');
db.version(1).stores({
  activeSession: '&session_id, exam_id, status, expires_at',
  questions: '&question_id, session_id',
  answers: '[session_id+question_id], sync_status',
  syncQueue: '++id, session_id, created_at',
  securityEvents: '++id, session_id, synced'
});
```

After writing, render the exam interface immediately. No loading state after this point.

### 8.4 Clock Offset Calculation

```typescript
const serverTime = new Date(response.server_time).getTime();
const clientTime = Date.now();
const clockOffset = serverTime - clientTime; // Store this

// Timer calculation (run every second)
function getTimeRemaining(): number {
  const expiresAt = new Date(session.expires_at).getTime();
  const adjustedNow = Date.now() + clockOffset;
  return Math.max(0, expiresAt - adjustedNow);
}
```

### 8.5 Exam Interface Layout

```
┌────────────────────────────────────────────────────────────────────┐
│ Air Law Exam              [Watermark overlay, semi-transparent]     │
│ Question 23 of 40                          ⏱ 01:12:34              │
├─────────────────────────────────────────────┬──────────────────────┤
│                                              │  Question Grid       │
│  23. Which authority is responsible for...  │  ┌──────────────┐    │
│                                              │  │1  2  3  4  5 │    │
│  ○ A  International Civil Aviation...        │  │●  ○  ●  ■  ○ │    │
│  ○ B  Federal Aviation Administration       │  │6  7  8  9 10 │    │
│  ● C  International Air Transport...        │  │○  ■  ○  ●  ○ │    │
│  ○ D  Civil Aviation Safety Authority       │  │...            │    │
│                                              │  └──────────────┘    │
│  [■ Mark for Review]                        │                      │
│                                              │  ● Answered          │
│                                              │  ○ Unanswered        │
│  ┌──────────────────────────────────────┐   │  ■ Review            │
│  │ [← Prev]              [Next →]       │   │  ○ Not Visited       │
│  └──────────────────────────────────────┘   │                      │
│                                              │  [Submit Exam]       │
├────────────────────────────────────────────────────────────────────┤
│ 💾 Saving...  (subtle status indicator, bottom left)               │
└────────────────────────────────────────────────────────────────────┘
```

### 8.6 Answer Selection — Optimistic UI

When student selects an option:

```
STEP 1 (synchronous, same render frame):
  → Update React state: selectedOption = option.id
  → UI re-renders: option highlighted, question marked as "Answered" in grid

STEP 2 (immediate, next microtask):
  → Write to Dexie IndexedDB:
    answers.put({ session_id, question_id, selected_option_id, sync_status: 'local', updated_at: now() })

STEP 3 (no network call made yet):
  → Answer added to pendingSyncQueue in memory

ZERO loading state. ZERO latency. Student experience is instant.
```

### 8.7 Autosave Batch Sync

A background service running independently of the UI, triggered every 25 seconds:

```
1. Collect all answers where sync_status = 'local' or 'failed' from Dexie
2. If queue is empty: skip
3. Set sync_status = 'pending' for collected answers in Dexie
4. Generate a sync_id (UUID)
5. POST to /api/exam/sync:
   {
     session_id,
     sync_id,
     answers: [{ question_id, selected_option_id, is_marked_for_review, updated_at }]
   }

6a. SUCCESS (200 OK):
    → Mark synced answers as sync_status = 'synced' in Dexie
    → Update last_synced_at in exam_sessions (server does this)
    → Update UI sync indicator to "Saved"

6b. FAILURE (any error):
    → Mark answers back to sync_status = 'failed' in Dexie
    → Will retry on next 25-second interval
    → Update UI sync indicator to "Offline" (subtle)
    → Log to console (not shown to student as error)
```

**Idempotency:** The server stores `sync_id` and if the same `sync_id` is received twice (network retry), returns the same success response without double-processing.

### 8.8 Sync API `/api/exam/sync`

Server-side processing:

```
1. Authenticate request
2. Validate session belongs to this student and is 'active'
3. Check session.expires_at > now() (reject if expired)
4. Check sync_id not already processed
5. For each answer in batch:
   a. Validate question_id belongs to this session
   b. Validate selected_option_id belongs to this question (or null)
   c. UPSERT into student_answers:
      ON CONFLICT (session_id, question_id) DO UPDATE
6. Update exam_sessions.last_synced_at = now()
7. Return { accepted: [...], server_time: now() }
```

### 8.9 Offline Handling

```typescript
// Monitor network status
window.addEventListener('online', () => {
  syncEngine.triggerImmediateSync(); // Don't wait for next interval
  showSyncIndicator('Reconnected — syncing...');
});

window.addEventListener('offline', () => {
  showSyncIndicator('Offline — answers saved locally');
  // Exam continues completely normally
});
```

### 8.10 Recovery on Refresh

When the student's browser refreshes mid-exam:

```
1. App loads, checks Dexie for activeSession record
2. If found AND expires_at > now():
   a. Load all question and answer data from Dexie immediately
   b. Render exam interface with recovered state (instant)
   c. In background: GET /api/exam/session/[id] — verify still valid
   d. Server returns: session status + latest synced answer state
   e. Merge: for each question, compare Dexie updated_at vs server updated_at
      → Take whichever is newer
   f. Trigger immediate sync of any unsynced local answers
3. If not found, or expires_at has passed:
   a. Check server for session status
   b. If 'active': session exists but local storage was cleared → re-fetch from server
   c. If 'submitted'/'expired': show appropriate message
```

### 8.11 Submission Flow

Student clicks "Submit Exam":

```
1. Show confirmation modal:
   "Are you sure you want to submit?
   Answered: 35 | Unanswered: 5 | Review: 2
   This action cannot be undone."
   [Submit] [Continue Exam]

2. Student confirms:
   a. Trigger immediate final sync of all pending answers
   b. Wait for sync to complete (with timeout of 5 seconds)
   c. POST to /api/exam/submit:
      {
        session_id,
        submission_token  // From session data, stored in Dexie
      }

3. Server processes submission:
   a. Check session belongs to student
   b. Check session.status = 'active'
   c. Check submission_token matches (idempotency key)
   d. If already 'submitted': return existing result
   e. Set session.status = 'submitted', session.submitted_at = now()
   f. Compute result (see Section 8.13)
   g. Store result in exam_results
   h. Write audit log: exam.session_submitted
   i. Clear Dexie activeSession data
   j. Return result data

4. Client receives result:
   → Navigate to /exam/result/[sessionId]
```

### 8.12 Auto-Submit on Timer Expiry

```typescript
useEffect(() => {
  const interval = setInterval(() => {
    const remaining = getTimeRemaining();
    
    if (remaining <= 0 && !hasSubmitted) {
      clearInterval(interval);
      autoSubmit(); // Same flow as manual submit, no confirmation dialog
    }
    
    if (remaining <= 300) { // 5 minutes warning
      showWarning('5 minutes remaining');
    }
    
    if (remaining <= 60) { // 1 minute warning
      showWarning('1 minute remaining — answers are being saved');
    }
  }, 1000);
  
  return () => clearInterval(interval);
}, []);
```

**Server-side:** If a session's `expires_at` has passed and `status = 'active'`, a scheduled Supabase cron job (or triggered on next API call) sets it to `expired` and computes results from last saved answers.

### 8.13 Result Computation

Called server-side, immediately after submission. Wrapped in a transaction.

```
1. Fetch all student_answers for this session
2. Fetch all exam_questions for this exam with correct option IDs:
   SELECT eq.question_id, eq.marks, qo.id as correct_option_id, q.explanation,
          q.content, q.type
   FROM exam_questions eq
   JOIN questions q ON q.id = eq.question_id
   JOIN question_options qo ON qo.question_id = eq.question_id AND qo.is_correct = true
   WHERE eq.exam_id = $exam_id
   
3. For each question in exam:
   - Find student's answer (if any)
   - Compare selected_option_id to correct_option_id
   - Categorize: correct | incorrect | unanswered
   - Calculate marks: correct → +marks_per_question, incorrect → -negative_marks, unanswered → 0
   
4. Aggregate: total_score, max_score, percentage, counts

5. Build result_data JSONB with per-question detail

6. INSERT into exam_results (one-time, stored permanently)

7. Mark session as submitted
```

---

## PART 9 — ANTI-CHEATING SYSTEM

### 9.1 Fullscreen Enforcement (Cross-Browser)

**NOT** using `requestFullscreen()` as the primary mechanism (unreliable on iOS Safari).

**CSS Fullscreen approach (universal):**
```css
.exam-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100dvh; /* dynamic viewport height for mobile */
  z-index: 9999;
  overflow: hidden;
  background: var(--background);
}
```

This covers the entire viewport on every browser without requiring the Fullscreen API. The browser chrome (address bar, tab bar) remains visible on some devices — that's acceptable. The exam content cannot be partially obscured.

**Additionally:** `requestFullscreen()` is called where supported (Chrome on Android, Chrome on desktop). This is a best-effort enhancement, not the primary mechanism.

**Violation detection:**
```typescript
// Works on all browsers
document.addEventListener('visibilitychange', handleVisibilityChange);
window.addEventListener('blur', handleFocusLoss);
window.addEventListener('focus', handleFocusReturn);
```

### 9.2 Focus Loss & Tab Switch Detection

```typescript
let focusLossStart: number | null = null;
const DEBOUNCE_MS = 1500; // Ignore losses shorter than 1.5 seconds
let debounceTimer: NodeJS.Timeout;

function handleFocusLoss() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    focusLossStart = Date.now();
    logSecurityEvent('tab_switch', {});
    showViolationWarning();
  }, DEBOUNCE_MS);
}

function handleFocusReturn() {
  clearTimeout(debounceTimer);
  if (focusLossStart) {
    const duration = Math.round((Date.now() - focusLossStart) / 1000);
    updateLastSecurityEvent({ duration_seconds: duration });
    focusLossStart = null;
    hideViolationWarning();
  }
}
```

**Violation accumulation:**
- Each tab switch increments `session.security_violations` counter
- Warning shown to student: "Warning: You have left the exam. This has been recorded. [X] violations detected."
- If `settings.auto_submit_on_max_violations = true` and `security_violations >= settings.max_tab_switches`: auto-submit triggered

### 9.3 Static Multi-Position Watermark

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│     JOHN SMITH | RN-2024-001 | 2024-01-15            │  ← top-center
│                                                      │
│                  [Question content here]             │
│                                                      │
│  JOHN SMITH                        JOHN SMITH        │  ← mid-left, mid-right
│  RN-2024-001                       RN-2024-001       │
│  2024-01-15                        2024-01-15        │
│                                                      │
│                  [Answer options here]               │
│                                                      │
│     JOHN SMITH | RN-2024-001 | 2024-01-15            │  ← bottom-center
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Implementation:**
- 4 fixed watermark instances: top-center, mid-left, mid-right, bottom-center
- `position: fixed` (stays on screen during scroll)
- `pointer-events: none` (doesn't block interaction)
- `user-select: none` (can't be selected)
- Opacity: 0.09 (9% — visible in photos, not distracting while reading)
- Slight rotation: top and bottom 0°, left +4°, right -4°
- Content: `[Full Name] | [Roll Number] | [Exam Date]`
- z-index above content, below modal overlays

### 9.4 Right-Click, Copy, Paste Blocking

```typescript
const preventedEvents = [
  'contextmenu',
  'copy',
  'cut',
  'paste',
  'selectstart'
];

preventedEvents.forEach(event => {
  document.addEventListener(event, (e) => {
    e.preventDefault();
    if (event === 'copy' || event === 'cut') {
      logSecurityEvent('copy_attempt', { event_type: event });
    }
    if (event === 'contextmenu') {
      logSecurityEvent('right_click_attempt', {});
    }
  }, true); // capture phase to prevent any handlers firing
});
```

### 9.5 Keyboard Shortcut Blocking

```typescript
const blockedCombinations = [
  { ctrl: true, key: 'a' },  // Select all
  { ctrl: true, key: 'c' },  // Copy
  { ctrl: true, key: 'v' },  // Paste
  { ctrl: true, key: 'x' },  // Cut
  { ctrl: true, key: 'u' },  // View source
  { ctrl: true, key: 'p' },  // Print
  { ctrl: true, key: 's' },  // Save
  { key: 'F12' },            // Dev tools
  { ctrl: true, shift: true, key: 'i' }, // Dev tools
  { ctrl: true, shift: true, key: 'j' }, // Console
  { ctrl: true, shift: true, key: 'c' }, // Inspect element
];

document.addEventListener('keydown', (e) => {
  const isBlocked = blockedCombinations.some(combo => 
    (!combo.ctrl || e.ctrlKey || e.metaKey) &&
    (!combo.shift || e.shiftKey) &&
    (e.key.toLowerCase() === combo.key.toLowerCase() || e.key === combo.key)
  );
  
  if (isBlocked) {
    e.preventDefault();
    e.stopPropagation();
    logSecurityEvent('keyboard_shortcut_blocked', { key: e.key });
  }
}, true);
```

### 9.6 Security Event Sync

Security events are queued locally in Dexie and synced to the server in the same autosave batch or on a separate 10-second interval. They do not block the exam or require network.

---

## PART 10 — POST-EXAM: RESULT & REVIEW

### 10.1 Result Screen (`/exam/result/[sessionId]`)

**First screen after submission:**

```
┌──────────────────────────────────────────────────┐
│            EXAMINATION COMPLETE                  │
│                                                  │
│           73 / 100                               │
│            73.0%                                 │
│            ✓ PASSED                              │
│                                                  │
│  ┌──────────┬──────────┬──────────┐              │
│  │ Correct  │Incorrect │Unanswered│              │
│  │   73     │   22     │    5     │              │
│  └──────────┴──────────┴──────────┘              │
│                                                  │
│  Time Taken: 1h 15m 32s                         │
│  Highest Score in this exam: 89%                │
│  Your Rank: 12 of 45 submitted                  │
│                                                  │
│  ┌──────────────────┐  ┌──────────────────────┐  │
│  │  Review Answers  │  │  View Leaderboard    │  │
│  └──────────────────┘  └──────────────────────┘  │
│                                                  │
│  [Back to Dashboard]                             │
└──────────────────────────────────────────────────┘
```

**Leaderboard availability:**
- Practice exams: shown immediately
- Scheduled exams: shown only after `exams.ends_at` has passed (configurable via `settings.show_leaderboard_after`)

**What leaderboard shows:**
- Rank, Student Name, Score, Percentage
- Limited to top 20 or all submitted students (admin configures)
- No lowest scorer highlighted

### 10.2 Answer Review Screen

```
┌──────────────────────────────────────────────────────┐
│ Answer Review — Air Law Practice                     │
│ [← Back to Result]      [1 2 3 4 5 6 7 8 9 10 ...]  │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Question 5 of 40                                     │
│                                                      │
│ What does METAR stand for?                           │
│                                                      │
│ ✗ A  International Civil Aviation Organization       │  ← Student's wrong answer (red)
│ ○ B  Meteorological Aviation Report                  │
│ ✓ C  Meteorological Aerodrome Report                 │  ← Correct answer (green)
│ ○ D  Civil Aviation Safety Authority                 │
│                                                      │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ Explanation:                                         │
│ METAR is a Meteorological Aerodrome Report — a       │
│ weather observation for aviation, issued hourly.     │
│                                                      │
│ ┌─────────────┐              ┌─────────────────────┐ │
│ │  ← Previous │              │        Next →       │ │
│ └─────────────┘              └─────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

**Color coding:**
- Green background + ✓ icon: Correct option (always shown, regardless of student answer)
- Red background + ✗ icon: Student's selected wrong answer
- No highlight: Other options student didn't select
- For unanswered: correct option shown in green, note "You did not answer this question"

---

## PART 11 — ADMIN PORTAL

### 11.1 Admin Portal Overview

The admin portal lives at `/admin/*` within the same Next.js application. Accessible only by users with `role = 'admin'` or `role = 'super_admin'`.

### 11.2 Student Management (`/admin/students`)

**Student List:**
- Sortable/filterable table: Name, Roll Number, Batch, Status, Last Login, Actions
- Search by name or roll number
- Filter by batch, status
- Bulk actions: assign to batch, enable/disable

**Create Student:**
- Form: Full Name, Email, Roll Number, Batch (optional), Temporary Password
- On save: creates Supabase Auth user + users row + student_profiles row
- Sets `force_password_change = true`
- Writes audit log

**Edit Student:**
- Edit profile fields
- Cannot edit roll number after creation (unique business key)

**Disable/Enable Student:**
- Sets `users.status = 'suspended'` or `'active'`
- Writes audit log
- Suspended students cannot log in

**Reset Password:**
- Admin enters new temporary password
- Updates Supabase Auth
- Sets `force_password_change = true`
- Writes audit log

### 11.3 Batch Management (`/admin/batches`)

- CRUD for batches
- Assign students to batch (multi-select)
- View students in batch

### 11.4 Question Bank Management (`/admin/question-banks`)

**Question Bank List:**
- Name, Subject, Question Count, Status
- Create / Edit / Archive

**Question List within Bank (`/admin/question-banks/[bankId]/questions`):**
- List all questions with subject, topic, difficulty, options count
- Filter by subject, topic, difficulty
- Search by question content
- Create / Edit / Delete (soft delete)

**Create/Edit Question:**

```
┌──────────────────────────────────────────────────────┐
│ Create Question                                      │
│                                                      │
│ Subject: [Air Law ▼]   Topic: [ICAO ▼]             │
│ Difficulty: [Medium ▼]                               │
│                                                      │
│ Question Text:                                       │
│ ┌────────────────────────────────────────────────┐  │
│ │ What does ICAO stand for?                      │  │
│ └────────────────────────────────────────────────┘  │
│                                                      │
│ Options (select the correct one):                    │
│ ○ A  International Civil Aviation Organization   [✕]│
│ ○ B  International Commercial Air Operations     [✕]│
│ ○ C  Inter-Continental Aviation Organization     [✕]│
│ ● D  International Civil Aeronautics Org         [✕]│
│                                              [+ Add] │
│                                                      │
│ Explanation (for review screen):                     │
│ ┌────────────────────────────────────────────────┐  │
│ │ ICAO stands for International Civil Aviation   │  │
│ │ Organization, established by the Chicago...    │  │
│ └────────────────────────────────────────────────┘  │
│                                                      │
│                    [Save Question]                   │
└──────────────────────────────────────────────────────┘
```

**Validation rules:**
- Minimum 2 options, maximum 6 options
- Exactly 1 option must be marked correct
- Question text: minimum 10 characters
- Explanation: mandatory (minimum 20 characters)
- At least 3 options recommended (warning if fewer)

### 11.5 Exam Creation Wizard (`/admin/exams/new`)

**Step 1 — Basic Information:**
- Title
- Type: Practice / Scheduled
- Subject (must match question bank subject)
- Description and Instructions
- Duration (minutes)
- Marks per question, Negative marking
- Passing marks (optional)

**Step 2 — Question Selection:**
- Select question bank
- View all questions in bank
- Specify number of questions to draw (e.g., "draw 40 from 100")
- Optional: specify distribution by difficulty (e.g., 10 easy, 20 medium, 10 hard)
- Preview selected questions

**Step 3 — Exam Settings:**
- Toggle: Randomize Questions (default: on)
- Toggle: Randomize Options (default: on)
- Toggle: Fullscreen Required (default: on)
- Max Tab Switches: input (default: 5)
- Toggle: Auto-Submit on Violations (default: off)
- Leaderboard: Show after submission / Show after exam ends
- Toggle: Watermark (default: on)

**Step 4 — Schedule (if type = Scheduled):**
- Start Date & Time
- End Date & Time (students can start anytime within this window)

**Step 5 — Enrollment:**
- Select enrollees: individual students or entire batches
- Preview enrolled student count

**Step 6 — Review & Publish:**
- Summary of all settings
- Preview
- "Publish Exam" button → sets status to 'scheduled' or 'active'

### 11.6 Exam Management (`/admin/exams`)

- List all exams with title, type, subject, status, enrolled count, submitted count
- Actions: Edit (draft only), Archive, View Results
- Status workflow: draft → (publish) → scheduled → (window opens) → active → (window closes) → completed → (manually) → archived

### 11.7 Monitoring (`/admin/monitoring`)

**Simple status board (not real-time — refreshes every 30 seconds):**

For a selected active exam, shows a table:

| Student Name | Roll No | Status | Tab Switches | Submitted At | Last Sync |
|---|---|---|---|---|---|
| John Smith | RN001 | In Progress | 2 | — | 2 min ago |
| Jane Doe | RN002 | Submitted | 0 | 10:47 AM | — |
| Mike Wilson | RN003 | Not Started | — | — | — |
| Sarah Kim | RN004 | Disconnected | 1 | — | 8 min ago |

- Status colors: In Progress (green), Submitted (blue), Not Started (gray), Disconnected (orange)
- Page auto-refreshes every 30 seconds
- Admin can manually click "Force Submit" for any active session (with confirmation)

### 11.8 Reports (`/admin/reports`)

Post-exam reports available after exam is completed:

**Class Summary:**
- Exam title, subject, date
- Total enrolled, total submitted, not submitted
- Average score, highest score
- Pass rate (if passing marks configured)

**Per-Student Summary:**
- Table: Name, Roll No, Score, Percentage, Status, Rank
- Sortable by score/name

**Question Analysis:**
- Table: Question No, Question (truncated), Correct %, Incorrect %, Unanswered %
- Sorted by Correct % ascending (hardest questions first)
- Helps identify questions students found most difficult

All reports have a "Download CSV" button.

---

## PART 12 — SECURITY ARCHITECTURE

### 12.1 RLS Policy Testing Protocol

After every migration, the following must be verified:

1. Student A cannot read Student B's answers
2. Student cannot read question correct answers
3. Student cannot access admin routes or data
4. Admin can read all student data
5. Admin cannot read another tenant's data (not applicable for single-tenant, but good practice)
6. Unauthenticated user gets 0 rows from every table

### 12.2 Input Validation (Zod)

Every API route validates input using Zod. Validation occurs before any database operation. Invalid input returns HTTP 400 with `{ code: 'VALIDATION_ERROR', details: [...] }`.

### 12.3 Rate Limiting

| Endpoint | Limit | Window |
|---|---|---|
| `/api/auth/login` | 5 attempts | 15 minutes per IP |
| `/api/auth/change-password` | 3 attempts | 1 hour per user |
| `/api/exam/start` | 3 attempts | 10 minutes per user |
| `/api/exam/sync` | 120 requests | 1 hour per session |
| `/api/exam/submit` | 5 attempts | 1 hour per session |
| All admin endpoints | 200 requests | 1 hour per user |

Implemented in Next.js middleware using in-memory counter with TTL (sufficient for current scale; can be replaced with Redis in future).

### 12.4 Error Responses

**All errors follow this standard format:**
```json
{
  "error": {
    "code": "SESSION_EXPIRED",
    "message": "Your examination session has expired.",
    "details": null
  }
}
```

**Error Codes:**
| Code | HTTP Status | Meaning |
|---|---|---|
| `UNAUTHORIZED` | 401 | Not logged in or token invalid |
| `SESSION_TERMINATED` | 401 | Active session was terminated (new login elsewhere) |
| `FORBIDDEN` | 403 | Logged in but not permitted to access this resource |
| `NOT_FOUND` | 404 | Resource does not exist or is not visible to this user |
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `EXAM_NOT_ACTIVE` | 400 | Exam is not currently in active status |
| `EXAM_NOT_STARTED_YET` | 400 | Exam hasn't opened yet |
| `EXAM_WINDOW_CLOSED` | 400 | Exam window has closed |
| `ALREADY_SUBMITTED` | 400 | Exam already submitted |
| `NOT_ENROLLED` | 403 | Student not enrolled in this exam |
| `SESSION_EXPIRED` | 400 | Exam session timer has expired |
| `ACCOUNT_SUSPENDED` | 403 | Account is suspended |
| `DEVICE_NOT_ALLOWED` | 403 | Mobile device access denied |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error (never expose details) |

Internal server errors are logged with full stack traces server-side but return only `INTERNAL_ERROR` code to the client.

### 12.5 Storage Security

- All Supabase Storage buckets: **private**
- No public bucket URL access
- Student profile photos accessed via signed URLs (expiry: 1 hour)
- No user-uploaded files in exam content (admin uploads only, through admin portal)
- Storage bucket listing: disabled

### 12.6 Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=          (public — safe to expose)
NEXT_PUBLIC_SUPABASE_ANON_KEY=     (public — safe to expose, RLS protects data)
SUPABASE_SERVICE_ROLE_KEY=         (NEVER public — server only)
NEXTAUTH_SECRET=                   (NEVER public — server only)
```

The `SUPABASE_SERVICE_ROLE_KEY` is only used in server-side API routes and bypasses RLS. It must never appear in any client-side code.

---

## PART 13 — PERFORMANCE REQUIREMENTS

| Operation | Target | Measurement |
|---|---|---|
| Dashboard load | < 1 second | Time to interactive |
| Exam start (session creation) | < 2 seconds | API response time |
| Answer selection feedback | 0ms (instant) | Optimistic UI, no network |
| Question navigation | 0ms (instant) | Local state, no network |
| Autosave batch | < 1 second | API response time |
| Result computation | < 2 seconds | Total post-submit time |
| Admin student list (100 students) | < 1 second | API response time |
| Admin report generation | < 3 seconds | API response time |

All database queries must use indexed columns for filtering. `EXPLAIN ANALYZE` must be run on every query and reviewed before implementation.

---

## PART 14 — BROWSER & DEVICE COMPATIBILITY

### 14.1 Supported Browsers

| Browser | Platform | Priority |
|---|---|---|
| Chrome (latest) | Android tablet | P0 (primary) |
| Safari (latest) | iPad / iPadOS | P0 (primary) |
| Chrome (latest) | Windows / Mac desktop | P1 |
| Safari (latest) | macOS desktop | P1 |

### 14.2 Safari-Specific Requirements

**Date handling:** All date strings passed between API and client must be ISO 8601 format (`2024-01-15T10:00:00.000Z`). Never use `new Date('2024-01-15 10:00:00')` — Safari returns `Invalid Date` for space-separated datetime strings.

**IndexedDB in private mode:** Detect Safari private browsing (IndexedDB quota will be 0). Show blocking message: "Please disable private browsing to take examinations."

**Fullscreen API:** iOS Safari 17+ supports fullscreen but behavior varies. Use the CSS-based fullscreen approach as primary. `requestFullscreen()` as best-effort enhancement.

**`dvh` units:** Use `100dvh` instead of `100vh` on mobile Safari to account for dynamic address bar.

**Input zoom:** Set `font-size: 16px` on all input elements — Safari auto-zooms on inputs with smaller font.

### 14.3 Cross-Browser Testing Checklist

Before every deployment:
- [ ] Complete exam flow on Chrome Android tablet
- [ ] Complete exam flow on iPad Safari
- [ ] Complete exam flow on Chrome Windows
- [ ] Complete exam flow on Safari macOS
- [ ] Timer displays correctly on all browsers
- [ ] IndexedDB recovery works on all browsers
- [ ] Watermark renders on all browsers
- [ ] Anti-cheating events fire on all browsers

---

## PART 15 — FUTURE LMS PATH

When LMS features are required, the following is added WITHOUT modifying existing tables:

**New tables:**
- `courses` (name, subject, batch_id, instructor_id, status)
- `lessons` (course_id, title, type, content_url, duration_seconds, order)
- `assignments` (similar structure to `exams`, type = 'assignment')
- `student_course_progress` (user_id, lesson_id, completed_at)
- `attendance` (user_id, date, status, notes)
- `certificates` (user_id, course_id, issued_at, certificate_url)

**Existing tables that grow (additive only):**
- `users.role` — add 'instructor' to check constraint
- `exams.type` — add 'mock', 'assignment' to check constraint
- `student_profiles.metadata` — JSONB, just add keys

**The exam engine is reused as-is** for mock exams, timed assignments, etc. New modules share auth, students, batches, and question banks. Nothing is rebuilt.

---

## PART 16 — DEPLOYMENT CHECKLIST

Before going live:

- [ ] Supabase Pro plan activated, spend cap enabled
- [ ] All RLS policies tested with multiple user roles
- [ ] Service role key confirmed absent from all client-side code
- [ ] Rate limiting configured and tested
- [ ] Soft delete implemented on all tables
- [ ] Audit log writes on all critical operations
- [ ] IndexedDB recovery tested (kill browser mid-exam, reopen)
- [ ] Clock offset tested (set tablet clock 10 minutes wrong, confirm timer still accurate)
- [ ] Safari private browsing detection tested
- [ ] Mobile device blocking tested on actual phone
- [ ] Idempotent submission tested (submit twice, confirm one result)
- [ ] Force password change flow tested
- [ ] Single device enforcement tested (login on second device)
- [ ] All error codes return correct HTTP status
- [ ] No sensitive data in client-side environment variables
- [ ] Storage buckets confirmed private
- [ ] Admin cannot access student exam answers in real-time (only after exam)
- [ ] Leaderboard honors `show_leaderboard_after` setting
- [ ] Auto-submit tested at timer expiry
- [ ] Offline exam continuation tested (disable Wi-Fi mid-exam)
- [ ] Result computation verified correct for multiple scenarios

---

*End of PRD v1.0*
*This document is the authoritative source of truth for the AVIORA portal.*
*Any deviation from this document requires explicit written approval and a PRD update.*
