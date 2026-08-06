// Load the Context7 chat widget on every docs page.
//
// Context7 indexes this repo (context7.com/infino-ai/docs); the widget
// renders a floating chat button that answers questions from that index.
// Mintlify injects every root-level .js file into each page, so loading
// the widget here puts it on the whole site. The script is appended
// asynchronously and never blocks page render.
(function () {
  var s = document.createElement("script");
  s.src = "https://context7.com/widget.js";
  s.async = true;
  s.setAttribute("data-library", "/infino-ai/docs");
  s.setAttribute("data-color", "#d24011");
  s.setAttribute("data-position", "bottom-right");
  s.setAttribute("data-placeholder", "Ask anything about Infino…");
  s.setAttribute(
    "data-welcome-message",
    "Hi! I answer questions about Infino and Infino Cloud straight from the docs. What are you building?"
  );
  document.head.appendChild(s);
})();
