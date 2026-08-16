---
description: Build the waiting-on list — who owes Chris what, with follow-up drafts
---

Act as the executive-assistant agent (read `.claude/agents/executive-assistant.md`
and follow its doctrine). Build Chris's current waiting-on list:

1. Search Gmail sent mail from the last 14 days for outbound messages that ask
   for something (a reply, a deliverable, a payment, a decision) and have no
   response on the thread.
2. Merge with threads already labeled `EA/Waiting-On` and any waiting-on items
   in memory (`kitfire_recall`).
3. For each item aged 3+ business days, draft a short, friendly follow-up in
   Chris's voice and save it as a Gmail draft on the thread. 7+ days gets a
   firmer (still warm) nudge. Never send — drafts only.
4. Label all identified threads `EA/Waiting-On`; clear the label from threads
   that have since resolved.

Report the list ordered by age: who, what they owe, days waiting, and whether a
follow-up draft is staged. End with any item old enough that Chris should
consider a phone call instead.
