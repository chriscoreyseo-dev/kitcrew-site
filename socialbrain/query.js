// Natural-language questions -> a query over the graph.
//
// Deliberately rule-based, not an LLM: it needs no key, works offline, answers
// in under a millisecond, and never invents an answer. The trade is that it
// understands a defined grammar rather than anything at all - so it always
// reports how it read your question, and you can see when it read it wrong.

const PLATFORM_ALIASES = {
  youtube: ['youtube', 'you tube', 'yt'],
  reddit: ['reddit', 'subreddit'],
  twitch: ['twitch'],
  x: ['x', 'twitter', 'tweet', 'tweets'],
  tiktok: ['tiktok', 'tik tok'],
  instagram: ['instagram', 'insta', 'ig', 'reels', 'reel'],
};

const METRIC_WORDS = [
  ['views', ['view', 'views', 'viewed', 'watched', 'watches', 'seen']],
  ['likes', ['like', 'likes', 'liked', 'upvote', 'upvotes', 'upvoted', 'hearts']],
  ['comments', ['comment', 'comments', 'commented', 'replies', 'discussed']],
  ['shares', ['share', 'shares', 'shared', 'repost', 'reposts', 'retweet', 'retweets']],
  ['score', ['engagement', 'engaging', 'popular', 'performing', 'traction', 'viral', 'trending']],
];

const FOLLOWER_WORDS = [
  'follower', 'followers', 'following', 'subscriber', 'subscribers', 'subs',
  'karma', 'audience', 'my account', 'my accounts', 'my channel',
];
const RECENCY_WORDS = ['recent', 'recently', 'newest', 'latest', 'just posted', 'just dropped', 'new'];
const LEAST_WORDS = ['least', 'fewest', 'lowest', 'worst', 'bottom', 'smallest'];
const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

const METRIC_LABEL = {
  score: 'engagement',
  views: 'views',
  likes: 'likes',
  comments: 'comments',
  shares: 'shares',
};

const has = (text, words) => words.some((w) => new RegExp(`\\b${w}\\b`).test(text));

export function parseQuery(raw, platformsPresent = []) {
  const text = String(raw || '')
    .toLowerCase()
    .replace(/[^\w\s/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return null;

  // --- platform -----------------------------------------------------------
  let platform = null;
  const anyPlatform = /\b(any|all|every|across|anywhere|overall)\b/.test(text);
  if (!anyPlatform) {
    for (const [id, aliases] of Object.entries(PLATFORM_ALIASES)) {
      if (!platformsPresent.length || platformsPresent.includes(id)) {
        // "x" is a single letter and matches far too easily - require context.
        const words = id === 'x' ? ['twitter', 'tweet', 'tweets', 'on x'] : aliases;
        if (has(text, words)) {
          platform = id;
          break;
        }
      }
    }
  }

  // --- is this a question about my own accounts? --------------------------
  // "how many followers do I have", "my subscribers on youtube", "my karma".
  const aboutAccounts = has(text, FOLLOWER_WORDS) || /\bmy (own )?(account|channel|profile)s?\b/.test(text);

  // "karma" only exists on Reddit - treat it as naming the platform.
  if (!platform && !anyPlatform && has(text, ['karma'])) platform = 'reddit';

  // --- how many -----------------------------------------------------------
  let limit = aboutAccounts && !platform ? 10 : 1;
  const digits = text.match(/\b(?:top|first|best)?\s*(\d{1,2})\b/);
  if (digits) limit = Math.min(25, Math.max(1, Number(digits[1])));
  else {
    for (const [word, n] of Object.entries(NUMBER_WORDS)) {
      if (new RegExp(`\\b(?:top|first|best)\\s+${word}\\b`).test(text)) limit = n;
    }
  }

  // --- sort ---------------------------------------------------------------
  const wantsRecency = has(text, RECENCY_WORDS);
  const ascending = has(text, LEAST_WORDS);

  let metric = null;
  for (const [key, words] of METRIC_WORDS) {
    if (has(text, words)) {
      metric = key;
      break;
    }
  }

  // Windowing: "in the last 24 hours", "today".
  const newOnly = /\b(today|last 24|past 24|last day|24 hours)\b/.test(text);

  let sortBy;
  let interpretation;
  if (aboutAccounts) {
    sortBy = 'followers';
    interpretation = 'my accounts, by follower count';
  } else if (wantsRecency) {
    sortBy = 'published';
    // "most recently viewed" mentions both - say out loud which one won.
    interpretation = metric
      ? `newest by publish time (you also said "${METRIC_LABEL[metric]}" - sorting by recency, not ${METRIC_LABEL[metric]})`
      : 'newest by publish time';
  } else {
    sortBy = metric ?? 'score';
    interpretation = `${ascending ? 'lowest' : 'highest'} ${METRIC_LABEL[sortBy]}`;
  }

  interpretation += platform ? ` · ${platform}` : ' · any platform';
  if (newOnly) interpretation += ' · last 24h only';
  if (limit > 1) interpretation += ` · top ${limit}`;

  return { sortBy, ascending, platform, newOnly, limit, interpretation, aboutAccounts, text };
}

export function runQuery(parsed, nodes) {
  if (!parsed) return [];

  // Account questions search the account nodes, not the videos under them.
  if (parsed.sortBy === 'followers') {
    let accounts = nodes.filter((n) => n.account);
    if (parsed.platform) accounts = accounts.filter((n) => n.account.platform === parsed.platform);
    accounts.sort((a, b) => {
      const av = a.account.followers ?? -1;
      const bv = b.account.followers ?? -1;
      return parsed.ascending ? av - bv : bv - av;
    });
    return accounts.slice(0, parsed.limit);
  }

  let items = nodes.filter((n) => n.type === 'item');
  if (parsed.platform) items = items.filter((n) => n.platform === parsed.platform);
  if (parsed.newOnly) items = items.filter((n) => n.isNew);

  const value = (n) =>
    parsed.sortBy === 'published'
      ? (n.publishedAt ? Date.parse(n.publishedAt) : -Infinity)
      : (n.metrics?.[parsed.sortBy] ?? 0);

  // Items with no publish date can never be "the newest" - drop them rather
  // than letting them win on a null.
  if (parsed.sortBy === 'published') items = items.filter((n) => Number.isFinite(value(n)));

  items.sort((a, b) => (parsed.ascending ? value(a) - value(b) : value(b) - value(a)));
  return items.slice(0, parsed.limit);
}

export { METRIC_LABEL };
