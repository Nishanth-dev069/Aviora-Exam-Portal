'use client';

import { useState, useEffect } from 'react';
import { X, Search, Users, User, Check, Loader2 } from 'lucide-react';

interface Student {
  id: string;
  full_name: string;
  roll_number: string;
  batch_name?: string;
  batch_id?: string;
}

interface Batch {
  id: string;
  name: string;
  student_count: number;
}

interface Props {
  examId: string;
  examTitle: string;
  enrolledStudentIds: Set<string>;
  onClose: () => void;
  onEnrolled: (count: number) => void;
}

export function ManageEnrollmentsModal({
  examId, examTitle, enrolledStudentIds, onClose, onEnrolled
}: Props) {
  const [tab, setTab] = useState<'students' | 'batches'>('students');
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allBatches, setAllBatches] = useState<Batch[]>([]);
  const [search, setSearch] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [studentsRes, batchesRes] = await Promise.all([
          fetch('/api/admin/students?format=simple'),
          fetch('/api/admin/batches?format=simple'),
        ]);
        const [studentsData, batchesData] = await Promise.all([
          studentsRes.json(),
          batchesRes.json(),
        ]);
        setAllStudents(studentsData.students ?? studentsData.data ?? []);
        setAllBatches(batchesData.batches ?? batchesData.data ?? []);
      } catch (err) {
        console.error('Failed to load students/batches:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const filteredStudents = allStudents.filter(s =>
    (s.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.roll_number || '').toLowerCase().includes(search.toLowerCase())
  );

  const toggleStudent = (id: string) => {
    if (enrolledStudentIds.has(id)) return; // Already enrolled
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleBatch = (id: string) => {
    setSelectedBatchIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (selectedStudentIds.size === 0 && selectedBatchIds.size === 0) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/exams/${examId}/enrollments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_ids: Array.from(selectedStudentIds),
          batch_ids: Array.from(selectedBatchIds),
        }),
      });
      if (!res.ok) throw new Error('Enrollment failed');
      const data = await res.json();
      onEnrolled(data.added_count);
      onClose();
    } catch (err) {
      console.error('Enrollment error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const totalSelected = selectedStudentIds.size + selectedBatchIds.size;

  return (
    // Full-screen modal backdrop
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-xl max-h-[85vh] flex flex-col bg-surface rounded-xl border border-border shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-text-primary">Manage Enrollments</h2>
            <p className="text-xs text-text-secondary mt-0.5 truncate">{examTitle}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-surface-2 text-text-muted hover:text-text-primary transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border flex-shrink-0">
          {(['students', 'batches'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${
                tab === t
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {t === 'students' ? <User className="h-4 w-4" /> : <Users className="h-4 w-4" />}
              {t === 'students' ? 'Individual Students' : 'Entire Batches'}
            </button>
          ))}
        </div>

        {/* Search (students tab only) */}
        {tab === 'students' && (
          <div className="px-4 py-3 border-b border-border flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search by name or roll number..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-text-primary placeholder:text-text-muted"
              />
            </div>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
            </div>
          ) : tab === 'students' ? (
            <div className="divide-y divide-border">
              {filteredStudents.length === 0 ? (
                <div className="p-8 text-center text-xs text-text-muted font-medium">
                  {search ? 'No students match your search.' : 'No students available.'}
                </div>
              ) : (
                filteredStudents.map(student => {
                  const isEnrolled = enrolledStudentIds.has(student.id);
                  const isSelected = selectedStudentIds.has(student.id);
                  return (
                    <button
                      key={student.id}
                      onClick={() => toggleStudent(student.id)}
                      disabled={isEnrolled}
                      className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${
                        isEnrolled
                          ? 'opacity-40 cursor-not-allowed bg-surface-2/40'
                          : isSelected
                          ? 'bg-primary/10'
                          : 'hover:bg-surface-2'
                      }`}
                    >
                      <div className={`h-5 w-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
                        isSelected || isEnrolled ? 'bg-primary border-primary' : 'border-border'
                      }`}>
                        {(isSelected || isEnrolled) && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-text-primary truncate">{student.full_name}</p>
                        <p className="text-xs text-text-muted">
                          {student.roll_number}{student.batch_name ? ` · ${student.batch_name}` : ''}
                          {isEnrolled && ' · Already enrolled'}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {allBatches.length === 0 ? (
                <div className="p-8 text-center text-xs text-text-muted font-medium">
                  No batches available.
                </div>
              ) : (
                allBatches.map(batch => {
                  const isSelected = selectedBatchIds.has(batch.id);
                  return (
                    <button
                      key={batch.id}
                      onClick={() => toggleBatch(batch.id)}
                      className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${
                        isSelected ? 'bg-primary/10' : 'hover:bg-surface-2'
                      }`}
                    >
                      <div className={`h-5 w-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
                        isSelected ? 'bg-primary border-primary' : 'border-border'
                      }`}>
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-text-primary">{batch.name}</p>
                        <p className="text-xs text-text-muted">{batch.student_count} students</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border flex-shrink-0 bg-surface">
          <p className="text-xs text-text-muted font-medium">
            {totalSelected > 0
              ? `${totalSelected} ${tab === 'students' ? 'student' : 'batch'}${totalSelected > 1 ? 's' : ''} selected`
              : 'Select students or batches to enroll'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-lg border border-border text-text-secondary hover:bg-surface-2 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={totalSelected === 0 || isSaving}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isSaving ? 'Enrolling...' : 'Enroll Selected'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
