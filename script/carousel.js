/* carousel.js */

document.addEventListener('DOMContentLoaded', function() {

    // for each carousel
    document.querySelectorAll('.carousel-wrapper').forEach(carousel => {
        const items   = carousel.querySelectorAll('.carousel-item');
        const dotsCon = carousel.querySelector('.carousel-dots');
        let   idx     = 0;

        // build dots
        items.forEach((_, i) => {
            const btn = document.createElement('button');
            btn.addEventListener('click', () => showSlide(i));
            dotsCon.appendChild(btn);
        });

        function showSlide(i) {
            items.forEach((el, j) => {
            el.classList.toggle('hidden', j !== i);
            dotsCon.children[j].classList.toggle('active', j === i);
            });
            idx = i;
        }

        // init
        showSlide(0);
    });
});