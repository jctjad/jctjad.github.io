// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const navLinks  = document.getElementById('navLinks');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(open));
  });

  // Close on any nav link click
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

// CS jokes — add more to this array as needed
var jokes = [
  "Siri recommended I \"touch grass\".",
  "I'm not hallucinating. I'm being creative.",
  "After Claude made my website I said \"thanks bestie\" and it told me to go make some real friends...",
  "Artificial intelligence; natural humor.",
  "My therapist said I spend too much time talking to chatbots—you can figure out who my therapist is.",
  "I asked my GPS to take me somewhere I'd be happy. It took me to \"Recalculating...\"",
  "Prompt: How is the name \"Tjaden\" pronounced?\nClaude: idk lol"
];

var jokeEl = document.getElementById('joke-text');
var jokeBtn = document.getElementById('joke-refresh');
var lastJokeIdx = -1;

function showRandomJoke() {
  if (jokes.length === 0) return;
  var idx;
  do { idx = Math.floor(Math.random() * jokes.length); } while (jokes.length > 1 && idx === lastJokeIdx);
  lastJokeIdx = idx;
  if (jokeEl) jokeEl.textContent = jokes[idx];
}

showRandomJoke();
if (jokeBtn) jokeBtn.addEventListener('click', showRandomJoke);

// Footer year (in Roman numerals)
function toRoman(n) {
  var numerals = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  var result = '';
  numerals.forEach(function (pair) {
    while (n >= pair[0]) { result += pair[1]; n -= pair[0]; }
  });
  return result;
}

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = toRoman(new Date().getFullYear());

// Cloudflare Scrape Shield — decode obfuscated email addresses
document.querySelectorAll('[data-cfemail]').forEach(function (el) {
  var enc = el.getAttribute('data-cfemail');
  var key = parseInt(enc.slice(0, 2), 16);
  var decoded = '';
  for (var i = 2; i < enc.length; i += 2) {
    decoded += String.fromCharCode(parseInt(enc.slice(i, i + 2), 16) ^ key);
  }

  // Replace visible text — el may be the span itself or the anchor containing it
  var span = el.classList.contains('__cf_email__') ? el : el.querySelector('.__cf_email__');
  if (span) span.textContent = decoded;

  // Copy to clipboard on click instead of opening mail client
  var anchor = el.tagName === 'A' ? el : el.closest('a');
  if (anchor) {
    anchor.removeAttribute('href');
    anchor.style.cursor = 'pointer';
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      navigator.clipboard.writeText(decoded).then(function () {
        var original = span ? span.textContent : '';
        if (span) span.textContent = 'Copied!';
        setTimeout(function () {
          if (span) span.textContent = original;
        }, 1500);
      });
    });
  }
});
