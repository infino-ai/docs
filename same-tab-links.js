// Open the marketing-site links in the same tab.
//
// The docs are served at infino.ai/docs and link back to the infino.ai
// marketing site (the logo, plus the Home / Compare / Infino Cloud navbar
// links) with full URLs. Mintlify opens full-URL links in a new tab, which
// breaks the "one site" feel — clicking Home or the logo should navigate in
// place, like moving between sections of infino.ai. Force those links (and
// only those — external links like GitHub keep opening in a new tab) to the
// same tab. Mintlify auto-includes any .js file in the repo on every page.
(function () {
  function sameTab() {
    document
      .querySelectorAll('a[href^="https://infino.ai"]')
      .forEach(function (a) {
        a.target = "_self";
      });
  }

  sameTab();

  // Mintlify is a single-page app; the header persists and can re-render on
  // navigation, so re-apply whenever the DOM changes. (Observes node additions
  // only — setting `target` doesn't add nodes, so this can't loop.)
  new MutationObserver(sameTab).observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
