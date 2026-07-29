import React from 'react';

export type BadgeVariant = 'default' | 'success' | 'danger' | 'warning' | 'primary';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  className = '',
  ...props
}) => {
  const variants: Record<BadgeVariant, string> = {
    default: 'bg-surface-2 text-text-secondary border-border',
    success: 'bg-success-bg text-success border-success/20',
    danger: 'bg-danger-bg text-danger border-danger/20',
    warning: 'bg-warning-bg text-warning border-warning/20',
    primary: 'bg-primary-light text-primary border-primary/20',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
