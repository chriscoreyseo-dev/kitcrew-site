/* KitCrew — scroll-reveal motion. Runs unconditionally (no reduced-motion gate on
 * marketing surfaces — Chris standing ruling, S244 canon). */
(function () {
  var targets = document.querySelectorAll(
    ".pain-card, .crew-card, .how-step, .trust-item, .price-card, .blog-card, .mh-panel, .trust-band"
  );
  if (!("IntersectionObserver" in window)) {
    targets.forEach(function (el) { el.classList.add("kc-in"); });
    return;
  }
  var staggerIndex = new Map();
  targets.forEach(function (el) {
    el.classList.add("kc-reveal");
    var parent = el.parentElement;
    var idx = (staggerIndex.get(parent) || 0);
    staggerIndex.set(parent, idx + 1);
    el.style.transitionDelay = Math.min(idx * 90, 450) + "ms";
  });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("kc-in");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  targets.forEach(function (el) { io.observe(el); });
})();
