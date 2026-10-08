/* THCM: adds a soft shadow to the sticky header once the page is scrolled. */
(function () {
  var scrolled = false;

  function update(target) {
    var y = window.scrollY || 0;
    if (target && target.scrollTop) y = Math.max(y, target.scrollTop);
    var next = y > 4;
    if (next === scrolled) return;
    scrolled = next;
    var header = document.querySelector('header-component');
    if (header) header.classList.toggle('tata-scrolled', scrolled);
  }

  // Capture phase so scrolling inside the page wrapper is also detected
  document.addEventListener('scroll', function (e) {
    update(e.target instanceof Element ? e.target : null);
  }, { capture: true, passive: true });
})();
