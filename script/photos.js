// ─── Photos ──────────────────────────────────────────────────
//
// To add a photo:
//   1. Put the image file in assets/photos/  (e.g. assets/photos/ultimate.jpg)
//   2. Fill in an entry below: src is the path, alt describes the photo.
//      caption is optional and shows in small text under the photo.
//
// Photos display two per row, in the order listed here.
// An entry with an empty src shows as a blank placeholder tile.

var photos = [
  { src: '', alt: '', caption: '' },
  { src: '', alt: '', caption: '' },
  { src: '', alt: '', caption: '' },
  { src: '', alt: '', caption: '' },
  { src: '', alt: '', caption: '' },
  { src: '', alt: '', caption: '' }

  // Example:
  // { src: 'assets/photos/ultimate.jpg', alt: 'Ultimate frisbee tournament', caption: 'Nationals, 2026' },
];

var photoGrid = document.getElementById('photo-grid');

if (photoGrid) {
  photos.forEach(function (photo) {
    var figure = document.createElement('figure');
    figure.className = 'photo-item';

    var frame = document.createElement('div');
    frame.className = 'photo-frame';

    if (photo.src) {
      var img = document.createElement('img');
      img.src = photo.src;
      img.alt = photo.alt || '';
      img.loading = 'lazy';
      frame.appendChild(img);
    } else {
      frame.classList.add('photo-empty');
    }

    figure.appendChild(frame);

    if (photo.caption) {
      var caption = document.createElement('figcaption');
      caption.className = 'photo-caption';
      caption.textContent = photo.caption;
      figure.appendChild(caption);
    }

    photoGrid.appendChild(figure);
  });
}
