'use client';

import React from 'react';
import { useFormContext } from 'react-hook-form';
import { WizardFormData } from '@/app/admin/exams/new/page';
import { ClipboardCheck, FileText, Database, Settings, Calendar, Users } from 'lucide-react';

export default function Step6_Review() {
  const { getValues } = useFormContext<WizardFormData>();
  const data = getValues();

  return (
    <div className="p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="mb-8 text-center flex flex-col items-center justify-center border-b border-border pb-8">
        <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-4">
          <ClipboardCheck className="w-8 h-8 text-success" />
        </div>
        <h2 className="text-2xl font-bold text-text-primary">Review & Publish</h2>
        <p className="text-text-secondary mt-1 max-w-lg">
          Please review the configurations below. Once published, the exam will be permanently stamped and its structure cannot be modified.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        
        {/* Basic Info */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-text-primary flex items-center gap-2 border-b border-border pb-2">
            <FileText className="w-5 h-5 text-primary" /> Basic Information
          </h3>
          <ul className="space-y-3 text-sm">
            <li className="flex justify-between">
              <span className="text-text-secondary">Title</span>
              <span className="font-bold text-text-primary text-right">{data.basic_info.title}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-text-secondary">Type</span>
              <span className="font-bold text-text-primary capitalize text-right">{data.basic_info.type}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-text-secondary">Subject</span>
              <span className="font-bold text-text-primary text-right">{data.basic_info.subject}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-text-secondary">Duration</span>
              <span className="font-bold text-text-primary text-right">{data.basic_info.duration} mins</span>
            </li>
            <li className="flex justify-between">
              <span className="text-text-secondary">Scoring</span>
              <span className="font-bold text-text-primary text-right">
                {data.basic_info.marks_per_question} per Q 
                {data.basic_info.negative_marking ? ` ( -${data.basic_info.negative_marks_value} for wrong)` : ''}
              </span>
            </li>
          </ul>
        </div>

        {/* Questions */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-text-primary flex items-center gap-2 border-b border-border pb-2">
            <Database className="w-5 h-5 text-primary" /> Question Draw
          </h3>
          <ul className="space-y-3 text-sm">
            <li className="flex justify-between">
              <span className="text-text-secondary">Total Questions</span>
              <span className="font-bold text-text-primary text-right">{data.questions.count}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-text-secondary">Distribution Mode</span>
              <span className="font-bold text-text-primary text-right">{data.questions.selection_type}</span>
            </li>
            {data.questions.selection_type === 'Manual' && (
              <li className="flex justify-between">
                <span className="text-text-secondary">Strict Targets</span>
                <span className="font-bold text-text-primary text-right">
                  <span className="text-success">{data.questions.manual_counts.easy} E</span>,{' '}
                  <span className="text-warning-dark">{data.questions.manual_counts.medium} M</span>,{' '}
                  <span className="text-danger">{data.questions.manual_counts.hard} H</span>
                </span>
              </li>
            )}
          </ul>
        </div>

        {/* Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-text-primary flex items-center gap-2 border-b border-border pb-2">
            <Settings className="w-5 h-5 text-primary" /> Delivery & Security
          </h3>
          <ul className="space-y-3 text-sm">
            <li className="flex justify-between">
              <span className="text-text-secondary">Randomize</span>
              <span className="font-bold text-text-primary text-right">
                {data.settings.randomize_questions && 'Questions'}
                {data.settings.randomize_questions && data.settings.randomize_options && ' & '}
                {data.settings.randomize_options && 'Options'}
                {!data.settings.randomize_questions && !data.settings.randomize_options && 'None'}
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-text-secondary">Security Profile</span>
              <span className="font-bold text-text-primary text-right">
                {data.settings.fullscreen_required ? 'Fullscreen + ' : ''}
                {data.settings.watermark ? 'Watermark' : ''}
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-text-secondary">Violations allowed</span>
              <span className="font-bold text-text-primary text-right">
                {data.settings.max_tab_switches === 0 ? 'Unlimited' : data.settings.max_tab_switches} 
                {data.settings.auto_submit && data.settings.max_tab_switches > 0 ? ' (Auto-Submit)' : ''}
              </span>
            </li>
          </ul>
        </div>

        {/* Enrollment & Schedule */}
        <div className="space-y-4">
          {data.basic_info.type === 'scheduled' && (
            <>
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2 border-b border-border pb-2">
                <Calendar className="w-5 h-5 text-primary" /> Schedule
              </h3>
              <ul className="space-y-3 text-sm mb-6">
                <li className="flex justify-between">
                  <span className="text-text-secondary">Window Opens</span>
                  <span className="font-bold text-text-primary text-right">{new Date(data.schedule.start_date || '').toLocaleString()}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-text-secondary">Window Closes</span>
                  <span className="font-bold text-danger text-right">{new Date(data.schedule.end_date || '').toLocaleString()}</span>
                </li>
              </ul>
            </>
          )}

          <h3 className="text-lg font-bold text-text-primary flex items-center gap-2 border-b border-border pb-2">
            <Users className="w-5 h-5 text-primary" /> Enrollment
          </h3>
          <ul className="space-y-3 text-sm">
            <li className="flex justify-between">
              <span className="text-text-secondary">Selected Batches</span>
              <span className="font-bold text-primary text-right">{data.enrollment.batches.length}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-text-secondary">Explicit Individuals</span>
              <span className="font-bold text-primary text-right">{data.enrollment.individual_students.length}</span>
            </li>
          </ul>
        </div>

      </div>
    </div>
  );
}
