# The claims firewall — background and worked substitutions

<!-- claims-scan: policy — this file lists the vocabulary it prohibits. -->
Read this when drafting offer copy for KitCrew, KitFire, or any network-marketing-
adjacent or affiliate audience, and any time a claim feels borderline.

## Contents

1. Why the rule exists
2. The two regimes stacked on top of each other
3. Vocabulary: never / careful / safe
4. Worked substitutions
5. Implied claims — the ones the scanner can't catch
6. Turning the constraint into the strongest thing on the page

---

## 1. Why the rule exists

KitCrew's category is full of products sold on earnings stories. That is the
convention the buyer has been burned by, repeatedly, before they ever reach our
page. Refusing to make claims is therefore not only the compliant path — it is
the differentiated one. Every competitor's page reads the same and our silence on
earnings is the loudest thing on ours.

Standing rule: **no income claims, ever.** It is blocked at the system level in
what KitCrew's agents produce, and it applies equally to how KitCrew itself is
marketed. Revenue pressure is never a reason to loosen it. If an offer only works
with an earnings claim in it, the offer is wrong — not the rule.

## 2. The two regimes stacked on top of each other

Copy aimed at this audience sits under two sets of expectations at once:

- **Earnings representations.** Network marketing companies and their
  distributors face heavy scrutiny on any statement about what participants
  make. That scrutiny extends to the tools sold to them when those tools imply
  business results. Regulators do not read a claim as harmless because it was
  phrased as a hypothetical, an average, or a testimonial.
- **Endorsement and testimonial disclosure.** If someone is compensated —
  affiliate commission, free product, a paid campaign — the material connection
  has to be clear. This matters the moment KitCrew pays anyone to talk about it,
  and it matters for testimonials we publish.

There is also a third, practical constraint that isn't regulatory: a member's own
company usually has its own social-media and advertising policy. Copy that would
put a member in breach of their upline's rules is bad copy even when it is
perfectly legal.

The safe posture across all three: **say only what our software does.**

## 3. Vocabulary

### Never — these do not appear in offer copy

earn · earnings · income · profit · revenue · make money · replace your income ·
replace your job · quit your job · financial freedom · residual income ·
passive income · commissions · payout · six figures · $X/month · ROI ·
"pays for itself" · rank · rank advancement · downline · team size ·
recruits · signups · conversions

### Careful — legitimate in some contexts, never as an outcome we promise

**leads** — fine describing our behaviour (*"answers a new lead in minutes"*),
never as a quantity we produce (*"10 leads in 7 days"*). The distinction is
whether the market has to act for the sentence to be true.

**growth, scale, results, success** — vague enough to read as earnings by
implication. Usually replaceable with something concrete about our output.

**save time** — safe, and stronger when quantified against the member's own
current behaviour rather than an invented baseline.

### Safe — our own machine's output, verifiable, ours to control

drafts produced · messages drafted · posts written · replies sent ·
response time · coverage ("nothing goes unanswered") · setup completed ·
hours spent reviewing vs. producing · onboarding steps finished ·
approvals given · items in the back office

The test: **could we verify this from our own logs, without knowing anything
about how the member's business performed?** If yes, it's safe.

## 4. Worked substitutions

| ❌ | ✅ | Why |
|---|---|---|
| "Go from 0 to $5k/month in 90 days" | "Go from four hours a day producing content to twenty minutes approving it" | Same before/after shape, denominated in our output |
| "Get 10 leads in 7 days or you don't pay" | "30 approve-ready drafts in your first 30 days, or month two is on us" | Countable, ours, verifiable in their back office |
| "Our members are crushing it" | "Every prospect has a next touch drafted and waiting" | Replaces a results claim with a state of the system |
| "This pays for itself in one signup" | *(no substitution — cut it)* | Pure income claim; there is no safe version |
| "How much are you leaving on the table?" | "How many people asked you something this week and never heard back?" | Internal scarcity denominated in observable behaviour |
| "Join 500+ successful marketers" | "Built and run by the company that uses it daily" | Social proof without implying outcomes |

## 5. Implied claims — the ones the scanner can't catch

`claims_scan.py` matches vocabulary. It cannot detect a claim assembled entirely
from safe words, and those are the ones that actually get businesses in trouble.

Watch for:

- **Juxtaposition.** A compliant sentence next to a price, a testimonial, or an
  aspirational image can read as a claim the sentence never makes. Read the
  block, not the line.
- **Implication by question.** *"What could another six months of this cost
  you?"* invites an earnings answer even though it states nothing. Anchor the
  question to observable behaviour so the buyer's answer isn't denominated in
  money.
- **Testimonials.** A member saying what they earned is an income claim we
  published. Quote members on the *product* ("I stopped losing track of people"),
  never on outcomes.
- **Screenshots.** Dashboards, ledgers, and back-office captures frequently
  contain figures. Check every image, not just the text.
- **Aggregates and averages.** "Members average X" is still an earnings
  representation, and averages attract more scrutiny than individual claims,
  not less.

When something feels borderline, the useful question is not *"is this
technically true?"* but **"does this sentence require the market to have acted
for it to be true?"** If yes, cut or rewrite it.

## 6. Turning the constraint into the strongest thing on the page

The instinct is to treat this as a limitation to work around. It reads better as
the offer's spine, because it answers the skepticism the buyer arrived with:

> "We won't promise you what the market does. Nobody honest can. We'll promise
> what the crew does, because that's the part we control."

That paragraph does three jobs at once — it states the guarantee's logic,
explains why the promise is scoped the way it is, and separates us from every
competing page the buyer has already been disappointed by. Say it near the
guarantee, where the buyer is weighing risk.
