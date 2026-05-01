// Smooth scroll for anchor links — offsets by the sticky nav height
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', function (e) {
    const id = this.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    const navH = document.getElementById('navbar')?.offsetHeight ?? 0;
    window.scrollTo({ top: target.offsetTop - navH, behavior: 'smooth' });
  });
});
