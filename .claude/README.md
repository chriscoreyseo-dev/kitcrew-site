# Executive Assistant seat

This directory defines Chris's executive-assistant agent for Claude Code sessions
in this repo.

- `agents/executive-assistant.md` — the agent: identity, duties, and standing
  doctrine (approve-first, RULE ZERO no-spend, no income claims, capture-only
  memory writes via the `EA-INBOX` convention, never claims session numbers).
- `commands/` — the EA's workflows, invocable as slash commands:
  - `/ea-brief` — morning brief
  - `/ea-inbox [window]` — inbox triage with Gmail drafts + `EA/*` labels
  - `/ea-meeting-prep <who>` — pre-meeting one-pager
  - `/ea-weekly` — end-of-week review
  - `/ea-waiting-on` — who owes Chris what, with staged follow-ups

The EA is a support seat: it owns Chris's time, inbox, follow-through, and
paperwork. Strategy lanes belong to the C-suite seats; trading belongs to the
Trading Desk; the EA touches neither.

## Blog comment engagement (MarketHive)

- `agents/blog-comment-engagement.md` — packages the existing chartered
  KitFire skill `skills/marketing/blog-comment-engagement` (v1.1, ruled S188)
  as a Claude Code agent: one engine, three brand profiles (KitFire group /
  Chris personal / TecHive), R1–R5 reply classes, Phase-1 posting authority,
  and the comment/pipeline logging doctrine.
- `commands/sweep-comments.md` — `/sweep-comments` runs the sweep.
- **Hard constraint:** MarketHive has no API. The sweep and any reply require
  driving Chris's authenticated browser session (Claude-in-Chrome /
  computer-use), so it only runs in a session with that access — not in a
  headless/remote session.

## Vendor & tool fit (`vendor-fit`)

- `skills/vendor-fit/SKILL.md` — the ruling doctrine for "should we add this
  tool?": gates G0–G9 (provenance, capability atoms, source discipline, true
  cost, exit cost, **stack redundancy**, offer math, platform-policy risk,
  access blast radius, and what to steal instead), resolving to one verdict —
  BUY / PILOT / STEAL / SKIP / TIER-3 — plus what would change it.
- `commands/vendor-fit.md` — `/vendor-fit <name or link>` runs the ruling.
- `skills/vendor-fit/cases/` — filed rulings. First case: Zeely, 2026-08.
- **Hard constraint:** RULE ZERO without exception. The skill never signs up,
  never starts a trial, never enters a card, and never grants account or
  partner access. Every vendor call is Tier-3 and stays Chris's.
