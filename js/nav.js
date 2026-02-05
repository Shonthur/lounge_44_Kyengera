(() => {
  function getCurrentPageName() {
    const path = window.location.pathname || "";
    const parts = path.split("/").filter(Boolean);
    return (parts[parts.length - 1] || "").toLowerCase();
  }

  function pickActiveLinks(links) {
    const current = getCurrentPageName();
    if (!current) return [];

    return links.filter((a) => {
      const href = (a.getAttribute("href") || "").trim().toLowerCase();
      if (!href) return false;
      const hrefParts = href.split("/").filter(Boolean);
      const hrefName = hrefParts[hrefParts.length - 1] || "";
      return hrefName === current;
    });
  }

  function setActiveState(root) {
    const links = Array.from(root.querySelectorAll("a.nav-link"));
    if (links.length === 0) return;

    links.forEach((a) => {
      a.classList.remove("nav-link--active");
      a.removeAttribute("aria-current");
    });

    const active = pickActiveLinks(links);
    active.forEach((a) => {
      a.classList.add("nav-link--active");
      a.setAttribute("aria-current", "page");
    });
  }

  function setupMobileMenu(root) {
    const btn = root.querySelector("#mobile-menu-btn");
    const panel = root.querySelector("#mobile-menu");
    if (!btn || !panel) return;

    const panelLinks = Array.from(panel.querySelectorAll("a.nav-link"));
    panelLinks.forEach((a, idx) => a.style.setProperty("--i", String(idx)));

    function closeMenu() {
      panel.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
    }

    function openMenu() {
      panel.classList.add("is-open");
      btn.setAttribute("aria-expanded", "true");
    }

    btn.setAttribute("aria-controls", "mobile-menu");
    btn.setAttribute("aria-expanded", panel.classList.contains("is-open") ? "true" : "false");

    btn.addEventListener("click", () => {
      if (panel.classList.contains("is-open")) closeMenu();
      else openMenu();
    });

    panel.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("a")) closeMenu();
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth >= 1024) closeMenu();
    });
  }

  function setupDesktopIndicator(root) {
    const container = root.querySelector("[data-nav-desktop]");
    const indicator = root.querySelector("[data-nav-indicator]");
    if (!container || !indicator) return;

    const STORAGE_KEY = "l44_nav_indicator_v1";
    const transition = "transform 500ms cubic-bezier(0.19, 1, 0.22, 1), width 500ms cubic-bezier(0.19, 1, 0.22, 1), opacity 200ms ease-out";

    function getLinkRect(link) {
      const linkRect = link.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const left = linkRect.left - containerRect.left;
      const width = linkRect.width;
      return { left, width };
    }

    function setIndicator(rect, animate) {
      if (!rect) {
        indicator.style.opacity = "0";
        return;
      }

      indicator.style.transition = animate ? transition : "none";
      indicator.style.width = `${Math.max(0, rect.width)}px`;
      indicator.style.transform = `translateX(${rect.left}px) translateY(-50%)`;
      indicator.style.opacity = "1";
    }

    function getActiveDesktopLink() {
      return container.querySelector("a.nav-link.nav-link--active") || null;
    }

    function moveToLink(link, animate) {
      if (!link) return setIndicator(null, animate);
      setIndicator(getLinkRect(link), animate);
    }

    function saveRect(rect) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...rect, t: Date.now() }));
      } catch {
        // ignore
      }
    }

    function loadRect() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.left !== "number" || typeof parsed.width !== "number") return null;
        return { left: parsed.left, width: parsed.width };
      } catch {
        return null;
      }
    }

    function refresh(animate) {
      const active = getActiveDesktopLink();
      if (!active) return;
      moveToLink(active, animate);
    }

    // Initial: animate from the previous page's indicator position (stored in localStorage).
    const prev = loadRect();
    if (prev) setIndicator(prev, false);
    requestAnimationFrame(() => refresh(true));

    // Hover/focus indicator movement (feels premium).
    const links = Array.from(container.querySelectorAll("a.nav-link"));
    links.forEach((a) => {
      a.addEventListener("mouseenter", () => moveToLink(a, true));
      a.addEventListener("focus", () => moveToLink(a, true));
      a.addEventListener("click", () => saveRect(getLinkRect(a)));
    });

    container.addEventListener("mouseleave", () => refresh(true));
    container.addEventListener("focusout", () => refresh(true));

    window.addEventListener("resize", () => refresh(false));
  }

  document.addEventListener("DOMContentLoaded", () => {
    const nav = document.getElementById("main-nav");
    if (!nav) return;

    setActiveState(nav);
    setupMobileMenu(nav);
    setupDesktopIndicator(nav);
  });
})();
