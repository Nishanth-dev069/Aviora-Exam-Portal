import { useState, useEffect } from 'react';
import { db, IDBAnswer } from '@/lib/db';
import Dexie from 'dexie';
import { getTimeRemainingMs, restoreCalibration } from '@/lib/exam/timer';
import { logger } from '@/lib/logger';

export type ExamPageState = 'loading' | 'active' | 'expired' | 'error';

export function useExamSession(sessionId: string) {
  const [state, setState] = useState<ExamPageState>('loading');
  
  useEffect(() => {
    async function initializeSession() {
      try {
        restoreCalibration();
        // 1. Check IndexedDB for existing session
        const localSession = await db.examSession.get(sessionId);
        
        if (localSession) {
          const remainingMs = getTimeRemainingMs(localSession.expires_at);
          
          if (remainingMs > 0) {
            // 2a. Session found locally and not expired — render immediately
            const localAnswers = await db.answers
              .where('[session_id+question_id]')
              .between([sessionId, Dexie.minKey], [sessionId, Dexie.maxKey])
              .toArray();
            
            setState('active');
            
            // 3. Verify with server in background
            verifyWithServer(sessionId, localAnswers);
          } else {
            // 4. Expired locally — check server
            await checkServerSession(sessionId);
          }
        } else {
          // 5. Nothing local — fetch from server
          await fetchFromServer(sessionId);
        }
      } catch (err) {
        console.error('Failed to initialize session from IndexedDB', err);
        setState('error');
      }
    }
    
    initializeSession();
  }, [sessionId]);

// Stubs for background network verifications
  async function verifyWithServer(sid: string, localAnswers: IDBAnswer[]) {
    logger.log(`Verifying session ${sid} with server...`, localAnswers.length, 'answers');
  }

  async function checkServerSession(sid: string) {
    logger.log(`Checking server for expired session ${sid}`);
    setState('expired');
  }

  async function fetchFromServer(sid: string) {
    logger.log(`Fetching missing session ${sid} from server`);
    setState('error');
  }

  return { state };
}
