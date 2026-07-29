"""
AVIORA Examination Portal — Complete Supabase SQL PDF Generator
Generates a professionally formatted, production-ready SQL reference document.
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether, Preformatted
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus.flowables import Flowable
from reportlab.lib import colors
import datetime

# ── Design tokens ────────────────────────────────────────────────────────────
NAVY        = HexColor("#1e3a5f")
NAVY_LIGHT  = HexColor("#e8eef6")
AMBER       = HexColor("#f59e0b")
BG          = HexColor("#f8fafc")
SURFACE     = HexColor("#ffffff")
BORDER      = HexColor("#e2e8f0")
TEXT_PRI    = HexColor("#0f172a")
TEXT_SEC    = HexColor("#475569")
SUCCESS     = HexColor("#16a34a")
DANGER      = HexColor("#dc2626")
CODE_BG     = HexColor("#f1f5f9")
CODE_BORDER = HexColor("#cbd5e1")
AMBER_BG    = HexColor("#fffbeb")
RED_LIGHT   = HexColor("#fef2f2")
GREEN_LIGHT = HexColor("#f0fdf4")
SECTION_BG  = HexColor("#0f172a")

W, H = A4

# ── Styles ────────────────────────────────────────────────────────────────────
def build_styles():
    base = getSampleStyleSheet()

    cover_title = ParagraphStyle("CoverTitle",
        fontName="Helvetica-Bold", fontSize=28, textColor=white,
        leading=34, alignment=TA_LEFT, spaceAfter=6)

    cover_sub = ParagraphStyle("CoverSub",
        fontName="Helvetica", fontSize=13, textColor=HexColor("#94a3b8"),
        leading=18, alignment=TA_LEFT, spaceAfter=4)

    cover_label = ParagraphStyle("CoverLabel",
        fontName="Helvetica-Bold", fontSize=9, textColor=AMBER,
        leading=12, alignment=TA_LEFT, spaceAfter=2,
        spaceBefore=16, tracking=80)

    h1 = ParagraphStyle("H1",
        fontName="Helvetica-Bold", fontSize=16, textColor=white,
        leading=20, spaceBefore=0, spaceAfter=0)

    h2 = ParagraphStyle("H2",
        fontName="Helvetica-Bold", fontSize=12, textColor=NAVY,
        leading=16, spaceBefore=20, spaceAfter=8,
        borderPad=0)

    h3 = ParagraphStyle("H3",
        fontName="Helvetica-Bold", fontSize=10, textColor=TEXT_PRI,
        leading=14, spaceBefore=14, spaceAfter=6)

    body = ParagraphStyle("Body",
        fontName="Helvetica", fontSize=9, textColor=TEXT_SEC,
        leading=14, spaceBefore=0, spaceAfter=6)

    body_bold = ParagraphStyle("BodyBold",
        fontName="Helvetica-Bold", fontSize=9, textColor=TEXT_PRI,
        leading=14, spaceBefore=0, spaceAfter=4)

    warning = ParagraphStyle("Warning",
        fontName="Helvetica-Bold", fontSize=9, textColor=HexColor("#92400e"),
        leading=13, spaceBefore=4, spaceAfter=4)

    note = ParagraphStyle("Note",
        fontName="Helvetica", fontSize=8, textColor=TEXT_SEC,
        leading=12, spaceBefore=2, spaceAfter=2)

    toc_section = ParagraphStyle("TOCSection",
        fontName="Helvetica-Bold", fontSize=10, textColor=NAVY,
        leading=14, spaceBefore=6, spaceAfter=2)

    toc_item = ParagraphStyle("TOCItem",
        fontName="Helvetica", fontSize=9, textColor=TEXT_SEC,
        leading=13, spaceBefore=1, spaceAfter=1, leftIndent=16)

    return dict(
        cover_title=cover_title, cover_sub=cover_sub, cover_label=cover_label,
        h1=h1, h2=h2, h3=h3, body=body, body_bold=body_bold,
        warning=warning, note=note, toc_section=toc_section, toc_item=toc_item
    )


# ── Custom flowables ──────────────────────────────────────────────────────────
class SectionHeader(Flowable):
    """Dark navy section header bar."""
    def __init__(self, number, title, styles):
        super().__init__()
        self.number = number
        self.title = title
        self.styles = styles
        self.width = W - 4*cm
        self.height = 32

    def draw(self):
        c = self.canv
        c.setFillColor(NAVY)
        c.roundRect(0, 0, self.width, self.height, 4, fill=1, stroke=0)
        c.setFillColor(AMBER)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(12, 11, f"SECTION {self.number}")
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 13)
        c.drawString(90, 9, self.title)


class CodeBlock(Flowable):
    """SQL code block with syntax-aware colouring."""
    KEYWORDS = {
        'CREATE', 'TABLE', 'INDEX', 'FUNCTION', 'POLICY', 'TRIGGER', 'VIEW',
        'INSERT', 'UPDATE', 'DELETE', 'SELECT', 'FROM', 'WHERE', 'JOIN',
        'INNER', 'LEFT', 'RIGHT', 'ON', 'AND', 'OR', 'NOT', 'IN', 'IS',
        'NULL', 'TRUE', 'FALSE', 'RETURN', 'RETURNS', 'DECLARE', 'BEGIN',
        'END', 'IF', 'THEN', 'ELSE', 'ELSIF', 'LOOP', 'FOREACH', 'FOR',
        'INTO', 'VALUES', 'SET', 'WITH', 'AS', 'CASE', 'WHEN', 'UNIQUE',
        'PRIMARY', 'KEY', 'REFERENCES', 'DEFAULT', 'NOT', 'CONSTRAINT',
        'CHECK', 'FOREIGN', 'ALTER', 'ENABLE', 'ROW', 'LEVEL', 'SECURITY',
        'LANGUAGE', 'PLPGSQL', 'SECURITY', 'DEFINER', 'STABLE', 'GRANT',
        'EXECUTE', 'TO', 'AUTHENTICATED', 'EXISTS', 'COALESCE', 'RAISE',
        'EXCEPTION', 'USING', 'REPLACE', 'OR', 'DROP', 'EXTENSION',
        'DEFINER', 'VOLATILE', 'IMMUTABLE', 'STRICT', 'CALLED', 'SETOF',
    }
    TYPES = {
        'uuid', 'text', 'integer', 'int', 'boolean', 'bool', 'timestamptz',
        'timestamp', 'numeric', 'jsonb', 'json', 'smallint', 'bigint',
        'inet', 'text[]', 'uuid[]', 'void', 'record',
    }

    def __init__(self, sql, width=None):
        super().__init__()
        self.sql = sql
        self.lines = sql.split('\n')
        self._width = width or (W - 4*cm)
        self.font_size = 7
        self.line_height = 9
        self.padding = 8

    def wrap(self, avail_w, avail_h):
        self._width = avail_w
        self.height = len(self.lines) * self.line_height + 2 * self.padding
        return self._width, self.height

    def split(self, avail_w, avail_h):
        if avail_h < 2 * self.padding + self.line_height:
            return []
        lines_fit = int((avail_h - 2 * self.padding) // self.line_height)
        if lines_fit <= 0 or lines_fit >= len(self.lines):
            return []
        b1 = CodeBlock('\n'.join(self.lines[:lines_fit]), width=self._width)
        b2 = CodeBlock('\n'.join(self.lines[lines_fit:]), width=self._width)
        return [b1, b2]

    def draw(self):
        c = self.canv
        h = self.height
        # Background
        c.setFillColor(CODE_BG)
        c.roundRect(0, 0, self._width, h, 4, fill=1, stroke=0)
        # Left accent bar
        c.setFillColor(NAVY)
        c.rect(0, 0, 3, h, fill=1, stroke=0)

        # Draw lines
        y = h - self.padding - self.font_size
        for raw_line in self.lines:
            if y < 0:
                break
            x = self.padding + 6
            # Comment lines
            stripped = raw_line.strip()
            if stripped.startswith('--'):
                c.setFillColor(HexColor("#64748b"))
                c.setFont("Courier", self.font_size)
                c.drawString(x, y, raw_line[:110])
            else:
                # Simple word-level rendering
                self._draw_line_coloured(c, raw_line, x, y)
            y -= self.line_height

    def _draw_line_coloured(self, c, line, start_x, y):
        """Word-by-word colouring for SQL syntax."""
        import re
        fs = self.font_size
        x = start_x
        # Split keeping delimiters
        tokens = re.split(r'(\s+|[(),;\'"])', line)
        for tok in tokens:
            if not tok:
                continue
            upper = tok.upper()
            if upper in self.KEYWORDS:
                c.setFillColor(HexColor("#7c3aed"))   # purple for keywords
                c.setFont("Courier-Bold", fs)
            elif tok.lower() in self.TYPES:
                c.setFillColor(HexColor("#0891b2"))   # cyan for types
                c.setFont("Courier", fs)
            elif tok.startswith("'") or tok.endswith("'"):
                c.setFillColor(HexColor("#16a34a"))   # green for strings
                c.setFont("Courier", fs)
            elif tok.isdigit():
                c.setFillColor(HexColor("#ea580c"))   # orange for numbers
                c.setFont("Courier", fs)
            elif upper.startswith("IDX_") or upper.startswith("P_") or upper.startswith("V_"):
                c.setFillColor(HexColor("#c2410c"))   # orange-red for vars/indexes
                c.setFont("Courier", fs)
            else:
                c.setFillColor(TEXT_PRI)
                c.setFont("Courier", fs)
            c.drawString(x, y, tok)
            x += c.stringWidth(tok, "Courier", fs)
            if x > self._width - self.padding:
                break


class NoteBox(Flowable):
    """Coloured note/warning box."""
    def __init__(self, text, kind='info', width=None):
        super().__init__()
        self.text = text
        self.kind = kind
        self._width = width or (W - 4*cm)
        self.padding = 10
        configs = {
            'warning': (AMBER_BG, AMBER, "⚠  WARNING"),
            'danger':  (RED_LIGHT, DANGER, "✕  CRITICAL"),
            'success': (GREEN_LIGHT, SUCCESS, "✓  NOTE"),
            'info':    (NAVY_LIGHT, NAVY, "ℹ  INFO"),
        }
        self.bg, self.border_col, self.label = configs.get(kind, configs['info'])

    def wrap(self, avail_w, avail_h):
        self._width = avail_w
        # Estimate lines needed
        chars_per_line = int(self._width / 5.5)
        lines = max(2, len(self.text) // chars_per_line + 2)
        self.height = lines * 13 + 2 * self.padding + 16
        return self._width, self.height

    def draw(self):
        c = self.canv
        h = self.height
        c.setFillColor(self.bg)
        c.roundRect(0, 0, self._width, h, 4, fill=1, stroke=0)
        c.setStrokeColor(self.border_col)
        c.setLineWidth(1.5)
        c.rect(0, 0, self._width, h, fill=0, stroke=1)
        # Left bar
        c.setFillColor(self.border_col)
        c.rect(0, 0, 4, h, fill=1, stroke=0)
        # Label
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(self.border_col)
        c.drawString(14, h - self.padding - 8, self.label)
        # Text
        c.setFont("Helvetica", 8)
        c.setFillColor(TEXT_PRI)
        # Simple line wrapping
        words = self.text.split()
        line, y = [], h - self.padding - 22
        for word in words:
            test = ' '.join(line + [word])
            if c.stringWidth(test, "Helvetica", 8) < self._width - 30:
                line.append(word)
            else:
                if line:
                    c.drawString(14, y, ' '.join(line))
                    y -= 12
                line = [word]
        if line:
            c.drawString(14, y, ' '.join(line))


def header_footer(canvas, doc):
    """Page header and footer."""
    canvas.saveState()
    # Header bar
    canvas.setFillColor(NAVY)
    canvas.rect(1.5*cm, H - 1.6*cm, W - 3*cm, 22, fill=1, stroke=0)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(white)
    canvas.drawString(1.8*cm, H - 1.35*cm, "✈  AVIORA Examination Portal")
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(HexColor("#94a3b8"))
    canvas.drawRightString(W - 1.8*cm, H - 1.35*cm, "Supabase SQL Reference v1.0 — CONFIDENTIAL")
    # Footer
    canvas.setFillColor(BORDER)
    canvas.rect(1.5*cm, 1.2*cm, W - 3*cm, 1, fill=1, stroke=0)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(TEXT_SEC)
    canvas.drawString(1.8*cm, 0.95*cm, "AVIORA by ZYXEN · Production Database Reference")
    canvas.drawRightString(W - 1.8*cm, 0.95*cm, f"Page {doc.page}")
    canvas.restoreState()


# ── SQL Content ───────────────────────────────────────────────────────────────

SECTIONS = []

# ────────────────────────────────────────────────────────────────────────────
# SECTION 1 — EXTENSIONS
# ────────────────────────────────────────────────────────────────────────────
SECTIONS.append(("EXTENSIONS & PREREQUISITES", [

("info", "Run these first before any table creation. Extensions must be enabled at the database level."),

("sql", """-- Enable UUID generation (required for gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable trigram search (required for full-text student name search)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";"""),

]))

# ────────────────────────────────────────────────────────────────────────────
# SECTION 2 — TRIGGER FUNCTION
# ────────────────────────────────────────────────────────────────────────────

SECTIONS.append(("IMMUTABILITY TRIGGERS", [

("h3", "IMMUTABILITY TRIGGERS"),
("sql", """CREATE OR REPLACE FUNCTION reject_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'IMMUTABLE_TABLE: % cannot be modified after insert. Table: %, Operation: %',
    TG_TABLE_NAME, TG_TABLE_NAME, TG_OP;
END;
$$;"""),

]))

SECTIONS.append(("UPDATED_AT AUTO-TRIGGER", [

("info", "This single function is reused by ALL tables that have an updated_at column. Create it before any tables."),

("sql", """-- Universal updated_at trigger function
-- Applied to every table that has an updated_at column.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;"""),

]))

# ────────────────────────────────────────────────────────────────────────────
# SECTION 3 — CORE TABLES
# ────────────────────────────────────────────────────────────────────────────
SECTIONS.append(("CORE TABLES", [

("h3", "TABLE: users"),
("body", "Universal identity table. Every person in the system (student, admin, super_admin) is a row here. Linked to Supabase Auth via matching UUID."),
("sql", """CREATE TABLE IF NOT EXISTS users (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 text        UNIQUE NOT NULL,
  role                  text        NOT NULL
                          CHECK (role IN ('student', 'admin', 'super_admin')),
  status                text        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'suspended', 'deactivated')),
  force_password_change boolean     NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz NULL
);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();"""),

("h3", "TABLE: batches"),
("body", "Named groups of students. Used for bulk exam enrollment and reporting. Maps to course cohorts in a future LMS."),
("sql", """CREATE TABLE IF NOT EXISTS batches (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text        NULL,
  status      text        NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'archived')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz NULL
);

CREATE TRIGGER batches_updated_at
  BEFORE UPDATE ON batches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();"""),

("h3", "TABLE: student_profiles"),
("body", "Extended profile for students only. Separated from users to keep the identity table generic and LMS-ready."),
("sql", """CREATE TABLE IF NOT EXISTS student_profiles (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name   text        NOT NULL,
  roll_number text        NOT NULL UNIQUE,
  batch_id    uuid        NULL REFERENCES batches(id) ON DELETE SET NULL,
  photo_url   text        NULL,
  phone       text        NULL,
  metadata    jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz NULL
);

CREATE TRIGGER student_profiles_updated_at
  BEFORE UPDATE ON student_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();"""),

]))

# ────────────────────────────────────────────────────────────────────────────
# SECTION 4 — QUESTION BANK TABLES
# ────────────────────────────────────────────────────────────────────────────
SECTIONS.append(("QUESTION BANK TABLES", [

("h3", "TABLE: question_banks"),
("body", "Container for questions, organised by subject. One bank per subject. Reusable across multiple exams."),
("sql", """CREATE TABLE IF NOT EXISTS question_banks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  subject     text        NOT NULL,
  description text        NULL,
  status      text        NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'archived')),
  created_by  uuid        NOT NULL REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz NULL
);

CREATE TRIGGER question_banks_updated_at
  BEFORE UPDATE ON question_banks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();"""),

("h3", "TABLE: questions"),
("body", "Individual MCQ questions. Minimum 10-char content. Explanation (min 20 chars) is mandatory — shown to students on review screen."),
("sql", """CREATE TABLE IF NOT EXISTS questions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id     uuid        NOT NULL REFERENCES question_banks(id) ON DELETE RESTRICT,
  content     text        NOT NULL CHECK (length(content) >= 10),
  type        text        NOT NULL DEFAULT 'mcq' CHECK (type IN ('mcq')),
  difficulty  text        NOT NULL DEFAULT 'medium'
                CHECK (difficulty IN ('easy', 'medium', 'hard')),
  subject     text        NOT NULL,
  topic       text        NULL,
  tags        text[]      NOT NULL DEFAULT '{}',
  explanation text        NULL CHECK (explanation IS NULL OR length(explanation) >= 20),
  metadata    jsonb       NOT NULL DEFAULT '{}',
  created_by  uuid        NOT NULL REFERENCES users(id),
  updated_by  uuid        NOT NULL REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz NULL
);

CREATE TRIGGER questions_updated_at
  BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();"""),

("h3", "TABLE: question_options"),
("warning", "CRITICAL: The correct answer is ALWAYS identified by option UUID, NEVER by position (A/B/C/D). The unique partial index below enforces exactly one correct option per question at the database level."),
("sql", """CREATE TABLE IF NOT EXISTS question_options (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id   uuid        NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  content       text        NOT NULL CHECK (length(content) >= 1),
  is_correct    boolean     NOT NULL DEFAULT false,
  display_order smallint    NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER question_options_updated_at
  BEFORE UPDATE ON question_options
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- DATABASE-LEVEL CONSTRAINT: exactly ONE correct option per question
CREATE UNIQUE INDEX IF NOT EXISTS idx_question_options_one_correct
  ON question_options(question_id)
  WHERE is_correct = true;"""),

]))

# ────────────────────────────────────────────────────────────────────────────
# SECTION 5 — EXAM TABLES
# ────────────────────────────────────────────────────────────────────────────
SECTIONS.append(("EXAM TABLES", [

("h3", "TABLE: exams"),
("body", "Each exam record. Covers both practice (available anytime) and scheduled (time-windowed) types. Settings stored as JSONB for zero-migration extensibility."),
("sql", """CREATE TABLE IF NOT EXISTS exams (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id            uuid        NOT NULL REFERENCES question_banks(id) ON DELETE RESTRICT,
  title              text        NOT NULL,
  subject            text        NOT NULL,
  description        text        NULL,
  instructions       text        NULL,
  type               text        NOT NULL CHECK (type IN ('practice', 'scheduled')),
  duration_minutes   integer     NOT NULL CHECK (duration_minutes > 0),
  total_questions    integer     NOT NULL CHECK (total_questions > 0),
  marks_per_question numeric(5,2) NOT NULL DEFAULT 1.0 CHECK (marks_per_question > 0),
  negative_marks     numeric(5,2) NOT NULL DEFAULT 0.0 CHECK (negative_marks >= 0),
  passing_marks      numeric(7,2) NULL CHECK (passing_marks >= 0),
  status             text        NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','scheduled','active','completed','archived')),
  scheduled_at       timestamptz NULL,
  ends_at            timestamptz NULL,
  settings           jsonb       NOT NULL DEFAULT '{
    "randomize_questions": true,
    "randomize_options": true,
    "fullscreen_required": true,
    "max_tab_switches": 5,
    "auto_submit_on_max_violations": false,
    "show_result_immediately": true,
    "allow_question_review": true,
    "show_leaderboard_after": "exam_end",
    "watermark_enabled": true
  }'::jsonb,
  created_by         uuid        NOT NULL REFERENCES users(id),
  updated_by         uuid        NOT NULL REFERENCES users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz NULL,
  CONSTRAINT scheduled_exam_requires_times CHECK (
    type != 'scheduled' OR (scheduled_at IS NOT NULL AND ends_at IS NOT NULL)
  ),
  CONSTRAINT ends_must_be_after_start CHECK (
    ends_at IS NULL OR scheduled_at IS NULL OR ends_at > scheduled_at
  )
);

CREATE TRIGGER exams_updated_at
  BEFORE UPDATE ON exams
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();"""),

("h3", "TABLE: exam_questions"),
("body", "IMMUTABLE snapshot of questions selected for an exam. Created once when exam is published. Never modified. This means editing a source question does not affect live or completed exams."),
("sql", """CREATE TABLE IF NOT EXISTS exam_questions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id     uuid        NOT NULL REFERENCES exams(id) ON DELETE RESTRICT,
  question_id uuid        NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  base_order  smallint    NOT NULL,
  marks       numeric(5,2) NOT NULL DEFAULT 1.0,
  created_at  timestamptz NOT NULL DEFAULT now()
  -- No updated_at — this table is immutable after insert
);

CREATE TRIGGER eq_immutable BEFORE UPDATE OR DELETE ON exam_questions FOR EACH ROW EXECUTE FUNCTION reject_mutation();"""),

("h3", "TABLE: exam_enrollments"),
("body", "Controls which students can access which exams. A student cannot start an exam without an enrollment row."),
("sql", """CREATE TABLE IF NOT EXISTS exam_enrollments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id     uuid        NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id  uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrolled_by uuid        NOT NULL REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);"""),

]))

# ────────────────────────────────────────────────────────────────────────────
# SECTION 6 — SESSION & ANSWER TABLES
# ────────────────────────────────────────────────────────────────────────────
SECTIONS.append(("SESSION & ANSWER TABLES", [

("h3", "TABLE: exam_sessions"),
("warning", "THE MOST CRITICAL TABLE. One row per student per exam attempt. question_order and option_orders store the randomisation mapping — generated ONCE at session start, NEVER regenerated. The unique partial index enforces one active/submitted session per student per exam."),
("sql", """CREATE TABLE IF NOT EXISTS exam_sessions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id             uuid        NOT NULL REFERENCES exams(id) ON DELETE RESTRICT,
  student_id          uuid        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status              text        NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','submitted','expired','terminated')),
  started_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL,
  submitted_at        timestamptz NULL,
  last_synced_at      timestamptz NULL,
  -- Stores shuffled question UUID array for THIS student: ["uuid-q5","uuid-q2",...]
  question_order      jsonb       NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(question_order) = 'array'),
  -- Stores per-question shuffled option arrays: {"uuid-q5": ["uuid-opt-b","uuid-opt-a",...]}
  option_orders       jsonb       NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(option_orders) = 'object'),
  submission_token    uuid        NOT NULL DEFAULT gen_random_uuid(),
  device_info         jsonb       NOT NULL DEFAULT '{}',
  ip_address          inet        NULL,
  security_violations integer     NOT NULL DEFAULT 0 CHECK (security_violations >= 0),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER exam_sessions_updated_at
  BEFORE UPDATE ON exam_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ONE active OR submitted session per student per exam (database enforced)
CREATE UNIQUE INDEX IF NOT EXISTS idx_exam_sessions_one_active
  ON exam_sessions(exam_id, student_id)
  WHERE status IN ('active', 'submitted');"""),

("h3", "TABLE: student_answers"),
("body", "One row per student per question per session. Upserted on every autosave batch. The sync_status column lives ONLY in IndexedDB on the client — it does not exist here."),
("sql", """CREATE TABLE IF NOT EXISTS student_answers (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           uuid        NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  question_id          uuid        NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  selected_option_id   uuid        NULL REFERENCES question_options(id) ON DELETE RESTRICT,
  is_marked_for_review boolean     NOT NULL DEFAULT false,
  is_visited           boolean     NOT NULL DEFAULT false,
  time_spent_seconds   integer     NOT NULL DEFAULT 0 CHECK (time_spent_seconds >= 0),
  answered_at          timestamptz NULL,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER student_answers_updated_at
  BEFORE UPDATE ON student_answers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();"""),

]))

# ────────────────────────────────────────────────────────────────────────────
# SECTION 7 — RESULT & SECURITY TABLES
# ────────────────────────────────────────────────────────────────────────────
SECTIONS.append(("RESULT & SECURITY TABLES", [

("h3", "TABLE: exam_results"),
("body", "Computed ONCE on submission by the submit_exam_session() function. Never recomputed on page load. result_data JSONB contains the full per-question breakdown including explanations."),
("sql", """CREATE TABLE IF NOT EXISTS exam_results (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid        NOT NULL UNIQUE REFERENCES exam_sessions(id) ON DELETE RESTRICT,
  exam_id          uuid        NOT NULL REFERENCES exams(id) ON DELETE RESTRICT,
  student_id       uuid        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  total_score      numeric(7,2) NOT NULL CHECK (total_score >= 0),
  max_score        numeric(7,2) NOT NULL CHECK (max_score >= 0),
  percentage       numeric(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  correct_count    integer     NOT NULL CHECK (correct_count >= 0),
  incorrect_count  integer     NOT NULL CHECK (incorrect_count >= 0),
  unanswered_count integer     NOT NULL CHECK (unanswered_count >= 0),
  time_taken_seconds integer   NOT NULL CHECK (time_taken_seconds >= 0),
  is_passed        boolean     NULL,
  computed_at      timestamptz NOT NULL DEFAULT now(),
  result_data      jsonb       NOT NULL DEFAULT '{}'
  -- result_data structure:
  -- { "questions": [{ "question_id", "question_content", "selected_option_id",
  --   "correct_option_id", "is_correct", "is_unanswered", "marks_awarded",
  --   "explanation", "time_spent_seconds" }, ...] }
);

CREATE TRIGGER er_immutable BEFORE UPDATE OR DELETE ON exam_results FOR EACH ROW EXECUTE FUNCTION reject_mutation();"""),

("h3", "TABLE: security_events"),
("body", "All anti-cheating events logged during an exam. Synced from client IndexedDB via the autosave batch. Admins view these in the monitoring dashboard."),
("sql", """CREATE TABLE IF NOT EXISTS security_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid        NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  student_id       uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type       text        NOT NULL CHECK (event_type IN (
    'fullscreen_exit', 'tab_switch', 'focus_loss',
    'right_click_attempt', 'keyboard_shortcut_blocked',
    'copy_attempt', 'paste_attempt', 'context_menu_blocked'
  )),
  duration_seconds integer     NULL CHECK (duration_seconds >= 0),
  event_data       jsonb       NOT NULL DEFAULT '{}',
  occurred_at      timestamptz NOT NULL DEFAULT now()
);"""),

]))

# ────────────────────────────────────────────────────────────────────────────
# SECTION 8 — AUDIT & SESSION CONTROL TABLES
# ────────────────────────────────────────────────────────────────────────────
SECTIONS.append(("AUDIT & SESSION CONTROL TABLES", [

("h3", "TABLE: active_sessions"),
("body", "Single-device enforcement. One active row per user at any time. On new login, all existing rows for that user are terminated. Middleware checks this table on every authenticated request."),
("sql", """CREATE TABLE IF NOT EXISTS active_sessions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash     text        NOT NULL,
  device_info    jsonb       NOT NULL DEFAULT '{}',
  ip_address     inet        NULL,
  status         text        NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'terminated')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER active_sessions_updated_at
  BEFORE UPDATE ON active_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();"""),

("h3", "TABLE: audit_logs"),
("body", "Immutable append-only log of every meaningful action. Only the service role key can INSERT here. Never modified after insert. The foundation of your audit trail."),
("sql", """CREATE TABLE IF NOT EXISTS audit_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      uuid        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_role    text        NOT NULL,
  action        text        NOT NULL,
  resource_type text        NOT NULL,
  resource_id   uuid        NULL,
  metadata      jsonb       NOT NULL DEFAULT '{}',
  ip_address    inet        NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
  -- NO updated_at — audit logs are immutable
);

CREATE TRIGGER al_immutable BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_mutation();"""),

]))

# ────────────────────────────────────────────────────────────────────────────
# SECTION 9 — INDEXES
# ────────────────────────────────────────────────────────────────────────────
SECTIONS.append(("COMPLETE INDEX DEFINITIONS", [

("info", "All indexes use IF NOT EXISTS so this section is safe to re-run. Partial indexes (WHERE clause) dramatically reduce index size by excluding soft-deleted rows and completed sessions."),

("h3", "users & student_profiles"),
("sql", """CREATE INDEX IF NOT EXISTS idx_users_email
  ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_role
  ON users(role) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_status
  ON users(status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_student_profiles_user_id
  ON student_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_student_profiles_roll_number
  ON student_profiles(roll_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_student_profiles_batch_id
  ON student_profiles(batch_id) WHERE deleted_at IS NULL;
-- Trigram index for fast name search (requires pg_trgm extension)
CREATE INDEX IF NOT EXISTS idx_student_profiles_name_trgm
  ON student_profiles USING gin(full_name gin_trgm_ops)
  WHERE deleted_at IS NULL;"""),

("h3", "batches, question_banks, questions, question_options"),
("sql", """CREATE INDEX IF NOT EXISTS idx_batches_status
  ON batches(status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_question_banks_subject
  ON question_banks(subject) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_question_banks_status
  ON question_banks(status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_questions_bank_id
  ON questions(bank_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_questions_subject
  ON questions(subject) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_questions_difficulty
  ON questions(difficulty) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_questions_tags
  ON questions USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_question_options_question_id
  ON question_options(question_id);"""),

("h3", "exams, exam_questions, exam_enrollments"),
("sql", """CREATE INDEX IF NOT EXISTS idx_exams_type
  ON exams(type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_exams_status
  ON exams(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_exams_subject
  ON exams(subject) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_exams_bank_id
  ON exams(bank_id) WHERE deleted_at IS NULL;
-- Partial index for scheduled exam queries
CREATE INDEX IF NOT EXISTS idx_exams_scheduled_at
  ON exams(scheduled_at)
  WHERE deleted_at IS NULL AND type = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_exam_questions_exam_id
  ON exam_questions(exam_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_exam_questions_unique
  ON exam_questions(exam_id, question_id);

CREATE INDEX IF NOT EXISTS idx_exam_enrollments_exam_id
  ON exam_enrollments(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_enrollments_student_id
  ON exam_enrollments(student_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_exam_enrollments_unique
  ON exam_enrollments(exam_id, student_id);"""),

("h3", "exam_sessions, student_answers"),
("sql", """CREATE INDEX IF NOT EXISTS idx_exam_sessions_student_id
  ON exam_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_student_status
  ON exam_sessions(student_id, status);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_exam_id
  ON exam_sessions(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_status
  ON exam_sessions(status);
-- For cron job: finding expired active sessions
CREATE INDEX IF NOT EXISTS idx_exam_sessions_expires_at
  ON exam_sessions(expires_at) WHERE status = 'active';
-- Composite for ownership checks (student_id + exam_id)
CREATE INDEX IF NOT EXISTS idx_exam_sessions_exam_student
  ON exam_sessions(exam_id, student_id);

CREATE INDEX IF NOT EXISTS idx_student_answers_session_id
  ON student_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_student_answers_question_id
  ON student_answers(question_id);
-- Unique answer per question per session
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_answers_unique
  ON student_answers(session_id, question_id);"""),

("h3", "exam_results, security_events, active_sessions, audit_logs"),
("sql", """CREATE INDEX IF NOT EXISTS idx_exam_results_student_id
  ON exam_results(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_exam_id
  ON exam_results(exam_id);
-- For leaderboard queries — sorted by score descending
CREATE INDEX IF NOT EXISTS idx_exam_results_exam_percentage
  ON exam_results(exam_id, percentage DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_session_id
  ON security_events(session_id);
CREATE INDEX IF NOT EXISTS idx_security_events_student_id
  ON security_events(student_id);
CREATE INDEX IF NOT EXISTS idx_security_events_occurred_at
  ON security_events(occurred_at);

CREATE INDEX IF NOT EXISTS idx_active_sessions_user_id
  ON active_sessions(user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_active_sessions_token_hash
  ON active_sessions(token_hash) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_active_sessions_expires_at
  ON active_sessions(expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_active_sessions_user_status
  ON active_sessions(user_id, status);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id
  ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource
  ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_time
  ON audit_logs(actor_id, created_at DESC);"""),

]))

# ────────────────────────────────────────────────────────────────────────────
# SECTION 10 — ROW LEVEL SECURITY
# ────────────────────────────────────────────────────────────────────────────
SECTIONS.append(("ROW LEVEL SECURITY (RLS)", [

("danger", "Run ALTER TABLE ... ENABLE ROW LEVEL SECURITY on EVERY table. Default policy after enabling RLS is DENY ALL. Explicit policies then grant specific access. Missing a table means no data protection."),

("h3", "Enable RLS on all tables"),
("sql", """ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_banks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_options   ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams              ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_questions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_enrollments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_answers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_results       ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs         ENABLE ROW LEVEL SECURITY;"""),

("h3", "Admin helper function"),
("body", "SECURITY DEFINER function that checks if the calling user is an active admin. Used in every admin policy to avoid repetition and ensure consistency."),
("sql", """CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND status = 'active'
      AND deleted_at IS NULL
  );
END;
$$;"""),

("h3", "Policies: users"),
("sql", """-- Students read only their own row
CREATE POLICY "users_student_read_own" ON users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Admins read all non-deleted users
CREATE POLICY "users_admin_read_all" ON users
  FOR SELECT TO authenticated
  USING (is_admin() AND deleted_at IS NULL);

-- Only admins can create users (student accounts)
CREATE POLICY "users_admin_insert" ON users
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

-- Admins can update any user record
CREATE POLICY "users_admin_update" ON users
  FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Direct student update policy removed for security.
-- Use update_force_password_change RPC instead."""),

("h3", "Policies: student_profiles, batches, question_banks, questions, question_options"),
("sql", """-- student_profiles: students read own, admins full access
CREATE POLICY "sp_student_read_own" ON student_profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "sp_admin_all" ON student_profiles
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- batches: students read active ones, admins full access
CREATE POLICY "batches_student_read" ON batches
  FOR SELECT TO authenticated
  USING (status = 'active' AND deleted_at IS NULL);
CREATE POLICY "batches_admin_all" ON batches
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- question_banks: STUDENTS CANNOT ACCESS — admins only
CREATE POLICY "qb_admin_all" ON question_banks
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- questions: STUDENTS CANNOT READ DIRECTLY — admins only
-- Students receive question content only through exam session API response
CREATE POLICY "questions_admin_all" ON questions
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- question_options: STUDENTS CANNOT READ — is_correct field must NEVER reach client
CREATE POLICY "question_options_admin_all" ON question_options
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());"""),

("h3", "Policies: exams, exam_questions, exam_enrollments"),
("sql", """-- exams: students read active/completed only; admins full access
CREATE POLICY "exams_student_read" ON exams
  FOR SELECT TO authenticated
  USING (
    status IN ('active', 'completed')
    AND deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'student')
  );
CREATE POLICY "exams_admin_all" ON exams
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- exam_questions: students CANNOT read (snapshot is server-only)
CREATE POLICY "exam_questions_admin_all" ON exam_questions
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- exam_enrollments: students read their own; admins full access
CREATE POLICY "ee_student_read_own" ON exam_enrollments
  FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "ee_admin_all" ON exam_enrollments
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());"""),

("h3", "Policies: exam_sessions, student_answers"),
("sql", """-- exam_sessions: students read/update their own active sessions
CREATE POLICY "es_student_read_own" ON exam_sessions
  FOR SELECT TO authenticated USING (student_id = auth.uid());
-- es_student_update_own removed; all session state changes go through RPCs.
CREATE POLICY "es_admin_all" ON exam_sessions
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- student_answers: students read/write own (only if session is active)
CREATE POLICY "sa_student_read_own" ON student_answers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM exam_sessions es
      WHERE es.id = session_id AND es.student_id = auth.uid()
    )
  );
CREATE POLICY "sa_student_insert_own_active" ON student_answers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM exam_sessions es
      WHERE es.id = session_id
        AND es.student_id = auth.uid()
        AND es.status = 'active'
    )
  );

CREATE POLICY "sa_student_update_own_active" ON student_answers
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM exam_sessions es
      WHERE es.id = session_id
        AND es.student_id = auth.uid()
        AND es.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM exam_sessions es
      WHERE es.id = session_id
        AND es.student_id = auth.uid()
        AND es.status = 'active'
    )
  );
CREATE POLICY "sa_admin_read_all" ON student_answers
  FOR SELECT TO authenticated USING (is_admin());"""),

("h3", "Policies: exam_results, security_events, active_sessions, audit_logs"),
("sql", """-- exam_results: students read their own; admins read all; only service role inserts
CREATE POLICY "er_student_read_own" ON exam_results
  FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "er_admin_read_all" ON exam_results
  FOR SELECT TO authenticated USING (is_admin());

-- security_events: admins read only; inserts via service role in API routes
CREATE POLICY "se_admin_read_all" ON security_events
  FOR SELECT TO authenticated USING (is_admin());

-- active_sessions: users read their own active session
CREATE POLICY "as_user_read_own" ON active_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND status = 'active');

-- audit_logs: only admins can read; only service role can insert
CREATE POLICY "al_admin_read" ON audit_logs
  FOR SELECT TO authenticated USING (is_admin());"""),

]))

# ────────────────────────────────────────────────────────────────────────────
# SECTION 11 — DATABASE FUNCTIONS
# ────────────────────────────────────────────────────────────────────────────
SECTIONS.append(("DATABASE FUNCTIONS (STORED PROCEDURES)", [

("info", "All functions use SECURITY DEFINER — they run as the function owner (bypassing RLS). Security logic is enforced INSIDE each function. All are called via Supabase RPC from Next.js API routes using the service role key."),

("warning", "ANTIGRAVITY BUG FIXES APPLIED: (1) create_exam_session — fixed JSONB loop syntax. (2) submit_exam_session — fixed max_score to use SUM(eq.marks), added GREATEST(0,...) floor, fixed time_taken from session timestamps, added expired status handling. (3) upsert_question — fixed column name 'text' → 'content', added display_order, added created_by/updated_by. (4) publish_exam — added audit log, added smart status determination."),

("h3", "FUNCTION: update_force_password_change"),
("body", "Allows an authenticated user to clear their force_password_change flag. Strictly isolated to prevent modifications to other columns or other users."),
("sql", """CREATE OR REPLACE FUNCTION update_force_password_change(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Only allow authenticated user to update their own row
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  UPDATE users
  SET force_password_change = false, updated_at = now()
  WHERE id = p_user_id;

  -- Optional: Audit logging if it aligns with the rest of the architecture
  INSERT INTO audit_logs (actor_id, actor_role, action, resource_type, resource_id)
  VALUES (
    p_user_id, 'student', 'user.password_changed', 'user', p_user_id
  );
END;
$$;"""),

("h3", "FUNCTION: create_exam_session"),
("body", "Called when a student clicks Start Exam. Atomically creates the session + inserts one student_answers row per question + writes audit log."),
("sql", """CREATE OR REPLACE FUNCTION create_exam_session(
  p_exam_id          uuid,
  p_student_id       uuid,
  p_duration_minutes integer,
  p_question_order   jsonb,   -- shuffled array of question UUIDs
  p_option_orders    jsonb,   -- { question_id: [option_id, ...] }
  p_device_info      jsonb,
  p_ip_address       text,
  p_student_role     text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE
  v_session_id       uuid;
  v_submission_token uuid        := gen_random_uuid();
  v_expires_at       timestamptz := now() + (p_duration_minutes * interval '1 minute');

BEGIN
  -- 1. question_order is a non-empty JSON array
  IF jsonb_typeof(p_question_order) != 'array' OR jsonb_array_length(p_question_order) = 0 THEN
    RAISE EXCEPTION 'INVALID_QUESTION_ORDER';
  END IF;

  -- 2. Every element is a valid UUID & 3. No duplicates
  IF (
    SELECT COUNT(*) FROM jsonb_array_elements_text(p_question_order)
  ) != (
    SELECT COUNT(DISTINCT value) FROM jsonb_array_elements_text(p_question_order)
  ) THEN
    RAISE EXCEPTION 'INVALID_QUESTION_ORDER';
  END IF;

  -- Confirm all question IDs belong to this exam's snapshot
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(p_question_order) AS elem
    WHERE NOT EXISTS (
      SELECT 1 FROM exam_questions
      WHERE exam_id = p_exam_id
      AND question_id = elem::uuid
    )
  ) THEN
    RAISE EXCEPTION 'VALIDATION_QUESTION_NOT_IN_EXAM';
  END IF;

  -- 4. option_orders is a JSON object
  IF jsonb_typeof(p_option_orders) != 'object' THEN
    RAISE EXCEPTION 'INVALID_OPTION_ORDERS';
  END IF;

  -- 5. & 6. option_orders keys exactly match question_order elements
  IF (
    SELECT COUNT(*) FROM jsonb_array_elements_text(p_question_order) AS q
    WHERE NOT p_option_orders ? q
  ) > 0 OR (
    SELECT COUNT(*) FROM jsonb_object_keys(p_option_orders) AS k
    WHERE NOT p_question_order @> to_jsonb(k)
  ) > 0 THEN
    RAISE EXCEPTION 'INVALID_OPTION_ORDERS';
  END IF;

  -- 7. Every option UUID supplied in option_orders belongs to its associated question
  IF EXISTS (
    SELECT 1
    FROM jsonb_each(p_option_orders) AS qo(q_id, opts),
         jsonb_array_elements_text(opts) AS o(opt_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM question_options
      WHERE id = opt_id::uuid AND question_id = qo.q_id::uuid
    )
  ) THEN
    RAISE EXCEPTION 'INVALID_OPTION_ORDERS';
  END IF;

  -- Insert the exam session with exception-based concurrency control
  BEGIN
    INSERT INTO exam_sessions (
      exam_id, student_id, status, started_at, expires_at,
      question_order, option_orders, submission_token, device_info, ip_address
    ) VALUES (
      p_exam_id, p_student_id, 'active', now(), v_expires_at,
      p_question_order, p_option_orders, v_submission_token,
      p_device_info, p_ip_address::inet
    ) RETURNING id INTO v_session_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'ALREADY_EXISTS';
  END;

  -- Insert one student_answers placeholder per question
  INSERT INTO student_answers (
    session_id, question_id,
    selected_option_id, is_visited, is_marked_for_review, time_spent_seconds
  )
  SELECT v_session_id, (elem::text)::uuid, NULL, false, false, 0
  FROM jsonb_array_elements_text(p_question_order) AS elem;

  -- Audit log
  INSERT INTO audit_logs (actor_id, actor_role, action, resource_type, resource_id, ip_address)
  VALUES (
    p_student_id, p_student_role, 'exam.session_created',
    'exam', p_exam_id, p_ip_address::inet
  );

  RETURN jsonb_build_object(
    'id',               v_session_id,
    'exam_id',          p_exam_id,
    'started_at',       now(),
    'expires_at',       v_expires_at,
    'submission_token', v_submission_token,
    'status',           'active'
  );
END;
$$;"""),

("h3", "FUNCTION: compute_and_store_result"),
("body", "Internal helper to compute results for an expiring or submitted session. Idempotent."),
("sql", """CREATE OR REPLACE FUNCTION compute_and_store_result(p_session_id uuid, p_student_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE
  v_session          exam_sessions%ROWTYPE;
  v_exam             exams%ROWTYPE;
  v_total_score      numeric := 0;
  v_max_score        numeric := 0;
  v_correct_count    integer := 0;
  v_incorrect_count  integer := 0;
  v_unanswered_count integer := 0;
  v_time_taken       integer := 0;
  v_result_data      jsonb;
  v_is_passed        boolean;
  v_percentage       numeric;
BEGIN
  -- Idempotency check
  IF EXISTS (SELECT 1 FROM exam_results WHERE session_id = p_session_id) THEN
    RETURN;
  END IF;

  SELECT * INTO v_session FROM exam_sessions WHERE id = p_session_id;
  SELECT * INTO v_exam FROM exams WHERE id = v_session.exam_id;

  WITH answer_eval AS (
    SELECT
      sa.question_id,
      q.content                                              AS question_content,
      q.explanation,
      sa.selected_option_id,
      sel.content                                            AS selected_option_content,
      cor.id                                                 AS correct_option_id,
      cor.content                                            AS correct_option_content,
      sa.time_spent_seconds,
      eq.marks                                               AS question_marks,
      (sa.selected_option_id IS NULL)                        AS is_unanswered,
      (sel.id IS NOT NULL AND sel.is_correct = true)         AS is_correct,
      eq.base_order
    FROM student_answers sa
    INNER JOIN exam_questions eq
           ON eq.question_id = sa.question_id
          AND eq.exam_id     = v_session.exam_id
    INNER JOIN questions q ON q.id = sa.question_id
    LEFT  JOIN question_options sel ON sel.id = sa.selected_option_id
    INNER JOIN question_options cor
           ON cor.question_id = sa.question_id AND cor.is_correct = true
    WHERE sa.session_id = p_session_id
  ),
  scored AS (
    SELECT *,
      CASE
        WHEN is_unanswered THEN 0::numeric
        WHEN is_correct    THEN question_marks
        ELSE -(v_exam.negative_marks)
      END AS marks_awarded
    FROM answer_eval
  )
  SELECT
    GREATEST(0, COALESCE(SUM(marks_awarded), 0)),
    COALESCE(SUM(question_marks), 0),
    COUNT(*) FILTER (WHERE is_correct),
    COUNT(*) FILTER (WHERE NOT is_correct AND NOT is_unanswered),
    COUNT(*) FILTER (WHERE is_unanswered),
    jsonb_build_object(
      'questions',
      COALESCE(jsonb_agg(jsonb_build_object(
        'question_id',             question_id,
        'question_content',        question_content,
        'selected_option_id',      selected_option_id,
        'selected_option_content', selected_option_content,
        'correct_option_id',       correct_option_id,
        'correct_option_content',  correct_option_content,
        'is_correct',              is_correct,
        'is_unanswered',           is_unanswered,
        'marks_awarded',           marks_awarded,
        'explanation',             explanation,
        'time_spent_seconds',      time_spent_seconds
      ) ORDER BY base_order ASC), '[]'::jsonb)
    )
  INTO
    v_total_score, v_max_score, v_correct_count,
    v_incorrect_count, v_unanswered_count, v_result_data
  FROM scored;

  v_percentage := CASE
    WHEN v_max_score > 0 THEN ROUND((v_total_score / v_max_score) * 100, 2)
    ELSE 0
  END;

  v_is_passed := CASE
    WHEN v_exam.passing_marks IS NOT NULL THEN v_total_score >= v_exam.passing_marks
    ELSE NULL
  END;

  v_time_taken := LEAST(
    EXTRACT(EPOCH FROM (now() - v_session.started_at))::integer,
    (v_exam.duration_minutes * 60)
  );

  INSERT INTO exam_results (
    session_id, exam_id, student_id,
    total_score, max_score, percentage,
    correct_count, incorrect_count, unanswered_count,
    time_taken_seconds, is_passed, result_data
  ) VALUES (
    p_session_id, v_session.exam_id, p_student_id,
    v_total_score, v_max_score, v_percentage,
    v_correct_count, v_incorrect_count, v_unanswered_count,
    v_time_taken, v_is_passed, v_result_data
  ) ON CONFLICT DO NOTHING;
END;
$$;"""),

("h3", "FUNCTION: submit_exam_session"),
("body", "Idempotent submission. Computes full result from student_answers, stores in exam_results, marks session submitted. If already submitted, returns existing result immediately."),
("sql", """CREATE OR REPLACE FUNCTION submit_exam_session(
  p_session_id       uuid,
  p_student_id       uuid,
  p_submission_token uuid,
  p_ip_address       text,
  p_student_role     text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE
  v_session          exam_sessions%ROWTYPE;
  v_exam             exams%ROWTYPE;
  v_result_id        uuid;
  v_total_score      numeric := 0;
  v_max_score        numeric := 0;
  v_correct_count    integer := 0;
  v_incorrect_count  integer := 0;
  v_unanswered_count integer := 0;
  v_time_taken       integer := 0;
  v_result_data      jsonb;
  v_is_passed        boolean;
  v_percentage       numeric;
  v_existing         jsonb;
BEGIN
  -- Fetch and validate session ownership with row lock
  SELECT * INTO v_session FROM exam_sessions
  WHERE id = p_session_id AND student_id = p_student_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  -- Validate submission token
  IF v_session.submission_token != p_submission_token THEN
    RAISE EXCEPTION 'INVALID_TOKEN';
  END IF;

  -- Idempotency: return existing result if already submitted
  IF v_session.status = 'submitted' THEN
    SELECT jsonb_build_object(
      'id', id, 'session_id', session_id, 'exam_id', exam_id,
      'total_score', total_score, 'max_score', max_score,
      'percentage', percentage, 'is_passed', is_passed,
      'result_data', result_data
    ) INTO v_existing FROM exam_results WHERE session_id = p_session_id;
    RETURN v_existing;
  END IF;

  -- Accept 'active' or 'expired' (timer may have just run out)
  IF v_session.status NOT IN ('active', 'expired') THEN
    RAISE EXCEPTION 'SESSION_INVALID: status=%', v_session.status;
  END IF;

  -- Compute and store result
  PERFORM compute_and_store_result(p_session_id, p_student_id);

  -- Mark session submitted
  UPDATE exam_sessions
  SET status = 'submitted', submitted_at = now()
  WHERE id = p_session_id;

  SELECT id, total_score, max_score, percentage, is_passed, result_data 
  INTO v_result_id, v_total_score, v_max_score, v_percentage, v_is_passed, v_result_data 
  FROM exam_results WHERE session_id = p_session_id;

  -- Audit log
  INSERT INTO audit_logs (
    actor_id, actor_role, action, resource_type, resource_id, metadata, ip_address
  ) VALUES (
    p_student_id, p_student_role, 'exam.session_submitted',
    'exam_session', p_session_id,
    jsonb_build_object('score', v_total_score, 'percentage', v_percentage),
    p_ip_address::inet
  );

  RETURN jsonb_build_object(
    'id',          v_result_id,
    'session_id',  p_session_id,
    'exam_id',     v_session.exam_id,
    'total_score', v_total_score,
    'max_score',   v_max_score,
    'percentage',  v_percentage,
    'is_passed',   v_is_passed,
    'result_data', v_result_data
  );
END;
$$;"""),

("h3", "FUNCTION: upsert_question"),
("body", "Called from admin question editor. Handles create and update atomically. Enforces exactly 1 correct option, min 2 / max 6 options, manages display_order."),
("sql", """CREATE OR REPLACE FUNCTION upsert_question(
  p_question_id uuid,     -- NULL to create new, UUID to update existing
  p_bank_id     uuid,
  p_content     text,
  p_subject     text,
  p_topic       text,
  p_difficulty  text,
  p_tags        text[],
  p_explanation text,
  p_created_by  uuid,
  p_options     jsonb     -- [{id?: uuid, content: text, is_correct: boolean}]
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE
  v_question_id   uuid;
  v_correct_count integer;
  v_option        jsonb;
  v_display_order integer := 1;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  -- Validate: exactly 1 correct option
  SELECT COUNT(*) INTO v_correct_count
  FROM jsonb_array_elements(p_options) AS opt
  WHERE (opt->>'is_correct')::boolean = true;
  IF v_correct_count != 1 THEN
    RAISE EXCEPTION 'VALIDATION: Exactly one option must be correct. Got: %', v_correct_count;
  END IF;

  -- Validate: option count
  IF jsonb_array_length(p_options) < 2 THEN
    RAISE EXCEPTION 'VALIDATION: Minimum 2 options required';
  END IF;
  IF jsonb_array_length(p_options) > 6 THEN
    RAISE EXCEPTION 'VALIDATION: Maximum 6 options allowed';
  END IF;

  -- Upsert question (uses 'content' column — not 'text')
  IF p_question_id IS NULL THEN
    INSERT INTO questions (
      bank_id, content, type, difficulty, subject, topic,
      tags, explanation, created_by, updated_by
    ) VALUES (
      p_bank_id, p_content, 'mcq', p_difficulty, p_subject, p_topic,
      p_tags, p_explanation, p_created_by, p_created_by
    ) RETURNING id INTO v_question_id;
  ELSE
    UPDATE questions SET
      content     = p_content,
      subject     = p_subject,
      topic       = p_topic,
      difficulty  = p_difficulty,
      tags        = p_tags,
      explanation = p_explanation,
      updated_by  = p_created_by,
      updated_at  = now()
    WHERE id = p_question_id
    RETURNING id INTO v_question_id;
    IF v_question_id IS NULL THEN
      RAISE EXCEPTION 'NOT_FOUND: Question % not found', p_question_id;
    END IF;
  END IF;

  -- Delete removed options (those not present in p_options by id)
  DELETE FROM question_options
  WHERE question_id = v_question_id
    AND id NOT IN (
      SELECT (opt->>'id')::uuid
      FROM jsonb_array_elements(p_options) AS opt
      WHERE opt->>'id' IS NOT NULL AND opt->>'id' != ''
    );

  -- Upsert options with display_order
  FOR v_option IN SELECT * FROM jsonb_array_elements(p_options) LOOP
    IF v_option->>'id' IS NULL OR v_option->>'id' = '' THEN
      -- New option
      INSERT INTO question_options (question_id, content, is_correct, display_order)
      VALUES (
        v_question_id,
        v_option->>'content',
        (v_option->>'is_correct')::boolean,
        v_display_order
      );
    ELSE
      -- Update existing option
      UPDATE question_options SET
        content       = v_option->>'content',
        is_correct    = (v_option->>'is_correct')::boolean,
        display_order = v_display_order,
        updated_at    = now()
      WHERE id = (v_option->>'id')::uuid AND question_id = v_question_id;
    END IF;
    v_display_order := v_display_order + 1;
  END LOOP;

  RETURN v_question_id;
END;
$$;"""),

("h3", "FUNCTION: publish_exam"),
("body", "Called from admin exam creation wizard Step 6. Atomically creates exam + snapshots questions into exam_questions + creates enrollments. Idempotent enrollments (ON CONFLICT DO NOTHING)."),
("sql", """CREATE OR REPLACE FUNCTION publish_exam(
  p_exam         jsonb,
  p_question_ids uuid[],
  p_student_ids  uuid[],
  p_admin_id     uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE
  v_exam_id     uuid;

  v_marks       numeric(5,2);
  v_exam_status text;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  v_marks := COALESCE((p_exam->>'marks_per_question')::numeric, 1.0);

  -- Determine status from type + schedule
  IF p_exam->>'type' = 'practice' THEN
    v_exam_status := 'active';
  ELSIF (p_exam->>'scheduled_at')::timestamptz > now() THEN
    v_exam_status := 'scheduled';
  ELSE
    v_exam_status := 'active';
  END IF;

  -- Create the exam
  INSERT INTO exams (
    bank_id, title, subject, description, instructions, type,
    duration_minutes, total_questions, marks_per_question, negative_marks,
    passing_marks, status, scheduled_at, ends_at, settings, created_by, updated_by
  ) VALUES (
    (p_exam->>'bank_id')::uuid,
    p_exam->>'title',  p_exam->>'subject',
    NULLIF(p_exam->>'description', ''),
    NULLIF(p_exam->>'instructions', ''),
    p_exam->>'type',
    (p_exam->>'duration_minutes')::integer,
    array_length(p_question_ids, 1),
    v_marks,
    COALESCE((p_exam->>'negative_marks')::numeric, 0.0),
    NULLIF(p_exam->>'passing_marks', '')::numeric,
    v_exam_status,
    NULLIF(p_exam->>'scheduled_at', '')::timestamptz,
    NULLIF(p_exam->>'ends_at',      '')::timestamptz,
    COALESCE((p_exam->'settings')::jsonb,
      '{"randomize_questions":true,"randomize_options":true,
        "fullscreen_required":true,"max_tab_switches":5,
        "auto_submit_on_max_violations":false,
        "show_result_immediately":true,"allow_question_review":true,
        "show_leaderboard_after":"exam_end","watermark_enabled":true}'::jsonb),
    p_admin_id, p_admin_id
  ) RETURNING id INTO v_exam_id;

  -- Snapshot questions
  INSERT INTO exam_questions (exam_id, question_id, base_order, marks)
  SELECT v_exam_id, q_id, q_order, v_marks
  FROM unnest(p_question_ids) WITH ORDINALITY AS t(q_id, q_order);

  -- Create enrollments (idempotent)
  INSERT INTO exam_enrollments (exam_id, student_id, enrolled_by)
  SELECT v_exam_id, s_id, p_admin_id
  FROM unnest(p_student_ids) AS s_id
  ON CONFLICT (exam_id, student_id) DO NOTHING;

  -- Audit log
  INSERT INTO audit_logs (
    actor_id, actor_role, action, resource_type, resource_id, metadata
  ) VALUES (
    p_admin_id, 'admin', 'admin.exam_published', 'exam', v_exam_id,
    jsonb_build_object(
      'title',          p_exam->>'title',
      'type',           p_exam->>'type',
      'question_count', array_length(p_question_ids, 1),
      'student_count',  array_length(p_student_ids,  1)
    )
  );

  RETURN v_exam_id;
END;
$$;"""),

("h3", "FUNCTION: get_monitoring_data"),
("body", "Called every 30 seconds from admin monitoring page. Returns all enrolled students with their current session status for a given exam."),
("sql", """CREATE OR REPLACE FUNCTION get_monitoring_data(p_exam_id uuid)
RETURNS TABLE (
  full_name           text,
  roll_number         text,
  student_id          uuid,
  session_id          uuid,
  status              text,
  started_at          timestamptz,
  expires_at          timestamptz,
  submitted_at        timestamptz,
  last_synced_at      timestamptz,
  security_violations integer,
  enrolled_id         uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  RETURN QUERY
  SELECT
    sp.full_name, sp.roll_number, ee.student_id,
    es.id, es.status, es.started_at, es.expires_at,
    es.submitted_at, es.last_synced_at, es.security_violations,
    ee.id
  FROM exam_enrollments ee
  INNER JOIN student_profiles sp
          ON sp.user_id = ee.student_id AND sp.deleted_at IS NULL
  LEFT JOIN exam_sessions es
         ON es.exam_id     = ee.exam_id
        AND es.student_id  = ee.student_id
        AND es.status IN ('active', 'submitted', 'expired', 'terminated')
  WHERE ee.exam_id = p_exam_id
  ORDER BY sp.full_name ASC;
END;
$$;"""),

("h3", "FUNCTION: get_exam_report"),
("body", "On-demand post-exam report for admin. Computes class summary and per-student breakdown from stored results. Does NOT re-evaluate student_answers — uses pre-computed exam_results only."),
("sql", """CREATE OR REPLACE FUNCTION get_exam_report(p_exam_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_summary  jsonb;
  v_students jsonb;
  v_question_analysis jsonb;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  -- Class-level summary
  SELECT jsonb_build_object(
    'exam_id',            p_exam_id,
    'enrolled_count',     COUNT(DISTINCT ee.student_id),
    'submitted_count',    COUNT(DISTINCT er.student_id),
    'avg_percentage',     ROUND(AVG(er.percentage), 2),
    'highest_percentage', MAX(er.percentage),
    'pass_count',   COUNT(*) FILTER (WHERE er.is_passed = true),
    'fail_count',   COUNT(*) FILTER (WHERE er.is_passed = false)
  ) INTO v_summary
  FROM exam_enrollments ee
  LEFT JOIN exam_results er
         ON er.exam_id = ee.exam_id AND er.student_id = ee.student_id
  WHERE ee.exam_id = p_exam_id;

  -- Per-student results with rank
  SELECT jsonb_agg(
    jsonb_build_object(
      'rank',               ROW_NUMBER() OVER (ORDER BY er.percentage DESC),
      'student_id',         sp.user_id,
      'full_name',          sp.full_name,
      'roll_number',        sp.roll_number,
      'total_score',        er.total_score,
      'max_score',          er.max_score,
      'percentage',         er.percentage,
      'is_passed',          er.is_passed,
      'time_taken_seconds', er.time_taken_seconds,
      'session_id',         er.session_id
    ) ORDER BY er.percentage DESC
  ) INTO v_students
  FROM exam_results er
  INNER JOIN student_profiles sp ON sp.user_id = er.student_id
  WHERE er.exam_id = p_exam_id;

  RETURN jsonb_build_object(
    'summary',  v_summary,
    'students', COALESCE(v_students, '[]'::jsonb)
  );
END;
$$;"""),

("info", "AUTHORIZATION NOTE: get_leaderboard() is intentionally unrestricted at the database layer. The application layer handles visibility via the show_leaderboard_after exam setting. Explicitly documented to acknowledge this intentional design."), 
("h3", "FUNCTION: get_leaderboard"),
("body", "Returns top 50 for a given exam. Called from result screen and admin reports. Respects the show_leaderboard_after setting in application layer."),
("sql", """CREATE OR REPLACE FUNCTION get_leaderboard(p_exam_id uuid)
RETURNS TABLE (
  rank         bigint,
  student_id   uuid,
  full_name    text,
  total_score  numeric,
  percentage   numeric,
  submitted_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Validate leaderboard publication state
  IF NOT EXISTS (
    SELECT 1 FROM exams
    WHERE id = p_exam_id
      AND status IN ('active', 'completed')
      AND (
        settings->>'show_leaderboard_after' = 'always' OR
        (settings->>'show_leaderboard_after' = 'exam_end' AND (status = 'completed' OR type = 'practice'))
      )
  ) THEN
    RAISE EXCEPTION 'LEADERBOARD_UNAVAILABLE';
  END IF;

  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY er.percentage DESC, er.computed_at ASC),
    er.student_id,
    sp.full_name,
    er.total_score,
    er.percentage,
    es.submitted_at
  FROM exam_results er
  INNER JOIN student_profiles sp
          ON sp.user_id = er.student_id AND sp.deleted_at IS NULL
  INNER JOIN exam_sessions es ON es.id = er.session_id
  WHERE er.exam_id = p_exam_id
  ORDER BY er.percentage DESC, er.computed_at ASC
  LIMIT 50;
END;
$$;"""),

("h3", "FUNCTION: admin_force_submit_session"),
("body", "Force submits a session. Requires admin privileges."),
("sql", """CREATE OR REPLACE FUNCTION admin_force_submit_session(
  p_session_id uuid,
  p_admin_id   uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_session exam_sessions%ROWTYPE;
BEGIN
  -- Authorization
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  -- Fetch and lock session
  SELECT * INTO v_session
  FROM exam_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  -- Only force-submit active or expired sessions
  IF v_session.status NOT IN ('active', 'expired') THEN
    RAISE EXCEPTION 'SESSION_INVALID: status=%', v_session.status;
  END IF;

  -- Compute and store result (idempotent)
  PERFORM compute_and_store_result(p_session_id, v_session.student_id);

  -- Mark submitted
  UPDATE exam_sessions
  SET status = 'submitted', submitted_at = now()
  WHERE id = p_session_id;

  -- Audit log
  INSERT INTO audit_logs (actor_id, actor_role, action, resource_type, resource_id, metadata)
  VALUES (
    p_admin_id, 'admin', 'admin.force_submitted',
    'exam_session', p_session_id,
    jsonb_build_object('student_id', v_session.student_id, 'exam_id', v_session.exam_id)
  );

  RETURN jsonb_build_object('session_id', p_session_id, 'status', 'submitted');
END;
$$;"""),

("h3", "FUNCTION: expire_stale_sessions"),
("body", "Schedule this as a cron job every 5 minutes via Supabase Dashboard > Database > Cron Jobs. Marks expired active sessions and logs the event."),
("sql", """CREATE OR REPLACE FUNCTION expire_stale_sessions()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE
  v_count integer;
BEGIN
  WITH updated_rows AS (
    UPDATE exam_sessions
    SET status = 'expired', updated_at = now()
    WHERE status = 'active'
      AND expires_at < now() - interval '2 minutes'
    RETURNING id, student_id
  )
  INSERT INTO audit_logs (actor_id, actor_role, action, resource_type, resource_id)
  SELECT student_id, 'system', 'exam.session_expired', 'exam_session', id
  FROM updated_rows;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Schedule via Supabase Dashboard > Database > Cron Jobs:
-- Name: expire_stale_sessions
-- Schedule: */5 * * * *   (every 5 minutes)
-- Command: SELECT expire_stale_sessions();"""),

]))

# ────────────────────────────────────────────────────────────────────────────
# SECTION 12 — GRANTS
# ────────────────────────────────────────────────────────────────────────────
SECTIONS.append(("FUNCTION GRANTS & RPC ACCESS", [

("info", "These GRANT statements allow authenticated Supabase users to call functions via RPC. Functions are SECURITY DEFINER so they run as the DB owner — the security is inside each function body, not at the RLS layer."),

("sql", """-- Allow authenticated users to call all public functions via Supabase RPC
GRANT EXECUTE ON FUNCTION create_exam_session   TO authenticated;
GRANT EXECUTE ON FUNCTION submit_exam_session   TO authenticated;
GRANT EXECUTE ON FUNCTION admin_force_submit_session TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_question       TO authenticated;
GRANT EXECUTE ON FUNCTION publish_exam          TO authenticated;
GRANT EXECUTE ON FUNCTION get_monitoring_data   TO authenticated;
GRANT EXECUTE ON FUNCTION get_exam_report       TO authenticated;
GRANT EXECUTE ON FUNCTION get_leaderboard       TO authenticated;
GRANT EXECUTE ON FUNCTION update_force_password_change TO authenticated;
REVOKE EXECUTE ON FUNCTION is_admin FROM authenticated;"""),

]))

# ────────────────────────────────────────────────────────────────────────────
# SECTION 13 — STORAGE
# ────────────────────────────────────────────────────────────────────────────
SECTIONS.append(("STORAGE BUCKET SETUP", [

("info", "Create the student-photos bucket in Supabase Dashboard > Storage > New Bucket. Then apply these RLS policies via SQL Editor."),

("h3", "Create bucket (Dashboard steps)"),
("body", "1. Go to Supabase Dashboard → Storage → New Bucket\n2. Name: student-photos\n3. Public: OFF (private)\n4. File size limit: 2 MB\n5. Allowed MIME types: image/jpeg, image/png, image/webp"),

("h3", "Storage RLS policies"),
("sql", """-- Students access only their own photos (folder = their user_id)
CREATE POLICY "student_photos_read_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "student_photos_upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'student-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Admins have full access to student photos
CREATE POLICY "admin_storage_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'student-photos' AND is_admin())
  WITH CHECK (bucket_id = 'student-photos' AND is_admin());"""),

]))

# ────────────────────────────────────────────────────────────────────────────
# SECTION 14 — VERIFICATION
# ────────────────────────────────────────────────────────────────────────────
SECTIONS.append(("VERIFICATION QUERIES", [

("info", "Run these after setup to confirm everything is configured correctly. All checks should return the expected values."),

("h3", "Verify all tables exist with RLS enabled"),
("sql", """-- Expected: 15 rows, all with rowsecurity = true
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;"""),

("h3", "Verify all indexes were created"),
("sql", """-- Check index count per table
SELECT tablename, COUNT(*) AS index_count
FROM pg_indexes
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;"""),

("h3", "Verify all functions exist"),
("sql", """SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;
-- Expected: create_exam_session, expire_stale_sessions, get_exam_report,
--           get_leaderboard, get_monitoring_data, is_admin,
--           publish_exam, set_updated_at, submit_exam_session, upsert_question"""),

("h3", "Security verification — run as a test student user"),
("sql", """-- If running as a student (anon/authenticated with student role):
-- These should ALL return 0 rows (RLS blocking access):
SELECT COUNT(*) AS question_banks_visible FROM question_banks;
SELECT COUNT(*) AS questions_visible       FROM questions;
SELECT COUNT(*) AS question_options_visible FROM question_options;
SELECT COUNT(*) AS other_answers           FROM student_answers
  WHERE session_id NOT IN (
    SELECT id FROM exam_sessions WHERE student_id = auth.uid()
  );
-- These should return > 0 for your own data:
SELECT COUNT(*) AS my_profile FROM student_profiles WHERE user_id = auth.uid();"""),

]))


# ── PDF Builder ───────────────────────────────────────────────────────────────
def build_pdf(path):
    doc = SimpleDocTemplate(
        path,
        pagesize=A4,
        leftMargin=1.8*cm, rightMargin=1.8*cm,
        topMargin=2.2*cm, bottomMargin=2*cm,
        title="AVIORA Supabase SQL Reference",
        author="ZYXEN",
    )
    styles = build_styles()
    story = []

    # ── Cover Page ────────────────────────────────────────────────────────────
    story.append(Spacer(1, 1*cm))

    # Navy cover block
    cover_table = Table(
        [[
            Paragraph("✈  AVIORA", ParagraphStyle("CL", fontName="Helvetica-Bold",
                fontSize=11, textColor=AMBER, leading=14)),
            ""
        ]],
        colWidths=[W - 3.6*cm], rowHeights=[28]
    )
    cover_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), NAVY),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 14),
        ('ROUNDEDCORNERS', [8]),
    ]))
    story.append(cover_table)
    story.append(Spacer(1, 0.4*cm))

    # Big title block
    title_block = Table(
        [[Paragraph(
            "Supabase SQL<br/>Reference",
            ParagraphStyle("BigTitle", fontName="Helvetica-Bold", fontSize=34,
                textColor=NAVY, leading=40)
        )]],
        colWidths=[W - 3.6*cm], rowHeights=[120]
    )
    title_block.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), NAVY_LIGHT),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 20),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(title_block)
    story.append(Spacer(1, 0.3*cm))

    # Meta info table
    today = datetime.datetime.now().strftime("%d %B %Y")
    meta = [
        ["Project", "AVIORA Examination Portal"],
        ["Builder", "ZYXEN"],
        ["Version", "1.0"],
        ["Date",    today],
        ["Database", "Supabase PostgreSQL (Pro Plan)"],
        ["Tables",  "15 tables · 40+ indexes · 15 functions"],
    ]
    mt = Table(meta, colWidths=[3.5*cm, W - 3.6*cm - 3.5*cm])
    mt.setStyle(TableStyle([
        ('FONTNAME',  (0,0), (0,-1), 'Helvetica-Bold'),
        ('FONTNAME',  (1,0), (1,-1), 'Helvetica'),
        ('FONTSIZE',  (0,0), (-1,-1), 9),
        ('TEXTCOLOR', (0,0), (0,-1), NAVY),
        ('TEXTCOLOR', (1,0), (1,-1), TEXT_SEC),
        ('TOPPADDING',    (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [SURFACE, CODE_BG]),
        ('LINEBELOW', (0,-1), (-1,-1), 0.5, BORDER),
    ]))
    story.append(mt)
    story.append(Spacer(1, 0.4*cm))

    # Warning box on cover
    story.append(NoteBox(
        "CONFIDENTIAL — This document contains the complete database schema and "
        "security configuration for the AVIORA examination portal. "
        "Do not share outside the ZYXEN development team. "
        "Run all SQL statements in Supabase SQL Editor IN THE ORDER SHOWN.",
        kind='danger'
    ))
    story.append(Spacer(1, 0.3*cm))

    # Antigravity corrections summary
    story.append(NoteBox(
        "ANTIGRAVITY BUG FIXES INCLUDED: 4 functions from Antigravity contained bugs "
        "that would cause production failures. All have been corrected in this document. "
        "Key fixes: (1) submit_exam_session — max_score now uses SUM(eq.marks) instead of COUNT(*)*marks, "
        "GREATEST(0,...) floor applied to total_score, time_taken uses session wall-clock not answer sum. "
        "(2) create_exam_session — JSONB loop syntax corrected. "
        "(3) upsert_question — column 'text' renamed to 'content', display_order and created_by added. "
        "(4) publish_exam — audit log added, status auto-determined from type+schedule.",
        kind='warning'
    ))

    story.append(PageBreak())

    # ── Table of Contents ─────────────────────────────────────────────────────
    toc_header = Table(
        [[Paragraph("Table of Contents", ParagraphStyle("TOCHead",
            fontName="Helvetica-Bold", fontSize=16, textColor=white))]],
        colWidths=[W - 3.6*cm], rowHeights=[36]
    )
    toc_header.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), NAVY),
        ('LEFTPADDING', (0,0), (-1,-1), 14),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(toc_header)
    story.append(Spacer(1, 0.3*cm))

    for i, (section_title, _) in enumerate(SECTIONS, 1):
        toc_row = Table(
            [[
                Paragraph(f"  {i:02d}", ParagraphStyle("TN",
                    fontName="Helvetica-Bold", fontSize=10, textColor=AMBER)),
                Paragraph(section_title, styles['toc_section']),
            ]],
            colWidths=[1.2*cm, W - 3.6*cm - 1.2*cm]
        )
        toc_row.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('ROWBACKGROUNDS', (0,0), (-1,-1), [SURFACE if i%2==0 else CODE_BG]),
        ]))
        story.append(toc_row)

    story.append(PageBreak())

    # ── Main content ──────────────────────────────────────────────────────────
    for sec_num, (section_title, items) in enumerate(SECTIONS, 1):
        # Section header
        story.append(SectionHeader(sec_num, section_title, styles))
        story.append(Spacer(1, 0.35*cm))

        for item_type, content in items:
            if item_type == "sql":
                block = CodeBlock(content)
                story.append(block)
                story.append(Spacer(1, 0.25*cm))
            elif item_type == "h3":
                story.append(KeepTogether([
                    Paragraph(content, styles['h3']),
                    HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=4),
                ]))
            elif item_type == "body":
                for line in content.split('\n'):
                    if line.strip():
                        story.append(Paragraph(line.strip(), styles['body']))
            elif item_type == "warning":
                story.append(NoteBox(content, kind='warning'))
                story.append(Spacer(1, 0.2*cm))
            elif item_type == "danger":
                story.append(NoteBox(content, kind='danger'))
                story.append(Spacer(1, 0.2*cm))
            elif item_type == "info":
                story.append(NoteBox(content, kind='info'))
                story.append(Spacer(1, 0.2*cm))
            elif item_type == "success":
                story.append(NoteBox(content, kind='success'))
                story.append(Spacer(1, 0.2*cm))

        story.append(PageBreak())

    # ── Back cover ────────────────────────────────────────────────────────────
    story.append(Spacer(1, 4*cm))
    back = Table(
        [[Paragraph(
            "This SQL reference covers the complete production database for the "
            "AVIORA Examination Portal. For a new tenant, run every section in order "
            "in a fresh Supabase project. The schema is deliberately generic — "
            "no aviation-specific column names — making it reusable across clients.",
            ParagraphStyle("BackText", fontName="Helvetica", fontSize=10,
                textColor=white, leading=16, alignment=TA_CENTER)
        )]],
        colWidths=[W - 3.6*cm], rowHeights=[120]
    )
    back.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), NAVY),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 24),
        ('RIGHTPADDING', (0,0), (-1,-1), 24),
        ('TOPPADDING', (0,0), (-1,-1), 20),
        ('BOTTOMPADDING', (0,0), (-1,-1), 20),
    ]))
    story.append(back)
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph(
        f"AVIORA Examination Portal · ZYXEN · {today} · v1.0",
        ParagraphStyle("Footer", fontName="Helvetica", fontSize=8,
            textColor=TEXT_SEC, alignment=TA_CENTER)
    ))

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f"Success: PDF generated at {path}")


if __name__ == "__main__":
    out = "AVIORA_Supabase_SQL_Reference.pdf"
    build_pdf(out)