---
description: Rule on a third-party tool or SaaS — buy, pilot, steal, or skip — with true cost, stack redundancy, and blast radius
---

Rule on the vendor, tool, or service named in `$ARGUMENTS` (a name, or a link
— strip every tracking parameter before you fetch anything).

Read `.claude/skills/vendor-fit/SKILL.md` and follow it exactly: work gates
G0–G9 in order, stop at the first hard failure, and return one verdict —
BUY / PILOT / STEAL / SKIP / TIER-3 — with the deciding gate named.

Before researching the vendor, check `.claude/skills/vendor-fit/cases/` for an
existing ruling on it or on a near-neighbour. If one exists, start from it and
say what changed rather than re-deriving the whole thing.

**RULE ZERO applies without exception:** do not sign up, do not start a trial,
do not enter or authorize a card, do not connect an account, do not grant
partner or asset access. The output is a ruling for Chris, not an adoption.

Close by offering to log the ruling (`kitfire_append_decision`, capture-only
rules from a phone/remote session) and to file the case under
`.claude/skills/vendor-fit/cases/`.
