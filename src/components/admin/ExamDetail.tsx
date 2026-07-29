'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, Target, Users, BookOpen, ShieldAlert, Archive, Trash2, Loader2, CheckCircle, AlertTriangle, Pencil, UserPlus } from 'lucide-react';
import Link from 'next/link';
import EditExamModal from '@/components/admin/EditExamModal';
import { ManageEnrollmentsModal } from '@/components/admin/exams/ManageEnrollmentsModal';

type ExamData = {
  id: string;
  title: string;
  type: string;
  subject: string;
  description: string | null;
  instructions: string | null;
  duration_minutes: number;
  total_questions: number;
  total_marks: number;
  marks_per_question: number;
  negative_marks: number;
  passing_marks: number | null;
  status: string;
  scheduled_at: string | null;
  ends_at: string | null;
  settings: Record<string, any>;
  created_at: string;
};

type QuestionItem = {
  id: string;
  base_order: number;
  marks: number;
  questions: {
    id: string;
    content: string;
    difficulty: string;
    subject: string;
    topic: string | null;
    explanation: string;
  };
};

type EnrollmentItem = {
  id: string;
  student_id: string;
  created_at?: string;
  student_profiles?: {
    full_name: string;
    roll_number: string;
    batch_id?: string;
    batches?: { name: string };
  };
  student?: {
    id: string;
    student_profiles?: {
      full_name: string;
      roll_number: string;
      batch_id?: string;
      batches?: { name: string };
    };
  };
};

export default function ExamDetail({ examId }: { examId: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [exam, setExam] = useState<ExamData | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentItem[]>([]);
  const [submissionCount, setSubmissionCount] = useState(0);

  const [activeTab, setActiveTab] = useState<'overview' | 'questions' | 'enrollments' | 'settings'>('overview');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);

  const enrolledStudentIds = React.useMemo(
    () => new Set(enrollments.map(e => e.student_id).filter(Boolean)),
    [enrollments]
  );

  const fetchExamDetails = useCallback(() => {
    setIsLoading(true);
    fetch(`/api/admin/exams/${examId}`)
      .then(res => res.json())
      .then(data => {
        if (data.exam) {
          setExam(data.exam);
          setQuestions(data.questions || []);
          setEnrollments(data.enrollments || []);
          setSubmissionCount(data.submission_count || 0);
        }
      })
      .finally(() => setIsLoading(false));
  }, [examId]);

  useEffect(() => {
    fetchExamDetails();
  }, [fetchExamDetails]);

  if (isLoading && !exam) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="p-8 text-center">
        <p className="text-text-muted">Exam not found.</p>
        <Link href="/admin/exams" className="text-primary font-bold mt-2 inline-block">Back to Exams</Link>
      </div>
    );
  }

  const handleArchive = async () => {
    if (!confirm('Are you sure you want to archive this exam?')) return;
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/admin/exams/${examId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive' })
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error?.message || 'Failed to archive exam');
        return;
      }
      setActionSuccess('Exam archived successfully');
      setExam(prev => prev ? { ...prev, status: 'archived' } : null);
    } catch {
      setActionError('Network error');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this draft exam? This action cannot be undone.')) return;
    setIsDeleting(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/admin/exams/${examId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error?.message || 'Failed to delete exam');
        setIsDeleting(false);
        return;
      }
      router.push('/admin/exams');
    } catch {
      setActionError('Network error');
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-7xl mx-auto p-4 md:p-8 animate-in fade-in">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link href="/admin/exams" className="p-2 text-text-muted hover:text-text-primary rounded-lg hover:bg-surface-2 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-text-primary">{exam.title}</h1>
              <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border uppercase ${
                exam.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                exam.status === 'scheduled' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                exam.status === 'completed' ? 'bg-purple-500/10 text-purple-600 border-purple-500/20' :
                exam.status === 'archived' ? 'bg-gray-500/10 text-gray-600 border-gray-500/20' :
                'bg-amber-500/10 text-amber-600 border-amber-500/20'
              }`}>
                {exam.status}
              </span>
            </div>
            <p className="text-text-secondary mt-1 text-sm">{exam.subject} • Created on {new Date(exam.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-primary text-white font-bold rounded-xl hover:bg-primary-hover flex items-center gap-2 text-sm shadow-md shadow-primary/20 transition-colors"
          >
            <Pencil className="w-4 h-4" />
            Edit Exam
          </button>

          {exam.status === 'draft' && (
            <button 
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 font-medium rounded-xl hover:bg-red-100 flex items-center gap-2 text-sm"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete Draft
            </button>
          )}

          {exam.status !== 'archived' && (
            <button 
              onClick={handleArchive}
              className="px-4 py-2 border border-border bg-surface text-text-secondary font-medium rounded-xl hover:bg-surface-2 flex items-center gap-2 text-sm"
            >
              <Archive className="w-4 h-4" />
              Archive Exam
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          {actionError}
        </div>
      )}

      {actionSuccess && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm font-medium flex items-center gap-2">
          <CheckCircle className="w-5 h-5 shrink-0" />
          {actionSuccess}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg"><Clock className="w-5 h-5 text-primary" /></div>
            <div className="font-bold text-text-secondary text-sm">Duration</div>
          </div>
          <div className="text-3xl font-bold text-text-primary">{exam.duration_minutes} <span className="text-base font-normal text-text-secondary">mins</span></div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-accent/10 rounded-lg"><BookOpen className="w-5 h-5 text-accent" /></div>
            <div className="font-bold text-text-secondary text-sm">Total Questions</div>
          </div>
          <div className="text-3xl font-bold text-text-primary">{exam.total_questions || questions.length}</div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-info/10 rounded-lg"><Target className="w-5 h-5 text-info" /></div>
            <div className="font-bold text-text-secondary text-sm">Total Marks</div>
          </div>
          <div className="text-3xl font-bold text-text-primary">{exam.total_marks || (questions.length * exam.marks_per_question)}</div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-warning/10 rounded-lg"><Users className="w-5 h-5 text-warning-dark" /></div>
            <div className="font-bold text-text-secondary text-sm">Submissions</div>
          </div>
          <div className="text-3xl font-bold text-text-primary">{submissionCount} / {enrollments.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-6">
        <button 
          onClick={() => setActiveTab('overview')}
          className={`px-5 py-3 font-bold text-sm border-b-2 transition-colors ${activeTab === 'overview' ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
        >
          Overview
        </button>
        <button 
          onClick={() => setActiveTab('questions')}
          className={`px-5 py-3 font-bold text-sm border-b-2 transition-colors ${activeTab === 'questions' ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
        >
          Questions ({questions.length})
        </button>
        <button 
          onClick={() => setActiveTab('enrollments')}
          className={`px-5 py-3 font-bold text-sm border-b-2 transition-colors ${activeTab === 'enrollments' ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
        >
          Enrolled Students ({enrollments.length})
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`px-5 py-3 font-bold text-sm border-b-2 transition-colors ${activeTab === 'settings' ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
        >
          Security & Settings
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-text-primary mb-2">Description</h3>
              <p className="text-sm text-text-secondary">{exam.description || 'No description provided.'}</p>
            </div>

            <div>
              <h3 className="text-base font-bold text-text-primary mb-2">Instructions to Students</h3>
              <p className="text-sm text-text-secondary whitespace-pre-wrap">{exam.instructions || 'No special instructions provided.'}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border">
              <div>
                <div className="text-xs text-text-muted font-semibold">Marks Per Question</div>
                <div className="text-sm font-bold text-text-primary mt-1">{exam.marks_per_question} mark(s)</div>
              </div>
              <div>
                <div className="text-xs text-text-muted font-semibold">Negative Marking</div>
                <div className="text-sm font-bold text-text-primary mt-1">
                  {exam.negative_marks > 0 ? `-${exam.negative_marks} per wrong answer` : 'Disabled'}
                </div>
              </div>
              <div>
                <div className="text-xs text-text-muted font-semibold">Passing Marks</div>
                <div className="text-sm font-bold text-text-primary mt-1">
                  {exam.passing_marks !== null ? `${exam.passing_marks} marks` : 'None (Optional)'}
                </div>
              </div>
              <div>
                <div className="text-xs text-text-muted font-semibold">Schedule Window</div>
                <div className="text-sm font-bold text-text-primary mt-1">
                  {exam.type === 'practice' ? 'Practice (Always Available)' : (
                    exam.scheduled_at ? `${new Date(exam.scheduled_at).toLocaleString()}` : 'Not scheduled'
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'questions' && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-text-primary mb-4">Assigned Questions</h3>
            {questions.length === 0 ? (
              <p className="text-sm text-text-muted">No questions assigned to this exam.</p>
            ) : (
              <div className="space-y-3">
                {questions.map((q, index) => (
                  <div key={q.id} className="p-4 bg-surface-2 border border-border rounded-xl flex items-start gap-4">
                    <span className="w-7 h-7 bg-primary/10 text-primary font-bold rounded-lg flex items-center justify-center text-xs shrink-0 mt-0.5">
                      Q{index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-text-primary">{q.questions.content}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
                        <span>Difficulty: <strong className="text-text-primary capitalize">{q.questions.difficulty}</strong></span>
                        <span>Marks: <strong className="text-primary">{q.marks}</strong></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'enrollments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-text-primary">
                Enrolled Students ({enrollments.length})
              </h3>
              <button
                onClick={() => setShowEnrollModal(true)}
                className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors shadow-sm"
              >
                <UserPlus className="w-4 h-4" />
                Add Students
              </button>
            </div>

            <div className="rounded-xl border border-border overflow-hidden bg-surface">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface-2 border-b border-border text-xs uppercase tracking-wider text-text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Student</th>
                    <th className="px-4 py-3 font-semibold">Roll No</th>
                    <th className="px-4 py-3 font-semibold">Batch</th>
                    <th className="px-4 py-3 font-semibold">Enrolled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {enrollments.map(e => {
                    const prof = e.student_profiles || e.student?.student_profiles;
                    return (
                      <tr key={e.id} className="hover:bg-surface-2/50 transition-colors">
                        <td className="px-4 py-3 font-bold text-text-primary">
                          {prof?.full_name || 'Student'}
                        </td>
                        <td className="px-4 py-3 text-text-secondary text-xs">
                          {prof?.roll_number || '—'}
                        </td>
                        <td className="px-4 py-3 text-text-secondary text-xs">
                          {prof?.batches?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-text-muted text-xs">
                          {e.created_at ? new Date(e.created_at).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    );
                  })}
                  {enrollments.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-text-muted font-medium">
                        No students enrolled yet. Click &quot;Add Students&quot; to enroll.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4 text-sm text-text-secondary">
            <h3 className="text-base font-bold text-text-primary mb-4">Security & Delivery Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-surface-2 border border-border rounded-xl flex justify-between items-center">
                <span className="font-semibold text-text-primary">Randomize Questions</span>
                <span className="font-bold text-primary">{exam.settings?.randomize_questions ? 'Enabled' : 'Disabled'}</span>
              </div>
              <div className="p-4 bg-surface-2 border border-border rounded-xl flex justify-between items-center">
                <span className="font-semibold text-text-primary">Randomize Options</span>
                <span className="font-bold text-primary">{exam.settings?.randomize_options ? 'Enabled' : 'Disabled'}</span>
              </div>
              <div className="p-4 bg-surface-2 border border-border rounded-xl flex justify-between items-center">
                <span className="font-semibold text-text-primary">Fullscreen Enforcement</span>
                <span className="font-bold text-primary">{exam.settings?.fullscreen_required ? 'Enabled' : 'Disabled'}</span>
              </div>
              <div className="p-4 bg-surface-2 border border-border rounded-xl flex justify-between items-center">
                <span className="font-semibold text-text-primary">Max Tab Switches Allowed</span>
                <span className="font-bold text-primary">{exam.settings?.max_tab_switches ?? 5}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Exam Modal */}
      {isEditing && (
        <EditExamModal 
          exam={exam} 
          onClose={() => setIsEditing(false)} 
          onSuccess={() => {
            fetchExamDetails();
            setActionSuccess('Exam information updated successfully!');
          }} 
        />
      )}

      {/* Manage Enrollments Modal */}
      {showEnrollModal && (
        <ManageEnrollmentsModal
          examId={exam.id}
          examTitle={exam.title}
          enrolledStudentIds={enrolledStudentIds}
          onClose={() => setShowEnrollModal(false)}
          onEnrolled={(count) => {
            fetchExamDetails();
            setActionSuccess(`${count} student(s) enrolled successfully!`);
          }}
        />
      )}

    </div>
  );
}
