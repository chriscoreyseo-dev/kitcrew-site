/*
 * KitCrew, by KitFire — brand/plan string source of truth. Draft v1, S246.
 *
 * PLAN NAME ISOLATION (per task requirement): "Duplicator Pro" is the current live
 * product name (state_of_play.md S232 ruling: ONE plan, $299/mo, 1 seat, no extra
 * seats, no Starter tier). Its fate under the KitCrew brand is Tom's execution item
 * (kitcrew-webmaster charter) — NOT decided here. Every page's pricing-panel labels
 * and buy-button copy render from PLAN_NAME below at runtime so a rename touches
 * this one file's one value.
 *
 * Known limitation (flagged honestly, not silently): this is a static site with no
 * build step yet. JSON-LD blocks and any text that must be crawler-visible without
 * JS execution keep a literal copy of PLAN_NAME in the page markup, each marked with
 * an HTML comment pointing back here ("PLAN_NAME source: assets/brand.js"). True
 * single-source enforcement needs a tiny build/templating pass — a fast-follow, not
 * built this run.
 */
window.KITCREW_BRAND = {
  NAME: "KitCrew",
  PARENT: "KitFire",
  PARENT_URL: "https://kitfire.ai/",
  TAGLINE: "KitCrew, by KitFire",
  DOMAIN: "kitcrew.ai",
  CONTACT_EMAIL: "ceo@kitfire.ai",
  // AI-answered line, labeled as a feature per BRAND_ASSETS.md contact standard.
  // (810) 510-2601 is a BUG on any KitFire/KitCrew surface — never that number.
  PHONE_AI_ANSWERED: "(810) 510-2801",
  PLAN_NAME: "Duplicator Pro",
  PLAN_PRICE_MONTHLY: "$299/mo",
  PLAN_PRICE_ANNUAL: "$2,990/yr",
  PLAN_SEATS: "1 seat",
  // Existing LIVE Stripe payment links (product/techive live catalog, itsgreatbusiness.com
  // build) — reused as-is pending a Product Manager / operator decision on whether the
  // rename mints new links or keeps these. Flagged in SITE_REPORT_S246.md, not decided here.
  BUY_MONTHLY_URL: "https://buy.stripe.com/eVq7sMaGH9C4cSRgo03Ru07",
  BUY_ANNUAL_URL: "https://buy.stripe.com/aFabJ216729CcSRfjW3Ru08",
  // Member app login. Still lives on the pre-rename domain — a Product Manager /
  // operator-hands coordination item (app domain move), not a webmaster decision.
  APP_LOGIN_URL: "https://itsgreatbusiness.com/app/",
  // Instagram-account-setup product ($199 one-time, S297-DRL-04) — the /never-drop-the-ball/
  // page. Stripe product does not exist yet; creating it is Chris's hands (RULE ZERO). This
  // is the ONE place the CTA href lives — every [data-buy-setup] element on the page reads
  // it. Swap this single value to the real Stripe Payment Link, then remove that page's
  // <meta name="robots" content="noindex,follow"/> tag, and it goes live with no other edits.
  CTA_ACCOUNT_SETUP_URL: "#stripe-link-pending"
};

(function renderBrandStrings() {
  var B = window.KITCREW_BRAND;
  document.querySelectorAll("[data-plan-name]").forEach(function (el) { el.textContent = B.PLAN_NAME; });
  document.querySelectorAll("[data-plan-price-monthly]").forEach(function (el) { el.textContent = B.PLAN_PRICE_MONTHLY; });
  document.querySelectorAll("[data-plan-price-annual]").forEach(function (el) { el.textContent = B.PLAN_PRICE_ANNUAL; });
  document.querySelectorAll("[data-plan-seats]").forEach(function (el) { el.textContent = B.PLAN_SEATS; });
  document.querySelectorAll("[data-buy-monthly]").forEach(function (el) { el.setAttribute("href", B.BUY_MONTHLY_URL); });
  document.querySelectorAll("[data-buy-annual]").forEach(function (el) { el.setAttribute("href", B.BUY_ANNUAL_URL); });
  document.querySelectorAll("[data-app-login]").forEach(function (el) { el.setAttribute("href", B.APP_LOGIN_URL); });
  document.querySelectorAll("[data-buy-setup]").forEach(function (el) { el.setAttribute("href", B.CTA_ACCOUNT_SETUP_URL); });
})();
