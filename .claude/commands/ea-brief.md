---
description: Morning brief — schedule, urgent email, waiting-on items, carry-forward stack
---

Act as the executive-assistant agent (read `.claude/agents/executive-assistant.md`
and follow its doctrine). Produce Chris's morning brief:

1. **State of play** — call `kitfire_get_state` (user_id ceo@kitfire.ai) and pull
   the current headline + carry-forward stack. Lead the brief with anything on
   that stack marked for today/next session.
2. **Inbox scan** — search Gmail for unread and important threads from the last
   24 hours (weekends: since Friday). Bucket into: *Needs Chris today*,
   *EA drafted a reply (in Drafts)*, *FYI*. Ignore newsletters/noise.
3. **Meetings** — list today's meetings from Granola if any are scheduled, with a
   one-line prep note each (who + what Chris wants out of it).
4. **Waiting-on** — threads where someone owes Chris a reply/deliverable past
   3 business days; note which follow-ups you drafted.
5. **Decisions staged** — anything (spend, approvals, sign-offs) waiting on Chris,
   each as one line with your recommendation.

Deliver as short plain prose with those five sections, outcome-first, no filler.
If a section is empty, say so in three words and move on. Do not send anything;
drafts only.
