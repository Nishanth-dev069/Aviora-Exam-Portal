'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Users, Trophy, BookOpen, Activity, Loader2, Search, ChevronDown, ChevronUp, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

type ExamAttempt = {
  id: string;
  percentage: number;
  total_score: number;
  max_score: number;
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
  computed_at: string;
  exams: {
    id: string;
    title: string;
    type: string;
    subject: string;
  };
};

type StudentResult = {
  id: string;
  full_name: string;
  roll_number: string;
  phone: string | null;
  email: string;
  status: string;
  rank: number;
  practice_score: number;
  exam_score: number;
  total_score: number;
  practices_taken: number;
  exams_taken: number;
  practice_results: ExamAttempt[];
  scheduled_results: ExamAttempt[];
};

type BatchData = {
  id: string;
  name: string;
  description: string;
  created_at: string;
  status?: string;
};

export default function BatchDetails({ batchId }: { batchId: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [batch, setBatch] = useState<BatchData | null>(null);
  const [students, setStudents] = useState<StudentResult[]>([]);
  const [search, setSearch] = useState('');
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/batches/${batchId}`)
      .then(res => res.json())
      .then(data => {
        if (data.batch) {
          setBatch(data.batch);
          setStudents(data.students || []);
        }
      })
      .finally(() => setIsLoading(false));
  }, [batchId]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center text-center p-8">
        <div className="mb-4 rounded-full bg-gray-100 p-4">
          <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-800">Batch Not Found</h2>
        <p className="mt-2 max-w-sm text-sm text-gray-500">
          This batch doesn't exist or has been deleted. Return to the batches list to view all batches.
        </p>
        <Link
          href="/admin/batches"
          className="mt-6 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          ← Return to Batches
        </Link>
      </div>
    );
  }

  const filteredStudents = students.filter(s => 
    s.full_name.toLowerCase().includes(search.toLowerCase()) || 
    s.roll_number.toLowerCase().includes(search.toLowerCase())
  );

  const avgTotal = students.length ? students.reduce((acc, s) => acc + s.total_score, 0) / students.length : 0;
  const highestTotal = students.length ? Math.max(...students.map(s => s.total_score)) : 0;
  const totalExamsTaken = students.reduce((acc, s) => acc + s.exams_taken + s.practices_taken, 0);

  return (
    <div className="flex flex-col h-full w-full max-w-7xl mx-auto p-4 md:p-8 animate-in fade-in">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/batches" className="p-2 text-text-muted hover:text-text-primary rounded-lg hover:bg-surface-2 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary">{batch.name}</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              Active Batch
            </span>
          </div>
          <p className="text-text-secondary mt-1 text-sm">{batch.description || 'Batch details and student performance metrics.'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg"><Users className="w-5 h-5 text-primary" /></div>
            <div className="font-bold text-text-secondary text-sm">Total Students</div>
          </div>
          <div className="text-3xl font-bold text-text-primary">{students.length}</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-success/10 rounded-lg"><Trophy className="w-5 h-5 text-success" /></div>
            <div className="font-bold text-text-secondary text-sm">Highest Score</div>
          </div>
          <div className="text-3xl font-bold text-text-primary">{highestTotal.toFixed(1)}%</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-warning/10 rounded-lg"><Activity className="w-5 h-5 text-warning-dark" /></div>
            <div className="font-bold text-text-secondary text-sm">Batch Average</div>
          </div>
          <div className="text-3xl font-bold text-text-primary">{avgTotal.toFixed(1)}%</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-info/10 rounded-lg"><BookOpen className="w-5 h-5 text-info" /></div>
            <div className="font-bold text-text-secondary text-sm">Total Attempts</div>
          </div>
          <div className="text-3xl font-bold text-text-primary">{totalExamsTaken}</div>
        </div>
      </div>

      <div className="bg-surface border border-border p-4 rounded-t-xl flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="w-5 h-5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="Search by student name or roll number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
          />
        </div>
        <div className="text-xs text-text-secondary font-medium">
          Ranking Formula: <span className="font-bold text-text-primary">30% Practice Avg + 70% Exam Avg</span>
        </div>
      </div>

      <div className="bg-surface border-x border-b border-border rounded-b-xl overflow-hidden shadow-sm flex-1 flex flex-col relative">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-2 border-b border-border text-xs uppercase tracking-wider text-text-secondary">
                <th className="px-4 py-4 font-semibold w-12 text-center">Rank</th>
                <th className="px-6 py-4 font-semibold">Student Name</th>
                <th className="px-6 py-4 font-semibold">Roll Number</th>
                <th className="px-6 py-4 font-semibold text-right">Practice Avg (30%)</th>
                <th className="px-6 py-4 font-semibold text-right">Exam Avg (70%)</th>
                <th className="px-6 py-4 font-semibold text-right">Weighted Total</th>
                <th className="px-4 py-4 font-semibold w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredStudents.map((student) => {
                const isExpanded = expandedStudentId === student.id;
                return (
                  <React.Fragment key={student.id}>
                    <tr 
                      onClick={() => setExpandedStudentId(isExpanded ? null : student.id)}
                      className="hover:bg-surface-2/60 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-4 text-center">
                        <span className={cn("inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold", 
                          student.rank === 1 ? "bg-amber-100 text-amber-800 border border-amber-300" : 
                          student.rank === 2 ? "bg-slate-200 text-slate-700 border border-slate-300" : 
                          student.rank === 3 ? "bg-amber-900/10 text-amber-900 border border-amber-900/20" : 
                          "bg-surface-2 text-text-secondary"
                        )}>
                          {student.rank}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-text-primary group-hover:text-primary transition-colors flex items-center gap-2">
                          {student.full_name}
                          {student.status === 'active' ? (
                            <span className="w-2 h-2 rounded-full bg-emerald-500" title="Active student" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-red-500" title="Suspended student" />
                          )}
                        </div>
                        <div className="text-xs text-text-muted">{student.email}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-text-secondary font-medium">
                        {student.roll_number}
                      </td>
                      <td className="px-6 py-4 text-sm text-text-secondary font-medium text-right">
                        <div>{student.practice_score.toFixed(1)}%</div>
                        <div className="text-xs text-text-muted">{student.practices_taken} taken</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-text-secondary font-medium text-right">
                        <div>{student.exam_score.toFixed(1)}%</div>
                        <div className="text-xs text-text-muted">{student.exams_taken} taken</div>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-primary text-right">
                        {student.total_score.toFixed(1)}%
                      </td>
                      <td className="px-4 py-4 text-text-muted text-right">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </td>
                    </tr>

                    {/* Accordion Detail Breakdown */}
                    {isExpanded && (
                      <tr className="bg-surface-2/40 border-b border-border">
                        <td colSpan={7} className="px-8 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                            
                            {/* Scheduled Exams */}
                            <div className="bg-surface p-4 rounded-xl border border-border">
                              <h4 className="font-bold text-text-primary mb-3 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-primary" />
                                Scheduled Exam Results ({student.scheduled_results.length})
                              </h4>
                              {student.scheduled_results.length === 0 ? (
                                <p className="text-xs text-text-muted italic">No scheduled exams completed yet.</p>
                              ) : (
                                <div className="space-y-2">
                                  {student.scheduled_results.map((r) => (
                                    <div key={r.id} className="flex items-center justify-between text-xs p-2 bg-background rounded-lg border border-border">
                                      <div>
                                        <div className="font-bold text-text-primary">{r.exams?.title}</div>
                                        <div className="text-text-muted">{r.exams?.subject} • {new Date(r.computed_at).toLocaleDateString()}</div>
                                      </div>
                                      <div className="text-right">
                                        <div className="font-bold text-primary">{r.percentage}%</div>
                                        <div className="text-text-muted">{r.total_score}/{r.max_score} marks</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Practice Exams */}
                            <div className="bg-surface p-4 rounded-xl border border-border">
                              <h4 className="font-bold text-text-primary mb-3 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-info" />
                                Practice Attempts ({student.practice_results.length})
                              </h4>
                              {student.practice_results.length === 0 ? (
                                <p className="text-xs text-text-muted italic">No practice attempts completed yet.</p>
                              ) : (
                                <div className="space-y-2">
                                  {student.practice_results.map((r) => (
                                    <div key={r.id} className="flex items-center justify-between text-xs p-2 bg-background rounded-lg border border-border">
                                      <div>
                                        <div className="font-bold text-text-primary">{r.exams?.title}</div>
                                        <div className="text-text-muted">{r.exams?.subject} • {new Date(r.computed_at).toLocaleDateString()}</div>
                                      </div>
                                      <div className="text-right">
                                        <div className="font-bold text-info">{r.percentage}%</div>
                                        <div className="text-text-muted">{r.correct_count} correct</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-text-muted">
                    No students found in this batch.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
