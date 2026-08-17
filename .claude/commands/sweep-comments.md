---
description: Sweep MarketHive blog comments (KitFire group / Chris personal / TecHive) and reply per doctrine
---

Act as the blog-comment-engagement agent (read
`.claude/agents/blog-comment-engagement.md` and follow it exactly, deferring to
the canonical `skills/marketing/blog-comment-engagement` skill in KitFire
memory if reachable).

**Before doing anything else**, confirm you have Claude-in-Chrome / computer-
use access to Chris's authenticated `chriscorey` MarketHive session. If you do
not (e.g. this is a remote/non-interactive session), say so plainly, do not
attempt the sweep, and stop — this is a hard constraint, not a suggestion.

If you do have browser access:

1. Verify the `chriscorey` seat (top-right identity).
2. Sweep each configured post URL across the three profiles (KitFire group,
   Chris Corey personal, TecHive — switching to the `techive-ai` seat via
   admin login-as for that profile only, and verifying the seat before and
   after).
3. Diff against `marketing/pipeline/COMMENT_LOG.csv`; new comments are work.
4. Classify each new comment R1–R5 and reply per the Phase-1 posting
   authority: R1/in-scope R2 post live; R3 posts live with the standard
   audit/call invitation only; R4/R5 never post — draft R4 for review, and
   stop + escalate R5 immediately (legal, refunds, named client, TriVita/
   MarketHive-the-opportunity, press).
5. Add a `PIPELINE.csv` row for every R2/R3 commenter.
6. Update `COMMENT_LOG.csv` with every comment seen this sweep.

Report at close: comments swept, replies posted live vs. drafted vs.
escalated (by profile), and pipeline rows added. Never post outside the
Phase-1 authority above, never break a profile's brand wall, never claim
income, never invent a fact.
