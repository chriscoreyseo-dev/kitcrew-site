---
description: Audit an offer against promise / guarantee / bonus / scarcity, and draft what's missing
---

Run the `offer-audit` skill (read `.claude/skills/offer-audit/SKILL.md` and follow
it). Target: $ARGUMENTS — a URL, a path in this repo, or a described product. If
no target was given, ask which offer before doing anything else.

Work in this order, because writing before diagnosing is what produces prettier
versions of the same broken offer:

1. Read the offer as a buyer would, and note what it costs.
2. **Search the rest of the business for a page that already executes a complete
   offer.** `/never-drop-the-ball/` is the current house benchmark — it has all
   four components and passes a clean claims scan. Use whatever you find as the
   voice template rather than inventing one.
3. Score promise / guarantee / bonus / scarcity as present, weak, or missing,
   quoting the evidence.
4. Name the buyer's #1 objection before proposing any bonus, and say plainly
   whether you're citing evidence or inferring.
5. Confirm the business can actually deliver any guarantee you draft. Check the
   current state of play (`kitfire_get_state`) if delivery is in question — a
   guarantee we would miss is worse than none.
6. Draft replacement copy only for what's missing or weak.
7. Run `python3 .claude/skills/offer-audit/scripts/claims_scan.py` over your
   draft and over the rendered page. Read every hit; the scanner catches
   vocabulary, not implication.

Report using the format in the skill. Close with an explicit **"decisions that
aren't mine"** list.

Hard limits, no exceptions: no income claims, ever — promise what the product
does, never what the market does. Never invent a deadline, a cap, or a number to
fill a gap; name the gap instead. Never set guarantee terms, discount, or give a
product away on your own authority — draft it, flag it, and leave the ruling to
Chris (S236 canon: promotion decisions stay operator-hands). Ship as a draft on a
branch, never straight to a live surface.
