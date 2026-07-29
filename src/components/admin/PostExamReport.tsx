'use client';

import React, { useState, useEffect } from 'react';
import { Download, Loader2, Target, Users, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';

interface StudentResultItem {
  rank: number;
  full_name: string;
  roll_number: string;
  total_score: number;
  max_score?: number;
  percentage: number;
  correct_count?: number;
  incorrect_count?: number;
  unanswered_count?: number;
  is_passed: boolean | null;
  time_taken: number;
}

interface QuestionAnalysisItem {
  question_id: string;
  content: string;
  correct: number;
  incorrect: number;
  unanswered: number;
  total: number;
  correct_pct: number;
}

interface ReportData {
  exam: {
    title: string;
    subject: string;
    type: string;
    duration_minutes: number;
    status: string;
  };
  summary: {
    enrolled: number;
    submitted: number;
    not_attempted: number;
    pass_rate: number;
    pass_count: number;
    average_score: number;
    highest_score: number;
    highest_student?: string;
    lowest_score: number;
    lowest_student?: string;
  };
  students: StudentResultItem[];
  question_analysis: QuestionAnalysisItem[];
}

const formatPct = (count: number, total: number): string => {
  if (total === 0) return '0.0%';
  return ((count / total) * 100).toFixed(1) + '%';
};

export default function PostExamReport({ exams }: { exams: { id: string, title: string, status: string }[] }) {
  const [examList, setExamList] = useState(exams);
  const [selectedExamId, setSelectedExamId] = useState<string>(exams[0]?.id || '');
  const [data, setData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeReportTab, setActiveReportTab] = useState<'summary' | 'students' | 'questions'>('summary');

  const [sortCol, setSortCol] = useState<'rank' | 'percentage' | 'full_name' | 'total_score'>('rank');
  const [sortAsc, setSortAsc] = useState(true);

  // Always fetch fresh exams on mount to prevent Next.js App Router stale caching
  useEffect(() => {
    let cancelled = false;
    const fetchExams = async () => {
      try {
        const res = await fetch('/api/admin/exams', { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const freshExams = json.data || json.exams || [];
        if (!cancelled && freshExams.length > 0) {
          setExamList(freshExams);
          if (!selectedExamId) {
            setSelectedExamId(freshExams[0].id);
          }
        }
      } catch (e) {
        console.error('Failed to fetch fresh exams for report dropdown', e);
      }
    };
    fetchExams();
    return () => { cancelled = true; };
  }, []);

  const fetchReportData = async (examId: string) => {
    if (!examId) return;
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/admin/reports?examId=${examId}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) {
        setFetchError(json.error?.message || json.error || 'Failed to load report data.');
        return;
      }
      if (json.success && json.report) {
        setData(json.report);
      } else if (json.data) {
        setData(json.data);
      }
    } catch {
      setFetchError('Network error while loading reports.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData(selectedExamId);
  }, [selectedExamId]);

  // Client-side CSV generator function
  const downloadCSV = (rows: Record<string, any>[], filename: string) => {
    if (!rows || !rows.length) return;
    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map(row =>
        headers.map(h => {
          const val = row[h] ?? '';
          const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
          return `"${str.replace(/"/g, '""')}"`;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSummaryCSV = () => {
    if (!data) return;
    const summaryRows = [
      { Metric: 'Exam Title', Value: data.exam.title },
      { Metric: 'Subject', Value: data.exam.subject },
      { Metric: 'Exam Type', Value: data.exam.type },
      { Metric: 'Duration (mins)', Value: data.exam.duration_minutes },
      { Metric: 'Total Enrolled', Value: data.summary.enrolled },
      { Metric: 'Submitted', Value: data.summary.submitted },
      { Metric: 'Did Not Submit', Value: data.summary.not_attempted },
      { Metric: 'Average Score (%)', Value: data.summary.average_score.toFixed(1) },
      { Metric: 'Highest Score (%)', Value: `${data.summary.highest_score.toFixed(1)} (${data.summary.highest_student || 'N/A'})` },
      { Metric: 'Lowest Score (%)', Value: `${data.summary.lowest_score.toFixed(1)} (${data.summary.lowest_student || 'N/A'})` },
      { Metric: 'Pass Rate (%)', Value: `${data.summary.pass_rate.toFixed(1)}%` },
    ];
    downloadCSV(summaryRows, `${data.exam.title}_Class_Summary`);
  };

  const handleExportStudentsCSV = () => {
    if (!data || !data.students) return;
    const studentRows = data.students.map(s => ({
      Rank: s.rank,
      Name: s.full_name,
      RollNumber: s.roll_number,
      Score: s.total_score,
      Percentage: `${s.percentage.toFixed(1)}%`,
      Correct: s.correct_count ?? 'N/A',
      Incorrect: s.incorrect_count ?? 'N/A',
      Unanswered: s.unanswered_count ?? 'N/A',
      TimeTakenSeconds: s.time_taken,
      Status: s.is_passed === true ? 'PASS' : s.is_passed === false ? 'FAIL' : 'N/A'
    }));
    downloadCSV(studentRows, `${data.exam.title}_Per_Student_Report`);
  };

  const handleExportQuestionsCSV = () => {
    if (!data || !data.question_analysis) return;
    const questionRows = data.question_analysis.map((q, idx) => ({
      HardnessRank: idx + 1,
      QuestionText: q.content,
      CorrectPct: `${q.correct_pct.toFixed(1)}%`,
      CorrectCount: q.correct,
      IncorrectCount: q.incorrect,
      UnansweredCount: q.unanswered,
      TotalAttempts: q.total
    }));
    downloadCSV(questionRows, `${data.exam.title}_Question_Analysis`);
  };

  const handleSort = (col: 'rank' | 'percentage' | 'full_name' | 'total_score') => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  if (examList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-surface border border-border rounded-xl p-8">
        <BarChart3 className="h-12 w-12 text-text-muted mb-4" />
        <h3 className="text-lg font-bold text-text-primary">No completed exams yet</h3>
        <p className="text-sm text-text-secondary mt-1 max-w-sm">
          Reports will appear here once students have submitted exams.
        </p>
      </div>
    );
  }

  const sortedStudents = [...(data?.students || [])].sort((a, b) => {
    const valA = a[sortCol];
    const valB = b[sortCol];
    if (valA! < valB!) return sortAsc ? -1 : 1;
    if (valA! > valB!) return sortAsc ? 1 : -1;
    return 0;
  });

  return (
    <div className="space-y-6">
      
      {/* Selector */}
      <div className="flex items-center gap-4 bg-surface p-4 rounded-xl border border-border shadow-sm">
        <label className="font-bold text-text-secondary text-sm whitespace-nowrap">Select Exam:</label>
        <select 
          value={selectedExamId}
          onChange={(e) => setSelectedExamId(e.target.value)}
          className="w-full md:w-96 px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-semibold"
        >
          {examList.map(ex => (
            <option key={ex.id} value={ex.id}>{ex.title} ({ex.status})</option>
          ))}
        </select>
      </div>

      {fetchError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-700 font-bold text-sm">{fetchError}</p>
          <button 
            onClick={() => selectedExamId && fetchReportData(selectedExamId)}
            className="mt-3 text-xs font-bold text-red-600 underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {isLoading && (
        <div className="py-20 flex flex-col items-center justify-center text-text-muted">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
          <p className="font-medium text-sm">Compiling comprehensive exam analytics...</p>
        </div>
      )}

      {!isLoading && data && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          
          {/* Report Tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveReportTab('summary')}
              className={`px-5 py-3 font-bold text-sm border-b-2 transition-colors ${activeReportTab === 'summary' ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
            >
              Class Summary
            </button>
            <button
              onClick={() => setActiveReportTab('students')}
              className={`px-5 py-3 font-bold text-sm border-b-2 transition-colors ${activeReportTab === 'students' ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
            >
              Per-Student Report ({data.students?.length || 0})
            </button>
            <button
              onClick={() => setActiveReportTab('questions')}
              className={`px-5 py-3 font-bold text-sm border-b-2 transition-colors ${activeReportTab === 'questions' ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
            >
              Question Analysis ({data.question_analysis?.length || 0})
            </button>
          </div>

          {/* TAB 1: CLASS SUMMARY */}
          {activeReportTab === 'summary' && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm space-y-6 p-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h2 className="text-xl font-bold text-text-primary">{data.exam.title} — Class Performance Overview</h2>
                  <p className="text-xs text-text-secondary mt-1">
                    Subject: <span className="font-bold text-text-primary">{data.exam.subject}</span> • Type: <span className="font-bold text-text-primary capitalize">{data.exam.type}</span> • Duration: <span className="font-bold text-text-primary">{data.exam.duration_minutes}m</span>
                  </p>
                </div>
                <button 
                  onClick={handleExportSummaryCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-background border border-border hover:bg-surface-2 rounded-lg text-xs font-bold text-text-primary transition-colors"
                >
                  <Download className="w-4 h-4" /> Download CSV
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="bg-surface-2 p-4 rounded-xl border border-border">
                  <div className="text-xs font-bold text-text-secondary uppercase mb-1 flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" /> Participation
                  </div>
                  <div className="text-3xl font-black text-text-primary">{data.summary.submitted}<span className="text-base text-text-muted font-normal"> / {data.summary.enrolled}</span></div>
                  <div className="text-xs text-text-muted mt-1 font-medium">{data.summary.not_attempted} Did Not Submit</div>
                </div>
                
                <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20">
                  <div className="text-xs font-bold text-emerald-700 uppercase mb-1 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Pass Rate
                  </div>
                  <div className="text-3xl font-black text-emerald-600">{data.summary.pass_rate.toFixed(1)}%</div>
                  <div className="text-xs text-emerald-700 mt-1 font-medium">{data.summary.pass_count} Passed</div>
                </div>

                <div className="bg-primary/10 p-4 rounded-xl border border-primary/20">
                  <div className="text-xs font-bold text-primary uppercase mb-1 flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" /> Class Average
                  </div>
                  <div className="text-3xl font-black text-primary">{data.summary.average_score.toFixed(1)}%</div>
                  <div className="text-xs text-text-muted mt-1 font-medium">Across all submissions</div>
                </div>

                <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/20">
                  <div className="text-xs font-bold text-amber-800 uppercase mb-1 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700" /> Highest Score
                  </div>
                  <div className="text-3xl font-black text-amber-700">{data.summary.highest_score.toFixed(1)}%</div>
                  {data.summary.highest_student && (
                    <div className="text-xs text-amber-800 mt-1 font-bold truncate">{data.summary.highest_student}</div>
                  )}
                </div>
              </div>

              {data.summary.lowest_student && (
                <div className="p-4 bg-background border border-border rounded-xl text-xs flex items-center justify-between">
                  <span className="text-text-secondary font-medium">Lowest Score Recorded:</span>
                  <span className="font-bold text-red-600">{data.summary.lowest_score.toFixed(1)}% ({data.summary.lowest_student})</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PER-STUDENT REPORT */}
          {activeReportTab === 'students' && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-border bg-surface-2 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-text-primary">Per-Student Results Table</h2>
                  <p className="text-xs text-text-secondary mt-1">Detailed breakdown for all {data.summary.submitted} submitted students.</p>
                </div>
                <button 
                  onClick={handleExportStudentsCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-background border border-border hover:bg-surface-3 rounded-lg text-xs font-bold text-text-primary transition-colors"
                >
                  <Download className="w-4 h-4" /> Download CSV
                </button>
              </div>
              <div className="overflow-x-auto max-h-[550px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-surface-2 text-text-secondary uppercase text-xs sticky top-0 z-10 shadow-sm border-b border-border">
                    <tr>
                      <th className="px-6 py-3 font-bold cursor-pointer hover:text-text-primary" onClick={() => handleSort('rank')}>
                        <div className="flex items-center gap-1">Rank {sortCol === 'rank' && (sortAsc ? '↑' : '↓')}</div>
                      </th>
                      <th className="px-6 py-3 font-bold cursor-pointer hover:text-text-primary" onClick={() => handleSort('full_name')}>
                        <div className="flex items-center gap-1">Student Name {sortCol === 'full_name' && (sortAsc ? '↑' : '↓')}</div>
                      </th>
                      <th className="px-6 py-3 font-bold">Roll No</th>
                      <th className="px-6 py-3 font-bold text-right cursor-pointer hover:text-text-primary" onClick={() => handleSort('total_score')}>
                        <div className="flex items-center justify-end gap-1">Score {sortCol === 'total_score' && (sortAsc ? '↑' : '↓')}</div>
                      </th>
                      <th className="px-6 py-3 font-bold text-right cursor-pointer hover:text-text-primary" onClick={() => handleSort('percentage')}>
                        <div className="flex items-center justify-end gap-1">Percentage {sortCol === 'percentage' && (sortAsc ? '↑' : '↓')}</div>
                      </th>
                      <th className="px-6 py-3 font-bold text-right text-emerald-600">Correct</th>
                      <th className="px-6 py-3 font-bold text-right text-red-600">Incorrect</th>
                      <th className="px-6 py-3 font-bold text-right text-text-muted">Unanswered</th>
                      <th className="px-6 py-3 font-bold text-right">Time Taken</th>
                      <th className="px-6 py-3 font-bold text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sortedStudents.map(s => (
                      <tr key={s.roll_number} className="hover:bg-surface-2/50 transition-colors">
                        <td className="px-6 py-3 font-bold text-text-primary">#{s.rank}</td>
                        <td className="px-6 py-3 font-bold text-text-primary">{s.full_name}</td>
                        <td className="px-6 py-3 text-text-secondary font-medium">{s.roll_number}</td>
                        <td className="px-6 py-3 font-bold text-text-primary text-right">{s.total_score}</td>
                        <td className="px-6 py-3 font-bold text-primary text-right">{s.percentage.toFixed(1)}%</td>
                        <td className="px-6 py-3 text-emerald-600 font-bold text-right">{s.correct_count ?? '—'}</td>
                        <td className="px-6 py-3 text-red-600 font-bold text-right">{s.incorrect_count ?? '—'}</td>
                        <td className="px-6 py-3 text-text-muted text-right">{s.unanswered_count ?? '—'}</td>
                        <td className="px-6 py-3 text-text-secondary text-right">{Math.floor(s.time_taken / 60)}m {s.time_taken % 60}s</td>
                        <td className="px-6 py-3 text-center">
                          {s.is_passed === true && <span className="text-emerald-700 font-bold text-xs bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">PASS</span>}
                          {s.is_passed === false && <span className="text-red-700 font-bold text-xs bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">FAIL</span>}
                          {s.is_passed === null && <span className="text-text-muted text-xs">COMPLETED</span>}
                        </td>
                      </tr>
                    ))}
                    {sortedStudents.length === 0 && (
                      <tr><td colSpan={10} className="px-6 py-8 text-center text-text-muted">No student submissions available for this exam.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: QUESTION ANALYSIS */}
          {activeReportTab === 'questions' && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-border bg-surface-2 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-text-primary">Question Difficulty & Accuracy Analysis</h2>
                  <p className="text-xs text-text-secondary mt-1">Questions sorted by lowest correct percentage (hardest questions first).</p>
                </div>
                <button 
                  onClick={handleExportQuestionsCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-background border border-border hover:bg-surface-3 rounded-lg text-xs font-bold text-text-primary transition-colors"
                >
                  <Download className="w-4 h-4" /> Download CSV
                </button>
              </div>
              <div className="overflow-x-auto max-h-[550px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-2 text-text-secondary uppercase text-xs sticky top-0 z-10 shadow-sm border-b border-border">
                    <tr>
                      <th className="px-6 py-3 font-bold w-16">Rank</th>
                      <th className="px-6 py-3 font-bold w-full">Question Text</th>
                      <th className="px-6 py-3 font-bold text-emerald-600 text-right">Correct %</th>
                      <th className="px-6 py-3 font-bold text-red-600 text-right">Incorrect %</th>
                      <th className="px-6 py-3 font-bold text-text-muted text-right">Unanswered %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.question_analysis.map((qa, i) => {
                      const totalAttempts = qa.total || (qa.correct + qa.incorrect + qa.unanswered);
                      return (
                        <tr key={qa.question_id || i} className="hover:bg-surface-2/50 transition-colors">
                          <td className="px-6 py-3 font-bold text-text-primary">#{i + 1}</td>
                          <td className="px-6 py-3 font-medium text-text-primary max-w-lg">{qa.content}</td>
                          <td title={`${qa.correct} of ${totalAttempts} students`} className="px-6 py-3 font-bold text-emerald-600 text-right">
                            {formatPct(qa.correct, totalAttempts)}
                          </td>
                          <td title={`${qa.incorrect} of ${totalAttempts} students`} className="px-6 py-3 font-bold text-red-600 text-right">
                            {formatPct(qa.incorrect, totalAttempts)}
                          </td>
                          <td title={`${qa.unanswered} of ${totalAttempts} students`} className="px-6 py-3 text-text-muted text-right">
                            {formatPct(qa.unanswered, totalAttempts)}
                          </td>
                        </tr>
                      );
                    })}
                    {data.question_analysis.length === 0 && (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-text-muted">No question breakdown data available.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
