const state = {
  user: null,
  content: { settings: {}, menu: [], events: [], gallery: [] },
  reservations: [],
};

function el(id) {
  return document.getElementById(id);
}

function isFileProtocol() {
  return window.location.protocol === "file:";
}

function setHidden(element, hidden) {
  if (!element) return;
  element.classList.toggle("hidden", Boolean(hidden));
}

function setText(element, text) {
  if (!element) return;
  element.textContent = text ?? "";
}

function setStatus(element, message, kind = "info") {
  if (!element) return;
  element.textContent = message ?? "";
  const base = "text-sm";
  const kindClass =
    kind === "success"
      ? "text-success"
      : kind === "error"
        ? "text-error"
        : kind === "warning"
          ? "text-warning"
          : "text-text-secondary";
  element.className = `${base} ${kindClass}`;
}

async function apiRequest(method, url, body) {
  const options = {
    method,
    credentials: "include",
    headers: {},
  };

  if (body instanceof FormData) {
    options.body = body;
  } else if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const msg = data?.error || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

function formatMoney(currency, amount) {
  if (amount === null || amount === undefined || amount === "") return "—";
  const n = Number(amount);
  if (!Number.isFinite(n)) return String(amount);
  const curr = currency || "UGX";
  return `${curr} ${n.toLocaleString()}`;
}

function normalizeTags(tagsText) {
  if (!tagsText) return [];
  return String(tagsText)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function selectView(name) {
  document.querySelectorAll(".cms-view").forEach((node) => node.classList.add("hidden"));
  el(`view-${name}`)?.classList.remove("hidden");

  document.querySelectorAll(".cms-nav").forEach((btn) => {
    const active = btn.dataset.view === name;
    btn.classList.toggle("bg-surface-200", active);
    btn.classList.toggle("font-semibold", active);
  });
}

function fillSettingsForm() {
  const s = state.content.settings || {};
  el("settings-siteName").value = s.siteName || "";
  el("settings-currency").value = s.currency || "";
  el("settings-contactPhone").value = s.contactPhone || "";
  el("settings-contactEmail").value = s.contactEmail || "";
  el("settings-address").value = s.address || "";
  el("settings-openingHours").value = s.openingHours || "";
}

function renderDashboard() {
  const { menu, events, gallery } = state.content;
  setText(el("stat-menu"), Array.isArray(menu) ? String(menu.length) : "0");
  setText(el("stat-events"), Array.isArray(events) ? String(events.length) : "0");
  setText(el("stat-gallery"), Array.isArray(gallery) ? String(gallery.length) : "0");
  const newCount = (state.reservations || []).filter((r) => r.status === "new").length;
  setText(el("stat-reservations"), String(newCount));
}

function renderMenuList() {
  const list = el("menu-list");
  if (!list) return;

  const currency = state.content.settings?.currency || "UGX";
  const query = (el("menu-search")?.value || "").trim().toLowerCase();

  const items = (state.content.menu || []).filter((item) => {
    if (!query) return true;
    return (
      String(item.name || "").toLowerCase().includes(query) ||
      String(item.category || "").toLowerCase().includes(query) ||
      (Array.isArray(item.tags) ? item.tags.join(",").toLowerCase().includes(query) : false)
    );
  });

  if (items.length === 0) {
    list.innerHTML = `<div class="text-sm text-text-secondary">No menu items yet.</div>`;
    return;
  }

  list.innerHTML = items
    .map((item) => {
      const price = formatMoney(currency, item.price);
      const tags = Array.isArray(item.tags) && item.tags.length ? ` • ${item.tags.join(", ")}` : "";
      const featured = item.featured ? ` <span class="text-xs text-secondary font-semibold">Featured</span>` : "";
      return `
        <div class="p-4 rounded-xl border border-surface-300 bg-surface-50">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="font-semibold text-text-primary truncate">${escapeHtml(item.name || "")}${featured}</div>
              <div class="text-sm text-text-secondary truncate">${escapeHtml(item.category || "General")} • ${escapeHtml(price)}${escapeHtml(tags)}</div>
            </div>
            <div class="flex gap-2 flex-shrink-0">
              <button class="btn-outline text-sm px-3 py-2" data-action="menu-edit" data-id="${escapeHtml(item.id)}">Edit</button>
              <button class="btn-outline text-sm px-3 py-2 border-red-600 text-red-600" data-action="menu-delete" data-id="${escapeHtml(item.id)}">Delete</button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderEventsList() {
  const list = el("events-list");
  if (!list) return;

  const currency = state.content.settings?.currency || "UGX";
  const query = (el("events-search")?.value || "").trim().toLowerCase();

  const items = (state.content.events || []).filter((item) => {
    if (!query) return true;
    return (
      String(item.title || "").toLowerCase().includes(query) ||
      String(item.category || "").toLowerCase().includes(query) ||
      String(item.date || "").toLowerCase().includes(query)
    );
  });

  if (items.length === 0) {
    list.innerHTML = `<div class="text-sm text-text-secondary">No events yet.</div>`;
    return;
  }

  list.innerHTML = items
    .map((item) => {
      const price = item.price === null || item.price === undefined ? "—" : formatMoney(currency, item.price);
      const featured = item.featured ? ` <span class="text-xs text-secondary font-semibold">Featured</span>` : "";
      const when = [item.date, item.time].filter(Boolean).join(" ");
      return `
        <div class="p-4 rounded-xl border border-surface-300 bg-surface-50">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="font-semibold text-text-primary truncate">${escapeHtml(item.title || "")}${featured}</div>
              <div class="text-sm text-text-secondary truncate">${escapeHtml(item.category || "General")} • ${escapeHtml(when || "—")} • ${escapeHtml(price)}</div>
            </div>
            <div class="flex gap-2 flex-shrink-0">
              <button class="btn-outline text-sm px-3 py-2" data-action="events-edit" data-id="${escapeHtml(item.id)}">Edit</button>
              <button class="btn-outline text-sm px-3 py-2 border-red-600 text-red-600" data-action="events-delete" data-id="${escapeHtml(item.id)}">Delete</button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderGalleryList() {
  const list = el("gallery-list");
  if (!list) return;

  const query = (el("gallery-search")?.value || "").trim().toLowerCase();

  const items = (state.content.gallery || []).filter((item) => {
    if (!query) return true;
    return (
      String(item.title || "").toLowerCase().includes(query) ||
      String(item.subtitle || "").toLowerCase().includes(query) ||
      String(item.category || "").toLowerCase().includes(query)
    );
  });

  if (items.length === 0) {
    list.innerHTML = `<div class="text-sm text-text-secondary">No gallery items yet.</div>`;
    return;
  }

  list.innerHTML = items
    .map((item) => {
      const subtitle = item.subtitle ? ` • ${item.subtitle}` : "";
      return `
        <div class="p-4 rounded-xl border border-surface-300 bg-surface-50">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="font-semibold text-text-primary truncate">${escapeHtml(item.title || "")}</div>
              <div class="text-sm text-text-secondary truncate">${escapeHtml(item.category || "dining")}${escapeHtml(subtitle)}</div>
              <div class="text-xs text-text-tertiary truncate mt-1">${escapeHtml(item.imageUrl || "")}</div>
            </div>
            <div class="flex gap-2 flex-shrink-0">
              <button class="btn-outline text-sm px-3 py-2" data-action="gallery-edit" data-id="${escapeHtml(item.id)}">Edit</button>
              <button class="btn-outline text-sm px-3 py-2 border-red-600 text-red-600" data-action="gallery-delete" data-id="${escapeHtml(item.id)}">Delete</button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderReservationsList() {
  const list = el("reservations-list");
  if (!list) return;

  const items = Array.isArray(state.reservations) ? state.reservations : [];
  if (items.length === 0) {
    list.innerHTML = `<div class="text-sm text-text-secondary">No reservations yet.</div>`;
    return;
  }

  list.innerHTML = items
    .map((r) => {
      const when = [r.date, r.time].filter(Boolean).join(" ");
      const party = r.partySize ? ` • Party: ${r.partySize}` : "";
      const area = r.area ? ` • Area: ${r.area}` : "";
      const email = r.email ? `<div class="text-sm text-text-secondary">${escapeHtml(r.email)}</div>` : "";
      const requests = r.requests ? `<div class="text-sm text-text-secondary mt-2">${escapeHtml(r.requests)}</div>` : "";

      return `
        <div class="p-4 rounded-xl border border-surface-300 bg-surface-50">
          <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div class="min-w-0">
              <div class="font-semibold text-text-primary truncate">${escapeHtml(r.name || "Reservation")}</div>
              <div class="text-sm text-text-secondary">${escapeHtml(r.phone || "")}</div>
              ${email}
              <div class="text-sm text-text-secondary mt-1">${escapeHtml(when || "—")}${escapeHtml(party)}${escapeHtml(area)}</div>
              ${requests}
              <div class="text-xs text-text-tertiary mt-2">Created: ${escapeHtml(r.createdAt || "")}</div>
            </div>
            <div class="flex items-center gap-3 flex-shrink-0">
              <select class="input-field" data-action="reservation-status" data-id="${escapeHtml(r.id)}" style="min-width: 170px;">
                ${["new", "confirmed", "cancelled", "completed"]
                  .map((s) => `<option value="${s}" ${r.status === s ? "selected" : ""}>${s}</option>`)
                  .join("")}
              </select>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resetMenuForm() {
  el("menu-id").value = "";
  el("menu-name").value = "";
  el("menu-category").value = "";
  el("menu-description").value = "";
  el("menu-price").value = "";
  el("menu-tags").value = "";
  el("menu-imageUrl").value = "";
  el("menu-featured").checked = false;
  setHidden(el("menu-delete-btn"), true);
}

function resetEventsForm() {
  el("events-id").value = "";
  el("events-title").value = "";
  el("events-category").value = "";
  el("events-description").value = "";
  el("events-date").value = "";
  el("events-time").value = "";
  el("events-price").value = "";
  el("events-imageUrl").value = "";
  el("events-featured").checked = false;
  setHidden(el("events-delete-btn"), true);
}

function resetGalleryForm() {
  el("gallery-id").value = "";
  el("gallery-title").value = "";
  el("gallery-subtitle").value = "";
  el("gallery-category").value = "dining";
  el("gallery-imageUrl").value = "";
  setHidden(el("gallery-delete-btn"), true);
}

async function refreshAll() {
  setStatus(el("dashboard-status"), "Refreshing…");
  try {
    const content = await apiRequest("GET", "/api/content");
    state.content = content || state.content;
    fillSettingsForm();

    try {
      state.reservations = await apiRequest("GET", "/api/reservations");
    } catch (err) {
      if (err.status === 401) {
        state.reservations = [];
      } else {
        throw err;
      }
    }

    renderDashboard();
    renderMenuList();
    renderEventsList();
    renderGalleryList();
    renderReservationsList();
    setStatus(el("dashboard-status"), "Up to date.", "success");
  } catch (err) {
    setStatus(el("dashboard-status"), err.message || "Failed to refresh.", "error");
  }
}

async function initAuthedUI(user) {
  state.user = user;

  setHidden(el("login-view"), true);
  setHidden(el("app-view"), false);

  setHidden(el("topbar-user"), false);
  el("topbar-user").classList.add("flex");

  setText(el("topbar-username"), user.username);
  setText(el("sidebar-username"), user.username);
  setText(el("api-origin"), isFileProtocol() ? "(run the CMS server to use admin)" : window.location.origin);

  selectView("dashboard");
  await refreshAll();
}

async function init() {
  if (isFileProtocol()) {
    setStatus(el("login-status"), "This admin needs the CMS server running (open via http://localhost:3000/admin/).", "warning");
    return;
  }

  // Nav
  document.querySelectorAll(".cms-nav").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectView(btn.dataset.view);
    });
  });

  el("refresh-btn")?.addEventListener("click", refreshAll);
  el("reservations-refresh-btn")?.addEventListener("click", refreshAll);

  // Login
  el("login-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus(el("login-status"), "Signing in…");
    try {
      const username = el("login-username").value.trim();
      const password = el("login-password").value;
      const data = await apiRequest("POST", "/api/auth/login", { username, password });
      setStatus(el("login-status"), "", "success");
      await initAuthedUI(data.user);
    } catch (err) {
      setStatus(el("login-status"), err.message || "Login failed.", "error");
    }
  });

  // Logout
  el("logout-btn")?.addEventListener("click", async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch {
      // ignore
    }
    window.location.reload();
  });

  // Settings
  el("settings-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus(el("settings-status"), "Saving…");
    try {
      const settings = {
        siteName: el("settings-siteName").value.trim(),
        currency: el("settings-currency").value.trim(),
        contactPhone: el("settings-contactPhone").value.trim(),
        contactEmail: el("settings-contactEmail").value.trim(),
        address: el("settings-address").value.trim(),
        openingHours: el("settings-openingHours").value.trim(),
      };
      const saved = await apiRequest("PUT", "/api/settings", { settings });
      state.content.settings = saved;
      setStatus(el("settings-status"), "Saved.", "success");
    } catch (err) {
      setStatus(el("settings-status"), err.message || "Failed to save.", "error");
    }
  });

  // Uploads
  el("upload-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setHidden(el("upload-result"), true);
    setStatus(el("upload-status"), "Uploading…");
    try {
      const input = el("upload-file");
      const file = input?.files?.[0];
      if (!file) throw new Error("Please select a file.");

      const fd = new FormData();
      fd.append("file", file);
      const data = await apiRequest("POST", "/api/uploads", fd);

      setText(el("upload-url"), data.url);
      el("open-upload-url").href = data.url;
      setHidden(el("upload-result"), false);
      setStatus(el("upload-status"), "Uploaded.", "success");
      input.value = "";
    } catch (err) {
      setStatus(el("upload-status"), err.message || "Upload failed.", "error");
    }
  });

  el("copy-upload-url")?.addEventListener("click", async () => {
    const url = el("upload-url").textContent || "";
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Ignore clipboard failures
    }
  });

  // Menu form
  el("menu-new-btn")?.addEventListener("click", () => {
    resetMenuForm();
    setStatus(el("menu-status"), "");
  });

  el("menu-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus(el("menu-status"), "Saving…");
    try {
      const id = el("menu-id").value || null;
      const payload = {
        name: el("menu-name").value.trim(),
        category: el("menu-category").value.trim(),
        description: el("menu-description").value.trim(),
        price: el("menu-price").value.trim(),
        tags: normalizeTags(el("menu-tags").value),
        imageUrl: el("menu-imageUrl").value.trim(),
        featured: el("menu-featured").checked,
      };
      if (id) {
        await apiRequest("PUT", `/api/menu/${encodeURIComponent(id)}`, payload);
      } else {
        await apiRequest("POST", "/api/menu", payload);
      }
      setStatus(el("menu-status"), "Saved.", "success");
      resetMenuForm();
      await refreshAll();
    } catch (err) {
      setStatus(el("menu-status"), err.message || "Failed to save.", "error");
    }
  });

  el("menu-delete-btn")?.addEventListener("click", async () => {
    const id = el("menu-id").value || null;
    if (!id) return;
    if (!window.confirm("Delete this menu item?")) return;
    setStatus(el("menu-status"), "Deleting…");
    try {
      await apiRequest("DELETE", `/api/menu/${encodeURIComponent(id)}`);
      setStatus(el("menu-status"), "Deleted.", "success");
      resetMenuForm();
      await refreshAll();
    } catch (err) {
      setStatus(el("menu-status"), err.message || "Failed to delete.", "error");
    }
  });

  el("menu-search")?.addEventListener("input", renderMenuList);

  // Events form
  el("events-new-btn")?.addEventListener("click", () => {
    resetEventsForm();
    setStatus(el("events-status"), "");
  });

  el("events-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus(el("events-status"), "Saving…");
    try {
      const id = el("events-id").value || null;
      const payload = {
        title: el("events-title").value.trim(),
        category: el("events-category").value.trim(),
        description: el("events-description").value.trim(),
        date: el("events-date").value,
        time: el("events-time").value.trim(),
        price: el("events-price").value.trim(),
        imageUrl: el("events-imageUrl").value.trim(),
        featured: el("events-featured").checked,
      };
      if (id) {
        await apiRequest("PUT", `/api/events/${encodeURIComponent(id)}`, payload);
      } else {
        await apiRequest("POST", "/api/events", payload);
      }
      setStatus(el("events-status"), "Saved.", "success");
      resetEventsForm();
      await refreshAll();
    } catch (err) {
      setStatus(el("events-status"), err.message || "Failed to save.", "error");
    }
  });

  el("events-delete-btn")?.addEventListener("click", async () => {
    const id = el("events-id").value || null;
    if (!id) return;
    if (!window.confirm("Delete this event?")) return;
    setStatus(el("events-status"), "Deleting…");
    try {
      await apiRequest("DELETE", `/api/events/${encodeURIComponent(id)}`);
      setStatus(el("events-status"), "Deleted.", "success");
      resetEventsForm();
      await refreshAll();
    } catch (err) {
      setStatus(el("events-status"), err.message || "Failed to delete.", "error");
    }
  });

  el("events-search")?.addEventListener("input", renderEventsList);

  // Gallery form
  el("gallery-new-btn")?.addEventListener("click", () => {
    resetGalleryForm();
    setStatus(el("gallery-status"), "");
  });

  el("gallery-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus(el("gallery-status"), "Saving…");
    try {
      const id = el("gallery-id").value || null;
      const payload = {
        title: el("gallery-title").value.trim(),
        subtitle: el("gallery-subtitle").value.trim(),
        category: el("gallery-category").value,
        imageUrl: el("gallery-imageUrl").value.trim(),
      };
      if (id) {
        await apiRequest("PUT", `/api/gallery/${encodeURIComponent(id)}`, payload);
      } else {
        await apiRequest("POST", "/api/gallery", payload);
      }
      setStatus(el("gallery-status"), "Saved.", "success");
      resetGalleryForm();
      await refreshAll();
    } catch (err) {
      setStatus(el("gallery-status"), err.message || "Failed to save.", "error");
    }
  });

  el("gallery-delete-btn")?.addEventListener("click", async () => {
    const id = el("gallery-id").value || null;
    if (!id) return;
    if (!window.confirm("Delete this gallery item?")) return;
    setStatus(el("gallery-status"), "Deleting…");
    try {
      await apiRequest("DELETE", `/api/gallery/${encodeURIComponent(id)}`);
      setStatus(el("gallery-status"), "Deleted.", "success");
      resetGalleryForm();
      await refreshAll();
    } catch (err) {
      setStatus(el("gallery-status"), err.message || "Failed to delete.", "error");
    }
  });

  el("gallery-search")?.addEventListener("input", renderGalleryList);

  // Delegated list actions
  document.addEventListener("click", async (e) => {
    const btn = e.target?.closest?.("button[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (!action || !id) return;

    if (action === "menu-edit") {
      const item = (state.content.menu || []).find((m) => m.id === id);
      if (!item) return;
      el("menu-id").value = item.id || "";
      el("menu-name").value = item.name || "";
      el("menu-category").value = item.category || "";
      el("menu-description").value = item.description || "";
      el("menu-price").value = item.price ?? "";
      el("menu-tags").value = Array.isArray(item.tags) ? item.tags.join(", ") : "";
      el("menu-imageUrl").value = item.imageUrl || "";
      el("menu-featured").checked = Boolean(item.featured);
      setHidden(el("menu-delete-btn"), false);
      setStatus(el("menu-status"), "Editing item…");
      selectView("menu");
      el("menu-name")?.focus();
      return;
    }

    if (action === "menu-delete") {
      if (!window.confirm("Delete this menu item?")) return;
      try {
        await apiRequest("DELETE", `/api/menu/${encodeURIComponent(id)}`);
        await refreshAll();
      } catch (err) {
        setStatus(el("menu-status"), err.message || "Failed to delete.", "error");
      }
      return;
    }

    if (action === "events-edit") {
      const item = (state.content.events || []).find((ev) => ev.id === id);
      if (!item) return;
      el("events-id").value = item.id || "";
      el("events-title").value = item.title || "";
      el("events-category").value = item.category || "";
      el("events-description").value = item.description || "";
      el("events-date").value = item.date || "";
      el("events-time").value = item.time || "";
      el("events-price").value = item.price ?? "";
      el("events-imageUrl").value = item.imageUrl || "";
      el("events-featured").checked = Boolean(item.featured);
      setHidden(el("events-delete-btn"), false);
      setStatus(el("events-status"), "Editing event…");
      selectView("events");
      el("events-title")?.focus();
      return;
    }

    if (action === "events-delete") {
      if (!window.confirm("Delete this event?")) return;
      try {
        await apiRequest("DELETE", `/api/events/${encodeURIComponent(id)}`);
        await refreshAll();
      } catch (err) {
        setStatus(el("events-status"), err.message || "Failed to delete.", "error");
      }
      return;
    }

    if (action === "gallery-edit") {
      const item = (state.content.gallery || []).find((g) => g.id === id);
      if (!item) return;
      el("gallery-id").value = item.id || "";
      el("gallery-title").value = item.title || "";
      el("gallery-subtitle").value = item.subtitle || "";
      el("gallery-category").value = item.category || "dining";
      el("gallery-imageUrl").value = item.imageUrl || "";
      setHidden(el("gallery-delete-btn"), false);
      setStatus(el("gallery-status"), "Editing item…");
      selectView("gallery");
      el("gallery-title")?.focus();
      return;
    }

    if (action === "gallery-delete") {
      if (!window.confirm("Delete this gallery item?")) return;
      try {
        await apiRequest("DELETE", `/api/gallery/${encodeURIComponent(id)}`);
        await refreshAll();
      } catch (err) {
        setStatus(el("gallery-status"), err.message || "Failed to delete.", "error");
      }
    }
  });

  document.addEventListener("change", async (e) => {
    const select = e.target?.closest?.("select[data-action='reservation-status']");
    if (!select) return;
    const id = select.dataset.id;
    const status = select.value;
    if (!id) return;
    try {
      await apiRequest("PATCH", `/api/reservations/${encodeURIComponent(id)}`, { status });
      setStatus(el("reservations-status"), "Reservation updated.", "success");
    } catch (err) {
      setStatus(el("reservations-status"), err.message || "Failed to update.", "error");
    }
  });

  // Password change
  el("password-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus(el("password-status"), "Updating…");
    try {
      const currentPassword = el("pw-current").value;
      const newPassword = el("pw-new").value;
      await apiRequest("POST", "/api/users/me/password", { currentPassword, newPassword });
      el("pw-current").value = "";
      el("pw-new").value = "";
      setStatus(el("password-status"), "Password updated.", "success");
    } catch (err) {
      setStatus(el("password-status"), err.message || "Failed to update password.", "error");
    }
  });

  // Boot: check existing session
  try {
    const me = await apiRequest("GET", "/api/auth/me");
    await initAuthedUI(me.user);
  } catch {
    // Not logged in; stay on login view.
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

