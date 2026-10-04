// Supabase Edge Function: retirement-lead
// Receives lead submissions from https://kitcrew.ai/retirement-review/ and inserts
// them into public.retirement_leads. Deploy with --no-verify-jwt (public form endpoint).
// Optional: set LEAD_NOTIFY_EMAIL + RESEND_API_KEY secrets to get an email per lead.

import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://kitcrew.ai",
  "https://www.kitcrew.ai",
]);

function cors(origin: string | null) {
  const o = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://kitcrew.ai";
  return {
    "Access-Control-Allow-Origin": o,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Content-Type": "application/json",
  };
}

const clip = (v: unknown, n: number) =>
  typeof v === "string" ? v.trim().slice(0, n) : "";

Deno.serve(async (req) => {
  const headers = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method" }), { status: 405, headers });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "bad json" }), { status: 400, headers });
  }

  // Honeypot: real users never fill the hidden "company" field. Pretend success.
  if (clip(body.company, 10)) {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  }

  const lead = {
    first_name: clip(body.first_name, 80),
    last_name: clip(body.last_name, 80),
    phone: clip(body.phone, 32),
    email: clip(body.email, 160),
    age_range: clip(body.age_range, 24),
    state: clip(body.state, 24),
    plan_status: clip(body.plan_status, 64),
    balance_range: clip(body.balance_range, 40),
    consent: body.consent === true,
    page: clip(body.page, 120),
    utm: typeof body.utm === "object" && body.utm !== null ? body.utm : {},
    user_agent: clip(req.headers.get("user-agent"), 300),
    ip: clip(req.headers.get("x-forwarded-for")?.split(",")[0], 64),
  };

  const phoneDigits = lead.phone.replace(/\D/g, "");
  if (!lead.first_name || !lead.last_name || phoneDigits.length < 10 ||
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lead.email) || !lead.consent) {
    return new Response(JSON.stringify({ ok: false, error: "missing fields" }), { status: 400, headers });
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { error } = await db.from("retirement_leads").insert(lead);
  if (error) {
    console.error("insert failed:", error.message);
    return new Response(JSON.stringify({ ok: false, error: "store" }), { status: 500, headers });
  }

  // Optional per-lead email notification via Resend.
  const notify = Deno.env.get("LEAD_NOTIFY_EMAIL");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (notify && resendKey) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Retirement Review Leads <leads@kitcrew.ai>",
          to: [notify],
          subject: `New 401(k) review lead: ${lead.first_name} ${lead.last_name} (${lead.state})`,
          text: [
            `Name:    ${lead.first_name} ${lead.last_name}`,
            `Phone:   ${lead.phone}`,
            `Email:   ${lead.email}`,
            `Age:     ${lead.age_range}`,
            `State:   ${lead.state}`,
            `401(k):  ${lead.plan_status}`,
            `Balance: ${lead.balance_range}`,
            `Source:  ${JSON.stringify(lead.utm)}`,
          ].join("\n"),
        }),
      });
    } catch (e) {
      console.error("notify failed:", e);
    }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
});
