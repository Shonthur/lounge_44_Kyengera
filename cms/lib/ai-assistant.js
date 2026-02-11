const https = require("https");

function safeText(value) {
  return value === null || value === undefined ? "" : String(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function clampString(value, maxLen) {
  const s = safeText(value);
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function sanitizeHistory(input) {
  if (!Array.isArray(input)) return [];
  const allowed = new Set(["user", "assistant"]);

  return input
    .filter((m) => m && typeof m === "object")
    .map((m) => ({
      role: safeText(m.role).trim().toLowerCase(),
      content: safeText(m.content),
    }))
    .filter((m) => allowed.has(m.role) && isNonEmptyString(m.content))
    .slice(-12)
    .map((m) => ({ role: m.role, content: clampString(m.content.trim(), 1200) }));
}

function buildSiteDataForPrompt(siteData) {
  const settings = siteData?.settings && typeof siteData.settings === "object" ? siteData.settings : {};
  const menu = Array.isArray(siteData?.menu) ? siteData.menu : [];
  const events = Array.isArray(siteData?.events) ? siteData.events : [];

  const menuSlim = menu.slice(0, 50).map((m) => ({
    name: safeText(m?.name).trim(),
    description: clampString(safeText(m?.description).trim(), 160),
    price: m?.price ?? null,
    category: safeText(m?.category).trim(),
    tags: Array.isArray(m?.tags) ? m.tags.slice(0, 8).map((t) => safeText(t).trim()).filter(Boolean) : [],
    featured: Boolean(m?.featured),
  }));

  const eventsSlim = events.slice(0, 25).map((e) => ({
    title: safeText(e?.title).trim(),
    date: safeText(e?.date).trim(),
    time: safeText(e?.time).trim(),
    description: clampString(safeText(e?.description).trim(), 220),
    price: e?.price ?? null,
    category: safeText(e?.category).trim(),
    featured: Boolean(e?.featured),
  }));

  return {
    settings: {
      siteName: safeText(settings?.siteName).trim(),
      currency: safeText(settings?.currency).trim(),
      contactPhone: safeText(settings?.contactPhone).trim(),
      contactEmail: safeText(settings?.contactEmail).trim(),
      address: safeText(settings?.address).trim(),
      openingHours: safeText(settings?.openingHours).trim(),
    },
    menu: menuSlim.filter((m) => m.name),
    events: eventsSlim.filter((e) => e.title || e.date),
  };
}

function buildSystemPrompt(siteDataSlim) {
  const name = siteDataSlim?.settings?.siteName || "Lounge 44";
  const currency = siteDataSlim?.settings?.currency || "UGX";

  return (
    `You are ${name}'s AI concierge on the official website.\n` +
    `Goals: help visitors with reservations, opening hours, directions, menu highlights, and events.\n\n` +
    `Rules:\n` +
    `- Use only the SITE_DATA below for facts. If it's not in SITE_DATA, say you don't know and suggest contacting the venue.\n` +
    `- Be concise, warm, and professional. Prefer 2-6 short sentences.\n` +
    `- Never ask for or store sensitive information (payment details, passwords, etc.).\n` +
    `- If the user wants to book, guide them to the Reservations page and/or provide phone/email from SITE_DATA.\n` +
    `- Prices are in ${currency} unless stated otherwise.\n\n` +
    `SITE_DATA (JSON):\n${JSON.stringify(siteDataSlim)}`
  );
}

function postJson(url, headers, data, timeoutMs) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(JSON.stringify(data), "utf8");
    const u = new URL(url);

    const req = https.request(
      {
        method: "POST",
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || 443,
        path: `${u.pathname}${u.search}`,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Content-Length": payload.length,
          ...headers,
        },
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => resolve({ status: res.statusCode || 0, raw }));
      },
    );

    req.on("error", reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error("Request timed out")));
    req.write(payload);
    req.end();
  });
}

async function getAssistantReply({ message, history, siteData }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!isNonEmptyString(apiKey)) {
    const err = new Error("OPENAI_API_KEY is not set");
    err.code = "AI_NOT_CONFIGURED";
    throw err;
  }

  const baseUrl = isNonEmptyString(process.env.OPENAI_BASE_URL)
    ? process.env.OPENAI_BASE_URL.trim().replace(/\/+$/, "")
    : "https://api.openai.com";

  const model = isNonEmptyString(process.env.OPENAI_MODEL) ? process.env.OPENAI_MODEL.trim() : "gpt-4o-mini";
  const timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS || 20000);
  const maxTokens = Number(process.env.OPENAI_MAX_TOKENS || 300);
  const temperature = Number(process.env.OPENAI_TEMPERATURE || 0.4);

  const siteDataSlim = buildSiteDataForPrompt(siteData);
  const systemPrompt = buildSystemPrompt(siteDataSlim);

  const messages = [
    { role: "system", content: systemPrompt },
    ...sanitizeHistory(history),
    { role: "user", content: clampString(safeText(message).trim(), 2000) },
  ];

  const { status, raw } = await postJson(
    `${baseUrl}/v1/chat/completions`,
    { Authorization: `Bearer ${apiKey}` },
    {
      model,
      messages,
      temperature: Number.isFinite(temperature) ? temperature : 0.4,
      max_tokens: Number.isFinite(maxTokens) ? Math.max(64, Math.min(800, maxTokens)) : 300,
    },
    Number.isFinite(timeoutMs) ? Math.max(2000, Math.min(60000, timeoutMs)) : 20000,
  );

  let parsed = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  if (status < 200 || status >= 300) {
    const detail = safeText(parsed?.error?.message || parsed?.message || raw).slice(0, 300);
    const err = new Error(`OpenAI request failed (${status}): ${detail}`);
    err.code = "AI_UPSTREAM_ERROR";
    err.status = status;
    throw err;
  }

  const reply = safeText(parsed?.choices?.[0]?.message?.content).trim();
  if (!reply) {
    const err = new Error("Empty assistant response");
    err.code = "AI_EMPTY_RESPONSE";
    throw err;
  }

  return reply;
}

module.exports = {
  getAssistantReply,
  sanitizeHistory,
};

