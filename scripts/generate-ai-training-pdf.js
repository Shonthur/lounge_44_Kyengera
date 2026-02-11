/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.join(__dirname, "..");
const DB_PATH = path.join(ROOT_DIR, "cms", "data", "db.json");
const OUT_MD = path.join(ROOT_DIR, "docs", "lounge44-ai-training.md");
const OUT_PDF = path.join(ROOT_DIR, "docs", "lounge44-ai-training.pdf");

function safeText(value) {
  return value === null || value === undefined ? "" : String(value);
}

function toAscii(input) {
  return safeText(input)
    .replace(/\u00a0/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function wrap(text, width) {
  const s = toAscii(text).trim();
  if (!s) return [""];

  const out = [];
  const words = s.split(/\s+/g);
  let line = "";
  words.forEach((w) => {
    if (!line) {
      line = w;
      return;
    }
    if ((line + " " + w).length <= width) {
      line += " " + w;
      return;
    }
    out.push(line);
    line = w;
  });
  if (line) out.push(line);
  return out;
}

function mdEscape(s) {
  return safeText(s).replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function mdText(value) {
  return mdEscape(toAscii(value));
}

function formatMoney(currency, amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return safeText(amount);
  const curr = currency || "UGX";
  return `${curr} ${n.toLocaleString()}`;
}

function formatEventDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return safeText(dateStr);
  return d.toISOString().slice(0, 10);
}

function buildTrainingData(db) {
  const settings = db?.settings && typeof db.settings === "object" ? db.settings : {};
  const currency = safeText(settings.currency || "UGX").trim() || "UGX";

  const menu = Array.isArray(db?.menu) ? db.menu : [];
  const events = Array.isArray(db?.events) ? db.events : [];
  const gallery = Array.isArray(db?.gallery) ? db.gallery : [];

  const website = extractWebsiteDetails();

  return {
    generatedAt: new Date().toISOString(),
    settings: {
      siteName: safeText(settings.siteName || "Lounge 44").trim() || "Lounge 44",
      currency,
      contactPhone: safeText(settings.contactPhone || "").trim(),
      contactEmail: safeText(settings.contactEmail || "").trim(),
      address: safeText(settings.address || "").trim(),
      openingHours: safeText(settings.openingHours || "").trim(),
    },
    menu: menu.map((m) => ({
      name: safeText(m?.name).trim(),
      description: safeText(m?.description).trim(),
      price: m?.price ?? null,
      category: safeText(m?.category).trim(),
      tags: Array.isArray(m?.tags) ? m.tags.map((t) => safeText(t).trim()).filter(Boolean) : [],
      featured: Boolean(m?.featured),
    })),
    events: events.map((e) => ({
      title: safeText(e?.title).trim(),
      description: safeText(e?.description).trim(),
      date: safeText(e?.date).trim(),
      time: safeText(e?.time).trim(),
      price: e?.price ?? null,
      category: safeText(e?.category).trim(),
      featured: Boolean(e?.featured),
    })),
    galleryCount: gallery.length,
    website,
  };
}

function uniqueStrings(list) {
  return Array.from(new Set((list || []).map((x) => safeText(x).trim()).filter(Boolean)));
}

function isPlaceholderEmail(email) {
  const e = safeText(email).trim().toLowerCase();
  if (!e) return true;
  if (e.includes("@example.") || e.endsWith(".example")) return true;
  if (e.includes("example.com") || e.includes("example.org") || e.includes("example.net")) return true;
  if (e.startsWith("your.")) return true;
  return false;
}

function uniquePhones(list) {
  const out = [];
  const indexByNorm = new Map();

  (list || []).forEach((raw) => {
    const phone = safeText(raw).trim();
    if (!phone) return;
    const norm = phone.replace(/[^\d+]/g, "");
    if (!norm) return;

    const existingIndex = indexByNorm.get(norm);
    if (existingIndex === undefined) {
      indexByNorm.set(norm, out.length);
      out.push(phone);
      return;
    }

    const current = out[existingIndex];
    const currentHasSpaces = /\s/.test(current);
    const nextHasSpaces = /\s/.test(phone);
    if (!currentHasSpaces && nextHasSpaces) out[existingIndex] = phone;
  });

  return out;
}

function extractWebsiteDetails() {
  const homepagePath = path.join(ROOT_DIR, "pages", "homepage.html");
  const reservationsPath = path.join(ROOT_DIR, "pages", "reservations_contact.html");

  let homepage = "";
  let reservations = "";
  try {
    homepage = fs.readFileSync(homepagePath, "utf8");
  } catch {
    homepage = "";
  }
  try {
    reservations = fs.readFileSync(reservationsPath, "utf8");
  } catch {
    reservations = "";
  }

  const emailRe = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const homepageEmails = uniqueStrings(homepage.match(emailRe)).filter((e) => !isPlaceholderEmail(e));
  const reservationsEmails = uniqueStrings(reservations.match(emailRe)).filter((e) => !isPlaceholderEmail(e));

  const phoneRe = /\+\d[\d\s]{8,}/g;
  const reservationsPhones = uniquePhones(reservations.match(phoneRe));

  function extractSpanValue(html, labelPattern) {
    const re = new RegExp(
      `<span>\\s*${labelPattern}\\s*<\\/span>[\\s\\S]{0,120}?<span>\\s*([^<]+?)\\s*<\\/span>`,
      "i",
    );
    const m = html.match(re);
    return m ? safeText(m[1]).trim() : "";
  }

  const homepageHours = {
    monThu: extractSpanValue(homepage, "Mon\\s*-\\s*Thu"),
    friSat: extractSpanValue(homepage, "Fri\\s*-\\s*Sat"),
    sunday: extractSpanValue(homepage, "Sunday"),
  };

  const openDailyMatch = reservations.match(/Open\s+Daily:\s*([^<\n\r]+)/i);
  const reservationsOpenDaily = openDailyMatch ? safeText(openDailyMatch[1]).trim() : "";

  const waMatch = reservations.match(/href\s*=\s*"(https:\/\/wa\.me\/[^"\s]+)"/i);
  const whatsappLink = waMatch ? safeText(waMatch[1]).trim() : "";

  const emergencyLineMatch = reservations.match(
    /24\s*\/\s*7\s*Emergency\s*Line[\s\S]{0,220}?(\+\d[\d\s]{8,})/i,
  );
  const emergencyLine = emergencyLineMatch ? safeText(emergencyLineMatch[1]).trim() : "";

  const cancellationPolicyMatch = reservations.match(/Reservations\s+can\s+be\s+cancelled[^<\n\r]+/i);
  const noShowPolicyMatch = reservations.match(/Tables\s+are\s+held\s+for\s+15\s+minutes[^<\n\r]+/i);
  const groupPolicyMatch = reservations.match(/Parties\s+of\s+8\s+or\s+more[^<\n\r]+/i);

  return {
    homepageEmails,
    reservationsEmails,
    reservationsPhones,
    homepageHours,
    reservationsOpenDaily,
    whatsappLink,
    emergencyLine,
    policies: {
      cancellation: cancellationPolicyMatch ? safeText(cancellationPolicyMatch[0]).trim() : "",
      noShow: noShowPolicyMatch ? safeText(noShowPolicyMatch[0]).trim() : "",
      group: groupPolicyMatch ? safeText(groupPolicyMatch[0]).trim() : "",
    },
  };
}

function buildMarkdown(data) {
  const s = data.settings;
  const currency = s.currency || "UGX";
  const dt = data.generatedAt.replace("T", " ").replace("Z", " UTC");
  const w = data.website || {};

  const lines = [];
  lines.push(`# ${mdText(s.siteName)} - Website Knowledge Pack (for AI)`);
  lines.push("");
  lines.push(`Generated: ${mdText(dt)}`);
  lines.push("");
  lines.push("## Quick facts (source of truth: CMS settings)");
  lines.push("");
  if (s.address) lines.push(`- Address: ${mdText(s.address)}`);
  if (s.contactPhone) lines.push(`- Phone: ${mdText(s.contactPhone)}`);
  if (s.contactEmail) lines.push(`- Email: ${mdText(s.contactEmail)}`);
  if (s.openingHours) lines.push(`- Opening hours: ${mdText(s.openingHours)}`);
  lines.push(`- Currency: ${mdText(currency)}`);
  lines.push("");
  lines.push("## Details currently shown on website pages (verify + keep consistent)");
  lines.push("");
  if (Array.isArray(w.homepageEmails) && w.homepageEmails.length) {
    lines.push(`- Emails on Home page: ${mdText(w.homepageEmails.join(", "))}`);
  }
  if (Array.isArray(w.reservationsEmails) && w.reservationsEmails.length) {
    lines.push(`- Emails on Reservations page: ${mdText(w.reservationsEmails.join(", "))}`);
  }
  if (Array.isArray(w.reservationsPhones) && w.reservationsPhones.length) {
    lines.push(`- Phone numbers on Reservations page: ${mdText(w.reservationsPhones.join(", "))}`);
  }
  if (w.whatsappLink) lines.push(`- WhatsApp link: ${mdText(w.whatsappLink)}`);
  if (w.reservationsOpenDaily) lines.push(`- Reservations page hours: ${mdText(w.reservationsOpenDaily)}`);
  const hh = w.homepageHours || {};
  if (hh.monThu || hh.friSat || hh.sunday) {
    const footerHours = [
      hh.monThu ? `Mon-Thu ${hh.monThu}` : "",
      hh.friSat ? `Fri-Sat ${hh.friSat}` : "",
      hh.sunday ? `Sunday ${hh.sunday}` : "",
    ]
      .filter(Boolean)
      .join("; ");
    lines.push(`- Home page footer hours: ${mdText(footerHours)}`);
  }
  const pol = w.policies || {};
  if (pol.cancellation || pol.noShow || pol.group) {
    lines.push("- Reservation policy text on Reservations page:");
    if (pol.cancellation) lines.push(`  - Cancellation: ${mdText(pol.cancellation)}`);
    if (pol.noShow) lines.push(`  - No-show: ${mdText(pol.noShow)}`);
    if (pol.group) lines.push(`  - Groups: ${mdText(pol.group)}`);
  }
  if (w.emergencyLine) lines.push(`- Emergency line shown on Reservations page: ${mdText(w.emergencyLine)}`);
  lines.push("");
  lines.push("## Website pages (visitor navigation)");
  lines.push("");
  lines.push("- Home: `pages/homepage.html`");
  lines.push("- Menu & Order: `pages/menu_ordering.html`");
  lines.push("- Events: `pages/events_entertainment.html`");
  lines.push("- Gallery: `pages/gallery_experience.html`");
  lines.push("- Reservations: `pages/reservations_contact.html`");
  lines.push("- About: `pages/about_lounge_44.html`");
  lines.push("");
  lines.push("## Reservations (how to guide users)");
  lines.push("");
  lines.push(
    "- Recommend the Reservations page for bookings. Ask for: full name, phone number, date, time, party size, preferred area, and any special requests.",
  );
  if (s.contactPhone || s.contactEmail) {
    lines.push("- If they need immediate help, provide the phone/email above.");
  }
  lines.push("- Avoid collecting payment details or passwords.");
  lines.push("");
  lines.push("## Menu (from CMS)");
  lines.push("");
  if (!data.menu.length) {
    lines.push("- No menu items found in the CMS yet.");
  } else {
    data.menu.forEach((m) => {
      const parts = [];
      if (m.category) parts.push(m.category);
      if (m.featured) parts.push("Featured");
      const meta = parts.length ? ` (${parts.join(", ")})` : "";
      const price = m.price !== null && m.price !== undefined ? ` - ${formatMoney(currency, m.price)}` : "";
      const desc = m.description ? `: ${m.description}` : "";
      lines.push(`- ${mdText(m.name)}${mdText(meta)}${mdText(price)}${mdText(desc)}`);
    });
  }
  lines.push("");
  lines.push("## Events (from CMS)");
  lines.push("");
  if (!data.events.length) {
    lines.push("- No events found in the CMS yet.");
  } else {
    data.events.forEach((e) => {
      const when = [formatEventDate(e.date), e.time].filter(Boolean).join(" ");
      const price = e.price !== null && e.price !== undefined ? ` - ${formatMoney(currency, e.price)}` : "";
      const meta = [e.category, e.featured ? "Featured" : ""].filter(Boolean).join(", ");
      const metaPart = meta ? ` (${meta})` : "";
      const desc = e.description ? `: ${e.description}` : "";
      lines.push(`- ${mdText(e.title)}${mdText(metaPart)} - ${mdText(when)}${mdText(price)}${mdText(desc)}`);
    });
  }
  lines.push("");
  lines.push("## AI assistant behavior (recommended)");
  lines.push("");
  lines.push("- Tone: premium, warm, concise, and helpful.");
  lines.push("- If a fact is not in this document, say you're not sure and suggest contacting the venue.");
  lines.push("- For reservations: guide users to the Reservations page and/or the official phone/email.");
  lines.push("- Do not accept payments. Do not request passwords or sensitive personal info.");
  lines.push("");
  lines.push("## Example Q&A");
  lines.push("");
  lines.push("- Q: What time do you open? A: Provide opening hours from Quick facts.");
  lines.push("- Q: Can I book a table for 4 tonight at 8pm? A: Ask for name/phone and direct to Reservations page.");
  lines.push("- Q: What are your featured dishes? A: List featured menu items from CMS.");
  lines.push("- Q: What events are coming up? A: List CMS events with date/time and pricing if available.");
  lines.push("");
  lines.push("---");
  lines.push("Note: Some HTML pages may contain placeholder contact details/hours. Keep CMS settings up to date so the AI stays consistent.");
  lines.push("");

  return lines.join("\n");
}

function buildPdfLines(data) {
  const s = data.settings;
  const currency = s.currency || "UGX";
  const dt = data.generatedAt.replace("T", " ").replace("Z", " UTC");
  const w = data.website || {};

  const lines = [];
  const W = 92;

  function addBlank() {
    lines.push("");
  }

  function addHeading(text) {
    lines.push(toAscii(text));
    lines.push("-".repeat(Math.min(W, toAscii(text).length || 1)));
  }

  function addParagraph(text) {
    wrap(text, W).forEach((l) => lines.push(l));
  }

  function addBullet(text) {
    const wrapped = wrap(text, W - 2);
    wrapped.forEach((l, idx) => lines.push((idx === 0 ? "- " : "  ") + l));
  }

  lines.push(toAscii(`${s.siteName || "Lounge 44"} - Website Knowledge Pack (for AI)`));
  addParagraph(`Generated: ${dt}`);
  addBlank();

  addHeading("Quick facts (source of truth: CMS settings)");
  if (s.address) addBullet(`Address: ${s.address}`);
  if (s.contactPhone) addBullet(`Phone: ${s.contactPhone}`);
  if (s.contactEmail) addBullet(`Email: ${s.contactEmail}`);
  if (s.openingHours) addBullet(`Opening hours: ${s.openingHours}`);
  addBullet(`Currency: ${currency}`);
  addBlank();

  addHeading("Details currently shown on website pages (verify)");
  if (Array.isArray(w.homepageEmails) && w.homepageEmails.length) {
    addBullet(`Emails on Home page: ${w.homepageEmails.join(", ")}`);
  }
  if (Array.isArray(w.reservationsEmails) && w.reservationsEmails.length) {
    addBullet(`Emails on Reservations page: ${w.reservationsEmails.join(", ")}`);
  }
  if (Array.isArray(w.reservationsPhones) && w.reservationsPhones.length) {
    addBullet(`Phone numbers on Reservations page: ${w.reservationsPhones.join(", ")}`);
  }
  if (w.whatsappLink) addBullet(`WhatsApp link: ${w.whatsappLink}`);
  if (w.reservationsOpenDaily) addBullet(`Reservations page hours: ${w.reservationsOpenDaily}`);
  const hh = w.homepageHours || {};
  if (hh.monThu || hh.friSat || hh.sunday) {
    const footerHours = [
      hh.monThu ? `Mon-Thu ${hh.monThu}` : "",
      hh.friSat ? `Fri-Sat ${hh.friSat}` : "",
      hh.sunday ? `Sunday ${hh.sunday}` : "",
    ]
      .filter(Boolean)
      .join("; ");
    addBullet(`Home page footer hours: ${footerHours}`);
  }
  const pol = w.policies || {};
  if (pol.cancellation) addBullet(`Cancellation policy: ${pol.cancellation}`);
  if (pol.noShow) addBullet(`No-show policy: ${pol.noShow}`);
  if (pol.group) addBullet(`Group reservations policy: ${pol.group}`);
  if (w.emergencyLine) addBullet(`Emergency line shown: ${w.emergencyLine}`);
  addBlank();

  addHeading("Website pages (visitor navigation)");
  addBullet("Home: pages/homepage.html");
  addBullet("Menu & Order: pages/menu_ordering.html");
  addBullet("Events: pages/events_entertainment.html");
  addBullet("Gallery: pages/gallery_experience.html");
  addBullet("Reservations: pages/reservations_contact.html");
  addBullet("About: pages/about_lounge_44.html");
  addBlank();

  addHeading("Reservations (how to guide users)");
  addBullet(
    "Recommend the Reservations page for bookings. Ask for: full name, phone number, date, time, party size, preferred area, and any special requests.",
  );
  if (s.contactPhone || s.contactEmail) addBullet("If they need immediate help, provide the official phone/email.");
  addBullet("Avoid collecting payment details or passwords.");
  addBlank();

  addHeading("Menu (from CMS)");
  if (!data.menu.length) {
    addParagraph("No menu items found in the CMS yet.");
  } else {
    data.menu.forEach((m) => {
      const parts = [];
      if (m.category) parts.push(m.category);
      if (m.featured) parts.push("Featured");
      const meta = parts.length ? ` (${parts.join(", ")})` : "";
      const price = m.price !== null && m.price !== undefined ? ` - ${formatMoney(currency, m.price)}` : "";
      const desc = m.description ? `: ${m.description}` : "";
      addBullet(`${m.name}${meta}${price}${desc}`);
    });
  }
  addBlank();

  addHeading("Events (from CMS)");
  if (!data.events.length) {
    addParagraph("No events found in the CMS yet.");
  } else {
    data.events.forEach((e) => {
      const when = [formatEventDate(e.date), e.time].filter(Boolean).join(" ");
      const price = e.price !== null && e.price !== undefined ? ` - ${formatMoney(currency, e.price)}` : "";
      const meta = [e.category, e.featured ? "Featured" : ""].filter(Boolean).join(", ");
      const metaPart = meta ? ` (${meta})` : "";
      const desc = e.description ? `: ${e.description}` : "";
      addBullet(`${e.title}${metaPart} - ${when}${price}${desc}`);
    });
  }
  addBlank();

  addHeading("AI assistant behavior (recommended)");
  addBullet("Tone: premium, warm, concise, and helpful.");
  addBullet("If a fact is not in this pack, say you're not sure and suggest contacting the venue.");
  addBullet("For reservations: guide users to the Reservations page and/or the official phone/email.");
  addBullet("Do not accept payments. Do not request passwords or sensitive personal info.");
  addBlank();

  addHeading("Example Q&A");
  addBullet("Q: What time do you open? A: Provide opening hours from Quick facts.");
  addBullet("Q: Can I book a table for 4 tonight at 8pm? A: Ask for name/phone and direct to Reservations page.");
  addBullet("Q: What are your featured dishes? A: List featured menu items from CMS.");
  addBullet("Q: What events are coming up? A: List CMS events with date/time and pricing if available.");
  addBlank();

  addParagraph(
    "Note: Some HTML pages may contain placeholder contact details/hours. Keep CMS settings up to date so the AI stays consistent.",
  );

  return lines;
}

function pdfEscape(s) {
  return toAscii(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildPdf(lines) {
  const pageWidth = 595; // A4
  const pageHeight = 842;
  const margin = 50;
  const fontSize = 11;
  const leading = 14;

  const usableLines = Math.max(10, Math.floor((pageHeight - margin * 2) / leading));
  const pages = [];
  for (let i = 0; i < lines.length; i += usableLines) {
    pages.push(lines.slice(i, i + usableLines));
  }

  const fontObjId = 3 + pages.length * 2;

  function makePageStream(pageLines) {
    const startY = pageHeight - margin - fontSize;
    const startX = margin;

    const content = [];
    content.push("BT");
    content.push(`/F1 ${fontSize} Tf`);
    content.push(`${leading} TL`);
    content.push(`1 0 0 1 ${startX} ${startY} Tm`);
    pageLines.forEach((l) => {
      content.push(`(${pdfEscape(l)}) Tj`);
      content.push("T*");
    });
    content.push("ET");
    return content.join("\n") + "\n";
  }

  const objects = [];
  const offsets = [];
  let offset = 0;
  const chunks = [];

  function push(str) {
    const buf = Buffer.from(str, "utf8");
    chunks.push(buf);
    offset += buf.length;
  }

  function addObj(id, body) {
    offsets[id] = offset;
    push(`${id} 0 obj\n${body}\nendobj\n`);
    objects.push(id);
  }

  // Header
  push("%PDF-1.4\n%PDF-Generator\n");

  // 1: catalog, 2: pages
  addObj(1, `<< /Type /Catalog /Pages 2 0 R >>`);

  const kids = [];
  for (let i = 0; i < pages.length; i++) {
    const pageObjId = 3 + i * 2;
    kids.push(`${pageObjId} 0 R`);
  }
  addObj(2, `<< /Type /Pages /Kids [ ${kids.join(" ")} ] /Count ${pages.length} >>`);

  // Pages + contents
  for (let i = 0; i < pages.length; i++) {
    const pageObjId = 3 + i * 2;
    const contentObjId = pageObjId + 1;
    const stream = makePageStream(pages[i]);
    const streamBytes = Buffer.from(stream, "utf8").length;

    addObj(
      pageObjId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontObjId} 0 R >> >> /Contents ${contentObjId} 0 R >>`,
    );
    addObj(contentObjId, `<< /Length ${streamBytes} >>\nstream\n${stream}endstream`);
  }

  // Font
  addObj(fontObjId, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`);

  // xref
  const xrefStart = offset;
  const size = fontObjId + 1;
  push("xref\n");
  push(`0 ${size}\n`);
  push("0000000000 65535 f \n");
  for (let id = 1; id < size; id++) {
    const off = offsets[id] || 0;
    push(String(off).padStart(10, "0") + " 00000 n \n");
  }

  // trailer
  push("trailer\n");
  push(`<< /Size ${size} /Root 1 0 R >>\n`);
  push("startxref\n");
  push(`${xrefStart}\n`);
  push("%%EOF\n");

  return Buffer.concat(chunks);
}

function main() {
  const raw = fs.readFileSync(DB_PATH, "utf8");
  const db = JSON.parse(raw);

  const data = buildTrainingData(db);
  const md = buildMarkdown(data);
  fs.writeFileSync(OUT_MD, md, "utf8");

  const pdfLines = buildPdfLines(data);
  const pdf = buildPdf(pdfLines);
  fs.writeFileSync(OUT_PDF, pdf);

  console.log("Wrote:");
  console.log("-", OUT_MD);
  console.log("-", OUT_PDF);
}

main();
