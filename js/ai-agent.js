(() => {
  const STORAGE_KEY = "l44_ai_assistant_v1";
  const API_URL = "/api/assistant/chat";

  function isFileProtocol() {
    return window.location.protocol === "file:";
  }

  function safeText(value) {
    return value === null || value === undefined ? "" : String(value);
  }

  function clampText(value, maxLen) {
    const s = safeText(value);
    return s.length > maxLen ? s.slice(0, maxLen) : s;
  }

  function loadConversation() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((m) => m && typeof m === "object")
        .map((m) => ({ role: safeText(m.role), content: safeText(m.content) }))
        .filter((m) => (m.role === "user" || m.role === "assistant") && m.content.trim())
        .slice(-24);
    } catch {
      return [];
    }
  }

  function saveConversation(messages) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-24)));
    } catch {
      // ignore
    }
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.entries(attrs).forEach(([k, v]) => {
        if (v === null || v === undefined) return;
        if (k === "class") node.className = String(v);
        else if (k === "text") node.textContent = String(v);
        else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, String(v));
      });
    }
    if (children) {
      children.forEach((child) => {
        if (child === null || child === undefined) return;
        node.appendChild(child);
      });
    }
    return node;
  }

  function scrollToBottom(container) {
    container.scrollTop = container.scrollHeight;
  }

  function addBubble(container, role, content, { pending = false } = {}) {
    const bubble = el("div", {
      class:
        "ai-agent__bubble " +
        (role === "user" ? "ai-agent__bubble--user" : "ai-agent__bubble--assistant") +
        (pending ? " ai-agent__bubble--pending" : ""),
    });
    bubble.textContent = content;
    container.appendChild(bubble);
    scrollToBottom(container);
    return bubble;
  }

  async function postChat({ message, history }) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const err = new Error(safeText(data?.error || `Request failed (${res.status})`));
      err.status = res.status;
      throw err;
    }

    return safeText(data?.reply).trim();
  }

  function init() {
    const root = el("div", { class: "ai-agent", id: "ai-agent" });

    const title = el("div", { class: "ai-agent__title", text: "AI Concierge" });
    const subtitle = el("div", { class: "ai-agent__subtitle", text: "Ask about menu, events, or bookings." });

    const closeBtn = el("button", {
      class: "ai-agent__icon-btn",
      type: "button",
      "aria-label": "Close assistant",
    });
    closeBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18"></path><path d="M6 6l12 12"></path></svg>';

    const headerLeft = el("div", { class: "ai-agent__header-left" }, [title, subtitle]);
    const header = el("div", { class: "ai-agent__header" }, [headerLeft, closeBtn]);

    const messages = el("div", {
      class: "ai-agent__messages",
      role: "log",
      "aria-live": "polite",
      "aria-relevant": "additions",
    });

    const input = el("input", {
      class: "ai-agent__input",
      type: "text",
      autocomplete: "off",
      placeholder: "Type a message…",
      maxlength: "2000",
      "aria-label": "Message",
    });

    const sendBtn = el("button", { class: "ai-agent__send", type: "submit" }, [
      el("span", { text: "Send" }),
    ]);

    const form = el("form", { class: "ai-agent__footer" }, [input, sendBtn]);

    const panel = el("div", {
      class: "ai-agent__panel",
      role: "dialog",
      "aria-label": "AI Concierge chat",
      "aria-modal": "false",
    });
    panel.appendChild(header);
    panel.appendChild(messages);
    panel.appendChild(form);

    const fab = el("button", {
      class: "ai-agent__fab",
      type: "button",
      "aria-haspopup": "dialog",
      "aria-expanded": "false",
      "aria-controls": "ai-agent-panel",
    });
    fab.innerHTML =
      '<span class="ai-agent__fab-dot" aria-hidden="true"></span><span class="ai-agent__fab-text">AI</span>';

    panel.id = "ai-agent-panel";

    root.appendChild(panel);
    root.appendChild(fab);
    document.body.appendChild(root);

    let conversation = loadConversation();
    conversation.forEach((m) => addBubble(messages, m.role, m.content));
    if (conversation.length === 0) {
      addBubble(
        messages,
        "assistant",
        "Hi! I’m the Lounge 44 concierge. Ask me about opening hours, tonight’s vibe, the menu, or how to reserve a table.",
      );
    }

    let isOpen = false;
    let sending = false;

    function setOpen(next) {
      isOpen = Boolean(next);
      root.classList.toggle("is-open", isOpen);
      fab.setAttribute("aria-expanded", isOpen ? "true" : "false");
      if (isOpen) {
        window.setTimeout(() => input.focus(), 50);
        scrollToBottom(messages);
      }
    }

    function toggle() {
      setOpen(!isOpen);
    }

    fab.addEventListener("click", toggle);
    closeBtn.addEventListener("click", () => setOpen(false));

    window.addEventListener("keydown", (e) => {
      if (!isOpen) return;
      if (e.key === "Escape") setOpen(false);
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (sending) return;

      const text = input.value.trim();
      if (!text) return;

      input.value = "";
      setOpen(true);

      const priorHistory = conversation.slice(-12);
      conversation = [...conversation, { role: "user", content: text }];
      saveConversation(conversation);
      addBubble(messages, "user", text);

      const pendingBubble = addBubble(messages, "assistant", "Thinking…", { pending: true });

      if (isFileProtocol()) {
        pendingBubble.classList.remove("ai-agent__bubble--pending");
        pendingBubble.textContent = "To use the AI concierge, run the CMS server and open the site at http://localhost:3000/.";
        conversation = [...conversation, { role: "assistant", content: pendingBubble.textContent }];
        saveConversation(conversation);
        return;
      }

      sending = true;
      sendBtn.disabled = true;
      input.disabled = true;

      try {
        const reply = await postChat({ message: clampText(text, 2000), history: priorHistory });
        pendingBubble.classList.remove("ai-agent__bubble--pending");
        pendingBubble.textContent = reply || "Sorry — I couldn’t generate a response right now.";

        conversation = [...conversation, { role: "assistant", content: pendingBubble.textContent }];
        saveConversation(conversation);
      } catch (err) {
        const status = Number(err?.status || 0);
        pendingBubble.classList.remove("ai-agent__bubble--pending");
        if (status === 503) {
          pendingBubble.textContent =
            "AI isn’t configured yet. Add OPENAI_API_KEY to your .env file, restart the CMS server, then try again.";
        } else if (status === 429) {
          pendingBubble.textContent = "Too many requests right now. Please wait a moment and try again.";
        } else {
          pendingBubble.textContent = "Sorry — the AI concierge is unavailable right now. Please try again shortly.";
        }

        conversation = [...conversation, { role: "assistant", content: pendingBubble.textContent }];
        saveConversation(conversation);
      } finally {
        sending = false;
        sendBtn.disabled = false;
        input.disabled = false;
        input.focus();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

