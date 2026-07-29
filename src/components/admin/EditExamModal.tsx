'use client';

import React, { useState } from 'react';
import { X, Loader2, Save, Calendar, Clock, FileText, Settings } from 'lucide-react';

type ExamData = {
  id: string;
  title: string;
  type: string;
  subject: string;
  description: string | null;
  instructions: string | null;
  duration_minutes: number;
  marks_per_question: number;
  negative_marks: number;
  passing_marks: number | null;
  status: string;
  scheduled_at: string | null;
  ends_at: string | null;
  settings: Record<string, any>;
};

function toDateTimeLocalString(dateStr?: string | null): string {
  if (!dateStr || !dateStr.trim()) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function EditExamModal({
  exam,
  onClose,
  onSuccess
}: {
  exam: ExamData;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [title, setTitle] = useState(exam.title || '');
  const [subject, setSubject] = useState(exam.subject || '');
  const [type, setType] = useState(exam.type || 'practice');
  const [description, setDescription] = useState(exam.description || '');
  const [instructions, setInstructions] = useState(exam.instructions || '');
  
  const [durationMinutes, setDurationMinutes] = useState<number>(exam.duration_minutes || 60);
  const [marksPerQuestion, setMarksPerQuestion] = useState<number>(exam.marks_per_question || 1.0);
  const [negativeMarking, setNegativeMarking] = useState<boolean>(Number(exam.negative_marks) > 0);
  const [negativeMarksVal, setNegativeMarksVal] = useState<number>(exam.negative_marks || 0.25);
  const [passingMarks, setPassingMarks] = useState<string>(exam.passing_marks !== null && exam.passing_marks !== undefined ? String(exam.passing_marks) : '');

  const [startDate, setStartDate] = useState(toDateTimeLocalString(exam.scheduled_at));
  const [endDate, setEndDate] = useState(toDateTimeLocalString(exam.ends_at));

  // Settings
  const [randomizeQuestions, setRandomizeQuestions] = useState<boolean>(exam.settings?.randomize_questions ?? true);
  const [randomizeOptions, setRandomizeOptions] = useState<boolean>(exam.settings?.randomize_options ?? true);
  const [fullscreenRequired, setFullscreenRequired] = useState<boolean>(exam.settings?.fullscreen_required ?? true);
  const [maxTabSwitches, setMaxTabSwitches] = useState<number>(exam.settings?.max_tab_switches ?? 5);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg('Title is required');
      return;
    }
    if (!subject.trim()) {
      setErrorMsg('Subject is required');
      return;
    }

    if (type === 'scheduled') {
      if (!startDate || !endDate) {
        setErrorMsg('Start date and End date are required for scheduled exams.');
        return;
      }
      if (new Date(endDate).getTime() <= new Date(startDate).getTime()) {
        setErrorMsg('End date must be strictly after Start date.');
        return;
      }
    }

    setIsSaving(true);

    try {
      const payload: Record<string, any> = {
        action: 'update_info',
        title: title.trim(),
        subject: subject.trim(),
        type,
        description: description.trim() || null,
        instructions: instructions.trim() || null,
        duration_minutes: Number(durationMinutes),
        marks_per_question: Number(marksPerQuestion),
        negative_marks: negativeMarking ? Number(negativeMarksVal) : 0,
        passing_marks: passingMarks.trim() !== '' ? Number(passingMarks) : null,
        scheduled_at: type === 'scheduled' && startDate ? new Date(startDate).toISOString() : null,
        ends_at: type === 'scheduled' && endDate ? new Date(endDate).toISOString() : null,
        settings: {
          ...exam.settings,
          randomize_questions: randomizeQuestions,
          randomize_options: randomizeOptions,
          fullscreen_required: fullscreenRequired,
          max_tab_switches: Number(maxTabSwitches)
        }
      };

      const res = await fetch(`/api/admin/exams/${exam.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error?.message || 'Failed to update exam');
        setIsSaving(false);
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setErrorMsg('Network error while updating exam.');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-surface z-10">
          <div>
            <h2 className="text-xl font-bold text-text-primary">Edit Exam Information</h2>
            <p className="text-xs text-text-secondary mt-0.5">Update configuration, schedule times, and security settings.</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-primary rounded-lg hover:bg-surface-2 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm font-bold rounded-xl animate-in fade-in">
              {errorMsg}
            </div>
          )}

          {/* Section 1: Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2 border-b border-border pb-2">
              <FileText className="w-4 h-4 text-primary" /> Basic Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">Exam Title *</label>
                <input 
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2 bg-background border border-border rounded-lg text-text-primary text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">Subject *</label>
                <input 
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3.5 py-2 bg-background border border-border rounded-lg text-text-primary text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">Exam Type</label>
                <select 
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3.5 py-2 bg-background border border-border rounded-lg text-text-primary text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="practice">Practice Exam (Open Availability)</option>
                  <option value="scheduled">Scheduled Exam (Strict Time Window)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">Duration (Minutes)</label>
                <input 
                  type="number"
                  min={5}
                  max={360}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full px-3.5 py-2 bg-background border border-border rounded-lg text-text-primary text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1">Description</label>
              <textarea 
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2 bg-background border border-border rounded-lg text-text-primary text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1">Instructions for Students</label>
              <textarea 
                rows={3}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full px-3.5 py-2 bg-background border border-border rounded-lg text-text-primary text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>
          </div>

          {/* Section 2: Marks & Grading */}
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2 border-b border-border pb-2">
              <Clock className="w-4 h-4 text-primary" /> Grading & Marks
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">Marks Per Question</label>
                <input 
                  type="number"
                  step="0.25"
                  min="0.25"
                  value={marksPerQuestion}
                  onChange={(e) => setMarksPerQuestion(Number(e.target.value))}
                  className="w-full px-3.5 py-2 bg-background border border-border rounded-lg text-text-primary text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">Negative Marking</label>
                <div className="flex items-center gap-3 mt-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-text-primary cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={negativeMarking}
                      onChange={(e) => setNegativeMarking(e.target.checked)}
                      className="rounded text-primary focus:ring-primary h-4 w-4"
                    />
                    Enable Negative Marks
                  </label>
                </div>
              </div>

              {negativeMarking && (
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">Negative Value</label>
                  <input 
                    type="number"
                    step="0.25"
                    min="0"
                    value={negativeMarksVal}
                    onChange={(e) => setNegativeMarksVal(Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-background border border-border rounded-lg text-text-primary text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-text-secondary mb-1">Passing Marks (Optional)</label>
              <input 
                type="number"
                min="0"
                placeholder="Leave blank for no minimum pass mark"
                value={passingMarks}
                onChange={(e) => setPassingMarks(e.target.value)}
                className="w-full md:w-1/2 px-3.5 py-2 bg-background border border-border rounded-lg text-text-primary text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          {/* Section 3: Schedule Window (If Scheduled Exam) */}
          {type === 'scheduled' && (
            <div className="space-y-4 pt-2">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2 border-b border-border pb-2">
                <Calendar className="w-4 h-4 text-primary" /> Schedule Window
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">Start Date & Time *</label>
                  <input 
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-background border border-border rounded-lg text-text-primary text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">End Date & Time *</label>
                  <input 
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-background border border-border rounded-lg text-text-primary text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Security & Delivery Settings */}
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2 border-b border-border pb-2">
              <Settings className="w-4 h-4 text-primary" /> Security & Delivery Settings
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-xs font-bold text-text-primary cursor-pointer p-3 bg-surface-2 border border-border rounded-xl">
                <input 
                  type="checkbox"
                  checked={randomizeQuestions}
                  onChange={(e) => setRandomizeQuestions(e.target.checked)}
                  className="rounded text-primary focus:ring-primary h-4 w-4"
                />
                Randomize Question Order
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-text-primary cursor-pointer p-3 bg-surface-2 border border-border rounded-xl">
                <input 
                  type="checkbox"
                  checked={randomizeOptions}
                  onChange={(e) => setRandomizeOptions(e.target.checked)}
                  className="rounded text-primary focus:ring-primary h-4 w-4"
                />
                Randomize Option Choices
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-text-primary cursor-pointer p-3 bg-surface-2 border border-border rounded-xl">
                <input 
                  type="checkbox"
                  checked={fullscreenRequired}
                  onChange={(e) => setFullscreenRequired(e.target.checked)}
                  className="rounded text-primary focus:ring-primary h-4 w-4"
                />
                Require Fullscreen Mode
              </label>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">Max Tab Switch Violations</label>
                <input 
                  type="number"
                  min={0}
                  max={20}
                  value={maxTabSwitches}
                  onChange={(e) => setMaxTabSwitches(Number(e.target.value))}
                  className="w-full px-3.5 py-2 bg-background border border-border rounded-lg text-text-primary text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
          </div>

          {/* Footer Controls */}
          <div className="pt-4 border-t border-border flex items-center justify-end gap-3 sticky bottom-0 bg-surface">
            <button 
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-border bg-surface text-text-secondary font-bold rounded-xl hover:bg-surface-2 text-sm transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-hover transition-colors flex items-center gap-2 text-sm disabled:opacity-75 shadow-md shadow-primary/20"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving Changes...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save Exam Changes
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
