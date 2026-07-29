import React from 'react';
import { Shield } from 'lucide-react';
import ChangePasswordForm from '@/components/student/ChangePasswordForm';

export default function SecurityCard() {
  return (
    <div className="bg-surface border border-border rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <div className="p-2.5 bg-primary/10 rounded-lg text-primary shrink-0">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-text-primary">Security & Password</h3>
          <p className="text-xs text-text-secondary mt-0.5 font-medium">Update your password to keep your student account secure.</p>
        </div>
      </div>

      <div className="max-w-md">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
