/*
 * Runs as early as possible in the document.
 * Adds the `cap-app` class to <html> and <body> so the override stylesheet
 * (capacitor-overrides.css) takes effect.
 */
(function () {
  function isCapacitor() {
    if (typeof window === "undefined") return false;
    if (window.Capacitor && window.Capacitor.isNativePlatform) {
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

  function apply() {
    if (!isCapacitor()) return;
    var html = document.documentElement;
    if (html && html.classList) html.classList.add("cap-app");
    if (document.body && document.body.classList) {
      document.body.classList.add("cap-app");
    } else {
      document.addEventListener("DOMContentLoaded", function () {
        if (document.body && document.body.classList) {
          document.body.classList.add("cap-app");
        }
      });
    }
  }

  apply();
})();
