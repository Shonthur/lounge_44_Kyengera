(() => {
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function initMagnetic() {
    const elements = Array.from(document.querySelectorAll(".magnetic"));
    if (elements.length === 0) return;

    elements.forEach((el) => {
      let raf = 0;

      function setTransform(x, y) {
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }

      function onMove(e) {
        if (reduceMotion) return;
        const rect = el.getBoundingClientRect();
        const relX = e.clientX - rect.left;
        const relY = e.clientY - rect.top;
        const dx = relX - rect.width / 2;
        const dy = relY - rect.height / 2;

        const strength = Number(el.getAttribute("data-magnetic")) || 0.18;
        const maxX = Math.max(6, rect.width * 0.06);
        const maxY = Math.max(6, rect.height * 0.2);

        const x = clamp(dx * strength, -maxX, maxX);
        const y = clamp(dy * strength, -maxY, maxY);

        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => setTransform(x, y));
      }

      function onLeave() {
        cancelAnimationFrame(raf);
        el.style.transform = "";
      }

      el.addEventListener("mousemove", onMove);
      el.addEventListener("mouseleave", onLeave);
      el.addEventListener("blur", onLeave);
    });
  }

  function initSlideshows() {
    const slideshows = Array.from(document.querySelectorAll("[data-slideshow]"));
    if (slideshows.length === 0) return;

    slideshows.forEach((root) => {
      const slides = Array.from(root.querySelectorAll("[data-slide]"));
      if (slides.length <= 1) return;

      let index = slides.findIndex((s) => s.classList.contains("is-active"));
      if (index < 0) index = 0;

      const intervalMs = Number(root.getAttribute("data-interval")) || 4500;
      const pauseOnHover = root.getAttribute("data-pause") !== "false";
      const dots = root.querySelector("[data-dots]");
      let timer = 0;

      function setActive(nextIndex) {
        const clamped = ((nextIndex % slides.length) + slides.length) % slides.length;
        slides.forEach((s, i) => s.classList.toggle("is-active", i === clamped));
        index = clamped;

        if (dots) {
          const items = Array.from(dots.querySelectorAll("button"));
          items.forEach((b, i) => b.setAttribute("aria-current", i === index ? "true" : "false"));
        }
      }

      function next() {
        setActive(index + 1);
      }

      function start() {
        if (reduceMotion) return;
        stop();
        timer = window.setInterval(next, intervalMs);
      }

      function stop() {
        if (!timer) return;
        window.clearInterval(timer);
        timer = 0;
      }

      if (dots) {
        dots.innerHTML = "";
        slides.forEach((_, i) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "slideshow-dot";
          b.setAttribute("aria-label", `Go to slide ${i + 1}`);
          b.setAttribute("aria-current", i === index ? "true" : "false");
          b.addEventListener("click", () => {
            setActive(i);
            start();
          });
          dots.appendChild(b);
        });
      }

      setActive(index);
      start();

      if (pauseOnHover) {
        root.addEventListener("mouseenter", stop);
        root.addEventListener("mouseleave", start);
        root.addEventListener("focusin", stop);
        root.addEventListener("focusout", start);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initMagnetic();
    initSlideshows();
  });
})();

