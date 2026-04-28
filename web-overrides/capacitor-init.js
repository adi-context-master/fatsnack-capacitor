/*
 * Runs as early as possible in the document.
 *
 * On Capacitor:
 *   1. Adds the `cap-app` class to <html> and <body> so the override
 *      stylesheet (capacitor-overrides.css) takes effect.
 *   2. Sets viewport-fit=cover so the WebView extends behind the
 *      notch/home indicator and `env(safe-area-inset-*)` becomes usable.
 *   3. Re-scales any `.stage` element to fit the viewport on every
 *      resize, overriding the inline transform that fat-snag's
 *      per-screen useEffect installs (which reserves 48px padding
 *      we don't want on a real device).
 */
(function () {
  function isCapacitor() {
    if (typeof window === "undefined") return false;
    if (window.Capacitor && typeof window.Capacitor.isNativePlatform === "function") {
      try {
        if (window.Capacitor.isNativePlatform()) return true;
      } catch (_) {}
    }
    if (
      window.location &&
      typeof window.location.protocol === "string" &&
      (window.location.protocol === "capacitor:" ||
        window.location.protocol === "ionic:")
    ) {
      return true;
    }
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.userAgent === "string" &&
      navigator.userAgent.indexOf("Capacitor") !== -1
    ) {
      return true;
    }
    return false;
  }

  if (!isCapacitor()) return;

  // (1) Mark html/body so the override stylesheet kicks in.
  function markCapApp() {
    var html = document.documentElement;
    if (html && html.classList) html.classList.add("cap-app");
    if (document.body && document.body.classList) {
      document.body.classList.add("cap-app");
    }
  }
  markCapApp();
  document.addEventListener("DOMContentLoaded", markCapApp);

  // (2) Force viewport-fit=cover so safe-area insets resolve to non-zero.
  function ensureViewportFit() {
    var existing = document.querySelector('meta[name="viewport"]');
    var content =
      "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover";
    if (existing) {
      if (existing.getAttribute("content") !== content) {
        existing.setAttribute("content", content);
      }
    } else {
      var meta = document.createElement("meta");
      meta.setAttribute("name", "viewport");
      meta.setAttribute("content", content);
      (document.head || document.documentElement).appendChild(meta);
    }
  }
  ensureViewportFit();
  document.addEventListener("DOMContentLoaded", ensureViewportFit);

  // (3) Scale every .stage to fit (max-fit, no padding) and re-apply on
  //     resize. This wins over the per-screen inline `transform: scale(s)`
  //     the source code installs because we run it after the React
  //     useEffect AND we re-run on every resize.
  var STAGE_W = 402;
  var STAGE_H = 874;

  // Lazy-create a hidden probe so we can read env(safe-area-inset-*) as
  // resolved px values from getComputedStyle.
  var probe = null;
  function getInsets() {
    if (!document.body) return { top: 0, right: 0, bottom: 0, left: 0 };
    if (!probe) {
      probe = document.createElement("div");
      probe.className = "cap-safe-probe";
      document.body.appendChild(probe);
    }
    var cs = window.getComputedStyle(probe);
    return {
      top: parseFloat(cs.paddingTop) || 0,
      right: parseFloat(cs.paddingRight) || 0,
      bottom: parseFloat(cs.paddingBottom) || 0,
      left: parseFloat(cs.paddingLeft) || 0,
    };
  }

  function scaleStages() {
    if (!document.body) return;
    var insets = getInsets();
    var vw = window.innerWidth - insets.left - insets.right;
    var vh = window.innerHeight - insets.top - insets.bottom;
    var s = Math.min(vw / STAGE_W, vh / STAGE_H);
    var tx = insets.left + Math.max(0, (vw - STAGE_W * s) / 2);
    var ty = insets.top + Math.max(0, (vh - STAGE_H * s) / 2);
    // Set CSS custom properties on <body>; the !important CSS rule in
    // capacitor-overrides.css consumes them. This wins over the inline
    // transform fat-snag's per-screen useEffect installs.
    var style = document.body.style;
    style.setProperty("--cap-tx", tx + "px");
    style.setProperty("--cap-ty", ty + "px");
    style.setProperty("--cap-scale", String(s));
  }

  // Run on resize. Throttle via rAF.
  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    (window.requestAnimationFrame || function (cb) { setTimeout(cb, 16); })(
      function () {
        pending = false;
        scaleStages();
      },
    );
  }

  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);

  // Run on DOM mutations so newly-mounted screens (Next.js client-side
  // navigation) get their stage scaled even though our resize listener
  // hasn't fired.
  function watchMutations() {
    var target = document.body;
    if (!target || typeof MutationObserver === "undefined") return;
    var observer = new MutationObserver(schedule);
    observer.observe(target, { childList: true, subtree: true });
  }

  document.addEventListener("DOMContentLoaded", function () {
    scaleStages();
    watchMutations();
  });
  // First-pass attempt now in case body is already there.
  scaleStages();
})();
