'use client';

import React from 'react';
import { useFormContext, Path } from 'react-hook-form';
import { WizardFormData } from '@/app/admin/exams/new/page';
import { Settings, Shield, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Step3_Settings() {
  const { register } = useFormContext<WizardFormData>();

  const ToggleRow = ({ name, label, description, danger = false }: { name: Path<WizardFormData>, label: string, description: string, danger?: boolean }) => {
    return (
      <div className="flex items-start justify-between py-4 border-b border-border last:border-0 gap-4">
        <div>
          <div className="font-bold text-text-primary">{label}</div>
          <div className="text-sm text-text-secondary mt-1">{description}</div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer mt-1 flex-shrink-0">
          <input type="checkbox" {...register(name)} className="sr-only peer" />
          <div className={cn(
            "w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all",
            danger ? "peer-checked:bg-danger" : "peer-checked:bg-primary"
          )}></div>
        </label>
      </div>
    );
  };

  return (
    <div className="p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-text-primary">Exam Settings</h2>
        <p className="text-text-secondary mt-1">Configure randomization, security, and post-exam workflows.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column */}
        <div className="space-y-6">
          <div className="bg-surface-2 rounded-2xl border border-border p-1">
            <div className="px-5 py-4 border-b border-border flex items-center gap-3 font-bold text-text-primary">
              <Settings className="w-5 h-5 text-primary" /> Delivery & Randomization
            </div>
            <div className="px-5">
              <ToggleRow 
                name="settings.randomize_questions" 
                label="Shuffle Questions" 
                description="Each student receives questions in a random order." 
              />
              <ToggleRow 
                name="settings.randomize_options" 
                label="Shuffle Options" 
                description="Answer options inside each question are randomized." 
              />
            </div>
          </div>

          <div className="bg-surface-2 rounded-2xl border border-border p-1">
            <div className="px-5 py-4 border-b border-border flex items-center gap-3 font-bold text-text-primary">
              <Award className="w-5 h-5 text-primary" /> Post-Exam Experience
            </div>
            <div className="px-5">
              <ToggleRow 
                name="settings.show_result" 
                label="Show Result Immediately" 
                description="Students see their score right after submission." 
              />
              <ToggleRow 
                name="settings.allow_review" 
                label="Allow Answer Review" 
                description="Students can see which questions they got wrong and view explanations." 
              />
              
              <div className="py-4 border-t border-border mt-2">
                <label className="block font-bold text-text-primary mb-1">Leaderboard Display</label>
                <p className="text-sm text-text-secondary mb-3">When should the student leaderboard be visible?</p>
                <select 
                  {...register('settings.leaderboard_timing')}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="submission">Immediately after submission</option>
                  <option value="exam_end">Only after exam window strictly closes</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <div className="bg-surface-2 rounded-2xl border border-border p-1 border-l-4 border-l-warning">
            <div className="px-5 py-4 border-b border-border flex items-center gap-3 font-bold text-text-primary">
              <Shield className="w-5 h-5 text-warning" /> Security & Anti-Cheat
            </div>
            <div className="px-5">
              <ToggleRow 
                name="settings.fullscreen_required" 
                label="Enforce Fullscreen Mode" 
                description="Students must remain in fullscreen mode during the exam." 
              />
              <ToggleRow 
                name="settings.watermark" 
                label="Enable Forensic Watermark" 
                description="Renders the student's ID dynamically across the screen to deter photos." 
              />
              
              <div className="py-4 border-t border-border">
                <label className="block font-bold text-text-primary mb-1">Max Tab Switches (Violations)</label>
                <p className="text-sm text-text-secondary mb-3">Number of times a student can leave the exam tab before being flagged (0 = unlimited).</p>
                <input 
                  type="number"
                  {...register('settings.max_tab_switches', { valueAsNumber: true })}
                  className="w-32 px-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                  min={0}
                />
              </div>

              <div className="bg-danger/5 -mx-5 px-5 pb-2 pt-2 rounded-b-xl border-t border-danger/20">
                <ToggleRow 
                  name="settings.auto_submit" 
                  label="Auto-Submit on Max Violations" 
                  description="Automatically terminate and submit the exam if the student exceeds max tab switches." 
                  danger
                />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
