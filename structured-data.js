// Injects schema.org JSON-LD structured data into every page.
// Mintlify auto-includes any .js file in the content directory as a global
// script (runs after the page is interactive). Mintlify does not emit JSON-LD
// itself, so this adds it: a site-wide SoftwareApplication entity, plus a
// FAQPage entity on /faq.

(function () {
  function addJsonLd(id, data) {
    if (document.getElementById(id)) return; // guard against double-injection
    var s = document.createElement("script");
    s.type = "application/ld+json";
    s.id = id;
    s.textContent = JSON.stringify(data);
    document.head.appendChild(s);
  }

  // Site-wide: describe Infino itself (the entity answer engines key on).
  addJsonLd("ld-software-application", {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Infino",
    applicationCategory: "DeveloperApplication",
    description:
      "Infino is an embedded retrieval engine — SQL, full-text (BM25), vector, and hybrid search over Apache Parquet on object storage, in-process.",
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
  });

  // FAQ page: a FAQPage entity (rich-result + answer-engine lever).
  var path = window.location.pathname.replace(/\/$/, "");
  if (path.endsWith("/faq")) {
    var qa = [
      ["Does Infino need a server?",
       "No. Infino is an embedded engine that runs in-process inside your application — you add it as a library and open a connection. There is no separate server, cluster, or managed service to operate."],
      ["Does Infino compute embeddings, or do I bring my own?",
       "You bring your own. Infino indexes the vectors you supply — compute them with any model and pass them in alongside your rows."],
      ["Does Infino do hybrid search?",
       "Yes — BM25 and vector kNN fused with reciprocal-rank fusion, in one query, via the hybrid_search SQL function."],
      ["Do I still need a separate vector database?",
       "No. One Infino table serves BM25, vector, hybrid, and SQL over a single copy of your data — no separate vector store or search cluster to run and keep in sync."],
      ["Which languages can I use Infino from?",
       "A Rust core with Python (pip install infino) and Node.js (npm install @infino-ai/infino) bindings."],
      ["What license is Infino under?",
       "Apache-2.0."],
    ];
    addJsonLd("ld-faqpage", {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: qa.map(function (pair) {
        return {
          "@type": "Question",
          name: pair[0],
          acceptedAnswer: { "@type": "Answer", text: pair[1] },
        };
      }),
    });
  }
})();
