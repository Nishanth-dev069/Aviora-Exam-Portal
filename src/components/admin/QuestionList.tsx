'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, MoreHorizontal, Plus, ChevronLeft, ChevronRight, Loader2, BookOpen, Download, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import Link from 'next/link';
import QuestionEditor from './QuestionEditor';

interface Props {
  bankId: string;
  bankName: string;
  bankSubject: string;
}

export type QuestionType = { id: string, text: string, subject: string, topic: string, difficulty: string, tags: string[], explanation: string, question_options: { id: string, text: string, is_correct: boolean }[] };

export default function QuestionList({ bankId, bankName, bankSubject }: Props) {
  const [questions, setQuestions] = useState<QuestionType[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [search, setSearch] = useState('');
  const [topicFilter, setTopicFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionType | null>(null);
  
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Derive unique topics for filter dropdown from the active page (or we could fetch distinctly, but this is simple)
  const availableTopics = Array.from(new Set(questions.map(q => q.topic))).filter(Boolean);

  const fetchQuestions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        bankId,
        page: page.toString(),
        pageSize: pageSize.toString(),
        search,
        topic: topicFilter,
        difficulty: difficultyFilter
      });
      const res = await fetch(`/api/admin/questions?${params}`);
      const data = await res.json();
      if (data.data) {
        setQuestions(data.data);
        setTotalCount(data.count);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [bankId, page, search, topicFilter, difficultyFilter]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleArchive = async (id: string) => {
    if (!confirm('Are you sure you want to archive this question? It will not appear in future exams.')) return;
    try {
      await fetch(`/api/admin/questions?id=${id}`, { method: 'DELETE' });
      fetchQuestions();
    } catch (err) {
      console.error(err);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="flex flex-col h-full w-full max-w-7xl mx-auto p-4 md:p-8 animate-in fade-in relative">
      
      {/* Header */}
      <div className="mb-6">
        <Link href="/admin/question-banks" className="inline-flex items-center gap-2 text-sm font-bold text-text-muted hover:text-text-primary transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Question Banks
        </Link>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-primary" />
              {bankName} — Questions
            </h1>
            <p className="text-text-secondary mt-1">Manage and edit questions in this bank.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              disabled
              title="Coming soon"
              className="flex items-center gap-2 bg-surface text-text-muted border border-border px-4 py-2.5 rounded-xl font-semibold cursor-not-allowed shadow-sm"
            >
              <Download className="w-4 h-4" /> Import
            </button>
            <button 
              onClick={() => { setEditingQuestion(null); setIsEditorOpen(true); }}
              className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-primary-hover transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5" /> Add Question
            </button>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-surface border border-border p-4 rounded-t-xl flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 flex-shrink-0">
            <Filter className="w-4 h-4 text-text-muted" />
            <select 
              value={topicFilter} 
              onChange={(e) => { setTopicFilter(e.target.value); setPage(1); }}
              className="bg-transparent text-sm font-medium text-text-secondary focus:outline-none"
            >
              <option value="all">All Topics</option>
              {availableTopics.map(t => (
                <option key={t as string} value={t as string}>{t as string}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 flex-shrink-0">
            <Filter className="w-4 h-4 text-text-muted" />
            <select 
              value={difficultyFilter} 
              onChange={(e) => { setDifficultyFilter(e.target.value); setPage(1); }}
              className="bg-transparent text-sm font-medium text-text-secondary focus:outline-none"
            >
              <option value="all">All Difficulties</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
        </div>

        <div className="relative w-full md:w-72 flex-shrink-0">
          <Search className="w-5 h-5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="Search questions..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface border-x border-b border-border rounded-b-xl overflow-hidden shadow-sm flex-1 flex flex-col relative min-h-[400px]">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-2 border-b border-border text-xs uppercase tracking-wider text-text-secondary">
                <th className="px-6 py-4 font-semibold w-16">#</th>
                <th className="px-6 py-4 font-semibold">Question</th>
                <th className="px-6 py-4 font-semibold">Topic</th>
                <th className="px-6 py-4 font-semibold">Difficulty</th>
                <th className="px-6 py-4 font-semibold text-center">Options</th>
                <th className="px-6 py-4 font-semibold w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><Skeleton className="h-4 w-6 rounded" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-64 rounded" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-24 rounded" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-16 rounded-full" /></td>
                    <td className="px-6 py-4 text-center"><Skeleton className="h-4 w-12 mx-auto rounded" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-6 w-6 rounded" /></td>
                  </tr>
                ))
              ) : (
                questions.map((q, idx) => {
                const displayIndex = (page - 1) * pageSize + idx + 1;
                
                return (
                  <tr key={q.id} className="hover:bg-surface-2/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-text-muted">
                      {displayIndex}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-text-primary line-clamp-2 max-w-xl" title={q.text}>
                        {q.text}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary font-medium">
                      {q.topic}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={cn(
                        'inline-flex px-2 py-0.5 rounded text-xs font-bold',
                        q.difficulty === 'Easy' ? 'bg-success/10 text-success' :
                        q.difficulty === 'Medium' ? 'bg-warning/10 text-warning-dark' :
                        'bg-danger/10 text-danger'
                      )}>
                        {q.difficulty}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary text-center font-bold">
                      {q.question_options?.length || 0}
                    </td>
                    <td className="px-6 py-4 relative">
                      <button 
                        onClick={() => setOpenMenuId(openMenuId === q.id ? null : q.id)}
                        className="p-2 hover:bg-border rounded-lg transition-colors text-text-secondary"
                      >
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                      
                      {openMenuId === q.id && (
                        <>
                          <div 
                            className="fixed inset-0 z-30" 
                            onClick={() => setOpenMenuId(null)}
                          />
                          <div className="absolute right-8 top-10 z-40 w-40 bg-surface border border-border rounded-xl shadow-xl py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                            <button 
                              onClick={() => { setEditingQuestion(q); setIsEditorOpen(true); setOpenMenuId(null); }}
                              className="w-full text-left px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-surface-2 transition-colors"
                            >
                              Edit Question
                            </button>
                            <button 
                              onClick={() => { handleArchive(q.id); setOpenMenuId(null); }}
                              className="w-full text-left px-4 py-2.5 text-sm font-medium text-danger hover:bg-danger/10 transition-colors border-t border-border mt-1"
                            >
                              Archive
                            </button>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
              {questions.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-text-muted">
                    No questions found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="border-t border-border px-6 py-4 flex items-center justify-between bg-surface flex-shrink-0">
          <div className="text-sm font-medium text-text-secondary">
            Showing <span className="text-text-primary font-bold">{Math.min((page - 1) * pageSize + 1, totalCount)}</span> to <span className="text-text-primary font-bold">{Math.min(page * pageSize, totalCount)}</span> of <span className="text-text-primary font-bold">{totalCount}</span> questions
          </div>
          <div className="flex items-center gap-2">
            <button 
              disabled={page === 1}
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              className="p-2 border border-border rounded-lg bg-background text-text-secondary hover:bg-surface-2 hover:text-text-primary disabled:opacity-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-sm font-bold text-text-primary px-2">{page} / {totalPages || 1}</div>
            <button 
              disabled={page >= totalPages}
              onClick={() => setPage(prev => prev + 1)}
              className="p-2 border border-border rounded-lg bg-background text-text-secondary hover:bg-surface-2 hover:text-text-primary disabled:opacity-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      <QuestionEditor 
        isOpen={isEditorOpen} 
        question={editingQuestion} 
        bankId={bankId} 
        bankSubject={bankSubject} 
        onClose={() => setIsEditorOpen(false)} 
        onSuccess={fetchQuestions} 
      />
    </div>
  );
}
