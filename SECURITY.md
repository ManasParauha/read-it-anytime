# Security Audit & Hardening Review

This document summarizes the Row-Level Security (RLS) policies, background job scopes, environment variables audit, and input hardening checks implemented for **Read It Anytime**.

---

## 1. Supabase Row-Level Security (RLS) Policy Summary

The PostgreSQL database enforces RLS on all primary application tables. The following policies are active:

| Table | Policy Name | Allowed Operations | Enforced Condition |
| :--- | :--- | :--- | :--- |
| **User** | `"Users can manage their own profile"` | `ALL` (Select, Insert, Update, Delete) | `auth.uid() = id` (Ensures authenticated users can only access their own user profile) |
| **Link** | `"Users can manage their own links"` | `ALL` (Select, Insert, Update, Delete) | `auth.uid() = "userId"` (Restricts link ingestion and retrieval to the authenticated owner) |
| **Usage** | `"Users can manage their own usage records"` | `ALL` (Select, Insert, Update, Delete) | `auth.uid() = "userId"` (Restricts weekly link processing limit counters to the owner) |
| **Digest** | `"Users can manage their own digests"` | `ALL` (Select, Insert, Update, Delete) | `auth.uid() = "userId"` (Restricts reading and managing sent digests to the owner) |

### Background Jobs & Service Role Verification
- **Prisma Server Client Access**: Server-side queries performed by Route Handlers and Inngest background jobs connect directly to the database via direct PostgreSQL URLs (`DATABASE_URL` / `DIRECT_URL`) utilizing the database owner/administrator credentials. Thus, RLS is bypassed at the database-driver level for internal server-side operations.
- **Scoped Execution Confirmation**: 
  - To prevent cross-tenant data leaks, all DB operations in the background jobs (`src/inngest/functions.ts`) use a **strictly scoped approach** rather than global queries.
  - In `scrapeLink`, updates and upserts are constrained by `linkId` and the specific user's `userId` mapping.
  - In `sendUserDigest`, query selection is scoped strictly by the `userId` received in the event payload.
  - This ensures that there are no data leakage paths even though background workers run with administrative DB access.

---

## 2. Environment Variables Audit

Below is the verification checklist for environment variables. None of the secret keys are prefixed with `NEXT_PUBLIC_` to prevent accidental client-side exposure.

- [x] **Database & Supabase Connections**
  - `DATABASE_URL`: Transaction-pooled Postgres connection string (Server-only).
  - `DIRECT_URL`: Direct Postgres connection string (Server-only, used for migrations).
  - `SUPABASE_SERVICE_ROLE_KEY`: Supabase admin service role bypass key (Server-only).
  - `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL (**Client-safe**, needed for client authentication).
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase public anon key (**Client-safe**, needed for client authentication).
- [x] **Google OAuth Credentials**
  - `GOOGLE_CLIENT_ID`: OAuth Client ID (Server/Supabase dashboard only).
  - `GOOGLE_CLIENT_SECRET`: OAuth Client Secret (Server/Supabase dashboard only).
- [x] **Inngest Engine Configuration**
  - `INNGEST_EVENT_KEY`: API signing key for event submission (Server-only).
  - `INNGEST_DEV`: Dev mode toggle (Server-only).
- [x] **AI / LLM Settings**
  - `AI_API_KEY`: Groq API key for Llama 3 categorization (Server-only).
- [x] **Email Dispatcher**
  - `RESEND_API_KEY`: Resend API key for digest emails (Server-only).
- [x] **Rate Limiting**
  - `UPSTASH_REDIS_REST_URL`: REST API endpoint for Upstash Redis (Server-only).
  - `UPSTASH_REDIS_REST_TOKEN`: Auth token for Upstash Redis (Server-only).
- [x] **Error Tracking**
  - `SENTRY_DSN`: Secret ingestion DSN for server-side errors (Server-only).
  - `NEXT_PUBLIC_SENTRY_DSN`: DSN for client-side browser errors (**Client-safe**, required for client-side reporting).

### Gitignore Verification
- `.env.local` is successfully gitignored. The `.gitignore` includes `/.*env*` rules, protecting local configuration secrets from git commits while keeping `.env.example` safe for reference.

---

## 3. Basic Input Hardening & XSS Prevention

- **Vulnerability Checked**: Stored Cross-Site Scripting (XSS) from scraped web page content (e.g. malicious `<script>` tags injected into article titles, cleaned text, or summaries).
- **Audit Confirmation**:
  - Verified that scraped `title`, `summary`, and `cleanedText` are rendered using standard React curly braces `{link.title}`, `{link.summary}`, and `{link.cleanedText}` in `src/app/dashboard/DashboardContent.tsx`.
  - React automatically escapes HTML strings by default before rendering them to the DOM.
  - Confirmed that `dangerouslySetInnerHTML` is **never** used anywhere in the dashboard code.
  - This ensures that scraped script tags or HTML are rendered strictly as raw plain-text strings, neutralizing any potential stored XSS.
