// Research Vectors — fetch JSON and render animated bar chart
(function () {
  var container = document.getElementById('vectors-bars');
  var meta      = document.getElementById('vectors-meta');
  if (!container) return;

  fetch('assets/research-vectors.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      container.innerHTML = '';

      data.vectors.forEach(function (v) {
        var row = document.createElement('div');
        row.className = 'vector-row';

        var label = document.createElement('span');
        label.className = 'vector-label';
        label.textContent = v.area;

        var track = document.createElement('div');
        track.className = 'vector-track';

        var fill = document.createElement('div');
        fill.className = 'vector-fill';
        fill.style.width = '0%';                     // start at 0 for animation
        fill.setAttribute('data-pct', v.pct);

        var pctLabel = document.createElement('span');
        pctLabel.className = 'vector-pct';
        pctLabel.textContent = v.pct + '%';

        var countLabel = document.createElement('span');
        countLabel.className = 'vector-count';
        countLabel.textContent = v.papers + ' paper' + (v.papers !== 1 ? 's' : '');

        track.appendChild(fill);
        row.appendChild(label);
        row.appendChild(track);
        row.appendChild(pctLabel);
        row.appendChild(countLabel);
        container.appendChild(row);
      });

      // Animate bars in after a short delay
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          container.querySelectorAll('.vector-fill').forEach(function (el) {
            el.style.width = el.getAttribute('data-pct') + '%';
          });
        });
      });

      if (meta) {
        meta.textContent = 'Based on ' + data.total_papers +
          ' publication' + (data.total_papers !== 1 ? 's' : '') +
          '. Last updated ' + data.generated + '.';
      }
    })
    .catch(function () {
      container.innerHTML = '<span class="vectors-loading">Could not load research vectors.</span>';
    });
})();
