# Security Policy

## SSRF Prevention
The Aviora Exam Portal strictly prevents Server-Side Request Forgery (SSRF). 
- The portal makes **no external HTTP requests** dynamically based on user input. 
- Usage of `fetch(userInput)` is strictly forbidden anywhere in the codebase.
- Any future integration requiring Webhooks or external URL fetching must rigorously validate the URL against a hardcoded backend allowlist before attempting to execute a request.

## Secret Management
- The `SUPABASE_SERVICE_ROLE_KEY` bypasses all Row Level Security (RLS) rules. It must **only** be used within server-side environments (`src/app/api`, Server Components).
- Client-side code (`src/components`, `src/hooks`, `src/lib`) is actively prevented from calling or referencing the Service Role Key via ESLint restrictions.

## Input Sanitization
- All text inputs that will be rendered dynamically are rigorously sanitized on the server before storage to prevent Stored XSS.
- The `sanitize-html` library handles stripping malicious scripts/iframes, specifically targeting Exam Question content and Admin notifications.

## Error Handling
- Active Exam sessions catch exceptions using React Error Boundaries.
- System errors are suppressed from the user output to prevent information leakage, preserving local IndexedDB states safely to prevent data loss.
