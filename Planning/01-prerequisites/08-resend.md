# Resend

Transactional email: order confirmation, shipping updates, password reset, etc. The full email inventory (triggers, templates, which service sends what) is in [email-flows](../04-cross-cutting/email-flows.md). Marketing email is Klaviyo ([09-klaviyo](09-klaviyo.md)) — keep the two on separate subdomains so marketing reputation can't hurt receipts.

## What it's for

API-driven sends from Medusa subscribers, with **React Email** templates living in `packages/emails` so templates are versioned code, not dashboard HTML.

## Tier & cost

**Free**: 3,000 emails/mo, 1 domain — fine until meaningful order volume. **Pro ($20/mo)**: 50k emails, multiple domains.

## Setup steps

1. Sign up at resend.com → Domains → Add `mail.odorelite.com` (subdomain, not apex — isolates transactional reputation).
2. Resend shows the DNS records; add them in Cloudflare (all **DNS-only**):
   - SPF: TXT `mail.odorelite.com` → `v=spf1 include:amazonses.com ~all` (Resend rides SES; copy the exact value shown).
   - DKIM: three CNAMEs as listed.
   - DMARC: TXT `_dmarc.mail.odorelite.com` → `v=DMARC1; p=quarantine; rua=mailto:dmarc@odorelite.com` — start at `p=none` for a week of reports, then tighten to `quarantine`.
3. Wait for the domain to show **Verified** (minutes to hours).
4. Create API key (Full access, scoped to the domain). One key per environment.
5. Sender identity: `OdorElite <orders@mail.odorelite.com>`; replies route to a monitored `support@odorelite.com` via `reply_to`.
6. In Medusa, implement a Notification provider (or subscriber module) that renders `packages/emails` templates and calls the Resend API — wiring detailed in the [integration map](../02-architecture/integration-map.md).

## Credentials to collect

| Env var | App | Where |
|---|---|---|
| `RESEND_API_KEY` | Medusa | API Keys page (`re_…`) |

## OdorElite-specific configuration

- Enable **click/open tracking off** for transactional mail (link rewriting hurts trust on receipts and password resets).
- Set up the `dmarc@odorelite.com` alias to actually receive aggregate reports.
- Test rendering of every template with `resend emails send` (or the dashboard test) against a Gmail, an Outlook, and an iOS Mail account — the three renderers that break things.

## You're done when…

- Domain shows Verified; `dig TXT _dmarc.mail.odorelite.com` returns the DMARC policy.
- A test order-confirmation email lands in the inbox (not spam) of Gmail and Outlook test accounts, from `orders@mail.odorelite.com`.
