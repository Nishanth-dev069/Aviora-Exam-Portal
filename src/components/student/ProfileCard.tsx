import React from 'react';
import { Mail, Hash, Users, UserCheck } from 'lucide-react';

interface ProfileData {
  fullName: string;
  rollNumber: string;
  email: string;
  batchName: string;
  photoUrl?: string | null;
}

export default function ProfileCard({ student }: { student: ProfileData }) {
  const initial = (student.fullName || 'S').charAt(0).toUpperCase();

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-5 gap-4">
        <div className="flex items-center gap-4">
          {/* Photo Avatar */}
          <div className="w-14 h-14 rounded-full overflow-hidden bg-surface-2 border-2 border-border flex items-center justify-center shrink-0 shadow-xs">
            {student.photoUrl ? (
              <img src={student.photoUrl} alt={student.fullName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-xl">
                {initial}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-black text-text-primary tracking-tight">{student.fullName}</h2>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                <UserCheck className="w-3.5 h-3.5" />
                Student Profile
              </span>
            </div>
            <p className="text-xs font-medium text-text-secondary mt-1">Academic identity and account information</p>
          </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="flex items-center gap-3.5 p-4 rounded-xl bg-surface-2/60 border border-border/80">
          <div className="p-2.5 bg-primary/10 rounded-lg text-primary shrink-0">
            <Hash className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Roll Number</div>
            <div className="font-bold text-text-primary text-sm mt-0.5 truncate">{student.rollNumber}</div>
          </div>
        </div>

        <div className="flex items-center gap-3.5 p-4 rounded-xl bg-surface-2/60 border border-border/80">
          <div className="p-2.5 bg-primary/10 rounded-lg text-primary shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Batch</div>
            <div className="font-bold text-text-primary text-sm mt-0.5 truncate">{student.batchName}</div>
          </div>
        </div>

        <div className="flex items-center gap-3.5 p-4 rounded-xl bg-surface-2/60 border border-border/80">
          <div className="p-2.5 bg-primary/10 rounded-lg text-primary shrink-0">
            <Mail className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Email Address</div>
            <div className="font-bold text-text-primary text-sm mt-0.5 truncate">{student.email}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
