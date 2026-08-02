import Dexie, { Table } from 'dexie';
import { SessionStatus, SyncStatus, SecurityEventType, ExamSettings } from '@/types';

export interface IDBExamSession {
  session_id: string;          // primary key
  exam_id: string;
  student_id: string;
  status: SessionStatus;
  started_at: string;          // ISO string
  expires_at: string;          // ISO string
  submission_token: string;
  clock_offset: number;        // server_time - client_time in ms
  security_violations: number;
  settings: ExamSettings;
  exam_title: string;
  exam_subject: string;
  duration_minutes: number;
  question_ids: string[];      // ordered array of question IDs for this student
  student_identity?: {
    full_name: string;
    roll_number: string;
    batch_name: string;
    email: string;
    photo_url: string | null;
  };
}

export interface IDBQuestion {
  question_id: string;         // primary key
  session_id: string;
  content: string;
  content_image_url?: string | null;
  explanation_image_url?: string | null;
  options: Array<{ id: string; content: string }>;  // in randomized order
}

export interface IDBAnswer {
  question_id: string;         // compound primary key with session_id mapped virtually
  session_id: string;
  selected_option_id: string | null;
  is_marked_for_review: boolean;
  is_visited: boolean;
  time_spent_seconds: number;
  updated_at: string;          // ISO string
  sync_status: SyncStatus;     // 'local' | 'pending' | 'synced' | 'failed'
}

export interface IDBSyncRecord {
  sync_id: string;             // primary key (UUID generated client-side)
  session_id: string;
  created_at: string;
  attempt_count: number;
  last_attempt_at: string | null;
}

export interface IDBSecurityEvent {
  id?: number;                 // auto-increment
  session_id: string;
  event_type: SecurityEventType;
  occurred_at: string;
  duration_seconds: number | null;
  event_data: Record<string, unknown>;
  synced: boolean;
}

class AviosaDB extends Dexie {
  examSession!: Table<IDBExamSession>;
  questions!: Table<IDBQuestion>;
  answers!: Table<IDBAnswer>;
  syncRecords!: Table<IDBSyncRecord>;
  securityEvents!: Table<IDBSecurityEvent>;

  constructor() {
    super('AviosaExamDB');
    this.version(1).stores({
      examSession: '&session_id, exam_id, status',
      questions: '&question_id, session_id',
      answers: '[session_id+question_id], sync_status, updated_at',
      syncRecords: '&sync_id, session_id',
      securityEvents: '++id, session_id, synced',
    });
  }
}

export const db = new AviosaDB();

export async function checkIndexedDBAvailability(): Promise<boolean> {
  try {
    await db.examSession.count();
    return true;
  } catch {
    return false;
  }
}

export async function clearExamDataFromIndexedDB(examId: string): Promise<void> {
  try {
    const sessions = await db.examSession
      .where('exam_id')
      .equals(examId)
      .toArray();

    for (const s of sessions) {
      await db.questions.where('session_id').equals(s.session_id).delete();
      await db.answers.where({ session_id: s.session_id }).delete();
      await db.securityEvents.where('session_id').equals(s.session_id).delete();
      await db.examSession.delete(s.session_id);
    }
  } catch (err) {
    console.warn('[AVIORA] Could not clear old exam data from IndexedDB:', err);
  }
}
