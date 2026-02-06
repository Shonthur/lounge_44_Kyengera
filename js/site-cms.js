function isFileProtocol() {
  return window.location.protocol === "file:";
}

function safeText(value) {
  return value === null || value === undefined ? "" : String(value);
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

function formatMoney(currency, amount) {
  if (amount === null || amount === undefined || amount === "") return "";
  const n = Number(amount);
  if (!Number.isFinite(n)) return safeText(amount);
  const curr = currency || "UGX";
  return `${curr} ${n.toLocaleString()}`;
}

function formatEventDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(timeStr) {
  if (!timeStr) return "";
  const m = String(timeStr).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return timeStr;
  const hh = Number(m[1]);
  const mm = m[2];
  if (!Number.isFinite(hh)) return timeStr;
  const suffix = hh >= 12 ? "PM" : "AM";
  const hour = ((hh + 11) % 12) + 1;
  return `${hour}:${mm} ${suffix}`;
}

function normalizeGalleryCategory(value) {
  const allowed = new Set(["dining", "entertainment", "events", "celebrations"]);
  const v = safeText(value).trim().toLowerCase();
  return allowed.has(v) ? v : "dining";
}

function buildGalleryItem(item) {
  const category = normalizeGalleryCategory(item.category);
  const wrapper = document.createElement("div");
  wrapper.className = `gallery-item ${category} hover-lift`;
  wrapper.dataset.category = category;

  const inner = document.createElement("div");
  inner.className = "relative overflow-hidden rounded-xl aspect-square";

  const img = document.createElement("img");
  img.src = item.imageUrl || "";
  img.alt = item.title || "Gallery item";
  img.className = "w-full h-full object-cover transition-transform duration-500 hover:scale-110";
  img.loading = "lazy";
  inner.appendChild(img);

  const overlay = document.createElement("div");
  overlay.className =
    "absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300";

  const overlayText = document.createElement("div");
  overlayText.className = "absolute bottom-4 left-4 text-white";

  const h3 = document.createElement("h3");
  h3.className = "font-playfair text-xl font-semibold";
  h3.textContent = item.title || "";
  overlayText.appendChild(h3);

  if (item.subtitle) {
    const p = document.createElement("p");
    p.className = "text-sm opacity-90";
    p.textContent = item.subtitle;
    overlayText.appendChild(p);
  }

  overlay.appendChild(overlayText);
  inner.appendChild(overlay);
  wrapper.appendChild(inner);
  return wrapper;
}

function buildMenuCard(item, currency) {
  const card = document.createElement("div");
  card.className = "card hover-lift";

  const imgWrap = document.createElement("div");
  imgWrap.className = "aspect-video rounded-lg overflow-hidden mb-4";
  const img = document.createElement("img");
  img.src = item.imageUrl || "";
  img.alt = item.name || "Menu item";
  img.className = "w-full h-full object-cover";
  img.loading = "lazy";
  imgWrap.appendChild(img);
  card.appendChild(imgWrap);

  const h3 = document.createElement("h3");
  h3.className = "font-playfair text-xl font-bold text-primary mb-2";
  h3.textContent = item.name || "";
  card.appendChild(h3);

  if (item.description) {
    const p = document.createElement("p");
    p.className = "text-text-secondary text-sm mb-4";
    p.textContent = item.description;
    card.appendChild(p);
  }

  const bottom = document.createElement("div");
  bottom.className = "flex items-center justify-between";

  const price = document.createElement("span");
  price.className = "text-lg font-bold text-primary";
  price.textContent = formatMoney(currency, item.price) || "";
  bottom.appendChild(price);

  const btn = document.createElement("button");
  btn.className = "btn-primary text-sm px-3 py-1";
  btn.type = "button";
  btn.textContent = "Add";
  bottom.appendChild(btn);

  card.appendChild(bottom);
  return card;
}

function buildMenuFeaturedCard(item, currency) {
  const outer = document.createElement("div");
  outer.className = "card hover-lift";

  const wrap = document.createElement("div");
  wrap.className = "flex flex-col md:flex-row gap-6";

  const left = document.createElement("div");
  left.className = "md:w-1/2";
  const imgFrame = document.createElement("div");
  imgFrame.className = "aspect-golden rounded-lg overflow-hidden";
  const img = document.createElement("img");
  img.src = item.imageUrl || "";
  img.alt = item.name || "Featured item";
  img.className = "w-full h-full object-cover";
  img.loading = "lazy";
  imgFrame.appendChild(img);
  left.appendChild(imgFrame);

  const right = document.createElement("div");
  right.className = "md:w-1/2";

  const badgeRow = document.createElement("div");
  badgeRow.className = "flex items-center gap-2 mb-3";
  const badge = document.createElement("span");
  badge.className = "bg-secondary text-primary px-3 py-1 rounded-full text-sm font-semibold";
  badge.textContent = "Featured";
  badgeRow.appendChild(badge);
  right.appendChild(badgeRow);

  const h3 = document.createElement("h3");
  h3.className = "font-playfair text-2xl font-bold text-primary mb-3";
  h3.textContent = item.name || "";
  right.appendChild(h3);

  if (item.description) {
    const p = document.createElement("p");
    p.className = "text-text-secondary mb-4";
    p.textContent = item.description;
    right.appendChild(p);
  }

  const row = document.createElement("div");
  row.className = "flex items-center justify-between mb-4";
  const price = document.createElement("span");
  price.className = "text-2xl font-bold text-primary";
  price.textContent = formatMoney(currency, item.price) || "";
  row.appendChild(price);
  right.appendChild(row);

  const btnRow = document.createElement("div");
  btnRow.className = "flex gap-3";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn-primary flex-1";
  btn.textContent = "Add to Cart";
  btnRow.appendChild(btn);
  right.appendChild(btnRow);

  wrap.appendChild(left);
  wrap.appendChild(right);
  outer.appendChild(wrap);
  return outer;
}

function buildUpcomingEventCard(item, currency) {
  const card = document.createElement("div");
  card.className = "card hover-lift";

  const row = document.createElement("div");
  row.className = "flex space-x-4";

  const imgBox = document.createElement("div");
  imgBox.className = "w-20 h-20 rounded-lg overflow-hidden flex-shrink-0";
  const img = document.createElement("img");
  img.src = item.imageUrl || "";
  img.alt = item.title || "Event";
  img.className = "w-full h-full object-cover";
  img.loading = "lazy";
  imgBox.appendChild(img);
  row.appendChild(imgBox);

  const body = document.createElement("div");
  body.className = "flex-1 min-w-0";

  const top = document.createElement("div");
  top.className = "flex items-center justify-between mb-2";
  const date = document.createElement("span");
  date.className = "text-xs text-secondary font-semibold";
  date.textContent = formatEventDate(item.date) || "";
  const time = document.createElement("span");
  time.className = "text-xs text-text-secondary";
  time.textContent = formatTime(item.time) || "";
  top.appendChild(date);
  top.appendChild(time);
  body.appendChild(top);

  const title = document.createElement("h4");
  title.className = "font-semibold text-text-primary mb-1 truncate";
  title.textContent = item.title || "";
  body.appendChild(title);

  if (item.description) {
    const p = document.createElement("p");
    p.className = "text-sm text-text-secondary mb-2";
    p.textContent = item.description;
    body.appendChild(p);
  }

  const bottom = document.createElement("div");
  bottom.className = "flex items-center justify-between";
  const price = document.createElement("span");
  price.className = "text-sm font-bold text-primary";
  price.textContent = formatMoney(currency, item.price) || "";
  bottom.appendChild(price);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "magnetic text-xs text-primary hover:text-primary-700 font-semibold";
  btn.setAttribute("data-magnetic", "0.22");
  btn.textContent = "Book \u2192";
  bottom.appendChild(btn);
  body.appendChild(bottom);

  row.appendChild(body);
  card.appendChild(row);
  return card;
}

async function init() {
  if (isFileProtocol()) return;

  let content = null;
  try {
    content = await fetchJson("/api/content");
  } catch {
    content = null;
  }

  const settings = content?.settings || {};
  const currency = settings.currency || "UGX";

  // Menu page
  const cmsMenuRoot = document.getElementById("cms-menu-root");
  const cmsMenuFeatured = document.getElementById("cms-menu-featured");
  const cmsMenuGrid = document.getElementById("cms-menu-grid");
  const staticMenuRoot = document.getElementById("static-menu-root");
  if (content && cmsMenuRoot && cmsMenuGrid && Array.isArray(content.menu) && content.menu.length) {
    const featured = content.menu.filter((m) => m.featured);
    const others = content.menu.filter((m) => !m.featured);
    const featuredItems = featured.length ? featured.slice(0, 2) : content.menu.slice(0, 2);
    const featuredIds = new Set(featuredItems.map((item) => item.id));

    if (cmsMenuFeatured) {
      cmsMenuFeatured.innerHTML = "";
      featuredItems.forEach((item) => cmsMenuFeatured.appendChild(buildMenuFeaturedCard(item, currency)));
    }

    cmsMenuGrid.innerHTML = "";
    const gridItems = [...others, ...content.menu.filter((m) => m.featured)].filter((item) => !featuredIds.has(item.id));
    if (gridItems.length === 0) {
      cmsMenuGrid.innerHTML = `<div class="text-sm text-text-secondary">Add more menu items in the CMS to see them here.</div>`;
    } else {
      gridItems.slice(0, 60).forEach((item) => {
        cmsMenuGrid.appendChild(buildMenuCard(item, currency));
      });
    }

    cmsMenuRoot.classList.remove("hidden");
    staticMenuRoot?.classList.add("hidden");
  }

  // Gallery page
  const galleryGrid = document.getElementById("gallery-grid");
  if (content && galleryGrid && Array.isArray(content.gallery) && content.gallery.length) {
    galleryGrid.innerHTML = "";
    content.gallery.slice(0, 120).forEach((item) => galleryGrid.appendChild(buildGalleryItem(item)));
  }

  // Events page (upcoming list)
  const cmsUpcoming = document.getElementById("cms-upcoming-events");
  const staticUpcoming = document.getElementById("static-upcoming-events");
  if (content && cmsUpcoming && Array.isArray(content.events) && content.events.length) {
    cmsUpcoming.innerHTML = "";
    const sorted = [...content.events].sort((a, b) => safeText(a.date).localeCompare(safeText(b.date)));
    sorted.slice(0, 6).forEach((item) => cmsUpcoming.appendChild(buildUpcomingEventCard(item, currency)));
    cmsUpcoming.classList.remove("hidden");
    staticUpcoming?.classList.add("hidden");
  }

  // Reservations page (form submit)
  const reservationForm = document.getElementById("reservation-form");
  if (reservationForm) {
    reservationForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const status = document.getElementById("reservation-status");
      if (status) {
        status.textContent = "Submitting…";
        status.className = "text-sm text-text-secondary mt-3";
      }

      const terms = reservationForm.querySelector("#terms");
      if (terms && !terms.checked) {
        if (status) {
          status.textContent = "Please accept the cancellation policy to continue.";
          status.className = "text-sm text-warning mt-3";
        }
        return;
      }

      const fd = new FormData(reservationForm);
      const payload = {
        name: fd.get("name"),
        phone: fd.get("phone"),
        email: fd.get("email"),
        date: fd.get("date"),
        time: fd.get("time"),
        partySize: fd.get("partySize"),
        area: fd.get("area"),
        requests: fd.get("requests"),
      };

      try {
        const res = await fetch("/api/reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);

        reservationForm.reset();
        if (status) {
          status.textContent = "Thanks! Your reservation request was sent. We’ll confirm via SMS/WhatsApp shortly.";
          status.className = "text-sm text-success mt-3";
        }
      } catch (err) {
        if (status) {
          status.textContent = "Could not submit right now. Please call or WhatsApp us to confirm.";
          status.className = "text-sm text-warning mt-3";
        }
      }
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
