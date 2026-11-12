# BELIN Clean: review and staged release

This PR targets `belin-v2`. Do not merge, deploy production, run production SQL,
enable forms or enable publication until the owner approves the staged result.
No live database changes are part of opening this PR.

## Source and build

The application modified here is `belin-netlify/belin-netlify 3/`.
The older outer `belin-netlify/` copy is deliberately unchanged. Netlify's base
directory must point at the nested application for this version. Do not change
the production project's branch/base directory as part of a preview.

Use Node 22, then `npm ci`, `npm run check`, `npm test`, `npm run build:check`.
The pinned Netlify CLI requires Node >=22.13.0; `.nvmrc` and Netlify's build
environment select Node 22.
Netlify publishes `public` and bundles `netlify/functions`. The platform function
statically imports its renderer/template, so no runtime template file lookup is
required. The build check produces an ignored `.build/functions/` artifact.

## Database preflight (staging first)

1. Back up the existing schema, grants, policies, triggers and relevant data.
   Inspect `customer_sites` and existing routines/views which expose it; this
   migration cannot remove unknown SECURITY DEFINER routines or external APIs.
2. Existing core columns must be compatible with: `id uuid`, `owner_id uuid`
   referencing `auth.users`, `name text`, `template_key text`, `status text`,
   `content jsonb`. Resolve enums, missing core columns, triggers, duplicate slugs
   and incompatible constraints deliberately. The migration fails/rolls back on
   incompatibility; it does not silently convert or delete customer data.
3. Review and apply `supabase/migrations/202611120001_customer_platform.sql` once
   on an isolated Supabase staging project. It intentionally replaces all legacy
   policies and browser grants on `customer_sites`, including column grants.
   Provisioning, ownership, entitlement, slug and published fields become
   server/operator-only. Users may SELECT their own rows and UPDATE only content.
4. Existing sites receive `publication_enabled=false` and no public snapshot.
   There is no migration-time publication. Existing public pages, if provided
   elsewhere, are not changed by this SQL.

Fresh installs still need the studio schema (`schema.sql`) plus any existing
services/templates migrations from the actual installation; this PR does not
reconstruct the unrelated studio catalog. The platform migration itself supports
both a fresh `customer_sites` table and a compatible existing table.

## Isolated preview configuration

- Use a separate Netlify preview project or preview-specific environment and
  separate Supabase staging project. Never give a deploy preview production
  service credentials. Keep the production branch configuration unchanged.
- Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` to staging.
  The browser now reads the public pair from `/api/config`, not a hardcoded
  production project. Never expose the service key to the browser.
- Set `LEAD_THROTTLE_SALT` to a long random secret and
  `BELIN_PLATFORM_ENABLED=true` only in the isolated staging environment. The new
  server routes return 503 unless explicitly enabled.
- In staging Supabase Auth allow the exact preview origin's `/dashboard/` and
  `/login/reset/` redirect URLs. Configure its Site URL, password policy,
  confirmation emails and SMTP. Avoid broad wildcard production redirects.
- Netlify automatically handles the new `/api/platform/*`, `/s/:slug` and
  `/s/:slug/privacy` routes; the specific API rule precedes `/api/*`.

## Provisioning and permission model

Create users through Supabase Auth. Provision sites through a trusted operator
using SQL or service credentials, never from browser metadata. After the order
is approved/paid, explicitly set that site's `publication_enabled=true`.
For example, in staging only (substitute an actual staging user UUID):

```sql
insert into public.customer_sites(owner_id,name,template_key,status,content,publication_enabled)
values ('STAGING-USER-UUID', 'Staging Clean', 'belin-clean', 'draft', '{}', true);
```

The customer fills content, real contacts, operator name and their approved
privacy policy in the editor. Saving affects only `content`. Publishing validates
the saved draft and writes a separate normalized `published_content` snapshot.
The stable public path is `/s/clean-<site-uuid>`. A later draft does not alter the
public page until republished. This release uses paths, not custom domains.
To suspend a site, the trusted operator sets `publication_enabled=false`; both
public rendering and lead acceptance stop. Customers cannot set this flag.

The policy length/contact checks are completeness checks, not legal validation.
Approve the actual policy and handling/retention process before collecting data.
Demonstration testimonials and unsupported experience metrics are removed from
the publishable template. Verify the remaining copy, image rights and prices for
each customer. Card prices are editable text; the estimate calculator uses the
separate base-price setting and fixed documented multipliers, so agree both.

## Acceptance before production approval

1. Register two staging users A/B and confirm email. Check login, logout, invalid
   password, password reset from the email (including another browser), expired
   link, mismatched passwords and successful login with the new password.
2. Give each a site. A cannot read/update B's row by direct REST requests. A
   cannot INSERT/DELETE sites or UPDATE owner, entitlement, slug, published
   snapshot or status. Anonymous requests cannot read sites/leads directly.
3. A saves, reloads and sees the same content. Import invalid services/JSON and
   invalid colors/URLs: controlled errors, no executable markup. Verify manual
   color input, text, footer contacts, metadata and calculator minimum price.
4. Publishing without entitlement, contacts or policy fails. Publish a valid site;
   verify public HTML, metadata, contacts, consent policy and mobile layout. Save
   a later draft and confirm the public page remains unchanged; republish it.
5. Submit a real staging lead from the public page on Netlify (the endpoint
   requires Netlify's trusted client-IP header). Confirm success only after DB
   insertion, the lead appears for A but not B, duplicate requests within one
   minute get 429, and a stale policy version gets 409. Do not use production
   customer details for testing.
6. Revoke entitlement and verify both public URL and lead endpoint stop working.
7. Review database policies/grants, Netlify logs, environment isolation and the
   final diff. Only then ask the owner to approve production rollout.

## Lead operations and limitations

The inbox shows the latest 100 leads across the first 100 owned sites. This is
durable database delivery to the customer's cabinet, not an email/Telegram
notification integration. No third-party notification credentials are required.
Retention/deletion, export and notifications need a separate agreed operating
process. The throttle is an atomic per-site/IP one-minute limit, not a CAPTCHA or
a complete DDoS defence. Arrange additional abuse controls if needed for launch.
Throttle rows retain salted IP hashes; include them in the retention/cleanup plan.

## Rollback

Before production approval, simply close the PR/remove the isolated preview.
After an approved release, turn off `BELIN_PLATFORM_ENABLED` to stop platform
routes, or suspend only the affected site's entitlement. Revert the code if
necessary. Do not drop lead tables or restore broad legacy grants to roll back;
preserve data and RLS, and review any schema rollback against the backup.

## Validation recorded for this PR

- 15 automated tests passed: fresh/legacy PostgreSQL migration and role isolation,
  privileged-column protection, password recovery states, rendering/XSS rejection,
  publication snapshots and conflicting edits, lead validation, policy version and
  throttle handling. PostgreSQL tests use disposable local PGlite databases, not
  the live Supabase project. HTTP handler tests use an injected database adapter.
- Syntax checks passed for 15 scripts/modules. Both API functions bundled with
  esbuild and with `netlify functions:build --src netlify/functions`.
- Browser preview: calculator/form opened, preview submission did not send data,
  no captured console warnings/errors; mobile width 390px matched document width
  390px after fixing the header overflow.
- Production dependency audit: zero reported vulnerabilities. Netlify CLI was
  upgraded from 23.15.1 to 27.17.0; the complete development dependency audit still
  reports 25 issues (1 critical, 4 high, 18 moderate, 2 low), in the CLI dependency
  tree. The critical finding is `proxy-addr`; high findings include `body-parser`,
  `http-proxy-middleware`, `multiparty`, `path-to-regexp`. These packages are not
  imported into the production functions. A compatible audit fix and current CLI
  upgrade did not eliminate them. Review/update tooling before exposing a local
  development server to untrusted networks; do not treat this as a clean full
  dependency audit or use forced transitive upgrades without compatibility tests.
- Actual Supabase email delivery, live-project policies, Netlify preview requests
  and lead persistence through the hosted stack remain staging acceptance tasks.

## Documentation references

- Supabase password reset: https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
- RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Column grants: https://supabase.com/docs/guides/database/postgres/column-level-security


## Applied database hardening — 2026-11-12

The owner subsequently authorized direct database cleanup. The reviewed migration
was applied through the authenticated Supabase SQL Editor to project
`wtzihjezhjevezgdipob` (`studio`, organization `belins`). This is a database-only
change: PR #1 remains unmerged and no Netlify production release was performed.
Do NOT rerun this initial migration against that existing project: its new tables
already exist. For new/staging databases use the updated migration normally.
Schema changes were executed as one transaction, without manually modifying
Supabase's migration-history tables.

Live inspection found a legacy status constraint (`draft`, `active`, `suspended`)
and a timestamp/field guard. The migration now preserves those states, adds
`published`, retains timestamp maintenance, protects all non-content fields for
browser roles and avoids duplicating existing owner/slug indexes. A redundant
owner index created during the first pass was removed after verifying it was
identical to the existing `customer_sites_owner_id_idx`; the original was kept.

Excess TRUNCATE/TRIGGER/REFERENCES grants on `services` and `templates` and broad
browser grants on `customer_sites` were revoked. RLS does not constrain TRUNCATE,
so the grants themselves had to be removed. Authenticated customers retain
SELECT of their own sites and UPDATE(content) only; the legacy frontend's save
query still works. `customer_leads` and its atomic-throttle function are ready
for the upcoming server code. Existing studio API access through service_role
was preserved.

Live verification used the real owner's role and a different synthetic JWT
subject inside an explicit transaction: own-site SELECT/content UPDATE passed,
foreign-site access and protected-column modification were blocked, unsafe
TRUNCATE privileges were absent. All test writes were rolled back. Original
site fields, content and timestamps were compared before/after and remained
identical. Counts remained: 1 draft site, 94 services, 0 studio leads, 0 templates;
new customer leads: 0. Publication remains disabled and the published snapshot
is NULL. Public /api/public still returned all 94 services with formsEnabled=false.
Private before/after snapshots were kept outside the repository and are not
included in this public PR.

Auth was inspected: confirmed email is enabled, anonymous sign-ins disabled,
secure email change enabled. Secure password change was enabled (requires a
recent login/reauthentication). Existing Site URL and callback were preserved;
exact callbacks on the same trusted domain were added:
`https://belin.su/dashboard/`, `https://belin.su/login/`,
`https://belin.su/login/reset/`. No wildcard/third-party callbacks were added.

Advisors were reviewed. RLS-without-policy informational notices on studio/server
and throttle tables are intentional: browser grants are revoked and service_role
is the only application reader/writer. Do not add permissive policies to silence
those notices. New-index "unused" notices are expected before traffic.
Leaked-password protection is unavailable on the current Free plan (Pro+); no
plan upgrade was made. Custom SMTP is disabled; configuring a mail provider and
running the email-to-browser recovery acceptance test are still required before
customer onboarding. No email/password/key rotation or user deletion occurred.
