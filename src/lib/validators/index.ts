import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  current_password: z.string().optional(),
  new_password: z.string().min(8),
  confirm_password: z.string(),
}).refine(data => data.new_password === data.confirm_password, {
  message: "Passwords do not match",
  path: ["confirm_password"],
}).refine(data => {
  const hasNumber = /[0-9]/.test(data.new_password);
  const hasUppercase = /[A-Z]/.test(data.new_password);
  return hasNumber || hasUppercase;
}, {
  message: "Password must contain at least one number or uppercase letter",
  path: ["new_password"],
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
