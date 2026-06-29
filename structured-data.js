// Injects schema.org JSON-LD structured data into every page.
// Mintlify auto-includes any .js file in the content directory as a global
// script. Mintlify only emits a bare WebSite node itself, so this adds:
//   - a site-wide SoftwareApplication entity (the entity answer engines key on)
//   - a FAQPage entity, present only on /faq
//
// Mintlify is a single-page app, so we re-evaluate on client-side route changes
// (the script runs once on first load) and add/remove the FAQPage node to match
// the current path.

(function () {
  function setJsonLd(id, data) {
    var existing = document.getElementById(id);
    if (data == null) {
      if (existing) existing.remove();
      return;
    }
    if (existing) return; // already present, leave it
    var s = document.createElement("script");
    s.type = "application/ld+json";
    s.id = id;
    s.textContent = JSON.stringify(data);
    document.head.appendChild(s);
  }

  var SOFTWARE = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Infino",
    applicationCategory: "DeveloperApplication",
    description:
      "Infino is an open-source retrieval engine for full-text, vector, and SQL search, with your data stored as Apache Parquet on object storage.",
    url: "https://docs.infino.ai",
    operatingSystem: "Linux, macOS",
    license: "https://www.apache.org/licenses/LICENSE-2.0",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    sameAs: [
      "https://github.com/infino-ai/infino",
      "https://crates.io/crates/infino",
      "https://pypi.org/project/infino/",
      "https://www.npmjs.com/package/@infino-ai/infino",
    ],
  };

  var FAQ = [
    ["Does Infino need a server?",
     "No. Infino runs inside your application as a library. You add it, open a connection, and the engine runs in your process."],
    ["Is Infino a vector database?",
     "It does what a vector database does (semantic nearest-neighbor search over your embeddings) without being a separate store you run. Vector search is one mode among full-text, hybrid, and SQL over a single copy of your data."],
    ["Is Infino a database?",
     "Not in the transactional sense. Infino is a retrieval engine for search and analytics over data you keep as Parquet, not an OLTP database for transactions or row-level updates."],
    ["Does Infino compute embeddings, or do I bring my own?",
     "You bring your own. Infino indexes the vectors you supply — compute them with any model and pass them in alongside your rows."],
    ["Does Infino do hybrid search?",
     "Yes — BM25 and vector kNN fused with reciprocal-rank fusion, in one query, via the hybrid_search SQL function."],
    ["Do I still need a separate vector database?",
     "No. One Infino table serves full-text, vector, hybrid, and SQL search over a single copy of your data."],
    ["Which languages can I use Infino from?",
     "A Rust core with Python (pip install infino) and Node.js (npm install @infino-ai/infino) bindings."],
    ["What license is Infino under?", "Apache-2.0."],
  ];

  function faqPage() {
    return {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map(function (p) {
        return {
          "@type": "Question",
          name: p[0],
          acceptedAnswer: { "@type": "Answer", text: p[1] },
        };
      }),
    };
  }

  function sync() {
    setJsonLd("ld-software-application", SOFTWARE); // site-wide, inject once
    var onFaq = window.location.pathname.replace(/\/$/, "").endsWith("/faq");
    setJsonLd("ld-faqpage", onFaq ? faqPage() : null); // add on /faq, remove off it
  }

  // Run now, and again on every client-side route change (SPA navigation).
  sync();
  ["pushState", "replaceState"].forEach(function (m) {
    var orig = history[m];
    history[m] = function () {
      var r = orig.apply(this, arguments);
      setTimeout(sync, 0);
      return r;
    };
  });
  window.addEventListener("popstate", function () { setTimeout(sync, 0); });
})();
