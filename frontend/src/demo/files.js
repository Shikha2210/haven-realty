// File helpers for the browser-only demo: uploads, sample images, and Excel / PDF generation.
import { fail } from './http.js';

const TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf' };
const MB = 1024 * 1024;

const magicOk = (type, h) =>
  type === 'image/jpeg' ? h[0] === 0xff && h[1] === 0xd8
    : type === 'image/png' ? h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4e && h[3] === 0x47
      : h[0] === 0x25 && h[1] === 0x50 && h[2] === 0x44 && h[3] === 0x46;

/** Shrinks photos so a visitor's browser storage does not fill up. */
async function shrink(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
}

/** Same checks as the server: extension, size and file signature. */
export async function readUpload(file, imageOnly) {
  if (!file || !file.size) fail(400, 'Please choose a file to upload');
  const name = String(file.name || 'file').replace(/\\/g, '/').split('/').pop().replace(/[^A-Za-z0-9._ -]/g, '_') || 'file';
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  const type = TYPES[ext];
  const isPdf = type === 'application/pdf';
  if (!type || (imageOnly && isPdf)) fail(400, imageOnly ? 'Only JPG or PNG images are allowed' : 'Only JPG, PNG or PDF files are allowed');
  const limit = isPdf ? 10 : 5;
  if (file.size > limit * MB) fail(400, `File is too large (limit ${limit} MB)`);
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (!magicOk(type, head)) fail(400, 'File content does not match its type');
  if (isPdf) return { name, type, blob: file.slice(0, file.size, type) };
  let blob;
  try { blob = await shrink(file); } catch { fail(400, 'File content does not match its type'); }
  return { name, type: 'image/jpeg', blob };
}

const xml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const shade = (hex, f) => '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f))).toString(16).padStart(2, '0')).join('');

/** A generated placeholder photo (architectural silhouette on a gradient). */
export function sampleImage(title, place, colour, variant) {
  const x = 120 + variant * 40;
  const top = shade(colour, variant === 1 ? 2.3 : 1.8);
  const windows = [0, 1, 2].map((i) => `<rect x="${x + 70 + i * 190}" y="450" width="90" height="110" fill="#ffe296" fill-opacity=".75"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">`
    + `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${shade(colour, 0.7)}"/></linearGradient></defs>`
    + `<rect width="1200" height="800" fill="url(#g)"/><circle cx="955" cy="145" r="85" fill="#fff" fill-opacity=".16"/>`
    + `<g fill="#000" fill-opacity=".28"><rect x="${x}" y="380" width="620" height="320"/><path d="M${x - 30} 380L${x + 310} 250L${x + 650} 380Z"/></g>${windows}`
    + `<rect y="700" width="1200" height="100" fill="#000" fill-opacity=".35"/>`
    + `<g fill="#fff" font-family="sans-serif"><text x="50" y="755" font-size="40" font-weight="700">${xml(title.slice(0, 40))}</text>`
    + `<text x="50" y="788" font-size="24">${xml(place)}  -  sample image</text></g></svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
}

const ascii = (v) => String(v).replace(/[^\x20-\x7E]/g, '?');

/** Minimal PDF writer: each page is a list of { x, y, size, bold, text }. Landscape A4. */
export function makePdf(pages) {
  const W = 842, H = 595;
  const esc = (s) => ascii(s).replace(/[\\()]/g, '\\$&');
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'];
  const kids = [];
  for (const items of pages) {
    const body = items.map((t) => `BT /F${t.bold ? 2 : 1} ${t.size} Tf ${t.x.toFixed(1)} ${t.y.toFixed(1)} Td (${esc(t.text)}) Tj ET`).join('\n');
    const page = objs.length + 1;
    kids.push(`${page} 0 R`);
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${page + 1} 0 R >>`);
    objs.push(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
  }
  objs[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;
  let out = '%PDF-1.4\n';
  const offsets = objs.map((o, i) => { const at = out.length; out += `${i + 1} 0 obj\n${o}\nendobj\n`; return at; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([out], { type: 'application/pdf' });
}

export const samplePdf = (label) => makePdf([[{ x: 60, y: 520, size: 18, bold: true, text: 'Haven Realty - sample document' },
  { x: 60, y: 490, size: 12, text: `${label} (placeholder generated for the demo)` }]]);

export function tablePdf(title, headers, rows) {
  const margin = 30, rowH = 18, size = 8, colW = (842 - 2 * margin) / headers.length;
  const max = Math.max(4, Math.floor(colW / (size * 0.5)));
  const line = (cells, y, bold) => cells.map((c, i) => {
    const v = ascii(c);
    return { x: margin + i * colW, y, size, bold, text: v.length > max ? v.slice(0, max - 1) + '~' : v };
  });
  const perPage = Math.floor((595 - 2 * margin - 26 - rowH) / rowH);
  const pages = [];
  for (let start = 0; start === 0 || start < rows.length; start += perPage) {
    let y = 595 - margin;
    const items = [{ x: margin, y, size: 14, bold: true, text: `Haven Realty - ${title}` }];
    y -= 26;
    items.push(...line(headers, y, true));
    for (const r of rows.slice(start, start + perPage)) { y -= rowH; items.push(...line(r, y, false)); }
    pages.push(items);
  }
  return makePdf(pages);
}

const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

/** Uncompressed ZIP, which is all an .xlsx file needs. */
function zip(files) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  const bytes = (...fields) => {
    const out = new Uint8Array(fields.reduce((n, [, len]) => n + len, 0));
    const view = new DataView(out.buffer);
    let at = 0;
    for (const [v, len] of fields) { if (len === 2) view.setUint16(at, v, true); else view.setUint32(at, v, true); at += len; }
    return out;
  };
  for (const [name, text] of Object.entries(files)) {
    const n = enc.encode(name), d = enc.encode(text), crc = crc32(d);
    const common = [[20, 2], [0, 2], [0, 2], [0, 2], [0x21, 2], [crc, 4], [d.length, 4], [d.length, 4], [n.length, 2], [0, 2]];
    parts.push(bytes([0x04034b50, 4], ...common), n, d);
    central.push(bytes([0x02014b50, 4], [20, 2], ...common, [0, 2], [0, 2], [0, 2], [0, 4], [offset, 4]), n);
    offset += 30 + n.length + d.length;
  }
  const size = central.reduce((s, c) => s + c.length, 0), count = Object.keys(files).length;
  const end = bytes([0x06054b50, 4], [0, 2], [0, 2], [count, 2], [count, 2], [size, 4], [offset, 4], [0, 2]);
  return new Blob([...parts, ...central, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function makeXlsx(sheet, headers, rows) {
  const data = [headers, ...rows].map((r, i) => `<row r="${i + 1}">${r.map((v) => `<c t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`).join('')}</row>`).join('');
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const ct = 'application/vnd.openxmlformats-officedocument.spreadsheetml';
  return zip({
    '[Content_Types].xml': `${head}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="${ct}.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="${ct}.worksheet+xml"/></Types>`,
    '_rels/.rels': `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `${head}<workbook xmlns="${main}" xmlns:r="${rel}"><sheets><sheet name="${xml(sheet)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': `${head}<worksheet xmlns="${main}"><sheetData>${data}</sheetData></worksheet>`,
  });
}
