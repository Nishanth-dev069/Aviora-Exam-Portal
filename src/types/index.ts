// Database row types — match schema exactly
export type UserRole = 'student' | 'admin' | 'super_admin';
export type UserStatus = 'active' | 'suspended' | 'deactivated';
export type ExamType = 'practice' | 'scheduled';
export type ExamStatus = 'draft' | 'scheduled' | 'active' | 'completed' | 'archived';
export type SessionStatus = 'active' | 'submitted' | 'expired' | 'terminated';
export type SyncStatus = 'local' | 'pending' | 'synced' | 'failed'; // client-side only
export type SecurityEventType =
  | 'fullscreen_exit'
  | 'tab_switch'
  | 'focus_loss'
  | 'right_click_attempt'
  | 'keyboard_shortcut_blocked'
  | 'copy_attempt'
  | 'paste_attempt'
  | 'context_menu_blocked';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  force_password_change: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface StudentProfile {
  id: string;
  user_id: string;
  full_name: string;
  roll_number: string;
  batch_id: string | null;
  photo_url: string | null;
  phone: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Batch {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface QuestionBank {
  id: string;
  name: string;
  subject: string;
  description: string | null;
  status: 'active' | 'archived';
  created_by: string;
  created_at: string;
  question_count?: number;
}

export interface QuestionOption {
  id: string;
  question_id: string;
  content: string;
  is_correct: boolean;
  display_order: number;
}

export interface Question {
  id: string;
  bank_id: string;
  content: string;
  type: 'mcq';
  difficulty: 'easy' | 'medium' | 'hard';
  subject: string;
  topic: string | null;
  tags: string[];
  explanation: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  options?: QuestionOption[];
}

export interface ExamSettings {
  randomize_questions: boolean;
  randomize_options: boolean;
  fullscreen_required: boolean;
  max_tab_switches: number;
  auto_submit_on_max_violations: boolean;
  show_result_immediately: boolean;
  allow_question_review: boolean;
  show_leaderboard_after: 'submission' | 'exam_end';
  watermark_enabled: boolean;
}

export interface Exam {
  id: string;
  bank_id: string;
  title: string;
  subject: string;
  description: string | null;
  instructions: string | null;
  type: ExamType;
  duration_minutes: number;
  total_questions: number;
  marks_per_question: number;
  negative_marks: number;
  passing_marks: number | null;
  status: ExamStatus;
  scheduled_at: string | null;
  ends_at: string | null;
  settings: ExamSettings;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ExamSession {
  id: string;
  exam_id: string;
  student_id: string;
  status: SessionStatus;
  started_at: string;
  expires_at: string;
  submitted_at: string | null;
  last_synced_at: string | null;
  question_order: string[];
  option_orders: Record<string, string[]>;
  submission_token: string;
  security_violations: number;
}

export interface StudentAnswer {
  session_id: string;
  question_id: string;
  selected_option_id: string | null;
  is_marked_for_review: boolean;
  is_visited: boolean;
  time_spent_seconds: number;
  updated_at: string;
  sync_status?: SyncStatus;
}

export interface ExamResult {
  id: string;
  session_id: string;
  exam_id: string;
  student_id: string;
  total_score: number;
  max_score: number;
  percentage: number;
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
  time_taken_seconds: number;
  is_passed: boolean | null;
  computed_at: string;
  result_data: ResultData;
}

export interface ResultData {
  questions: ResultQuestion[];
}

export interface ResultQuestion {
  question_id: string;
  question_content: string;
  content_image_url?: string | null;
  explanation_image_url?: string | null;
  selected_option_id: string | null;
  selected_option_content: string | null;
  correct_option_id: string;
  correct_option_content: string;
  is_correct: boolean;
  is_unanswered: boolean;
  marks_awarded: number;
  explanation: string | null;
  time_spent_seconds: number;
}

// API response shapes
export interface ApiError {
  error: { code: string; message: string; details: unknown | null };
}

export interface ExamStartResponse {
  session: ExamSession;
  exam: Exam;
  questions: ClientQuestion[];
  server_time: string;
}

export interface ClientQuestion {
  id: string;
  content: string;
  options: ClientOption[];
}

export interface ClientOption {
  id: string;
  content: string; // NO is_correct field ever sent to client
}
