'use client';

import React, { useState, useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import { WizardFormData } from '@/app/admin/exams/new/page';
import { Users, Layers, Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Step5_Enrollment() {
  const { watch, setValue } = useFormContext<WizardFormData>();
  const [activeTab, setActiveTab] = useState<'batches' | 'individuals'>('batches');
  
  const [batches, setBatches] = useState<{ id: string, name: string, student_count: number }[]>([]);
  const [students, setStudents] = useState<{ user_id: string, full_name: string, roll_number: string, batches?: { name: string } }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  
  const [searchBatch, setSearchBatch] = useState('');
  const [searchStudent, setSearchStudent] = useState('');

  const selectedBatches = watch('enrollment.batches') || [];
  const selectedStudents = watch('enrollment.individual_students') || [];

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setStudentsError(null);
      try {
        const [resBatches, resStudents] = await Promise.all([
          fetch('/api/admin/batches?pageSize=1000'),
          fetch('/api/admin/students?pageSize=1000&status=active')
        ]);
        const dataBatches = await resBatches.json();
        const dataStudents = await resStudents.json();
        
        if (dataBatches.data) setBatches(dataBatches.data);
        if (resStudents.ok) {
          const list = dataStudents.students ?? dataStudents.data ?? [];
          setStudents(list);
        } else {
          setStudentsError(dataStudents.error?.message || 'Failed to load students');
        }
      } catch (err: any) {
        console.error(err);
        setStudentsError(err.message || 'Network error loading students');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const toggleBatch = (id: string) => {
    const isSelected = selectedBatches.includes(id);
    if (isSelected) {
      setValue('enrollment.batches', selectedBatches.filter(b => b !== id));
    } else {
      setValue('enrollment.batches', [...selectedBatches, id]);
    }
  };

  const toggleStudent = (id: string) => {
    const isSelected = selectedStudents.includes(id);
    if (isSelected) {
      setValue('enrollment.individual_students', selectedStudents.filter(s => s !== id));
    } else {
      setValue('enrollment.individual_students', [...selectedStudents, id]);
    }
  };

  const filteredBatches = batches.filter(b => b.name.toLowerCase().includes(searchBatch.toLowerCase()));
  const filteredStudents = students.filter(s => 
    s.full_name.toLowerCase().includes(searchStudent.toLowerCase()) || 
    s.roll_number.toLowerCase().includes(searchStudent.toLowerCase())
  );

  return (
    <div className="p-8 animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col h-full">
      <div className="mb-6 flex-shrink-0">
        <h2 className="text-2xl font-bold text-text-primary">Enrollment</h2>
        <p className="text-text-secondary mt-1">Select the batches or individual students who will have access to this exam.</p>
      </div>

      <div className="flex items-center gap-4 border-b border-border mb-6 flex-shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('batches')}
          className={cn("px-4 py-3 font-bold border-b-2 transition-colors flex items-center gap-2", activeTab === 'batches' ? "border-primary text-primary" : "border-transparent text-text-secondary hover:text-text-primary")}
        >
          <Layers className="w-5 h-5" /> Entire Batches
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('individuals')}
          className={cn("px-4 py-3 font-bold border-b-2 transition-colors flex items-center gap-2", activeTab === 'individuals' ? "border-primary text-primary" : "border-transparent text-text-secondary hover:text-text-primary")}
        >
          <Users className="w-5 h-5" /> Individual Students
        </button>
      </div>

      {studentsError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          Could not load students: {studentsError}
        </div>
      )}

      <div className="flex-1 bg-surface-2 border border-border rounded-2xl p-6 flex flex-col min-h-[400px] relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-surface-2/80 backdrop-blur-[2px] flex items-center justify-center rounded-2xl">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {activeTab === 'batches' ? (
          <>
            <div className="relative mb-4 flex-shrink-0">
              <Search className="w-5 h-5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search batches..." 
                value={searchBatch}
                onChange={e => setSearchBatch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
              />
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
              {filteredBatches.map(batch => (
                <label key={batch.id} className={cn(
                  "flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-colors",
                  selectedBatches.includes(batch.id) ? "bg-primary/5 border-primary" : "bg-background border-border hover:border-primary/50"
                )}>
                  <div>
                    <div className="font-bold text-text-primary">{batch.name}</div>
                    <div className="text-sm text-text-secondary">{batch.student_count} students</div>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={selectedBatches.includes(batch.id)}
                    onChange={() => toggleBatch(batch.id)}
                    className="w-5 h-5 text-primary rounded focus:ring-primary accent-primary"
                  />
                </label>
              ))}
              {filteredBatches.length === 0 && !isLoading && (
                <div className="text-center py-10 text-text-muted">No batches found.</div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="relative mb-4 flex-shrink-0">
              <Search className="w-5 h-5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search students by name or roll number..." 
                value={searchStudent}
                onChange={e => setSearchStudent(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
              />
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
              {filteredStudents.map(student => (
                <label key={student.user_id} className={cn(
                  "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors",
                  selectedStudents.includes(student.user_id) ? "bg-primary/5 border-primary" : "bg-background border-border hover:border-primary/50"
                )}>
                  <div>
                    <div className="font-bold text-text-primary">{student.full_name} <span className="text-text-muted font-normal text-sm ml-2">{student.roll_number}</span></div>
                    {student.batches?.name && <div className="text-xs text-text-secondary mt-0.5">{student.batches.name}</div>}
                  </div>
                  <input 
                    type="checkbox" 
                    checked={selectedStudents.includes(student.user_id)}
                    onChange={() => toggleStudent(student.user_id)}
                    className="w-5 h-5 text-primary rounded focus:ring-primary accent-primary"
                  />
                </label>
              ))}
              {filteredStudents.length === 0 && !isLoading && (
                <div className="text-center py-10 text-text-muted">No students found.</div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between p-4 bg-primary/10 rounded-xl border border-primary/20 flex-shrink-0">
        <div className="text-sm font-bold text-primary">
          {selectedBatches.length} Batches selected
        </div>
        <div className="text-sm font-bold text-primary">
          {selectedStudents.length} Individual Students selected
        </div>
      </div>
    </div>
  );
}
