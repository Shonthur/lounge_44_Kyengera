/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.join(__dirname, "..");
const DB_PATH = path.join(ROOT_DIR, "cms", "data", "db.json");

const OUT_CSV = path.join(ROOT_DIR, "docs", "lounge44-product-prices.csv");
const OUT_XLSX = path.join(ROOT_DIR, "docs", "lounge44-product-prices.xlsx");

function safeText(value) {
  return value === null || value === undefined ? "" : String(value);
}

function xmlEscape(value) {
  return safeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toCsvCell(value) {
  const s = safeText(value);
  if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/\"/g, '""')}"`;
  }
  return s;
}

function columnName(n) {
  let x = n + 1;
  let out = "";
  while (x > 0) {
    const mod = (x - 1) % 26;
    out = String.fromCharCode(65 + mod) + out;
    x = Math.floor((x - 1) / 26);
  }
  return out;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16le(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n & 0xffff, 0);
  return b;
}

function u32le(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

function dosDateTime(date) {
  const d = date instanceof Date ? date : new Date();
  const year = Math.max(1980, d.getUTCFullYear());
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const hours = d.getUTCHours();
  const minutes = d.getUTCMinutes();
  const seconds = Math.floor(d.getUTCSeconds() / 2);

  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  return { dosTime, dosDate };
}

function zipStore(entries) {
  const files = entries.map((e) => ({
    name: String(e.name).replace(/\\/g, "/"),
    data: Buffer.isBuffer(e.data) ? e.data : Buffer.from(String(e.data), "utf8"),
    date: e.date instanceof Date ? e.date : new Date(),
  }));

  let offset = 0;
  const localParts = [];
  const centralParts = [];

  files.forEach((f) => {
    const nameBuf = Buffer.from(f.name, "utf8");
    const { dosTime, dosDate } = dosDateTime(f.date);
    const data = f.data;
    const crc = crc32(data);

    const localHeader = Buffer.concat([
      u32le(0x04034b50),
      u16le(20),
      u16le(0),
      u16le(0),
      u16le(dosTime),
      u16le(dosDate),
      u32le(crc),
      u32le(data.length),
      u32le(data.length),
      u16le(nameBuf.length),
      u16le(0),
      nameBuf,
    ]);

    const localOffset = offset;
    localParts.push(localHeader, data);
    offset += localHeader.length + data.length;

    const centralHeader = Buffer.concat([
      u32le(0x02014b50),
      u16le(20),
      u16le(20),
      u16le(0),
      u16le(0),
      u16le(dosTime),
      u16le(dosDate),
      u32le(crc),
      u32le(data.length),
      u32le(data.length),
      u16le(nameBuf.length),
      u16le(0),
      u16le(0),
      u16le(0),
      u16le(0),
      u32le(0),
      u32le(localOffset),
      nameBuf,
    ]);

    centralParts.push(centralHeader);
  });

  const centralDir = Buffer.concat(centralParts);
  const centralDirOffset = offset;
  offset += centralDir.length;

  const end = Buffer.concat([
    u32le(0x06054b50),
    u16le(0),
    u16le(0),
    u16le(files.length),
    u16le(files.length),
    u32le(centralDir.length),
    u32le(centralDirOffset),
    u16le(0),
  ]);

  return Buffer.concat([...localParts, centralDir, end]);
}

function buildSheetXml(rows) {
  // rows = array of arrays (cells)
  const sheetRows = rows
    .map((cells, rowIdx) => {
      const r = rowIdx + 1;
      const cellXml = cells
        .map((cell, colIdx) => {
          const ref = `${columnName(colIdx)}${r}`;
          if (typeof cell === "number" && Number.isFinite(cell)) {
            return `<c r="${ref}"><v>${cell}</v></c>`;
          }
          return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(cell)}</t></is></c>`;
        })
        .join("");
      return `<row r="${r}">${cellXml}</row>`;
    })
    .join("");

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheetData>${sheetRows}</sheetData>` +
    `</worksheet>`
  );
}

function buildXlsx(rows) {
  const now = new Date();

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
    `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
    `</Types>`;

  const rels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
    `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>` +
    `</Relationships>`;

  const workbook =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="Product Prices" sheetId="1" r:id="rId1"/></sheets>` +
    `</workbook>`;

  const workbookRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`;

  const styles =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<fonts count="1"><font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font></fonts>` +
    `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
    `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `<dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium9" defaultPivotStyle="PivotStyleLight16"/>` +
    `</styleSheet>`;

  const sheet1 = buildSheetXml(rows);

  const core =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
    `xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ` +
    `xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>Lounge 44 Product Prices</dc:title>` +
    `<dc:creator>Generated</dc:creator>` +
    `<cp:lastModifiedBy>Generated</cp:lastModifiedBy>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${now.toISOString()}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${now.toISOString()}</dcterms:modified>` +
    `</cp:coreProperties>`;

  const app =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ` +
    `xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
    `<Application>Microsoft Excel</Application>` +
    `</Properties>`;

  const zip = zipStore([
    { name: "[Content_Types].xml", data: contentTypes, date: now },
    { name: "_rels/.rels", data: rels, date: now },
    { name: "docProps/core.xml", data: core, date: now },
    { name: "docProps/app.xml", data: app, date: now },
    { name: "xl/workbook.xml", data: workbook, date: now },
    { name: "xl/_rels/workbook.xml.rels", data: workbookRels, date: now },
    { name: "xl/styles.xml", data: styles, date: now },
    { name: "xl/worksheets/sheet1.xml", data: sheet1, date: now },
  ]);

  return zip;
}

function loadProductsFromCms() {
  let db = null;
  try {
    db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch {
    db = null;
  }

  const currency = safeText(db?.settings?.currency || "UGX").trim() || "UGX";
  const menu = Array.isArray(db?.menu) ? db.menu : [];

  const base = menu.map((m) => ({
    sku: safeText(m.id).trim(),
    name: safeText(m.name).trim(),
    category: safeText(m.category).trim(),
    priceUGX: Number(m.price),
    description: safeText(m.description).trim(),
    featured: Boolean(m.featured),
    currency,
  }));

  return { currency, products: base.filter((p) => p.sku && p.name) };
}

function exampleProducts(currency) {
  return [
    {
      sku: "ex-menu-nyamachoma",
      name: "Nyama Choma Beef Platter",
      category: "Grilled",
      priceUGX: 48000,
      description: "Char-grilled beef cuts served with kachumbari and chips.",
      featured: false,
      currency,
    },
    {
      sku: "ex-menu-peri-peri-chicken",
      name: "Peri-Peri Chicken Platter",
      category: "Grilled",
      priceUGX: 38000,
      description: "Spicy peri-peri chicken with salad and wedges.",
      featured: false,
      currency,
    },
    {
      sku: "ex-menu-chicken-wings-6",
      name: "Spicy Chicken Wings (6pcs)",
      category: "Starters",
      priceUGX: 22000,
      description: "Crispy wings tossed in house spicy glaze.",
      featured: false,
      currency,
    },
    {
      sku: "ex-menu-samosas-4",
      name: "Vegetable Samosas (4pcs)",
      category: "Starters",
      priceUGX: 12000,
      description: "Golden samosas served with chili dip.",
      featured: false,
      currency,
    },
    {
      sku: "ex-menu-matooke-groundnut",
      name: "Matooke & Groundnut Sauce",
      category: "Ugandan Classics",
      priceUGX: 25000,
      description: "Steamed matooke with creamy groundnut sauce.",
      featured: false,
      currency,
    },
    {
      sku: "ex-menu-fish-and-chips",
      name: "Fish & Chips",
      category: "Mains",
      priceUGX: 32000,
      description: "Crispy fish fillet with chips and tartar sauce.",
      featured: false,
      currency,
    },
    {
      sku: "ex-menu-chips-dips",
      name: "Chips & Dips",
      category: "Sides",
      priceUGX: 10000,
      description: "Seasoned fries with house dips.",
      featured: false,
      currency,
    },
    {
      sku: "ex-drink-house-coffee",
      name: "House Coffee",
      category: "Beverages",
      priceUGX: 8000,
      description: "Fresh brewed coffee (Arabica).",
      featured: false,
      currency,
    },
    {
      sku: "ex-drink-passion-juice",
      name: "Fresh Passion Juice",
      category: "Beverages",
      priceUGX: 9000,
      description: "Fresh passion fruit juice served chilled.",
      featured: false,
      currency,
    },
    {
      sku: "ex-dessert-lava-cake",
      name: "Chocolate Lava Cake",
      category: "Desserts",
      priceUGX: 18000,
      description: "Warm chocolate cake with a molten center.",
      featured: false,
      currency,
    },
    {
      sku: "ex-mocktail-passion-mojito",
      name: "Passion Mojito (Mocktail)",
      category: "Mocktails",
      priceUGX: 15000,
      description: "Mint, lime, passion fruit, and soda.",
      featured: false,
      currency,
    },
    {
      sku: "ex-cocktail-signature",
      name: "Signature Cocktail",
      category: "Cocktails",
      priceUGX: 25000,
      description: "Ask the bartender for today's signature mix.",
      featured: false,
      currency,
    },
  ];
}

function main() {
  const { currency, products } = loadProductsFromCms();
  const all = [...products, ...exampleProducts(currency)];

  // CSV
  const csvRows = [
    ["SKU", "Product Name", "Category", "Price (UGX)", "Description", "Featured"],
    ...all.map((p) => [p.sku, p.name, p.category, String(p.priceUGX), p.description, p.featured ? "TRUE" : "FALSE"]),
  ];
  const csv = csvRows.map((row) => row.map(toCsvCell).join(",")).join("\n") + "\n";
  fs.writeFileSync(OUT_CSV, csv, "utf8");

  // XLSX
  const xlsxRows = [
    ["SKU", "Product Name", "Category", "Price (UGX)", "Description", "Featured"],
    ...all.map((p) => [p.sku, p.name, p.category, Number(p.priceUGX), p.description, p.featured ? "TRUE" : "FALSE"]),
  ];
  const xlsx = buildXlsx(xlsxRows);
  fs.writeFileSync(OUT_XLSX, xlsx);

  console.log("Wrote:");
  console.log("-", OUT_CSV);
  console.log("-", OUT_XLSX);
  console.log(`Currency: ${currency}`);
  console.log(`Rows: ${all.length}`);
}

main();

