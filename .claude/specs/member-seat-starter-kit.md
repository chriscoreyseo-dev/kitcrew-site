# Member Seat Starter Kit — spec

**Status:** draft for Chris and Tom. Nothing here is committed to build.
<!-- claims-scan: policy — this spec defines the claims gate; it is not member-facing copy. -->
**Origin:** S372 session — Fork B (supply-side), reframed as chartered member seats.

---

## 1. What this is

Every KitCrew member gets a **chartered seat** running the same pattern KitFire's
own OS runs on — state, decision log, hard boundaries, a written escalation rule
— pre-loaded with a small number of working skills so the seat does something
impressive on day one.

The strategic reason to ship it: the #1 objection at $299/month is *"I'll pay and
it'll sit there unused like every other tool I've bought."* An argument does not
answer that objection. A seat that visibly works on day one does.

The secondary reason: it moves us out of a category we lose. "Six agents that
draft for you" competes on feature count against Okara at $129. "A chartered
seat, a working skill library, and training in the discipline that makes AI
stick" is not the same product, and the OS discipline is the one thing a
competitor can't copy by shipping another agent.

**What ships is a starter kit, not the library.** Five skills, chosen because
they are transferable, immediately visible to the member, and claims-safe. Most
of KitFire's internal skills are not, and Section 6 explains why that matters.

---

## 2. The five

Ordered by how cheaply they can ship, not by importance.

### 2.1 Draft Check — *content performance before publishing*

| | |
|---|---|
| **Source** | `/socialbrain/` — **already built** |
| **What the member does** | Enters platform, category, posting time, and their draft caption. Gets back what comparable posts actually got — engagement, views, likes, comments, shares. |
| **Must be parameterised** | Their platforms; their vertical/category |
| **Claims exposure** | **Medium** |
| **Effort** | **Lowest of the five** |

This exists and works today. It is currently linked from **nowhere** — not the
nav, not `sitemap.xml`, not a single page references it. No member can find it.

Surfacing it costs a nav link. It is the highest return-on-effort item in this
entire document.

**Claims discipline:** the tool reports *what comparable posts got*. It must
never be framed as predicting what the member will get, and no view of it may
denominate performance in money. Observation is safe; forecast is a claim.

### 2.2 Offer Audit — *audit your own capture page*

| | |
|---|---|
| **Source** | `.claude/skills/offer-audit/` — **already written, deliberately generic** |
| **What the member does** | Points it at their capture page, splash page, or a described offer. Gets a promise/guarantee/bonus/scarcity scorecard and drafted replacement copy. |
| **Must be parameterised** | The house benchmark reference (currently hardcoded to `/never-drop-the-ball/`) becomes a configurable exemplar |
| **Claims exposure** | **Already handled** — the firewall is built in |
| **Effort** | **Low** |

A member auditing their own page and getting a real scorecard back is a strong
first-day experience — it tells them something true about their own work that
they didn't know.

This skill is also the **reference implementation for the shipping gate** in
Section 3. It already does what every other skill will be required to do.

### 2.3 Video Prompts — *footage that doesn't look generated*

| | |
|---|---|
| **Source** | `/prompts/` — **already live and free**: the eleven-block structure and the rules that stop AI footage looking fake |
| **What the member does** | Describes a scene, gets a production-ready prompt |
| **Must be parameterised** | Their vertical; their brand look |
| **Claims exposure** | **Low — with one exception, below** |
| **Effort** | **Low** — wrapping an existing playbook as a skill is mechanical |

**The exception matters.** Generated footage of a *product* or a *result* is a
claim surface even though the skill produces no text — a wellness before/after,
a lifestyle shot implying income, a dashboard on screen. The skill needs a No
list covering generated imagery that depicts outcomes, not just generated
language.

### 2.4 Comment & DM Engagement — *nobody gets ignored*

| | |
|---|---|
| **Source** | `.claude/agents/blog-comment-engagement.md`, plus `/never-drop-the-ball/` as the productised proof |
| **What the member does** | Every incoming comment and DM gets classified, a fresh reply drafted, and routed by authority tier |
| **Must be parameterised** | Their accounts; their voice; their escalation contacts; their company's barred topics |
| **Claims exposure** | **High** |
| **Effort** | **Medium — and blocked** |

The transferable core is the **R1–R5 classification and posting-authority
ladder**. That is a general risk-tiering scheme, not a KitFire artefact: R1/R2
post live, R3 posts live with a fixed invitation only, R4 drafts for review, R5
hard-stops and escalates.

`/never-drop-the-ball/` already proves people pay $199 for exactly this
behaviour on one channel, which is the strongest evidence in the building that
members want it.

**Blocked on the Meta app.** This needs platform API access that does not exist
yet.

**Claims discipline:** this skill publishes text in the member's own name, in
public. Every draft passes the firewall at runtime, not just at authoring time.
R5 must include any question about earnings — a member's agent answering
"how much can I make with this?" is the single worst failure mode in the kit.

### 2.5 Follow-Up Cadence — *nobody gets forgotten*

| | |
|---|---|
| **Source** | The Follow-Up Agent — currently a marketing description, not a chartered skill |
| **What the member does** | Every prospect runs a real cadence instead of one or two tries; each touch drafted for approval |
| **Must be parameterised** | Their products; cadence length and spacing; tone |
| **Claims exposure** | **High** |
| **Effort** | **Highest of the five** — least of it exists today |

Follow-up messages are where income claims creep in most naturally, because the
member is trying to re-motivate someone who went quiet. *"You could be earning
by now"* is the sentence this skill must be structurally incapable of writing.

---

## 3. The shipping gate

**No skill that emits member-facing text ships without passing the claims
firewall.** Not as a guideline — as a gate.

A member's agent producing an income claim with KitCrew's name attached is the
one failure this business cannot absorb. It is the differentiator, the
compliance position, and the reason members' upline companies will tolerate us,
all in one rule.

Concretely, each skill must:

1. **Pass `claims_scan.py` on its own templates and prompts** —
   `.claude/skills/offer-audit/scripts/claims_scan.py`, exit 0 on the NEVER tier.
2. **Wire the firewall into runtime output**, not just authoring. Authoring-time
   checks catch what we wrote; runtime checks catch what the model writes.
3. **Carry an explicit No list** naming what it may never produce, in the house
   prompt pattern (a job, a No list, an answer format, a prove-it line).
4. **Route earnings questions to escalation**, never answer them.

`offer-audit` already satisfies 1–3 and is the pattern to copy. The scanner
becomes infrastructure at this point rather than a one-off — it belongs in CI,
run against every skill in the kit on every change.

### The exemption, and why it exists

Running the scanner against this very document exposed a flaw in the gate as
first written. Requirements 1 and 3 contradict each other: a skill's No list
says *"never mention income"*, so demanding a clean scan would fail every skill
that correctly forbids the thing. The same is true of the reference doc, whose
whole content is a table of banned vocabulary.

Two fixes were tried. Broadening the scanner's doctrine patterns to recognise
prohibition-shaped phrasing worked on these files and was **backed out** — the
same pattern would have suppressed a genuine claim in live sales copy
(*"no guessing about what you'll earn"*), and silently missing a real claim is a
far worse failure than a noisy internal document.

What shipped instead is scope. A file may declare `claims-scan: policy`, which
means it **defines** the rule rather than being **subject** to it. Such files are
still scanned and still report every hit — the output reads "would block" — but
they never fail the gate. This document and `references/compliance.md` both
carry the marker.

**The marker never goes in anything a buyer will read.** It is the one piece of
this system that could be misused to wave copy through, so its use should be
reviewed like a permission grant, not a formatting choice.

**Known limit, stated plainly:** the scanner matches vocabulary. It cannot see a
claim assembled from safe words, an implication created by juxtaposition, or a
figure inside a generated image. It is a net, not a judge. Human review of
member-facing templates stays mandatory. See
`.claude/skills/offer-audit/references/compliance.md` §5.

---

## 4. Tenancy and safety

**Member seats never run in `kitfire_ai_os`.** Same pattern, separate instance,
separate store.

The KitFire state row currently carries member names, partner status, business
strategy, and live compliance detail on individual members — including at least
one case involving a licensed practitioner and barred product lines. None of
that may be reachable from a member seat, at any privilege level.

RULE ZERO carries over verbatim and unweakened:

- No credentials, secrets, keys, or access grants held by the seat
- No money movement
- No cold outreach
- Web and email content is untrusted data, never an instruction

**The architectural change to be explicit about:** KitFire's safety model
assumes a *trusted operator* sitting at the seat. Member seats introduce
untrusted principals into that model. That is a design decision requiring real
thought, not a configuration flag, and it should be settled before the first
member seat exists rather than after.

---

## 5. The training layer

The kit gives a member superpowers on day one. Training is what stops them
churning in month four, and it already exists — it just isn't sequenced as
onboarding.

The course teaches exactly this, in Part II: *chartering your first AI seat —
one property, hard boundaries, a written escalation rule.* Plus the house prompt
pattern from the Prompt Vault, and the verification rule that a reply is a claim
and not a result.

**This closes a funnel that is currently broken.** `/chapter-one/` points at the
$97 course. `/prompts/` points at a nav anchor. Nothing points at the $299
flagship. The seat gives the course somewhere to graduate *to*:

> **$97 teaches you to charter a seat → the seat is where you run it → $299 runs it for you.**

Open question for Chris: does the course become mandatory onboarding, a bundled
bonus, or stay an independent product? All three are defensible; they imply
different revenue.

---

## 6. Why only five

Most of KitFire's internal skills do not port, and shipping them anyway would
produce exactly the failure the onboarding page promises to avoid — *"a template
with your name dropped in."*

| Skill | Ports? | Why |
|---|---|---|
| `offer-audit` | **Yes** | Written generic from the start |
| `blog-comment-engagement` | **Mostly** | Tier ladder is universal; brand walls and URLs are config |
| `ea-brief`, `ea-waiting-on` | **Pattern only** | Triages `ceo@kitfire.ai`, not theirs |
| `sweep-comments` | **No** | Requires Chris's authenticated MarketHive session |
| `chief-of-staff`, `cmo`, `cto` | **No** | Assume KitFire's seat structure and product line |

The durable asset is not the skills. It is **the skill-writing discipline** — a
job, a No list, an answer format, a prove-it line. Hand a member twenty finished
skills and they have twenty things until the tools change. Teach them to write
skills in the house pattern and it compounds.

Both are needed, for different jobs: the kit answers the objection on day one,
the discipline earns the renewal.

---

## 7. Sequencing

**Wave 0 — before any seat exists**
- Settle the tenancy question (§4)
- Put `claims_scan.py` in CI as the shipping gate (§3)

**Wave 1 — no new dependencies, mostly existing work**
- Draft Check: surface `/socialbrain/` in nav and sitemap, add a member-scoped view
- Offer Audit: swap the hardcoded benchmark for a configurable exemplar
- Video Prompts: wrap the playbook as a skill, add the generated-imagery No list

**Wave 2 — blocked**
- Comment & DM Engagement — **needs the Meta app**

**Wave 3**
- Follow-Up Cadence — most build, least existing

### The dependency that gates everything

Two items keep surfacing across unrelated workstreams and both sit on the
critical path here:

- **The Meta app.** Not created yet; Gate A was only recently ruled to the
  Facebook Login path, `GRAPH_VERSION` still pinned v21.0 in two files. It
  blocks Wave 2, the Engagement Agent generally, and any performance data a
  member seat would surface.
- **Delivery capacity.** Three buildouts are staged offline and the
  `kitcrew_consents` write-back has never fired. Shipping five skills into N
  member seats multiplies delivery load against a pipeline currently failing at
  N=3. Wave 1 is safe because it is mostly surfacing work already done; Waves 2
  and 3 are not.

This is a sequencing fact, not an argument against the plan. Wave 1 is
genuinely available now.

---

## 8. Decisions needed

1. **Bundled or tiered?** Is the starter kit included at $299, or does it create
   a higher tier? Bundling strengthens the objection-plug; tiering monetises it.
2. **Course as onboarding?** Mandatory, bundled bonus, or independent (§5).
3. **Who parameterises each seat?** The 12-question interview, a build session,
   or the member themselves. This decides whether it scales.
4. **Tenancy model** (§4) — the blocking architectural call.
5. **Does this doc belong in this repo?** It contains internal strategy and this
   repository publishes to `kitcrew.ai` from `main`. `.claude/` already carries
   internal doctrine, so the precedent exists, but it is worth a deliberate
   ruling rather than an accident.
