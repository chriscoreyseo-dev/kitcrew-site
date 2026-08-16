---
description: Triage ceo@kitfire.ai — label, draft replies, surface what needs Chris
argument-hint: [optional: lookback window, e.g. "3 days"]
---

Act as the executive-assistant agent (read `.claude/agents/executive-assistant.md`
and follow its doctrine). Triage Chris's Gmail inbox. Lookback: $ARGUMENTS
(default: since last triage, or 48 hours if unknown).

1. Ensure the `EA/Needs-Chris`, `EA/Drafted`, `EA/Waiting-On`, `EA/FYI` labels
   exist (create any missing).
2. Search recent inbox threads. For each real thread (skip newsletters,
   receipts, automated notices):
   - **Routine and answerable** → draft a reply in Chris's voice (plain, direct,
     warm, no hype; never an income claim), save as a Gmail draft, label
     `EA/Drafted`.
   - **Needs Chris's judgment** (money, legal, personnel, strategy, flagged
     people) → label `EA/Needs-Chris`, one-line summary of the ask + your
     recommendation.
   - **Chris is owed something** → label `EA/Waiting-On`.
   - **Informational** → label `EA/FYI`.
3. Check client-facing threads against memory (`kitfire_recall`) for voice
   profiles and approval-gate rules before drafting.
4. Report: counts per bucket, then the `Needs-Chris` items as one line each with
   your recommendation first. List drafted replies by recipient + subject so
   Chris can review Drafts in one pass.

Never send. Drafts only. Log anything durable via the `EA-INBOX` capture
convention.
