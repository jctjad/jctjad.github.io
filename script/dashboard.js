// ─── Site analytics dashboard ────────────────────────────────
//
// Reads assets/analytics.enc.json (written daily by scripts/update_analytics.py
// via GitHub Actions). The file is password-encrypted (AES-GCM, PBKDF2 key —
// see scripts/dashboard_crypto.py) and decrypted here in the browser.
// Open dashboard.html?demo to preview with fake data.

(function () {
  'use strict';

  var DATA_URL = 'assets/analytics.enc.json';
  var NO_TRACK_KEY = 'jt-no-track';
  var PASSWORD_KEY = 'jt-dash-pw';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var CHART_SPAN = { week: 26, month: 24, year: 20 };   // how many bars to show

  var METRICS = {
    visitors: { label: 'Visitors', key: 'activeUsers', fmt: fmtInt },
    visits:   { label: 'Visits', key: 'sessions', fmt: fmtInt },
    views:    { label: 'Page views', key: 'screenPageViews', fmt: fmtInt },
    time:     { label: 'Avg. time on site', fmt: fmtDuration,
                compute: function (o) { return o.activeUsers ? o.userEngagementDuration / o.activeUsers : 0; } }
  };

  var state = { data: null, gran: 'week', period: null, metric: 'visits' };

  var $ = function (id) { return document.getElementById(id); };

  // ── Formatting ────────────────────────────────────────────

  function fmtInt(n) { return Math.round(n || 0).toLocaleString('en-US'); }

  function fmtDuration(s) {
    s = Math.round(s || 0);
    if (s < 60) return s + 's';
    var m = Math.floor(s / 60), r = s % 60;
    return r ? m + 'm ' + r + 's' : m + 'm';
  }

  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // ── Period keys ───────────────────────────────────────────
  // week "202647" (ISO year + ISO week), month "202611", year "2026", all "all"

  function isoWeekMonday(key) {
    var y = +key.slice(0, 4), w = +key.slice(4);
    var jan4 = new Date(Date.UTC(y, 0, 4));
    var dow = jan4.getUTCDay() || 7;
    return new Date(Date.UTC(y, 0, 4 - dow + 1 + (w - 1) * 7));
  }

  function isoWeekKey(d) {
    var t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));   // Thursday of this week
    var y = t.getUTCFullYear();
    var w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
    return y + pad(w);
  }

  function keyFor(gran, d) {
    if (gran === 'week') return isoWeekKey(d);
    if (gran === 'month') return d.getUTCFullYear() + pad(d.getUTCMonth() + 1);
    if (gran === 'year') return String(d.getUTCFullYear());
    return 'all';
  }

  function nextKey(gran, key) {
    if (gran === 'week') {
      var m = isoWeekMonday(key);
      m.setUTCDate(m.getUTCDate() + 7);
      return isoWeekKey(m);
    }
    if (gran === 'month') {
      var y = +key.slice(0, 4), mo = +key.slice(4) + 1;
      if (mo > 12) { mo = 1; y++; }
      return y + pad(mo);
    }
    return String(+key + 1);
  }

  // Every period from the first one with data through `endKey`, gaps included
  function fillKeys(gran, keys, endKey) {
    if (gran === 'all') return ['all'];
    keys = keys.slice().sort();
    if (!keys.length) return [endKey];
    var last = keys[keys.length - 1] > endKey ? keys[keys.length - 1] : endKey;
    var out = [], k = keys[0];
    while (k <= last && out.length < 2000) { out.push(k); k = nextKey(gran, k); }
    return out;
  }

  function periodLabel(gran, key, short) {
    if (gran === 'week') {
      var d = isoWeekMonday(key);
      var s = MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate();
      return short ? s : 'Week of ' + s + ', ' + d.getUTCFullYear();
    }
    if (gran === 'month') {
      var m = MONTHS[+key.slice(4) - 1];
      return short ? m + ' ’' + key.slice(2, 4) : m + ' ' + key.slice(0, 4);
    }
    if (gran === 'year') return key;
    return 'All time';
  }

  // ── Data access ───────────────────────────────────────────

  function generatedDate() {
    var d = state.data && state.data.generated ? new Date(state.data.generated) : new Date();
    return isNaN(d) ? new Date() : d;
  }

  function periodKeys(gran) {
    var table = state.data.periods[gran] || {};
    return fillKeys(gran, Object.keys(table), keyFor(gran, generatedDate()));
  }

  function periodData(gran, key) {
    var table = state.data.periods[gran] || {};
    return table[key] || {};
  }

  function metricValue(metric, period) {
    var o = period.overview || {};
    return metric.compute ? metric.compute(o) : (o[metric.key] || 0);
  }

  // ── Render ────────────────────────────────────────────────

  function render() {
    var gran = state.gran;
    var keys = periodKeys(gran);
    if (keys.indexOf(state.period) < 0) state.period = keys[keys.length - 1];

    var idx = keys.indexOf(state.period);
    var cur = periodData(gran, state.period);
    var prev = idx > 0 ? periodData(gran, keys[idx - 1]) : null;

    renderControls(keys);
    renderTiles(cur, prev);
    renderChart();
    renderLists(cur);
  }

  function renderControls(keys) {
    document.querySelectorAll('.dash-seg button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.gran === state.gran));
    });

    var sel = $('dash-period');
    sel.hidden = state.gran === 'all';
    var currentKey = keyFor(state.gran, new Date());
    sel.innerHTML = keys.slice().reverse().map(function (k) {
      var label = periodLabel(state.gran, k) + (k === currentKey ? ' (in progress)' : '');
      return '<option value="' + esc(k) + '"' + (k === state.period ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
  }

  function renderTiles(cur, prev) {
    var unit = { week: 'week', month: 'month', year: 'year' }[state.gran];
    $('dash-tiles').innerHTML = Object.keys(METRICS).map(function (id) {
      var m = METRICS[id];
      var v = metricValue(m, cur);
      var delta = '&nbsp;';
      if (prev && unit) {
        var p = metricValue(m, prev);
        if (p > 0) {
          var pct = Math.round(((v - p) / p) * 100);
          var arrow = pct > 0 ? '▲ ' : pct < 0 ? '▼ ' : '';
          delta = arrow + Math.abs(pct) + '% vs. previous ' + unit;
        } else {
          delta = 'No data for previous ' + unit;
        }
      }
      return '<button type="button" class="dash-tile" data-metric="' + id + '" aria-pressed="' + (id === state.metric) + '">' +
        '<span class="dash-tile-label">' + m.label + '</span>' +
        '<span class="dash-tile-value">' + m.fmt(v) + '</span>' +
        '<span class="dash-tile-delta">' + delta + '</span>' +
        '</button>';
    }).join('');
  }

  // Bar chart of the selected metric over time
  function renderChart() {
    var m = METRICS[state.metric];
    var chartGran = state.gran === 'all' ? 'month' : state.gran;
    var keys = periodKeys(chartGran);

    // Window of bars ending at the selected period (or the latest)
    var span = CHART_SPAN[chartGran];
    var end = state.gran === 'all' ? keys.length : keys.indexOf(state.period) + 1;
    end = Math.max(end, Math.min(keys.length, span));
    var series = keys.slice(Math.max(0, end - span), end).map(function (k) {
      return { key: k, value: metricValue(m, periodData(chartGran, k)) };
    });

    $('chart-title').textContent = m.label + ' per ' + chartGran;

    // Table view
    $('dash-table-body').innerHTML = '<table><thead><tr><th>' + (chartGran[0].toUpperCase() + chartGran.slice(1)) +
      '</th><th>' + m.label + '</th></tr></thead><tbody>' +
      series.slice().reverse().map(function (s) {
        return '<tr><td>' + esc(periodLabel(chartGran, s.key)) + '</td><td>' + m.fmt(s.value) + '</td></tr>';
      }).join('') + '</tbody></table>';

    var el = $('dash-chart');
    var W = el.clientWidth, H = el.clientHeight;
    var padL = 44, padR = 4, padT = 10, padB = 26;
    var plotW = W - padL - padR, plotH = H - padT - padB, base = padT + plotH;

    var max = Math.max.apply(null, series.map(function (s) { return s.value; }).concat([0]));
    var ticks = niceTicks(max, state.metric === 'time');
    var top = ticks[ticks.length - 1];

    var n = series.length;
    var slot = plotW / n;
    var bw = Math.max(2, Math.min(28, slot - 2, slot * 0.68));
    var labelEvery = Math.ceil(52 / slot);
    var svg = '<svg width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(m.label + ' per ' + chartGran) + '">';

    ticks.forEach(function (t) {
      var y = Math.round(base - (t / top) * plotH) + 0.5;
      svg += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y + '" y2="' + y + '" stroke="' + (t === 0 ? '#d1d5db' : '#f0f1f3') + '" />';
      svg += '<text x="' + (padL - 8) + '" y="' + (y + 4) + '" text-anchor="end" font-size="11" fill="#9ca3af">' + esc(m.fmt(t)) + '</text>';
    });

    series.forEach(function (s, i) {
      var cx = padL + i * slot + slot / 2;
      var x = cx - bw / 2;
      var h = (s.value / top) * plotH;
      var selected = state.gran !== 'all' && s.key === state.period;
      if (h > 0) {
        svg += '<path d="' + barPath(x, base, bw, Math.max(h, 1.5)) + '" fill="' + (selected ? 'var(--columbia-blue)' : '#b4c3dd') + '" />';
      }
      if ((n - 1 - i) % labelEvery === 0) {
        svg += '<text x="' + cx + '" y="' + (base + 17) + '" text-anchor="middle" font-size="11" fill="' +
          (selected ? '#111' : '#9ca3af') + '">' + esc(periodLabel(chartGran, s.key, true)) + '</text>';
      }
      // Generous invisible hit target: full column
      svg += '<rect class="hit" data-i="' + i + '" x="' + (padL + i * slot) + '" y="' + padT + '" width="' + slot + '" height="' + plotH + '" fill="transparent" />';
    });
    svg += '</svg><div class="dash-tip" id="dash-tip"></div>';
    el.innerHTML = svg;

    var tip = $('dash-tip');
    el.querySelectorAll('.hit').forEach(function (r) {
      var s = series[+r.dataset.i];
      r.addEventListener('mouseenter', function () {
        tip.innerHTML = '<b>' + esc(m.fmt(s.value)) + '</b> &middot; ' + esc(periodLabel(chartGran, s.key));
        tip.classList.add('show');
        var cx = padL + (+r.dataset.i + 0.5) * slot;
        var y = base - (s.value / top) * plotH;
        var tw = tip.offsetWidth;
        var left = Math.min(Math.max(cx - tw / 2, 0), W - tw);
        tip.style.transform = 'translate(' + left + 'px,' + (y - tip.offsetHeight - 8) + 'px)';
      });
      r.addEventListener('mouseleave', function () { tip.classList.remove('show'); });
      r.addEventListener('click', function () {
        if (state.gran === 'all') return;
        state.period = s.key;
        render();
      });
    });
  }

  // Bar with 4px rounded top, square at the baseline
  function barPath(x, base, w, h) {
    var r = Math.min(4, w / 2, h);
    var top = base - h;
    return 'M' + x + ',' + base + 'V' + (top + r) + 'Q' + x + ',' + top + ' ' + (x + r) + ',' + top +
      'H' + (x + w - r) + 'Q' + (x + w) + ',' + top + ' ' + (x + w) + ',' + (top + r) + 'V' + base + 'Z';
  }

  function niceTicks(max, isTime) {
    if (max <= 0) return [0, 1];
    var raw = max / 4, step;
    if (isTime && raw >= 30) {
      var steps = [30, 60, 120, 300, 600, 900, 1800, 3600];
      step = steps.filter(function (s) { return s >= raw; })[0] || Math.ceil(raw / 3600) * 3600;
    } else {
      var pow = Math.pow(10, Math.floor(Math.log10(raw)));
      var f = raw / pow;
      step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
      if (step < 1) step = 1;
    }
    var out = [];
    for (var t = 0; t < max + step; t += step) out.push(t);
    if (out[out.length - 1] < max) out.push(out[out.length - 1] + step);
    return out;
  }

  // ── Ranked lists ──────────────────────────────────────────

  function barList(id, items, fmt, emptyText) {
    items = items.filter(function (it) { return it.value > 0; })
      .sort(function (a, b) { return b.value - a.value; })
      .slice(0, 8);
    var el = $(id);
    if (!items.length) {
      el.innerHTML = '<li class="dash-empty">' + (emptyText || 'Nothing yet for this period') + '</li>';
      return;
    }
    var max = items[0].value;
    el.innerHTML = items.map(function (it) {
      return '<li><div class="bl-head">' +
        '<span class="bl-label" title="' + esc(it.label) + '">' + esc(it.label) + '</span>' +
        '<span class="bl-value">' + esc((fmt || fmtInt)(it.value)) +
        (it.sub ? '<span class="bl-sub">' + esc(it.sub) + '</span>' : '') + '</span>' +
        '</div><div class="bl-track"><div class="bl-fill" style="width:' + (it.value / max * 100).toFixed(1) + '%"></div></div></li>';
    }).join('');
  }

  function eventItems(events, name, prefix, blankLabel) {
    var labels = (events && events[name]) || {};
    return Object.keys(labels).map(function (l) {
      return { label: (prefix || '') + (l || blankLabel || '(not recorded)'), value: labels[l] };
    });
  }

  function sum(obj) {
    return Object.keys(obj || {}).reduce(function (t, k) { return t + obj[k]; }, 0);
  }

  function renderLists(cur) {
    var ev = cur.events || {};

    barList('list-papers', eventItems(ev, 'paper_click'), null, 'No paper clicks this period');

    barList('list-interactions', [
      { label: 'Joke refreshes', value: sum(ev.joke_refresh) },
      { label: 'Email copied', value: sum(ev.email_copy) }
    ]
      .concat(eventItems(ev, 'social_click', '', 'Social link').map(function (it) {
        it.label += ' profile'; return it;
      }))
      .concat(eventItems(ev, 'article_click', 'Article: ')));

    var sources = cur.sources || {};
    barList('list-sources', Object.keys(sources).map(function (s) {
      return { label: s === '(direct)' ? 'Direct / bookmark' : s, value: sources[s] };
    }), function (v) { return fmtInt(v) + ' visits'; });

    var countries = cur.countries || {};
    barList('list-countries', Object.keys(countries).map(function (c) {
      return { label: c, value: countries[c] };
    }), function (v) { return fmtInt(v) + (v === 1 ? ' visitor' : ' visitors'); });

    var pages = cur.pages || {};
    barList('list-pages', Object.keys(pages).map(function (p) {
      var pg = pages[p];
      var name = p === '/' ? 'Home' : p.replace(/^\//, '').replace(/^\w/, function (c) { return c.toUpperCase(); });
      return {
        label: name,
        value: pg.views,
        sub: pg.views ? fmtDuration(pg.engagement / pg.views) + ' avg. per view' : ''
      };
    }), function (v) { return fmtInt(v) + ' views'; });
  }

  // ── Demo data (dashboard.html?demo) ───────────────────────

  function makeDemo() {
    var seed = 42;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    function r(n) { return Math.max(0, Math.round(n)); }

    var papers = [
      'Policy alone is probably not the solution: A large-scale experiment on how developers struggle to',
      'Less Talk, More Code: Practice-Based Instruction Improves Programming Skill Acquisition',
      'The Balancing Act of Policies in Developing Machine Learning Explanations'
    ];
    var periods = { week: {}, month: {}, year: {}, all: {} };
    var today = new Date();
    var WEEKS = 90;

    for (var i = 0; i < WEEKS; i++) {
      var d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (WEEKS - 1 - i) * 7));
      var spike = rnd() < 0.08 ? 2.2 : 1;
      var visitors = r((18 + i * 0.5 + rnd() * 14) * spike);
      var sessions = r(visitors * (1.15 + rnd() * 0.2));
      var views = r(sessions * (1.4 + rnd() * 0.4));
      var engagement = r(visitors * (45 + rnd() * 50));
      var homeViews = r(views * 0.82);
      var p = {
        overview: { activeUsers: visitors, newUsers: r(visitors * 0.72), sessions: sessions, screenPageViews: views,
                    userEngagementDuration: engagement, engagedSessions: r(sessions * 0.6) },
        pages: {
          '/': { views: homeViews, engagement: r(engagement * 0.85) },
          '/photos': { views: views - homeViews, engagement: r(engagement * 0.15) }
        },
        events: {
          joke_refresh: { '': r(visitors * rnd() * 0.5) },
          email_copy: { '': r(rnd() * 3) },
          paper_click: {},
          social_click: { Scholar: r(rnd() * 5), GitHub: r(rnd() * 4), LinkedIn: r(rnd() * 6) },
          article_click: { 'NSF Graduate Research Fellowship (GRFP)': r(rnd() * 2) }
        },
        sources: { google: r(sessions * 0.35), '(direct)': r(sessions * 0.3), 'linkedin.com': r(sessions * 0.12),
                   'scholar.google.com': r(sessions * 0.1), 'columbia.edu': r(sessions * 0.08), 'github.com': r(sessions * 0.05) },
        countries: { 'United States': r(visitors * 0.6), India: r(visitors * 0.1), China: r(visitors * 0.08),
                     Germany: r(visitors * 0.05), 'United Kingdom': r(visitors * 0.05), Canada: r(visitors * 0.04) }
      };
      papers.forEach(function (t, j) { p.events.paper_click[t] = r(rnd() * (5 - j)); });

      ['week', 'month', 'year', 'all'].forEach(function (g) {
        var k = keyFor(g, d);
        periods[g][k] = merge(periods[g][k] || {}, p);
      });
    }
    return { generated: today.toISOString(), start_date: null, periods: periods, demo: true };
  }

  // Deep-sum two objects of numbers (only used to roll demo weeks into months/years)
  function merge(a, b) {
    var out = JSON.parse(JSON.stringify(a));
    Object.keys(b).forEach(function (k) {
      if (typeof b[k] === 'number') out[k] = (out[k] || 0) + b[k];
      else out[k] = merge(out[k] || {}, b[k]);
    });
    return out;
  }

  // ── Setup ─────────────────────────────────────────────────

  function showBanner(html) {
    var b = $('dash-banner');
    b.innerHTML = html;
    b.hidden = false;
  }

  function start(data) {
    state.data = data;
    $('dash-body').hidden = false;

    var gen = new Date(data.generated);
    if (!isNaN(gen)) {
      $('dash-updated').textContent = 'Updated ' + MONTHS[gen.getMonth()] + ' ' + gen.getDate() + ', ' + gen.getFullYear();
    }
    if (data.demo) {
      showBanner('Showing <strong>demo data</strong>, not real traffic. <a href="dashboard.html">Show real data</a>');
    }
    $('dash-source').textContent = data.demo ? '' : 'Source: Google Analytics' +
      (data.start_date ? ' since ' + data.start_date : '');

    document.querySelectorAll('.dash-seg button').forEach(function (b) {
      b.addEventListener('click', function () {
        state.gran = b.dataset.gran;
        state.period = null;
        render();
      });
    });
    $('dash-period').addEventListener('change', function (e) {
      state.period = e.target.value;
      render();
    });
    $('dash-tiles').addEventListener('click', function (e) {
      var tile = e.target.closest('.dash-tile');
      if (!tile) return;
      state.metric = tile.dataset.metric;
      render();
    });

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(renderChart, 100);
    });

    render();
  }

  // "Don't count my visits" toggle — read by the GA snippet on the other pages
  var optout = $('dash-notrack');
  try { optout.checked = localStorage.getItem(NO_TRACK_KEY) === '1'; } catch (e) { optout.disabled = true; }
  optout.addEventListener('change', function () {
    try {
      if (optout.checked) localStorage.setItem(NO_TRACK_KEY, '1');
      else localStorage.removeItem(NO_TRACK_KEY);
    } catch (e) {}
  });

  // ── Decryption ────────────────────────────────────────────

  function fromB64(s) {
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // Rejects if the password is wrong (AES-GCM authentication fails)
  function decrypt(envelope, password) {
    var subtle = window.crypto && window.crypto.subtle;
    if (!subtle) return Promise.reject(new Error('Web Crypto unavailable (page must be served over HTTPS)'));
    return subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return subtle.deriveKey(
          { name: 'PBKDF2', salt: fromB64(envelope.salt), iterations: envelope.iterations, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      })
      .then(function (key) {
        return subtle.decrypt({ name: 'AES-GCM', iv: fromB64(envelope.iv) }, key, fromB64(envelope.data));
      })
      .then(function (buf) { return JSON.parse(new TextDecoder().decode(buf)); });
  }

  function storage(fn) { try { return fn(localStorage); } catch (e) { return null; } }

  function unlock(envelope) {
    var form = $('dash-lock'), input = $('dash-password'), btn = $('dash-unlock'), err = $('dash-lock-error');

    function open(password, remember) {
      return decrypt(envelope, password).then(function (data) {
        if (remember) storage(function (s) { s.setItem(PASSWORD_KEY, password); });
        form.hidden = true;
        $('dash-logout').hidden = false;
        start(data);
      });
    }

    // Key derivation is deliberately slow (~1s), so show progress
    function busy(on) {
      btn.disabled = on;
      btn.textContent = on ? 'Unlocking…' : 'Unlock';
    }

    form.hidden = false;
    var saved = storage(function (s) { return s.getItem(PASSWORD_KEY); });
    if (saved) {
      busy(true);
      open(saved, false).catch(function () {
        storage(function (s) { s.removeItem(PASSWORD_KEY); });   // password was changed
        busy(false);
        input.focus();
      });
    } else {
      input.focus();
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      busy(true);
      err.textContent = '';
      open(input.value, $('dash-remember').checked)
        .catch(function (ex) {
          busy(false);
          err.textContent = ex && /Web Crypto/.test(ex.message) ? ex.message : 'Wrong password.';
          input.select();
        });
    });
  }

  $('dash-logout').addEventListener('click', function () {
    storage(function (s) { s.removeItem(PASSWORD_KEY); });
    location.reload();
  });

  // ── Load ──────────────────────────────────────────────────

  if (/[?&]demo\b/.test(location.search)) {
    start(makeDemo());
  } else {
    fetch(DATA_URL, { cache: 'no-cache' })
      .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
      .then(unlock)
      .catch(function () {
        showBanner('No analytics data yet. It appears once the <em>Update Analytics</em> GitHub Action has run ' +
          '(see the setup notes in <code>scripts/update_analytics.py</code>). ' +
          '<a href="dashboard.html?demo">Preview with demo data</a>');
      });
  }
})();
