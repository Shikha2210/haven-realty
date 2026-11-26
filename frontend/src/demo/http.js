// Small shared pieces of the in-browser API: errors, validation, dates and paging.
export class ApiError extends Error {
  constructor(status, message, fields) { super(message); this.status = status; this.fields = fields; }
}
export const fail = (status, message, fields) => { throw new ApiError(status, message, fields); };
export const bad = (m) => fail(400, m);
export const forbidden = (m) => fail(403, m);
export const conflict = (m) => fail(409, m);
export const notFound = (what) => fail(404, `${what} not found`);

export const has = (s) => s != null && String(s).trim() !== '';

const pad = (n) => String(n).padStart(2, '0');
/** Local date-time without a zone, the same shape the Java API returns. */
export const stamp = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

/** rules: { field: [[testReturningTrueWhenValid, message], ...] } */
export function validate(body, rules) {
  const fields = {};
  for (const [name, checks] of Object.entries(rules)) {
    const broken = checks.find(([ok]) => !ok(body?.[name]));
    if (broken) fields[name] = broken[1];
  }
  if (Object.keys(fields).length) fail(400, 'Please correct the highlighted fields', fields);
}
export const required = (msg = 'This value is required') => [has, msg];
export const maxLen = (n) => [(v) => v == null || String(v).length <= n, `Must be at most ${n} characters`];
export const matches = (re, msg) => [(v) => v == null || re.test(v), msg];
export const atLeast = (min, msg) => [(v) => v == null || v === '' || Number(v) >= min, msg || `Must be at least ${min}`];

export function page(rows, pageNo, size) {
  const p = Math.max(Number(pageNo) || 0, 0);
  const s = Math.max(Number(size) || 20, 1);
  return { content: rows.slice(p * s, p * s + s), page: { size: s, number: p, totalElements: rows.length, totalPages: Math.ceil(rows.length / s) } };
}
