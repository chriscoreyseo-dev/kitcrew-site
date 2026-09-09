---
name: offer-audit
description: Audit any offer against the four components that make one complete — promise, guarantee, bonus, scarcity — then draft replacement copy for whatever is missing, with a hard claims firewall so nothing promises earnings. Use this whenever the work touches how something is SOLD rather than how it is built: a sales or landing page, pricing section, hero copy, a CTA that isn't converting, an offer that "feels weak," a launch, a lead magnet, or any request to review, rewrite, tighten, or strengthen the way a product is presented to a buyer. Use it even when the ask sounds like plain copywriting ("make this page better", "the pricing section is flat", "why isn't this converting") — those are almost always missing-component problems, and diagnosing before writing is what makes the rewrite work. Applies to KitCrew, KitFire, and any client or partner offer.
---

# Offer audit

An offer is not a description of a product. It is four components working together, and a buyer says no when any one of them is missing. Most weak pages are not badly written — they are **incomplete**, and rewriting the prose without fixing the missing component just makes the same gap sound nicer.

So the order matters: **diagnose first, write second.** Resist the pull to start rewriting sentences. Find out which of the four is absent, then write only what's needed to fill it.

## The four components

| Component | The job it does | Present when… |
|---|---|---|
| **Promise** | Sells the transformation, not the feature list | There's a *before*, an *after*, and a timeframe. A metaphor is not a promise. |
| **Guarantee** | Moves risk from the buyer onto us | There's a stated consequence *for us* if we don't deliver. "Cancel anytime" is not a guarantee — it's an exit, and it leaves all the risk with the buyer. |
| **Bonus** | Removes the single biggest reason not to buy | It plugs the buyer's #1 objection specifically. **A bonus is not a value stack.** Piling on extras the buyer didn't ask for adds perceived value but removes no friction. |
| **Scarcity** | Gives a reason to decide now instead of later | It's *internal* — the cost of not changing, which the buyer computes about their own life. External scarcity ("only 3 spots left") is fakeable, and audiences who've been sold to before read it as fake even when it's true. |

## Procedure

**1. Read the offer as a buyer would.** Fetch the URL or read the file. If it's a described product with no page yet, work from the description.

**2. Find out what it costs and what else the business sells.** Price sets how much risk the buyer is carrying, which determines how strong the guarantee has to be.

**3. Look for the offer already done well elsewhere in the same business.** This is the highest-leverage step and it's easy to skip. Businesses very often have one page — usually a smaller or older product — where somebody wrote a complete offer without naming it as such. Find it and you have a house-voice template that already passes compliance, instead of inventing copy from scratch. Check every product page, not just the flagship. If you find one, put it side by side with the page under audit; the gap between the two columns *is* the finding.

**4. Score each component** as present / weak / missing, with the evidence quoted.

**5. Identify the #1 objection** before proposing a bonus. Ask: *what is the one thing stopping this buyer from saying yes right now?* Ground it in what the business already knows — support threads, FAQ entries, objections the copy pre-empts elsewhere. If you're inferring rather than citing, **say so plainly** and name the cheapest way to find out for real (usually: ask ten people who didn't buy). A confidently wrong objection produces a bonus that removes no friction at all.

**6. Check deliverability before writing any guarantee.** A guarantee is a promise the business has to keep operationally. Verify the thing can actually be delivered at the promised standard today. If it can't, say so and propose the strongest guarantee that *is* currently honest — then name what would need fixing to unlock the better one. Shipping a guarantee the business will miss is worse than shipping none.

**7. Draft replacement copy** for what's missing, in the voice of the page you found in step 3.

**8. Run the claims firewall** over everything you wrote, before presenting it.

## The claims firewall

This is the part that cannot be relaxed, and it's also — usefully — what makes the copy better.

> **Promise what the product does. Never promise what the market does.**

The product's own output is ours to control and verifiable. What the market does — whether people buy, opt in, join, or pay — is not ours, and claiming it is both untrue and, in KitFire's niche, prohibited. Income claims are blocked at the system level in everything KitCrew produces; the same standard applies to how KitCrew itself is sold. Revenue pressure is never a reason to loosen this.

The framework's own formulas have a results-shaped slot in them, which is exactly where this goes wrong:

- Promise: *"goes from [PAIN] to [OUTCOME] in [TIMEFRAME]"*
- Guarantee: *"if you don't get [RESULT] in [TIMEFRAME]…"*

Fill those slots with what the product produces, never with what the buyer earns.

| ❌ Never fill the slot with | ✅ Fill it with |
|---|---|
| money, income, revenue, profit | drafts produced, messages sent, hours returned |
| leads, signups, conversions, opt-ins | response time, coverage, nothing-missed |
| team size, rank, downline, recruits | setup speed, onboarding completed |
| *"10 leads in 7 days"* | *"every lead answered in under 5 minutes"* |

**Scarcity has its own trap.** Internal scarcity works by making the buyer total up the cost of standing still — and the obvious unit for that total is money, which walks straight back into a claim. Denominate it in **behaviour the buyer can observe about themselves** instead: follow-ups they meant to send and didn't, people who asked and never heard back, evenings spent on something they hate. *"How much are you leaving on the table"* is an income claim wearing a question mark. *"How many people asked you something this week and never heard back"* is not, and it lands harder.

Run `scripts/claims_scan.py` over the rendered page or your draft copy before presenting anything. It flags claim vocabulary with surrounding context and knows to ignore the business's own no-income-claims doctrine statements. It is a net, not a judge — read every hit yourself, because it cannot catch an implied claim made entirely in safe words.

For the full vocabulary lists, the regulatory background, and worked before/after substitutions, read `references/compliance.md`.

## Report format

Lead with the diagnosis. The gap table is usually the most persuasive thing you produce, so put it near the top.

```markdown
## The finding
[One or two sentences. If a sibling page already executes the offer well, say so here.]

## Component scorecard
| | This offer | [sibling page that does it well, if found] |
|---|---|---|
| Promise | missing — feature list, no transformation | "quoted line that works" |
| Guarantee | weak — "cancel anytime" | 30 days, full refund |
| Bonus | mis-aimed — plugs the wrong objection | opens by killing the real one |
| Scarcity | soft — undefined deadline | internal, in the close |

## Draft replacement copy
[Only for what's missing or weak. Quote what it replaces.]

## Claims pass
[What you scanned, what it flagged, why each hit is clean.]

## Decisions that aren't mine
[Guarantee terms, discounting, anything with revenue or legal consequence —
name them explicitly and leave them open.]
```

## Where authority stops

Diagnosing, drafting, and pushing to a branch is the job. **Changing what a business promises, guarantees, or gives away is the operator's call, not yours** — those have revenue and legal consequences that don't belong to whoever happens to be writing the copy.

So: draft the guarantee, don't set its terms. Recommend the bundle, don't give the product away. Flag that "founding rate" has no end date, don't invent one — a fabricated deadline is the exact fakery the scarcity section warns against, and inventing a number to fill a gap is worse than leaving the gap visible.

Put every one of those in the "decisions that aren't mine" section, and ship the work as a draft for approval.
