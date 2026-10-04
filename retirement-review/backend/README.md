# Retirement Review — lead capture backend

Backend for the `/retirement-review/` landing page (401(k) review lead-gen campaign,
Mike Sheehan). The page posts JSON to a Supabase edge function which stores leads in
`public.retirement_leads`.

The site's other forms live in Supabase project `obwjlqrzshdglrccsbtl`, and the page
is already pointed at that project:

```
https://obwjlqrzshdglrccsbtl.supabase.co/functions/v1/retirement-lead
```

## Deploy (one time, ~2 minutes)

1. **Create the table** — paste `schema.sql` into the Supabase SQL editor and run it.
   RLS is on with no public policies, so only the edge function (service role) can
   touch the data.

2. **Deploy the function** from this directory:

   ```sh
   supabase functions deploy retirement-lead --no-verify-jwt --project-ref obwjlqrzshdglrccsbtl
   ```

   `--no-verify-jwt` is required — it's a public form endpoint (same as the other
   site forms). Spam is handled by a honeypot field plus server-side validation.

3. **Optional — email per lead.** Set two secrets and every lead also lands in an inbox
   (e.g. forward to Mike):

   ```sh
   supabase secrets set LEAD_NOTIFY_EMAIL=you@example.com RESEND_API_KEY=re_... --project-ref obwjlqrzshdglrccsbtl
   ```

   Without these secrets the function still works; leads just live in the table only.

## Pulling leads

```sql
select created_at, first_name, last_name, phone, email, age_range, state,
       plan_status, balance_range, utm->>'utm_source' as source, status
from public.retirement_leads
order by created_at desc;
```

`status` is a simple pipeline column: `new → contacted → booked → closed` (or `bad`).

## Campaign tracking

The page captures `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, and
`utm_term` from the URL and stores them with each lead — point ads at e.g.
`https://kitcrew.ai/retirement-review/?utm_source=facebook&utm_campaign=401k-aug`.
