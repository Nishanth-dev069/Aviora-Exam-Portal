import { db } from '@/lib/db';
import Dexie from 'dexie';
import { SyncStatus } from '@/types';
import { recalibrateFromSync } from './timer';

export class SyncEngine {
  private sessionId: string;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;
  private onSyncStatus?: (status: 'saving' | 'saved' | 'offline' | 'error') => void;
  private setStatus(status: 'saving' | 'saved' | 'offline' | 'error') {
    if (this.onSyncStatus) this.onSyncStatus(status);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('exam:sync_status', { detail: status }));
    }
  }

  constructor(sessionId: string, onSyncStatus?: (status: 'saving' | 'saved' | 'offline' | 'error') => void) {
    this.sessionId = sessionId;
    if (onSyncStatus) this.onSyncStatus = onSyncStatus;
  }

  start() {
    // Sync every 10 seconds for real-time live monitoring
    this.intervalId = setInterval(() => this.sync(), 10_000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async triggerImmediateSync() {
    await this.sync();
  }

  private async sync() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    
    try {
      // 1. Collect answers where sync_status is 'local' or 'failed'
      const pending = await db.answers
        .where('[session_id+question_id]')
        .between([this.sessionId, Dexie.minKey], [this.sessionId, Dexie.maxKey])
        .filter(a => a.sync_status === 'local' || a.sync_status === 'failed')
        .toArray();
      
      // Collect pending security events
      const pendingEvents = await db.securityEvents
        .where({ session_id: this.sessionId, synced: false })
        .toArray();

      // Collect session violations count
      const session = await db.examSession.get(this.sessionId);
      const security_violations = session?.security_violations || 0;
      
      if (pending.length === 0 && pendingEvents.length === 0 && security_violations === 0) {
        this.isSyncing = false;
        return;
      }
      
      // 2. Generate sync_id for idempotency
      const sync_id = crypto.randomUUID();
      
      // 3. Mark as 'pending' in local DB
      await db.answers.bulkPut(pending.map(a => ({ ...a, sync_status: 'pending' as SyncStatus })));
      
      this.setStatus('saving');
      
      // 4. Send to server
      const response = await fetch('/api/exam/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
          sync_id,
          security_violations,
          answers: pending.map(a => ({
            question_id: a.question_id,
            selected_option_id: a.selected_option_id,
            is_marked_for_review: a.is_marked_for_review,
            is_visited: a.is_visited,
            time_spent_seconds: a.time_spent_seconds,
            updated_at: a.updated_at,
          })),
          security_events: pendingEvents.map(e => ({
            event_type: e.event_type,
            occurred_at: e.occurred_at,
            duration_seconds: e.duration_seconds,
            event_data: e.event_data,
          })),
        }),
      });
      
      if (response.ok) {
        // 5a. Mark as synced
        await db.answers.bulkPut(pending.map(a => ({ ...a, sync_status: 'synced' as SyncStatus })));
        await db.securityEvents.bulkPut(pendingEvents.map(e => ({ ...e, synced: true })));
        this.setStatus('saved');

        const syncData = await response.json().catch(() => null);
        if (syncData?.server_time) {
          recalibrateFromSync(syncData.server_time);
        }
      } else if (response.status === 401) {
        // Session terminated — bubble this up to exam UI
        const data = await response.json();
        if (data?.error?.code === 'SESSION_TERMINATED') {
          this.stop();
          window.dispatchEvent(new CustomEvent('exam:session_terminated'));
        }
      } else {
        // 5b. Mark as failed (will retry)
        await db.answers.bulkPut(pending.map(a => ({ ...a, sync_status: 'failed' as SyncStatus })));
        this.setStatus('error');
      }
    } catch {
      // Network error — mark as failed
      try {
        const pending = await db.answers
          .where('[session_id+question_id]')
          .between([this.sessionId, Dexie.minKey], [this.sessionId, Dexie.maxKey])
          .filter(a => a.sync_status === 'pending')
          .toArray();
        await db.answers.bulkPut(pending.map(a => ({ ...a, sync_status: 'failed' as SyncStatus })));
      } catch (e) {
        console.error('Failed to update sync_status on error', e);
      }
      this.setStatus('offline');
    } finally {
      this.isSyncing = false;
    }
  }
}
