// ─── Custom analytics events (Google Analytics 4) ────────────
//
// Page visits and time on page are measured by GA4 automatically.
// This file adds the interactions GA4 doesn't know about. Each event
// carries a "label" parameter (e.g. which paper was clicked), which the
// dashboard reads via the "label" custom dimension in GA4.
//
// Events: joke_refresh, paper_click, social_click, email_copy, article_click

(function () {
  function track(name, label) {
    if (typeof gtag !== 'function') return;
    var params = {};
    // GA4 caps parameter values at 100 characters
    if (label) params.label = label.replace(/\s+/g, ' ').trim().slice(0, 100);
    gtag('event', name, params);
  }

  function on(selector, handler) {
    document.querySelectorAll(selector).forEach(function (el) {
      el.addEventListener('click', function () { handler(el); });
    });
  }

  // Joke refresh button
  on('#joke-refresh', function () { track('joke_refresh'); });

  // Paper links — label is the paper title
  on('.pub-link', function (el) {
    var item = el.closest('.pub-item');
    var title = item && item.querySelector('.pub-title');
    track('paper_click', title ? title.textContent : el.textContent);
  });

  // Scholar / GitHub / LinkedIn
  on('.social-link', function (el) {
    track('social_click', el.getAttribute('title') || el.textContent);
  });

  // Email (click copies it to the clipboard)
  on('.photo-email', function () { track('email_copy'); });

  // Achievement article links — label is the achievement title
  on('.achievement-tag', function (el) {
    var card = el.closest('.achievement-card');
    var title = card && card.querySelector('.achievement-title');
    track('article_click', title ? title.textContent : el.textContent);
  });
})();
