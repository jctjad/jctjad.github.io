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
  { src: 'assets/photos/ny_minute.jpg', alt: 'Manhattan frisbee tournament', caption: 'taken by Roark' },
  { src: 'assets/photos/party_people.jpg', alt: 'Group grad photo', caption: '' },
  { src: 'assets/photos/seniors.jpg', alt: 'Seniors practice close-up', caption: 'taken by Nano' },
  { src: 'assets/photos/greece.jpg', alt: 'Christmas card 2025', caption: '' },
  { src: 'assets/photos/lobby_p_24.jpg', alt: 'Lobster pot 2024', caption: 'taken by Kristen' },
  // { src: 'assets/photos/acadia.png', alt: 'Acadia', caption: '' },
  { src: 'assets/photos/museum.png', alt: 'Museum', caption: '' }
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
