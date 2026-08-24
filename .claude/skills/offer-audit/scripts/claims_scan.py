#!/usr/bin/env python3
"""Scan offer copy for income-claim vocabulary.

Usage:
    python3 claims_scan.py index.html
    python3 claims_scan.py page.html draft.md
    cat draft.txt | python3 claims_scan.py -

Strips HTML if present, then reports every hit with surrounding context so you
can judge it. Hits inside the business's own no-income-claims doctrine
statements are listed separately rather than counted against the page.

Exit codes:  0 = no NEVER-tier hits   1 = NEVER-tier hits found   2 = bad usage

This is a net, not a judge. It matches vocabulary, so it cannot see a claim
assembled entirely from safe words — juxtaposition with a price, an implied
answer to a question, a figure inside a screenshot. Read every hit yourself and
read the surrounding block, not just the line. See ../references/compliance.md
section 5.
"""

import html
import re
import sys

CONTEXT = 95

MONEY = "money figure (price or claim?)"

# Every offer page states a price, so reporting bare currency drowns the real
# signal. A figure is only worth a human's attention when it recurs per period
# ("$2,000/mo") or sits next to earnings language — that's the shape of a claim
# rather than a price. Suppressed figures are still counted so the summary
# never implies the page has no money in it.
MONEY_PERIOD = re.compile(r"/\s?(mo|month|yr|year|day|week)|\d\s?[kK]\b")
MONEY_NEARBY = re.compile(
    r"\b(earn|earns|earned|earning|make|makes|made|making|average|averages|"
    r"extra|profits?|income|revenue|per (month|week|day)|within \d)\b", re.I)

# Tiering is deliberate. NEVER is for phrasing that is almost never innocent on
# an offer page — a hit is a defect. CAREFUL is for vocabulary that is routinely
# legitimate (a price, a referral dashboard, the word "leads") but turns into a
# claim depending on what surrounds it; those need eyes, not a block.
#
# Keeping prices out of NEVER matters more than it looks: a scanner that fails
# a page for stating what it costs gets switched off, and then it catches
# nothing at all.
NEVER = {
    # "earn" is excluded when it takes a non-money object — "earns your trust",
    # "earns the renewal", "earning its keep". The verb is only a claim when
    # what's being earned is money.
    "earnings": r"\b(earnings|income|profits?)\b"
                r"|\b(earn|earns|earning)\b(?!\s+(your|their|our|my|its|his|her|the|a|an)\s+"
                r"(trust|respect|confidence|keep|place|way|spot|renewal|right|"
                r"reputation|credibility|attention))",
    "making money": r"\b(make|makes|making) money\b|\bmoney[- ]making\b",
    "replacing a job": r"\b(replace your (income|job|salary)|quit your job|fire your boss)\b",
    "freedom framing": r"\b(financial freedom|time freedom|passive income|residual income)\b",
    "figures as outcome": r"\b(six|seven|five) figures?\b",
    "pays for itself": r"\bpays? for (itself|themselves)\b|\breturn on investment\b",
    "growth of a team": r"\b(rank ?advancements?|ranks? up|grow your (team|downline)|"
                        r"downline (growth|grows)|team size)\b",
}

# Legitimate in some contexts, never as an outcome we promise. Always printed,
# never fatal — these need a human read, not a block.
CAREFUL = {
    # See MONEY below — a bare price is suppressed, a recurring or
    # earnings-adjacent figure is surfaced.
    MONEY: r"\$\s?\d[\d,]*(\.\d+)?\s?(k|K|/\s?(mo|month|yr|year|day|week))?\b",
    "commissions and payouts": r"\b(commissions?|payouts?|paid out|paycheck)\b",
    "recruiting language": r"\b(downlines?|recruits?|recruited)\b",
    "market outcomes": r"\b(signups?|sign[- ]ups?|conversions?|closed deals?|sales made)\b",
    "leads as a quantity": r"\b\d+\+?\s+leads?\b|\bleads? (per|a|each)\s+(day|week|month)\b",
    "vague outcome words": r"\b(crushing it|life[- ]changing|game[- ]changer|explode|skyrocket|10x)\b",
    "aggregate claims": r"\b(members?|users?|customers?|most|many|our \w+)\s+"
                        r"(average|typically|usually|routinely)\b",
    "ROI": r"\bROI\b",
}

# Text that PROHIBITS a claim necessarily contains the vocabulary it prohibits.
# Three kinds of writing do this, and all three are the rule working rather than
# breaking: the site's doctrine lines, sales copy that pointedly refuses to make
# a claim, and any policy document, skill No-list, or spec that defines the rule.
#
# That last kind matters structurally — a skill's No list says "never mention
# income", so without this a gate demanding a clean scan would fail every skill
# that correctly forbids the thing.
DOCTRINE = [
    # Site doctrine
    r"no income claims",
    r"income claims are blocked",
    r"income claims,? market[Hh]ive",
    r"never a projection",
    r"blocked at the system level",
    # Copy that refuses to make a claim
    r"not (a promise|going to tell you) (about )?what you('ll| will)",
    r"no income (figure|range|claim)",
    r"not\b[^.]{0,40}\b(a range|a projection|a testimonial with a number)",
    r"(never|not|no)\b[^.]{0,30}\b(income|earnings) (claims?|figures?|representations?)",
    # Naming the rule as a thing (an "income claim", a "claims firewall").
    # Deliberately narrow: broader prohibition-shaped patterns were tried and
    # removed, because "no ... earn" within a sentence also suppresses a real
    # claim like "no guessing about what you'll earn". Suppressing a live claim
    # is a far worse failure than a noisy policy document, and policy documents
    # have their own answer below.
    r"(income|earnings) (claims?|questions?|representations?)",
    r"claims? (firewall|scan|gate|discipline|pass)",
]

# Some files are *about* the rule rather than subject to it — this reference
# doc's tables of banned vocabulary, a skill's No list, a policy spec. They will
# always be dense with the words they prohibit, and no pattern can reliably tell
# that apart from using them. So they say so explicitly: a file containing this
# marker is still scanned and still reports, but never blocks.
#
# Never put this marker in anything a buyer will read.
POLICY_MARKER = re.compile(r"claims-scan:\s*policy", re.I)


def strip_markup(raw: str) -> str:
    """Reduce HTML to readable text. Harmless on plain text and markdown."""
    if "<" in raw and ">" in raw:
        raw = re.sub(r"<(script|style|head)\b.*?</\1>", " ", raw, flags=re.S | re.I)
        raw = re.sub(r"<!--.*?-->", " ", raw, flags=re.S)
        raw = re.sub(r"<[^>]+>", " ", raw)
    return re.sub(r"[ \t]+", " ", html.unescape(raw))


def is_doctrine(context: str) -> bool:
    return any(re.search(p, context, re.I) for p in DOCTRINE)


def scan(text: str):
    """Yield (tier, label, context, doctrine) per hit, plus suppressed price count."""
    hits, prices = [], 0
    for tier, table in (("NEVER", NEVER), ("CAREFUL", CAREFUL)):
        for label, pattern in table.items():
            for m in re.finditer(pattern, text, re.I):
                start = max(0, m.start() - CONTEXT)
                ctx = text[start:m.end() + CONTEXT].replace("\n", " ").strip()
                if label is MONEY and not (MONEY_PERIOD.search(m.group(0))
                                           or MONEY_NEARBY.search(ctx)):
                    prices += 1
                    continue
                hits.append((tier, label, ctx, is_doctrine(ctx)))
    return hits, prices


def report(name: str, text: str, policy: bool = False) -> int:
    hits, prices = scan(text)
    live = [h for h in hits if not h[3]]
    doctrine = [h for h in hits if h[3]]
    fatal = [h for h in live if h[0] == "NEVER"]

    print(f"\n=== {name} ===")
    if not live:
        print("  No claim vocabulary found.")
    for tier, label, ctx, _ in live:
        print(f"\n  [{tier}] {label}\n    …{ctx}…")

    if doctrine:
        print(f"\n  ({len(doctrine)} hit(s) inside no-income-claims doctrine "
              f"statements — the rule being stated, not a claim.)")

    if prices:
        print(f"\n  ({prices} bare currency figure(s) read as prices and not "
              f"reported — check they are prices.)")

    label = "would block" if (fatal and policy) else "blocking"
    print(f"\n  {len(fatal)} {label}, {len(live) - len(fatal)} to read, "
          f"{len(doctrine)} doctrine, {prices} price(s).")
    if policy:
        print("  Marked `claims-scan: policy` — this file defines the rule "
              "rather than being subject to it, so it never blocks.")
    elif not fatal:
        print("  Vocabulary is clean. Now read the page for implied claims — "
              "see references/compliance.md section 5.")
    return 1 if (fatal and not policy) else 0


def main() -> int:
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return 2

    worst = 0
    for path in args:
        try:
            raw = sys.stdin.read() if path == "-" else open(
                path, encoding="utf-8", errors="replace").read()
        except OSError as exc:
            print(f"cannot read {path}: {exc}", file=sys.stderr)
            worst = max(worst, 2)
            continue
        worst = max(worst, report("stdin" if path == "-" else path,
                                  strip_markup(raw),
                                  bool(POLICY_MARKER.search(raw))))
    return worst


if __name__ == "__main__":
    sys.exit(main())
