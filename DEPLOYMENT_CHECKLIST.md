# AVIORA Portal - Deployment Checklist

> [!WARNING]  
> The following infrastructure tasks must be configured manually inside the **Supabase Dashboard** prior to launching the platform in production.

## 1. Storage Buckets Configuration
Create the following buckets and strictly enforce their properties:

| Bucket Name | Visibility | File Size Limit | Allowed MIME Types |
|---|---|---|---|
| `student-photos` | **Private** | 2 MB | `image/jpeg`, `image/png`, `image/webp` |
| `exam-assets` | **Private** | 5 MB | `image/jpeg`, `image/png`, `application/pdf` |

**Security Checks:**
- Ensure "Disable bucket listing" is ON for all private buckets.
- For `student-photos`, ensure the application generates Signed URLs (1-hour expiry) to serve the images safely (this logic will be enforced by the App).

### Storage RLS Policies
Navigate to `Authentication > Policies` in Supabase and ensure:
- Only authenticated admins/super_admins can **INSERT/UPDATE** to `student-photos`.
- Authenticated students can **SELECT** from `student-photos` only if they match their own `user_id`, or via generated Signed URLs.

## 2. Spend Cap & Cost Management
Navigate to `Project Settings > Billing`:
- **Enable Spend Cap**: Set this explicitly to ON.
- **Monthly Limit**: Set the limit to `$50` (or 2× Pro Plan Base) to prevent automated billing attacks or unexpected cost spikes.
- **Alerting**: Configure a usage alert to trigger an email at **80%** of the Spend Cap.

## 3. Database Tasks
- **Scheduled Exams**: Ensure the `pg_cron` extension is active. You must schedule the database CRON job that flips Scheduled exams to `active` when their `scheduled_at` timestamp arrives. The system relies on this trigger for the Monitoring dropdowns.
