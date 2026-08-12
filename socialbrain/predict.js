// Pre-post estimate, built from comparables.
//
// ---------------------------------------------------------------------------
// WHAT THIS IS NOT
//
// It is not a prediction. View counts are driven mostly by two things this
// project cannot see: what the recommendation algorithm decides to do with a
// post in its first hour, and the shape of your existing audience. Nothing
// here models either, because nothing here CAN.
//
// WHAT IT IS
//
// "Posts like this one actually landed between X and Y." It finds comparable
// posts in the graph, reports the real distribution of what they got, anchors
// that to your own track record when there is one, and shows the sample size
// so you can judge how much to trust it. Every number traces to rows in the
// data - none of it is modelled or invented.
//
// A range with an n beside it is honest. A single confident number would not be.
// ---------------------------------------------------------------------------

const STOPWORDS = new Set(
  `a an the and or but if then than that this these those of to in on at for with from by as is are was
   were be been being do does did doing have has had i you he she it we they my your our their me him her
   them what which who whom how why when where all any some no not so very just about over under out up
   down new get got make made how-to vs`
    .split(/\s+/)
    .filter(Boolean),
);

const tokenise = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));

function percentile(sortedValues, p) {
  if (!sortedValues.length) return 0;
  const idx = (sortedValues.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedValues[lo];
  return sortedValues[lo] + (sortedValues[hi] - sortedValues[lo]) * (idx - lo);
}

const statsOf = (items, key = 'views') => {
  const values = items.map((n) => n.metrics?.[key] ?? 0).sort((a, b) => a - b);
  return {
    n: values.length,
    p25: percentile(values, 0.25),
    p50: percentile(values, 0.5),
    p75: percentile(values, 0.75),
  };
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// A measured signal: does the pool actually do better with this trait or not?
// Only reported when BOTH groups are big enough to mean anything.
function measureTrait(pool, label, predicate, { present }) {
  const withTrait = pool.filter(predicate);
  const withoutTrait = pool.filter((n) => !predicate(n));
  const MIN = 5;
  if (withTrait.length < MIN || withoutTrait.length < MIN) {
    return {
      label,
      verdict: 'unknown',
      detail: `not enough comparables to tell (${withTrait.length} with, ${withoutTrait.length} without)`,
      present,
    };
  }
  const a = statsOf(withTrait).p50;
  const b = statsOf(withoutTrait).p50;
  if (!b) return { label, verdict: 'unknown', detail: 'no baseline', present };
  const ratio = a / b;
  const pct = Math.round((ratio - 1) * 100);
  const verdict = Math.abs(pct) < 12 ? 'flat' : pct > 0 ? 'up' : 'down';
  return {
    label,
    verdict,
    present,
    detail:
      verdict === 'flat'
        ? `no real difference in this data (${withTrait.length} vs ${withoutTrait.length})`
        : `comparables with it did ${pct > 0 ? '+' : ''}${pct}% on median views (${withTrait.length} vs ${withoutTrait.length})`,
  };
}

const hourOf = (iso) => {
  const ms = Date.parse(iso ?? '');
  return Number.isFinite(ms) ? new Date(ms).getHours() : null;
};

/**
 * @param {{platform:string, branchId?:string, title:string, when?:string}} draft
 * @param {{nodes:Array, sources:Array}} graph
 */
export function estimate(draft, graph) {
  const platform = draft.platform;
  if (!platform) return { ok: false, reason: 'Pick a platform first.' };

  const isDemo = (graph.sources ?? []).some((s) => s.status === 'demo');
  const allItems = graph.nodes.filter((n) => n.type === 'item');

  // "Mine" = posts under MY ACCOUNTS for this platform. These are the only
  // rows that reflect YOUR audience, so they anchor everything.
  const mine = allItems.filter(
    (n) => n.platform === 'accounts' && n.extra?.mine !== false && idPlatform(n, graph) === platform,
  );
  const publicPool = allItems.filter((n) => n.platform === platform);

  if (!publicPool.length && !mine.length) {
    return { ok: false, reason: `No ${platform} data loaded yet — nothing to compare against.` };
  }

  // Narrow the public pool by branch, then by topic overlap.
  let pool = draft.branchId ? publicPool.filter((n) => n.parent === draft.branchId) : publicPool;
  if (pool.length < 8) pool = publicPool;

  const tokens = tokenise(draft.title);
  let matched = pool;
  let matchedOn = 'no topic match — using the whole platform';
  if (tokens.length) {
    const scored = pool
      .map((n) => {
        const words = new Set(tokenise(n.label));
        return { n, hits: tokens.filter((t) => words.has(t)).length };
      })
      .filter((s) => s.hits > 0)
      .sort((a, b) => b.hits - a.hits);
    if (scored.length >= 8) {
      matched = scored.map((s) => s.n);
      matchedOn = `${matched.length} comparables share wording with your title`;
    } else if (scored.length) {
      matchedOn = `only ${scored.length} posts share wording — too few, using the whole platform`;
    }
  }

  const matchedStats = statsOf(matched);
  const poolStats = statsOf(publicPool);
  const myStats = statsOf(mine);

  // Topic multiplier: how this subject performs relative to the platform as a
  // whole. Clamped hard - a thin sample must not produce a wild number.
  const scale =
    poolStats.p50 > 0 && matchedStats.p50 > 0 ? clamp(matchedStats.p50 / poolStats.p50, 0.3, 3.5) : 1;

  let low;
  let mid;
  let high;
  let basis;
  if (myStats.n >= 4) {
    low = myStats.p25 * scale;
    mid = myStats.p50 * scale;
    high = myStats.p75 * scale;
    basis = `your own ${myStats.n} ${platform} posts, adjusted ×${scale.toFixed(2)} for this topic`;
  } else {
    low = matchedStats.p25;
    mid = matchedStats.p50;
    high = matchedStats.p75;
    basis =
      myStats.n > 0
        ? `other people's ${platform} posts — you only have ${myStats.n} of your own here, too few to anchor to`
        : `other people's ${platform} posts — no history of your own on this platform yet`;
  }

  // Confidence is about the evidence, not about the guess.
  let confidence = 'low';
  let confidenceWhy;
  if (isDemo) {
    confidence = 'none';
    confidenceWhy = 'This is DEMO DATA. The numbers are invented — ignore the range entirely.';
  } else if (myStats.n >= 12 && matched.length >= 15) {
    confidence = 'medium';
    confidenceWhy = `${myStats.n} of your own posts plus ${matched.length} comparables. Still a range, not a forecast.`;
  } else if (myStats.n >= 4 || matched.length >= 15) {
    confidence = 'low';
    confidenceWhy = `Thin evidence — ${myStats.n} of your own, ${matched.length} comparables. Treat as a rough order of magnitude.`;
  } else {
    confidence = 'very low';
    confidenceWhy = `Almost nothing to go on (${matched.length} comparables). This is barely better than a guess.`;
  }

  // Signals, each measured inside the comparable pool.
  const titleWords = tokenise(draft.title).length;
  const rawTitle = String(draft.title || '');
  const hour = draft.when ? hourOf(draft.when) : new Date().getHours();

  const signals = [
    measureTrait(matched, 'A number in the title', (n) => /\d/.test(n.label), {
      present: /\d/.test(rawTitle),
    }),
    measureTrait(matched, 'Phrased as a question', (n) => n.label.includes('?'), {
      present: rawTitle.includes('?'),
    }),
    measureTrait(matched, 'Short title (under 7 words)', (n) => tokenise(n.label).length < 7, {
      present: titleWords > 0 && titleWords < 7,
    }),
  ];

  // Timing: compare the chosen hour's band against the rest.
  if (hour !== null) {
    const band = (h) => Math.floor(h / 4); // six four-hour bands
    signals.push(
      measureTrait(
        matched.filter((n) => hourOf(n.publishedAt) !== null),
        `Posting around ${String(hour).padStart(2, '0')}:00`,
        (n) => band(hourOf(n.publishedAt)) === band(hour),
        { present: true },
      ),
    );
  }

  return {
    ok: true,
    isDemo,
    platform,
    low,
    mid,
    high,
    basis,
    matchedOn,
    confidence,
    confidenceWhy,
    counts: { mine: myStats.n, matched: matched.length, platform: poolStats.n },
    scale,
    signals,
  };
}

// MY ACCOUNTS items carry their real network on the parent branch, not on
// node.platform (which is 'accounts' for the whole category).
function idPlatform(node, graph) {
  const parent = graph.nodes.find((n) => n.id === node.parent);
  return parent?.account?.platform ?? null;
}
