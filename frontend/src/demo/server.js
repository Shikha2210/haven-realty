// Browser port of the Spring Boot API, used only by the static (GitHub Pages) build.
// The Java services in backend/ are the reference; keep behaviour in step with them.
import { AxiosError } from 'axios';
import { ApiError, atLeast, bad, conflict, fail, forbidden, has, matches, maxLen, notFound, page, required, stamp, validate } from './http.js';
import { makeXlsx, readUpload, tablePdf } from './files.js';
import { hash, insert, load, passwordMatches, save, storeFile } from './store.js';

const PUBLISHED = 'PUBLISHED';
const TYPES = ['Residential', 'Commercial', 'Agricultural', 'Apartment', 'House', 'Villa', 'Plot', 'Office', 'Shop', 'Land'];
const ALL_PROPERTY_STATUS = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'PUBLISHED', 'REJECTED', 'SUSPENDED', 'INACTIVE', 'SOLD'];
const ENQUIRY_STATUS = ['NEW', 'UNDER_REVIEW', 'CONTACTED', 'DETAILS_SHARED', 'SITE_VISIT_SCHEDULED', 'NEGOTIATION', 'DEAL_IN_PROGRESS', 'CLOSED', 'REJECTED', 'ON_HOLD', 'CANCELLED'];
const FINISHED = ['CLOSED', 'REJECTED', 'CANCELLED'];
const EMAIL = /^[^\s@]+@[^\s@]+$/;

const routes = [];
/** access: 'public' | 'any' (signed in) | 'CUSTOMER' | 'AGENT' */
const route = (method, path, access, handler) =>
  routes.push({ method, access, handler, re: new RegExp(`^${path.replace(/\./g, '\\.').replace(/:\w+/g, '(\\d+)')}$`) });

// ================================================================ lookups
const byId = (db, table, id) => db[table].find((r) => r.id === Number(id));
const need = (db, table, id, what) => byId(db, table, id) || notFound(what);
const desc = (a, b) => b.id - a.id;
const newest = (key) => (a, b) => String(b[key]).localeCompare(String(a[key])) || b.id - a.id;
const agentUser = (db) => db.users.find((u) => u.role === 'AGENT');
const list = (v) => (v == null || v === '' ? [] : [].concat(v).flatMap((x) => String(x).split(',')));
const text = (v) => String(v ?? '').toLowerCase();

// ================================================================ audit and notifications
const audit = (db, actorId, action, entityType, entityId, details = null) =>
  insert(db, 'audit', { actorId, action, entityType, entityId, details });
const notify = (db, userId, title, body, link) => insert(db, 'notifications', { userId, title, body, link });
const notifyAgent = (db, title, body, link) => agentUser(db) && notify(db, agentUser(db).id, title, body, link);

// ================================================================ users
const latestVerification = (db, userId) => db.verifications.filter((v) => v.userId === userId).sort(desc)[0];
const sellerStatus = (db, u) => (u.role === 'AGENT' ? 'NONE' : u.sellerEnabled ? 'VERIFIED' : latestVerification(db, u.id)?.status || 'NONE');
const userView = (db, u) => ({
  id: u.id, email: u.email, fullName: u.fullName, phone: u.phone, role: u.role, buyerEnabled: u.buyerEnabled, sellerEnabled: u.sellerEnabled,
  emailVerified: u.emailVerified, phoneVerified: u.phoneVerified, sellerStatus: sellerStatus(db, u), city: u.city, state: u.state,
  address: u.address, postalCode: u.postalCode, dateOfBirth: u.dateOfBirth, preferences: u.preferences,
});
const summary = (u) => ({ id: u.id, name: u.fullName, email: u.email, phone: u.phone, city: u.city });
const token = (u) => `demo.${u.id}.${Date.now() + 86400000}`;
const strongEnough = (p) => {
  if (!p || p.length < 8 || !/[A-Za-z]/.test(p) || !/\d/.test(p)) bad('Password must be at least 8 characters and contain a letter and a number');
};

// ================================================================ one-time codes (shown on screen: no email / SMS here)
function issueCode(db, user, channel, purpose) {
  db.tokens.filter((t) => t.userId === user.id && t.channel === channel && t.purpose === purpose && !t.usedAt).forEach((t) => { t.usedAt = stamp(); });
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
  insert(db, 'tokens', { userId: user.id, channel, purpose, code, expiresAt: stamp(new Date(Date.now() + 15 * 60000)) });
  return code;
}
function consumeCode(db, user, channel, purpose, code) {
  const t = db.tokens.filter((x) => x.userId === user.id && x.channel === channel && x.purpose === purpose && !x.usedAt).sort(desc)[0];
  if (!t || t.expiresAt < stamp() || t.attempts >= 5) bad('Invalid or expired code');
  if (String(code ?? '').trim() !== t.code) {
    t.attempts += 1;
    // the failed attempt must be remembered even though the request is rejected
    throw Object.assign(new ApiError(400, 'Invalid or expired code'), { keep: true });
  }
  t.usedAt = stamp();
}

// ================================================================ property views
const imagesOf = (db, pid) => db.images.filter((i) => i.propertyId === pid).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
const imageUrl = (pid, iid) => `/api/properties/${pid}/images/${iid}`;
const savedIds = (db, viewer) => new Set(viewer && viewer.role !== 'AGENT' ? db.wishlist.filter((w) => w.userId === viewer.id).map((w) => w.propertyId) : []);
function card(db, p, saved = new Set()) {
  const cover = imagesOf(db, p.id)[0];
  return {
    id: p.id, title: p.title, propertyType: p.propertyType, category: p.category, city: p.city, locality: p.locality, price: p.price, area: p.area,
    measurementUnit: p.measurementUnit, bedrooms: p.bedrooms, bathrooms: p.bathrooms, furnishingStatus: p.furnishingStatus,
    coverImageUrl: cover ? imageUrl(p.id, cover.id) : null, verified: true, wishlisted: saved.has(p.id), listedAt: p.createdAt,
  };
}
const docView = (d) => ({ id: d.id, docType: d.docType, originalName: d.originalName, uploadedAt: d.uploadedAt });
function sellerView(db, p) {
  const { sellerId, ...rest } = p;
  return {
    ...rest,
    enquiryCount: db.enquiries.filter((e) => e.propertyId === p.id).length,
    images: imagesOf(db, p.id).map((i) => ({ id: i.id, url: imageUrl(p.id, i.id) })),
    documents: db.propertyDocs.filter((d) => d.propertyId === p.id).map(docView),
  };
}
const agentProperty = (db, p) => ({
  property: sellerView(db, p),
  seller: summary(need(db, 'users', p.sellerId, 'Seller')),
  approvals: db.approvals.filter((a) => a.propertyId === p.id).map((a) => ({ decision: a.decision, reason: a.reason, at: a.createdAt })),
});
const published = (db, ids) => ids.map((id) => byId(db, 'properties', id)).filter((p) => p?.status === PUBLISHED);
const viewedIds = (db, userId) => db.recent.filter((r) => r.userId === userId).sort(newest('viewedAt')).slice(0, 10).map((r) => r.propertyId);
const recentlyViewed = (db, u) => published(db, viewedIds(db, u.id)).map((p) => card(db, p, savedIds(db, u)));
const wishlistOf = (db, u) => published(db, db.wishlist.filter((w) => w.userId === u.id).sort(desc).map((w) => w.propertyId)).map((p) => card(db, p, savedIds(db, u)));
function recommended(db, u) {
  const seen = viewedIds(db, u.id);
  const cities = new Set(seen.map((id) => text(byId(db, 'properties', id)?.city)));
  if (!cities.size && u.city) cities.add(text(u.city));
  return db.properties.filter((p) => p.status === PUBLISHED).sort(newest('createdAt')).slice(0, 24)
    .filter((p) => p.sellerId !== u.id && !seen.includes(p.id))
    .sort((a, b) => Number(!cities.has(text(a.city))) - Number(!cities.has(text(b.city))))
    .slice(0, 6).map((p) => card(db, p, savedIds(db, u)));
}

const approval = (db, p, decision, reason, actorId) => insert(db, 'approvals', { propertyId: p.id, decision, reason: reason ?? null, actorId });
function applyInput(p, input) {
  validate(input, {
    title: [required('Title is required'), maxLen(200)], propertyType: [required('Property type is required')],
    category: [matches(/^(SALE|RENT)$/, 'Choose Sale or Rent')], description: [maxLen(5000)], city: [required('City is required')],
    address: [required('Address is required'), maxLen(300)], postalCode: [matches(/^(\d{6})?$/, 'Enter a 6-digit PIN code')],
    area: [required('Area is required'), atLeast(0.01, 'Area must be positive')], price: [required('Price is required'), atLeast(1, 'Price must be positive')],
    bedrooms: [atLeast(0)], bathrooms: [atLeast(0)], amenities: [maxLen(1000)],
  });
  const type = TYPES.find((t) => text(t) === text(input.propertyType).trim()) || bad('Unknown property type');
  const num = (v) => (v == null || v === '' ? null : Number(v));
  Object.assign(p, {
    title: input.title.trim(), propertyType: type, category: input.category, description: input.description ?? null, city: input.city.trim(),
    locality: input.locality ?? null, address: input.address.trim(), postalCode: has(input.postalCode) ? input.postalCode : null, area: Number(input.area),
    measurementUnit: has(input.measurementUnit) ? input.measurementUnit : 'sq ft', price: Number(input.price), bedrooms: num(input.bedrooms),
    bathrooms: num(input.bathrooms), furnishingStatus: input.furnishingStatus ?? null, parkingAvailable: !!input.parkingAvailable,
    amenities: input.amenities ?? null, constructionType: input.constructionType ?? null, facing: input.facing ?? null, approvedBy: input.approvedBy ?? null,
    updatedAt: stamp(),
  });
}
function markStatus(db, p, status, actorId, reason) {
  p.status = status;
  p.updatedAt = stamp();
  approval(db, p, status, reason, actorId);
  audit(db, actorId, `PROPERTY_${status}`, 'Property', p.id, reason);
  if (status === 'SOLD') notify(db, p.sellerId, 'Property marked as sold', p.title, '/seller/properties');
}
const requireSeller = (u) => u.sellerEnabled || forbidden('Your seller verification must be approved before you can list properties');
const owned = (db, u, id) => {
  requireSeller(u);
  const p = byId(db, 'properties', id);
  return p && p.sellerId === u.id ? p : notFound('Property');
};

// ================================================================ enquiry views
const system = (db, e, body) => insert(db, 'buyerMessages', { enquiryId: e.id, senderRole: 'SYSTEM', senderId: 0, body });
const words = (s) => s.replace(/_/g, ' ').toLowerCase();
function setStatus(db, e, status, reason, actorId, tellCustomer) {
  if (e.status === status) return;
  e.status = status;
  if (FINISHED.includes(status)) e.closureReason = reason ?? null;
  e.updatedAt = stamp();
  system(db, e, `Status changed to ${words(status)}${has(reason) && FINISHED.includes(status) ? ` - ${reason}` : ''}`);
  if (tellCustomer) notify(db, e.customerId, `Your enquiry is now: ${words(status)}`, reason ?? null, `/enquiries/${e.id}`);
  audit(db, actorId, `ENQUIRY_${status}`, 'Enquiry', e.id, reason);
}
const moveTo = (db, enquiryId, status, reason, actorId) => {
  const e = enquiryId && byId(db, 'enquiries', enquiryId);
  if (e) setStatus(db, e, status, reason, actorId, true);
};
const messageView = (m, viewer) => ({
  id: m.id, from: m.senderRole === 'SYSTEM' ? 'SYSTEM' : m.senderRole === viewer ? 'ME' : m.senderRole === 'AGENT' ? 'AGENT' : 'CUSTOMER',
  body: m.body, internal: m.internalNote, at: m.createdAt,
});
const visitsOf = (db, id) => db.visits.filter((v) => v.enquiryId === id).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  .map((v) => ({ id: v.id, scheduledAt: v.scheduledAt, status: v.status, notes: v.notes }));
const customerEnquiry = (db, e) => ({
  id: e.id, property: card(db, byId(db, 'properties', e.propertyId)), enquiryType: e.enquiryType, status: e.status, message: e.message,
  createdAt: e.createdAt, updatedAt: e.updatedAt,
});
const myEnquiries = (db, u) => db.enquiries.filter((e) => e.customerId === u.id).sort(desc).map((e) => customerEnquiry(db, e));
const ownEnquiry = (db, u, id) => {
  const e = byId(db, 'enquiries', id);
  return e && e.customerId === u.id ? e : notFound('Enquiry'); // "not found" so other ids cannot be probed
};
const customerDetail = (db, e) => ({
  enquiry: customerEnquiry(db, e),
  messages: db.buyerMessages.filter((m) => m.enquiryId === e.id && !m.internalNote).map((m) => messageView(m, 'CUSTOMER')),
  visits: visitsOf(db, e.id),
});
function agentEnquiry(db, e) {
  const p = byId(db, 'properties', e.propertyId);
  return {
    id: e.id, status: e.status, priority: e.priority, followUpDate: e.followUpDate, closureReason: e.closureReason, enquiryType: e.enquiryType,
    message: e.message, createdAt: e.createdAt, updatedAt: e.updatedAt, property: card(db, p), propertyAddress: p.address,
    buyer: summary(byId(db, 'users', e.customerId)), seller: summary(byId(db, 'users', p.sellerId)),
  };
}
function agentDetail(db, id) {
  const e = need(db, 'enquiries', id, 'Enquiry');
  const latest = (table) => db[table].filter((r) => r.enquiryId === e.id).sort(desc)[0]?.id ?? null;
  return {
    enquiry: agentEnquiry(db, e),
    messages: db.buyerMessages.filter((m) => m.enquiryId === e.id).map((m) => messageView(m, 'AGENT')),
    visits: visitsOf(db, e.id),
    offers: db.offers.filter((o) => o.enquiryId === e.id).map((o) => ({ id: o.id, amount: o.amount, note: o.note, status: o.status, at: o.createdAt })),
    saleId: latest('sales'), rentalId: latest('rentals'),
  };
}

// ================================================================ seller verification views
const verificationDocs = (db, id) => db.verificationDocs.filter((d) => d.verificationId === id && !d.superseded).map(docView);
const historyOf = (db, id) => db.history.filter((h) => h.verificationId === id).map((h) => ({ fromStatus: h.fromStatus, toStatus: h.toStatus, note: h.note, at: h.createdAt }));
const myVerification = (db, v) => v && ({
  id: v.id, status: v.status, rejectionReason: v.rejectionReason, consentGiven: v.consentGiven, submittedAt: v.submittedAt, reviewedAt: v.reviewedAt,
  documents: verificationDocs(db, v.id), history: historyOf(db, v.id),
});
function agentVerification(db, v) {
  const u = need(db, 'users', v.userId, 'User');
  return { ...myVerification(db, v), userId: u.id, applicantName: u.fullName, applicantEmail: u.email, applicantPhone: u.phone, applicantCity: u.city, reviewNotes: v.reviewNotes };
}
const record = (db, v, fromStatus, toStatus, note, actorId) => insert(db, 'history', { verificationId: v.id, fromStatus, toStatus, note, actorId });
function transition(db, v, to, note, actor) {
  const from = v.status;
  Object.assign(v, { status: to, reviewedAt: stamp(), updatedAt: stamp() });
  record(db, v, from, to, note, actor.id);
}

// ================================================================ agent views
const agentCustomer = (db, u) => ({
  user: userView(db, u), sellerApplicationStatus: sellerStatus(db, u), propertyCount: db.properties.filter((p) => p.sellerId === u.id).length,
  enquiryCount: db.enquiries.filter((e) => e.customerId === u.id).length, accountEnabled: u.accountEnabled, joinedAt: u.createdAt,
});
const person = (db, id) => byId(db, 'users', id);
function saleView(db, t) {
  const p = byId(db, 'properties', t.propertyId), b = person(db, t.buyerId), s = person(db, t.sellerId);
  return { ...t, propertyTitle: p.title, buyerName: b.fullName, buyerPhone: b.phone, sellerName: s.fullName, sellerPhone: s.phone };
}
function rentalView(db, r) {
  const p = byId(db, 'properties', r.propertyId), t = person(db, r.tenantId);
  return { ...r, propertyTitle: p.title, tenantName: t.fullName, tenantPhone: t.phone };
}
function exportTable(db, what) {
  const s = (v) => (v == null ? '' : String(v));
  if (what === 'customers') {
    return { title: 'Customers', headers: ['Name', 'Email', 'Mobile', 'City', 'Seller', 'Active', 'Joined'], rows: db.users.filter((u) => u.role !== 'AGENT').map((u) => [s(u.fullName), s(u.email), s(u.phone), s(u.city), u.sellerEnabled ? 'Yes' : 'No', u.accountEnabled ? 'Yes' : 'No', s(u.createdAt).replace('T', ' ')]) };
  }
  if (what === 'properties') {
    return { title: 'Properties', headers: ['ID', 'Title', 'Type', 'For', 'City', 'Locality', 'Price', 'Area', 'Status'], rows: db.properties.map((p) => [p.id, p.title, p.propertyType, p.category, p.city, p.locality, p.price, p.area, p.status].map(s)) };
  }
  if (what === 'sales') {
    return { title: 'Sales', headers: ['ID', 'Property', 'Buyer', 'Seller', 'Final amount', 'Down payment', 'Deal date', 'Registry date', 'Commission', 'Status'], rows: db.sales.map((t) => [t.id, byId(db, 'properties', t.propertyId)?.title, person(db, t.buyerId)?.fullName, person(db, t.sellerId)?.fullName, t.finalAmount, t.downPayment, t.dealDate, t.registryDate, t.totalCommission, t.status].map(s)) };
  }
  return notFound('Export');
}

// ================================================================ routes: auth and account
route('GET', '/health', 'public', () => ({ status: 'ok', service: 'haven-realty-browser-demo' }));

route('POST', '/auth/register', 'public', async ({ db, body: r }) => {
  validate(r, {
    fullName: [required('Full name is required'), maxLen(120)], email: [required('Email is required'), matches(EMAIL, 'Enter a valid email')],
    phone: [required('Enter a 10-digit mobile number'), matches(/^\d{10}$/, 'Enter a 10-digit mobile number')],
    address: [required('Address is required'), maxLen(300)], city: [required('City is required')], state: [required('State is required')],
    postalCode: [matches(/^\d{6}$/, 'Enter a 6-digit PIN code')],
    password: [required('Password is required'), [(v) => v.length >= 8 && v.length <= 72, 'Use 8 to 72 characters']],
  });
  const email = r.email.trim().toLowerCase();
  strongEnough(r.password);
  if (db.users.some((u) => u.email === email)) conflict('This email is already registered');
  if (db.users.some((u) => u.phone === r.phone)) conflict('This mobile number is already registered');
  const purpose = (r.purpose || 'BUY').toUpperCase();
  if (!/^(BUY|SELL|BOTH)$/.test(purpose)) bad('Choose Buy, Sell or Both');
  const u = insert(db, 'users', { fullName: r.fullName.trim(), email, password: await hash(r.password), phone: r.phone, dateOfBirth: r.dateOfBirth || null, address: r.address, city: r.city, state: r.state, postalCode: r.postalCode ?? null, role: 'CUSTOMER' });
  const devEmailCode = issueCode(db, u, 'EMAIL', 'VERIFY'), devPhoneCode = issueCode(db, u, 'PHONE', 'VERIFY');
  audit(db, u.id, 'CUSTOMER_REGISTERED', 'User', u.id, `purpose=${purpose}`);
  notifyAgent(db, 'New customer registered', `${u.fullName} joined as ${purpose.toLowerCase()}`, '/agent/customers');
  notify(db, u.id, 'Welcome to Haven Realty', 'Verify your email and mobile to start sending enquiries.', '/account/verify');
  return { token: token(u), user: userView(db, u), nextStep: purpose === 'BUY' ? 'VERIFY' : 'VERIFY_THEN_SELLER_APPLICATION', devEmailCode, devPhoneCode };
});

route('POST', '/auth/login', 'public', async ({ db, body: r }) => {
  validate(r, { email: [required()], password: [required()] });
  const u = db.users.find((x) => x.email === r.email.trim().toLowerCase());
  if (u && !u.accountEnabled) forbidden('This account has been suspended. Please contact the agent.');
  const portal = (r.portal || 'CUSTOMER').toUpperCase();
  if (!u || !(await passwordMatches(r.password, u.password)) || u.role !== portal) fail(401, 'Invalid email or password');
  audit(db, u.id, 'LOGIN', 'User', u.id, portal);
  return { token: token(u), user: userView(db, u), nextStep: null, devEmailCode: null, devPhoneCode: null };
});

route('POST', '/auth/forgot-password', 'public', ({ db, body: r }) => {
  validate(r, { email: [required(), matches(EMAIL, 'Enter a valid email')] });
  const out = { message: 'If that email is registered, a reset code has been sent.' };
  const u = db.users.find((x) => x.email === r.email.trim().toLowerCase());
  if (u) out.devCode = issueCode(db, u, 'EMAIL', 'RESET');
  return out;
});

route('POST', '/auth/reset-password', 'public', async ({ db, body: r }) => {
  validate(r, { email: [required()], code: [required()], newPassword: [required(), [(v) => v.length >= 8 && v.length <= 72, 'Use 8 to 72 characters']] });
  const u = db.users.find((x) => x.email === r.email.trim().toLowerCase()) || bad('Invalid or expired code');
  consumeCode(db, u, 'EMAIL', 'RESET', r.code);
  strongEnough(r.newPassword);
  u.password = await hash(r.newPassword);
  audit(db, u.id, 'PASSWORD_RESET', 'User', u.id);
  return { message: 'Password updated. You can sign in now.' };
});

route('GET', '/account/me', 'any', ({ db, user }) => userView(db, user));
route('POST', '/account/change-password', 'any', async ({ db, user, body: r }) => {
  validate(r, { currentPassword: [required()], newPassword: [required(), [(v) => v.length >= 8 && v.length <= 72, 'Use 8 to 72 characters']] });
  if (!(await passwordMatches(r.currentPassword, user.password))) bad('Current password is incorrect');
  strongEnough(r.newPassword);
  user.password = await hash(r.newPassword);
  audit(db, user.id, 'PASSWORD_CHANGED', 'User', user.id);
  return { message: 'Password changed' };
});
const myNotifications = (db, u) => db.notifications.filter((n) => n.userId === u.id).sort(desc).slice(0, 50)
  .map((n) => ({ id: n.id, title: n.title, body: n.body || '', link: n.link || '', read: n.read, createdAt: n.createdAt }));
const unread = (db, u) => db.notifications.filter((n) => n.userId === u.id && !n.read).length;
route('GET', '/account/notifications', 'any', ({ db, user }) => ({ items: myNotifications(db, user), unread: unread(db, user) }));
route('POST', '/account/notifications/read-all', 'any', ({ db, user }) => {
  db.notifications.filter((n) => n.userId === user.id).forEach((n) => { n.read = true; });
  return { message: 'ok' };
});
route('POST', '/account/notifications/:id/read', 'any', ({ db, user, ids: [id] }) => {
  const n = byId(db, 'notifications', id);
  if (n?.userId === user.id) n.read = true;
  return { message: 'ok' };
});

// Demo only: lets visitors choose the agent login for their own browser, so no private password is ever published.
route('PUT', '/demo/agent-login', 'public', async ({ db, body: r }) => {
  validate(r, { email: [required('Email is required'), matches(EMAIL, 'Enter a valid email')], password: [required('Password is required'), [(v) => v.length >= 8 && v.length <= 72, 'Use 8 to 72 characters']] });
  const email = r.email.trim().toLowerCase();
  strongEnough(r.password);
  const agent = agentUser(db);
  if (db.users.some((u) => u !== agent && u.email === email)) conflict('This email belongs to another account in the demo');
  Object.assign(agent, { email, password: await hash(r.password) });
  audit(db, agent.id, 'AGENT_LOGIN_CHANGED', 'User', agent.id);
  return { message: 'Agent login changed in this browser' };
});

// ================================================================ routes: public catalogue
route('GET', '/properties', 'public', ({ db, user, query: c }) => {
  const q = text(c.q).trim();
  let rows = db.properties.filter((p) => p.status === PUBLISHED);
  const keep = (value, test) => { if (has(value)) rows = rows.filter(test); };
  keep(c.q, (p) => [p.title, p.city, p.locality, p.address].some((v) => text(v).includes(q)));
  keep(c.city, (p) => text(p.city) === text(c.city).trim());
  keep(c.locality, (p) => text(p.locality).includes(text(c.locality).trim()));
  keep(c.type, (p) => text(p.propertyType) === text(c.type).trim());
  keep(c.category, (p) => p.category === String(c.category).toUpperCase());
  keep(c.bhk, (p) => (Number(c.bhk) >= 4 ? p.bedrooms >= 4 : p.bedrooms === Number(c.bhk)));
  keep(c.minPrice, (p) => p.price >= Number(c.minPrice));
  keep(c.maxPrice, (p) => p.price <= Number(c.maxPrice));
  keep(c.minArea, (p) => p.area >= Number(c.minArea));
  keep(c.maxArea, (p) => p.area <= Number(c.maxArea));
  const recentFirst = newest('createdAt');
  const sorts = { price_asc: (a, b) => a.price - b.price, price_desc: (a, b) => b.price - a.price, newest: recentFirst };
  rows.sort(sorts[c.sort] || ((a, b) => b.viewCount - a.viewCount || recentFirst(a, b)));
  const out = page(rows, c.page, Math.min(Number(c.size) || 12, 48));
  const saved = savedIds(db, user);
  return { ...out, content: out.content.map((p) => card(db, p, saved)) };
});

route('GET', '/properties/compare', 'public', ({ db, query }) => {
  const ids = list(query.ids);
  if (!ids.length || ids.length > 4) bad('Choose between 1 and 4 properties to compare');
  return published(db, ids).map((p) => card(db, p));
});

route('GET', '/properties/:id', 'public', ({ db, user, ids: [id], touch }) => {
  const p = need(db, 'properties', id, 'Property');
  const owner = user && p.sellerId === user.id, agent = user?.role === 'AGENT';
  if (p.status !== PUBLISHED && !owner && !agent) notFound('Property');
  if (!owner && !agent) {
    p.viewCount += 1;
    if (user) {
      const seen = db.recent.find((r) => r.userId === user.id && r.propertyId === p.id) || insert(db, 'recent', { userId: user.id, propertyId: p.id });
      seen.viewedAt = stamp();
    }
    touch();
  }
  return {
    card: card(db, p, savedIds(db, user)), description: p.description, postalCode: p.postalCode, parkingAvailable: p.parkingAvailable,
    amenities: String(p.amenities || '').split(',').map((a) => a.trim()).filter(Boolean),
    imageUrls: imagesOf(db, p.id).map((i) => imageUrl(p.id, i.id)),
    constructionType: p.constructionType, facing: p.facing, approvedBy: p.approvedBy,
    contactedThrough: 'Our agent handles all enquiries and visits for this property',
  };
});

route('GET', '/properties/:id/images/:imageId', 'public', ({ db, user, ids: [id, imageId] }) => {
  const p = need(db, 'properties', id, 'Image');
  const allowed = p.status === PUBLISHED || user?.role === 'AGENT' || (user && p.sellerId === user.id);
  const img = byId(db, 'images', imageId);
  if (!allowed || img?.propertyId !== p.id) notFound('Image');
  return db.files[img.storedName] || notFound('File');
});

// ================================================================ routes: private documents
route('GET', '/files/verification-documents/:id', 'any', ({ db, user, ids: [id], touch }) => {
  const d = need(db, 'verificationDocs', id, 'Document');
  const v = need(db, 'verifications', d.verificationId, 'Application');
  if (user.role !== 'AGENT' && v.userId !== user.id) notFound('Document');
  audit(db, user.id, 'DOCUMENT_VIEWED', 'VerificationDocument', d.id);
  touch();
  return db.files[d.storedName] || notFound('File');
});
route('GET', '/files/property-documents/:id', 'any', ({ db, user, ids: [id], touch }) => {
  const d = need(db, 'propertyDocs', id, 'Document');
  const p = need(db, 'properties', d.propertyId, 'Document');
  if (user.role !== 'AGENT' && p.sellerId !== user.id) notFound('Document');
  audit(db, user.id, 'DOCUMENT_VIEWED', 'PropertyDocument', d.id);
  touch();
  return db.files[d.storedName] || notFound('File');
});

// ================================================================ routes: buyer
route('PUT', '/me', 'CUSTOMER', ({ db, user: u, body: r }) => {
  validate(r, { fullName: [required(), maxLen(120)], phone: [matches(/^\d{10}$/, 'Enter a 10-digit mobile number')], postalCode: [matches(/^(\d{6})?$/, 'Enter a 6-digit PIN code')], preferences: [maxLen(1000)] });
  if (r.phone !== u.phone) {
    if (db.users.some((x) => x.phone === r.phone)) conflict('That mobile number is already registered');
    u.phone = r.phone;
    u.phoneVerified = false;
  }
  for (const k of ['fullName', 'dateOfBirth', 'address', 'city', 'state', 'postalCode', 'preferences']) u[k] = r[k] ?? null;
  return userView(db, u);
});
const channelOf = (v) => {
  const c = String(v || '').toUpperCase();
  return /^(EMAIL|PHONE)$/.test(c) ? c : bad('Unknown channel');
};
route('POST', '/me/verify', 'CUSTOMER', ({ db, user, body: r }) => {
  validate(r, { channel: [required()], code: [required()] });
  const channel = channelOf(r.channel);
  consumeCode(db, user, channel, 'VERIFY', r.code);
  if (channel === 'EMAIL') user.emailVerified = true; else user.phoneVerified = true;
  audit(db, user.id, `${channel}_VERIFIED`, 'User', user.id);
  return { message: 'Verified' };
});
route('POST', '/me/resend', 'CUSTOMER', ({ db, user, body }) => ({ sent: true, devCode: issueCode(db, user, channelOf(body?.channel || 'EMAIL'), 'VERIFY') }));

route('GET', '/me/seller-application', 'CUSTOMER', ({ db, user }) => myVerification(db, latestVerification(db, user.id)) || '');
route('POST', '/me/seller-application', 'CUSTOMER', async ({ db, user, form }) => {
  const file = (k) => { const f = form.get(k); return f && f.size ? f : null; };
  const identity = file('identity'), address = file('address'), photo = file('photo');
  if (!user.emailVerified || !user.phoneVerified) bad('Please verify your email and mobile number before applying');
  if (String(form.get('consent')) !== 'true') bad('You must consent to the review of your documents');
  let v = latestVerification(db, user.id);
  const resubmission = v?.status === 'RESUBMISSION_REQUIRED';
  if (['PENDING', 'UNDER_REVIEW', 'VERIFIED'].includes(v?.status)) conflict(v.status === 'VERIFIED' ? 'You are already a verified seller' : 'Your application is already being reviewed');
  const fresh = !v || v.status === 'REJECTED';
  if (fresh && !(identity && address && photo)) bad('Identity proof, address proof and a recent photograph are all required');
  if (resubmission && !(identity || address || photo)) bad('Upload at least one corrected document');
  const from = v?.status ?? null;
  if (fresh) v = insert(db, 'verifications', { userId: user.id, consentGiven: true });
  else Object.assign(v, { status: 'PENDING', consentGiven: true, submittedAt: stamp(), updatedAt: stamp(), rejectionReason: null });
  for (const [docType, f, imageOnly] of [['IDENTITY', identity, false], ['ADDRESS', address, false], ['PHOTO', photo, true]]) {
    if (!f) continue;
    const stored = storeFile(db, await readUpload(f, imageOnly));
    db.verificationDocs.filter((d) => d.verificationId === v.id && d.docType === docType).forEach((d) => { d.superseded = true; });
    insert(db, 'verificationDocs', { verificationId: v.id, docType, ...stored });
  }
  record(db, v, from, 'PENDING', resubmission ? 'Documents resubmitted' : 'Application submitted', user.id);
  audit(db, user.id, 'SELLER_APPLICATION_SUBMITTED', 'SellerVerification', v.id);
  notifyAgent(db, 'Seller application', `${user.fullName} submitted documents for review`, '/agent/verifications');
  return myVerification(db, v);
});

route('GET', '/me/wishlist', 'CUSTOMER', ({ db, user }) => wishlistOf(db, user));
route('POST', '/me/wishlist/:id', 'CUSTOMER', ({ db, user, ids: [id] }) => {
  const p = byId(db, 'properties', id);
  if (p?.status !== PUBLISHED) notFound('Property');
  if (!db.wishlist.some((w) => w.userId === user.id && w.propertyId === p.id)) insert(db, 'wishlist', { userId: user.id, propertyId: p.id });
  return { message: 'Saved' };
});
route('DELETE', '/me/wishlist/:id', 'CUSTOMER', ({ db, user, ids: [id] }) => {
  db.wishlist = db.wishlist.filter((w) => !(w.userId === user.id && w.propertyId === Number(id)));
  return { message: 'Removed' };
});
route('GET', '/me/recently-viewed', 'CUSTOMER', ({ db, user }) => recentlyViewed(db, user));
route('GET', '/me/dashboard', 'CUSTOMER', ({ db, user }) => ({
  user: userView(db, user), recentlyViewed: recentlyViewed(db, user), wishlist: wishlistOf(db, user), recommended: recommended(db, user),
  enquiries: myEnquiries(db, user).slice(0, 5), notifications: myNotifications(db, user).slice(0, 5), unreadNotifications: unread(db, user),
}));

route('POST', '/me/enquiries', 'CUSTOMER', ({ db, user, body: r }) => {
  validate(r, { propertyId: [required('Property is required')], enquiryType: [matches(/^(BUY|RENT|INFO|SITE_VISIT)$/, 'Choose a valid enquiry type')], message: [required('Please write a message'), maxLen(2000)] });
  if (!user.emailVerified) forbidden('Please verify your email before sending enquiries');
  const p = byId(db, 'properties', r.propertyId);
  if (p?.status !== PUBLISHED) notFound('Property');
  if (p.sellerId === user.id) bad('You cannot enquire about your own property');
  if (db.enquiries.some((e) => e.customerId === user.id && e.propertyId === p.id && !FINISHED.includes(e.status))) conflict('You already have an open enquiry for this property. Add a message to it instead.');
  const e = insert(db, 'enquiries', { propertyId: p.id, customerId: user.id, enquiryType: r.enquiryType || 'INFO', message: r.message.trim() });
  insert(db, 'buyerMessages', { enquiryId: e.id, senderRole: 'CUSTOMER', senderId: user.id, body: e.message });
  system(db, e, 'Your enquiry was received. Our agent will contact you shortly.');
  notifyAgent(db, 'New enquiry', `${user.fullName} asked about ${p.title}`, `/agent/enquiries/${e.id}`);
  notify(db, p.sellerId, 'New interest in your listing', `Someone enquired about ${p.title}. Our agent is handling it.`, '/seller/properties');
  audit(db, user.id, 'ENQUIRY_CREATED', 'Enquiry', e.id);
  return customerEnquiry(db, e);
});
route('GET', '/me/enquiries', 'CUSTOMER', ({ db, user }) => myEnquiries(db, user));
route('GET', '/me/enquiries/:id', 'CUSTOMER', ({ db, user, ids: [id] }) => customerDetail(db, ownEnquiry(db, user, id)));
route('POST', '/me/enquiries/:id/messages', 'CUSTOMER', ({ db, user, ids: [id], body: r }) => {
  validate(r, { body: [required('Message is empty'), maxLen(4000)] });
  const e = ownEnquiry(db, user, id);
  if (FINISHED.includes(e.status)) conflict('This enquiry is closed');
  insert(db, 'buyerMessages', { enquiryId: e.id, senderRole: 'CUSTOMER', senderId: user.id, body: r.body.trim() });
  e.updatedAt = stamp();
  notifyAgent(db, `Reply from ${user.fullName}`, r.body, `/agent/enquiries/${e.id}`);
  return customerDetail(db, e);
});
route('POST', '/me/enquiries/:id/cancel', 'CUSTOMER', ({ db, user, ids: [id] }) => {
  const e = ownEnquiry(db, user, id);
  if (FINISHED.includes(e.status)) conflict('This enquiry is already finished');
  setStatus(db, e, 'CANCELLED', 'Cancelled by customer', user.id, false);
  return customerDetail(db, e);
});

// ================================================================ routes: seller
route('GET', '/seller/dashboard', 'CUSTOMER', ({ db, user }) => {
  requireSeller(user);
  const mine = db.properties.filter((p) => p.sellerId === user.id);
  const count = (...s) => mine.filter((p) => s.includes(p.status)).length;
  return {
    totalProperties: mine.length, activeListings: count(PUBLISHED), pendingApprovals: count('SUBMITTED', 'UNDER_REVIEW'), rejectedListings: count('REJECTED'),
    soldProperties: count('SOLD'), propertyViews: mine.reduce((n, p) => n + p.viewCount, 0),
    enquiryCount: db.enquiries.filter((e) => mine.some((p) => p.id === e.propertyId)).length,
  };
});
route('GET', '/seller/properties', 'CUSTOMER', ({ db, user }) => {
  requireSeller(user);
  return db.properties.filter((p) => p.sellerId === user.id).sort(desc).map((p) => sellerView(db, p));
});
route('POST', '/seller/properties', 'CUSTOMER', ({ db, user, body }) => {
  requireSeller(user);
  const draft = {};
  applyInput(draft, body);
  const p = insert(db, 'properties', { ...draft, sellerId: user.id });
  audit(db, user.id, 'PROPERTY_CREATED', 'Property', p.id, p.title);
  return sellerView(db, p);
});
route('GET', '/seller/properties/:id', 'CUSTOMER', ({ db, user, ids: [id] }) => sellerView(db, owned(db, user, id)));
route('PUT', '/seller/properties/:id', 'CUSTOMER', ({ db, user, ids: [id], body }) => {
  const p = owned(db, user, id);
  if (['SUBMITTED', 'UNDER_REVIEW', 'SOLD', 'SUSPENDED'].includes(p.status)) conflict(`This listing cannot be edited while it is ${words(p.status)}`);
  applyInput(p, body);
  if (p.status === PUBLISHED) {
    p.status = 'SUBMITTED'; // edited live listings are re-checked by the agent
    approval(db, p, 'RESUBMITTED', 'Edited after publishing', user.id);
    notifyAgent(db, 'Listing edited', `${p.title} needs another review`, '/agent/properties');
  }
  audit(db, user.id, 'PROPERTY_UPDATED', 'Property', p.id);
  return sellerView(db, p);
});
route('POST', '/seller/properties/:id/images', 'CUSTOMER', async ({ db, user, ids: [id], form }) => {
  const p = owned(db, user, id);
  const files = form.getAll('files');
  if (!files.length) bad('Choose at least one image');
  let order = imagesOf(db, p.id).length;
  if (order + files.length > 12) bad('A listing can have at most 12 images');
  for (const f of files) insert(db, 'images', { propertyId: p.id, sortOrder: order++, ...storeFile(db, await readUpload(f, true)) });
  return sellerView(db, p);
});
route('DELETE', '/seller/properties/:id/images/:imageId', 'CUSTOMER', ({ db, user, ids: [id, imageId] }) => {
  const p = owned(db, user, id);
  const img = db.images.find((i) => i.id === Number(imageId) && i.propertyId === p.id);
  if (img) { delete db.files[img.storedName]; db.images = db.images.filter((i) => i !== img); }
  return sellerView(db, p);
});
route('POST', '/seller/properties/:id/documents', 'CUSTOMER', async ({ db, user, ids: [id], form, query }) => {
  const p = owned(db, user, id);
  const docType = form.get('docType') || query.docType;
  const stored = storeFile(db, await readUpload(form.get('file'), false));
  insert(db, 'propertyDocs', { propertyId: p.id, docType: has(docType) ? String(docType).toUpperCase() : 'OWNERSHIP', ...stored });
  audit(db, user.id, 'PROPERTY_DOCUMENT_UPLOADED', 'Property', p.id, docType || null);
  return sellerView(db, p);
});
route('POST', '/seller/properties/:id/submit', 'CUSTOMER', ({ db, user, ids: [id] }) => {
  const p = owned(db, user, id);
  if (!['DRAFT', 'REJECTED'].includes(p.status)) conflict('Only drafts or rejected listings can be submitted');
  if (!imagesOf(db, p.id).length) bad('Add at least one photo before submitting');
  if (!db.propertyDocs.some((d) => d.propertyId === p.id && d.docType === 'OWNERSHIP')) bad('Upload an ownership document before submitting');
  const resubmit = p.status === 'REJECTED';
  Object.assign(p, { status: 'SUBMITTED', rejectionReason: null, updatedAt: stamp() });
  approval(db, p, resubmit ? 'RESUBMITTED' : 'SUBMITTED', null, user.id);
  notifyAgent(db, 'New listing to review', `${p.title} (${p.city})`, '/agent/properties');
  audit(db, user.id, 'PROPERTY_SUBMITTED', 'Property', p.id);
  return sellerView(db, p);
});
for (const [action, active] of [['activate', true], ['deactivate', false]]) {
  route('POST', `/seller/properties/:id/${action}`, 'CUSTOMER', ({ db, user, ids: [id] }) => {
    const p = owned(db, user, id);
    if (active && p.status === 'INACTIVE') p.status = PUBLISHED;
    else if (!active && p.status === PUBLISHED) p.status = 'INACTIVE';
    else conflict(`That change is not possible for a ${p.status.toLowerCase()} listing`);
    p.updatedAt = stamp();
    audit(db, user.id, active ? 'PROPERTY_REACTIVATED' : 'PROPERTY_DEACTIVATED', 'Property', p.id);
    return sellerView(db, p);
  });
}
const sellerMessage = (m) => ({ id: m.id, fromAgent: m.senderRole === 'AGENT', body: m.body, propertyId: m.propertyId, createdAt: m.createdAt });
const thread = (db, sellerId) => db.sellerMessages.filter((m) => m.sellerId === Number(sellerId)).map(sellerMessage);
route('GET', '/seller/messages', 'CUSTOMER', ({ db, user }) => (user.sellerEnabled ? thread(db, user.id) : forbidden('Seller access required')));
route('POST', '/seller/messages', 'CUSTOMER', ({ db, user, body: r }) => {
  validate(r, { body: [required()] });
  if (!user.sellerEnabled) forbidden('Seller access required');
  if (r.propertyId != null && byId(db, 'properties', r.propertyId)?.sellerId !== user.id) notFound('Property');
  const m = insert(db, 'sellerMessages', { sellerId: user.id, propertyId: r.propertyId ?? null, senderRole: 'SELLER', senderId: user.id, body: r.body.trim() });
  notifyAgent(db, `Message from seller ${user.fullName}`, r.body, `/agent/customers/${user.id}`);
  return sellerMessage(m);
});

// ================================================================ routes: agent
route('GET', '/agent/dashboard', 'AGENT', ({ db }) => {
  const customers = db.users.filter((u) => u.role === 'CUSTOMER');
  const sellers = customers.filter((u) => u.sellerEnabled).length;
  const count = (table, ...s) => db[table].filter((r) => s.includes(r.status)).length;
  const grouped = (table, key) => Object.entries(db[table].reduce((m, r) => ({ ...m, [r[key]]: (m[r[key]] || 0) + 1 }), {})).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({ name, value }));
  return {
    totalCustomers: customers.length, totalBuyers: customers.length, totalSellers: sellers,
    pendingSellerVerifications: count('verifications', 'PENDING', 'UNDER_REVIEW'), verifiedSellers: sellers,
    totalProperties: db.properties.length, pendingPropertyApprovals: count('properties', 'SUBMITTED', 'UNDER_REVIEW'), activeProperties: count('properties', PUBLISHED),
    totalEnquiries: db.enquiries.length, pendingEnquiries: count('enquiries', 'NEW'), ongoingDeals: count('sales', 'ONGOING'),
    completedDeals: count('sales', 'COMPLETED'), activeRentals: count('rentals', 'ACTIVE'),
    enquiriesByStatus: ENQUIRY_STATUS.map((name) => ({ name, value: count('enquiries', name) })).filter((x) => x.value > 0),
    propertiesByStatus: grouped('properties', 'status'), propertiesByType: grouped('properties', 'propertyType'), dealsByStatus: grouped('sales', 'status'),
  };
});
route('GET', '/agent/audit-logs', 'AGENT', ({ db, query }) => {
  const out = page([...db.audit].sort(desc), query.page, Math.min(Number(query.size) || 30, 100));
  return { ...out, content: out.content.map((a) => ({ id: a.id, actorId: a.actorId, actorName: a.actorId == null ? 'System' : person(db, a.actorId)?.fullName || 'Unknown', action: a.action, entityType: a.entityType, entityId: a.entityId, details: a.details, at: a.createdAt })) };
});
for (const what of ['customers', 'properties', 'sales']) {
  route('GET', `/agent/export/${what}`, 'AGENT', ({ db }) => { const t = exportTable(db, what); return makeXlsx(t.title, t.headers, t.rows); });
  route('GET', `/agent/export/${what}.pdf`, 'AGENT', ({ db }) => { const t = exportTable(db, what); return tablePdf(t.title, t.headers, t.rows); });
}

const customerById = (db, id) => {
  const u = byId(db, 'users', id);
  return u && u.role !== 'AGENT' ? u : notFound('Customer');
};
route('GET', '/agent/customers', 'AGENT', ({ db, query }) => {
  const q = text(query.q).trim();
  const rows = db.users.filter((u) => u.role === 'CUSTOMER' && (text(query.kind) !== 'seller' || u.sellerEnabled)
    && (!q || [u.fullName, u.email, u.phone].some((v) => text(v).includes(q)))).sort(desc);
  const out = page(rows, query.page, query.size);
  return { ...out, content: out.content.map((u) => agentCustomer(db, u)) };
});
route('GET', '/agent/customers/:id', 'AGENT', ({ db, ids: [id] }) => agentCustomer(db, customerById(db, id)));
for (const [action, enabled] of [['suspend', false], ['reactivate', true]]) {
  route('POST', `/agent/customers/:id/${action}`, 'AGENT', ({ db, user, ids: [id], body }) => {
    const u = customerById(db, id);
    const reason = body?.reason ?? null;
    if (!enabled && !has(reason)) bad('A reason is required to suspend an account');
    u.accountEnabled = enabled;
    audit(db, user.id, enabled ? 'ACCOUNT_REACTIVATED' : 'ACCOUNT_SUSPENDED', 'User', u.id, reason);
    return agentCustomer(db, u);
  });
}
route('GET', '/agent/customers/:id/messages', 'AGENT', ({ db, ids: [id] }) => thread(db, id));
route('POST', '/agent/customers/:id/messages', 'AGENT', ({ db, user, ids: [id], body: r }) => {
  validate(r, { body: [required()] });
  const seller = byId(db, 'users', id);
  if (!seller?.sellerEnabled) notFound('Seller');
  if (r.propertyId != null && need(db, 'properties', r.propertyId, 'Property').sellerId !== seller.id) bad('That property does not belong to this seller');
  const m = insert(db, 'sellerMessages', { sellerId: seller.id, propertyId: r.propertyId ?? null, senderRole: 'AGENT', senderId: user.id, body: r.body.trim() });
  notify(db, seller.id, 'New message from your agent', r.body, '/seller/messages');
  return sellerMessage(m);
});

route('GET', '/agent/verifications', 'AGENT', ({ db, query }) => {
  const wanted = list(query.status);
  const rows = db.verifications.filter((v) => !wanted.length || wanted.includes(v.status)).sort(desc);
  const out = page(rows, query.page, query.size);
  return { ...out, content: out.content.map((v) => agentVerification(db, v)) };
});
route('GET', '/agent/verifications/:id', 'AGENT', ({ db, ids: [id] }) => agentVerification(db, need(db, 'verifications', id, 'Application')));
route('POST', '/agent/verifications/:id/review', 'AGENT', ({ db, user, ids: [id] }) => {
  const v = need(db, 'verifications', id, 'Application');
  if (v.status !== 'PENDING') conflict('Only pending applications can be moved to review');
  transition(db, v, 'UNDER_REVIEW', 'Review started', user);
  return agentVerification(db, v);
});
route('POST', '/agent/verifications/:id/decision', 'AGENT', ({ db, user, ids: [id], body: r }) => {
  validate(r, { action: [required()] });
  const v = need(db, 'verifications', id, 'Application');
  if (!['PENDING', 'UNDER_REVIEW'].includes(v.status)) conflict('This application is not awaiting a decision');
  const applicant = need(db, 'users', v.userId, 'User');
  const action = r.action.toUpperCase();
  if (has(r.notes)) v.reviewNotes = r.notes;
  if (action === 'APPROVE') {
    applicant.sellerEnabled = true;
    transition(db, v, 'VERIFIED', 'Approved', user);
    notify(db, applicant.id, 'You are now a verified seller', 'You can now list properties from the Seller portal.', '/seller');
  } else if (action === 'REJECT' || action === 'RESUBMIT') {
    if (!has(r.reason)) bad('A reason is required');
    v.rejectionReason = r.reason;
    const reject = action === 'REJECT';
    transition(db, v, reject ? 'REJECTED' : 'RESUBMISSION_REQUIRED', r.reason, user);
    notify(db, applicant.id, reject ? 'Seller application rejected' : 'Please resubmit your documents', r.reason, '/account/seller-application');
  } else bad('Action must be APPROVE, REJECT or RESUBMIT');
  audit(db, user.id, `SELLER_${action}`, 'SellerVerification', v.id, r.reason ?? null);
  return agentVerification(db, v);
});

route('GET', '/agent/properties', 'AGENT', ({ db, query }) => {
  const wanted = list(query.status), q = text(query.q).trim();
  const rows = db.properties.filter((p) => (wanted.length ? wanted : ALL_PROPERTY_STATUS).includes(p.status)
    && (!q || [p.title, p.city, p.address].some((v) => text(v).includes(q)))).sort(desc);
  const out = page(rows, query.page, query.size);
  return { ...out, content: out.content.map((p) => agentProperty(db, p)) };
});
route('GET', '/agent/properties/:id', 'AGENT', ({ db, ids: [id] }) => agentProperty(db, need(db, 'properties', id, 'Property')));
route('PUT', '/agent/properties/:id', 'AGENT', ({ db, user, ids: [id], body }) => {
  const p = need(db, 'properties', id, 'Property');
  applyInput(p, body);
  audit(db, user.id, 'PROPERTY_EDITED_BY_AGENT', 'Property', p.id);
  return agentProperty(db, p);
});
route('POST', '/agent/properties/:id/review', 'AGENT', ({ db, user, ids: [id] }) => {
  const p = need(db, 'properties', id, 'Property');
  if (p.status !== 'SUBMITTED') conflict('Only submitted listings can be put under review');
  p.status = 'UNDER_REVIEW';
  approval(db, p, 'REVIEW_STARTED', null, user.id);
  return agentProperty(db, p);
});
const DECISIONS = {
  APPROVE: { from: ['SUBMITTED', 'UNDER_REVIEW'], wrong: 'This listing is not awaiting approval', to: PUBLISHED, done: 'APPROVED', title: 'Listing approved' },
  REJECT: { from: ['SUBMITTED', 'UNDER_REVIEW'], wrong: 'This listing is not awaiting approval', to: 'REJECTED', done: 'REJECTED', title: 'Listing needs changes', reason: 'A rejection reason is required' },
  SUSPEND: { from: [PUBLISHED], wrong: 'Only published listings can be suspended', to: 'SUSPENDED', done: 'SUSPENDED', title: 'Listing suspended', reason: 'A reason is required' },
  RESTORE: { from: ['SUSPENDED'], wrong: 'Only suspended listings can be restored', to: PUBLISHED, done: 'RESTORED', title: 'Listing restored' },
};
route('POST', '/agent/properties/:id/decision', 'AGENT', ({ db, user, ids: [id], body: r }) => {
  validate(r, { action: [required()] });
  const p = need(db, 'properties', id, 'Property');
  const d = DECISIONS[r.action.toUpperCase()] || bad('Action must be APPROVE, REJECT, SUSPEND or RESTORE');
  if (!d.from.includes(p.status)) conflict(d.wrong);
  if (d.reason && !has(r.reason)) bad(d.reason);
  Object.assign(p, { status: d.to, rejectionReason: d.reason ? r.reason : null, updatedAt: stamp() });
  const body = d.reason ? `${p.title}: ${r.reason}` : `${p.title}${d.done === 'APPROVED' ? ' is now live.' : ' is live again.'}`;
  notify(db, p.sellerId, d.title, body, '/seller/properties');
  approval(db, p, d.done, r.reason, user.id);
  audit(db, user.id, `PROPERTY_${d.done}`, 'Property', p.id, r.reason ?? null);
  return agentProperty(db, p);
});
route('POST', '/agent/properties/:id/status', 'AGENT', ({ db, user, ids: [id], body: r }) => {
  validate(r, { status: [required()] });
  const p = need(db, 'properties', id, 'Property');
  const status = r.status.toUpperCase();
  if (!['INACTIVE', 'SOLD'].includes(status)) bad('Status must be INACTIVE or SOLD');
  markStatus(db, p, status, user.id, r.reason ?? null);
  return agentProperty(db, p);
});

route('GET', '/agent/enquiries', 'AGENT', ({ db, query }) => {
  const wanted = list(query.status);
  const rows = db.enquiries.filter((e) => !wanted.length || wanted.includes(e.status)).sort(newest('updatedAt'));
  const out = page(rows, query.page, query.size);
  return { ...out, content: out.content.map((e) => agentEnquiry(db, e)) };
});
route('GET', '/agent/enquiries/:id', 'AGENT', ({ db, ids: [id] }) => agentDetail(db, id));
route('POST', '/agent/enquiries/:id/messages', 'AGENT', ({ db, user, ids: [id], body: r }) => {
  validate(r, { body: [required('Message is empty'), maxLen(4000)] });
  const e = need(db, 'enquiries', id, 'Enquiry');
  insert(db, 'buyerMessages', { enquiryId: e.id, senderRole: 'AGENT', senderId: user.id, body: r.body.trim(), internalNote: !!r.internal });
  e.updatedAt = stamp();
  if (!r.internal) {
    if (e.status === 'NEW') setStatus(db, e, 'UNDER_REVIEW', null, user.id, false);
    notify(db, e.customerId, 'Update on your enquiry', r.body, `/enquiries/${e.id}`);
  }
  return agentDetail(db, e.id);
});
route('POST', '/agent/enquiries/:id/status', 'AGENT', ({ db, user, ids: [id], body: r }) => {
  validate(r, { status: [required()] });
  const e = need(db, 'enquiries', id, 'Enquiry');
  const status = r.status.toUpperCase();
  if (!ENQUIRY_STATUS.includes(status) || status === 'NEW') bad('Unknown status');
  if (FINISHED.includes(status) && !has(r.closureReason)) bad('A reason is required to close, reject or cancel an enquiry');
  setStatus(db, e, status, r.closureReason, user.id, true);
  if (has(r.message)) insert(db, 'buyerMessages', { enquiryId: e.id, senderRole: 'AGENT', senderId: user.id, body: r.message.trim() });
  return agentDetail(db, e.id);
});
route('PUT', '/agent/enquiries/:id/triage', 'AGENT', ({ db, user, ids: [id], body: r }) => {
  const e = need(db, 'enquiries', id, 'Enquiry');
  if (r?.priority != null) {
    const priority = r.priority.toUpperCase();
    if (!['LOW', 'NORMAL', 'HIGH'].includes(priority)) bad('Priority must be LOW, NORMAL or HIGH');
    e.priority = priority;
  }
  Object.assign(e, { followUpDate: r?.followUpDate || null, updatedAt: stamp() });
  audit(db, user.id, 'ENQUIRY_TRIAGED', 'Enquiry', e.id, e.priority);
  return agentDetail(db, e.id);
});
route('POST', '/agent/enquiries/:id/site-visits', 'AGENT', ({ db, user, ids: [id], body: r }) => {
  validate(r, { scheduledAt: [required(), [(v) => new Date(v) > new Date(), 'Choose a future date and time']] });
  const e = need(db, 'enquiries', id, 'Enquiry');
  if (FINISHED.includes(e.status)) conflict('This enquiry is closed');
  const at = stamp(new Date(r.scheduledAt));
  insert(db, 'visits', { enquiryId: e.id, scheduledAt: at, notes: r.notes ?? null });
  if (['NEW', 'UNDER_REVIEW', 'CONTACTED', 'DETAILS_SHARED'].includes(e.status)) setStatus(db, e, 'SITE_VISIT_SCHEDULED', null, user.id, false);
  const p = byId(db, 'properties', e.propertyId);
  const when = `${p.title} on ${at.slice(0, 16).replace('T', ' ')}`;
  notify(db, e.customerId, 'Site visit scheduled', when, `/enquiries/${e.id}`);
  notify(db, p.sellerId, 'Site visit planned for your property', `${when}. The agent will coordinate with you.`, '/seller/properties');
  audit(db, user.id, 'SITE_VISIT_SCHEDULED', 'Enquiry', e.id, at);
  return agentDetail(db, e.id);
});
route('PUT', '/agent/site-visits/:id', 'AGENT', ({ db, ids: [id], body: r }) => {
  validate(r, { status: [required()] });
  const v = need(db, 'visits', id, 'Site visit');
  const status = r.status.toUpperCase();
  if (!['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(status)) bad('Unknown visit status');
  v.status = status;
  if (r.notes != null) v.notes = r.notes;
  return agentDetail(db, v.enquiryId);
});
route('POST', '/agent/enquiries/:id/offers', 'AGENT', ({ db, user, ids: [id], body: r }) => {
  validate(r, { amount: [required(), atLeast(1)] });
  const e = need(db, 'enquiries', id, 'Enquiry');
  insert(db, 'offers', { enquiryId: e.id, amount: Number(r.amount), note: r.note ?? null });
  audit(db, user.id, 'OFFER_RECORDED', 'Enquiry', e.id, String(r.amount));
  return agentDetail(db, e.id);
});
route('PUT', '/agent/offers/:id', 'AGENT', ({ db, user, ids: [id], body: r }) => {
  validate(r, { status: [required()] });
  const o = need(db, 'offers', id, 'Offer');
  const status = r.status.toUpperCase();
  if (!['OPEN', 'ACCEPTED', 'REJECTED', 'COUNTERED'].includes(status)) bad('Unknown offer status');
  o.status = status;
  audit(db, user.id, `OFFER_${status}`, 'Enquiry', o.enquiryId, String(o.amount));
  return agentDetail(db, o.enquiryId);
});

// ================================================================ routes: sales and rentals (a completed deal marks the property sold)
const SALE_RULES = { finalAmount: [required(), atLeast(1)], downPayment: [atLeast(0)], dealDate: [required()], totalCommission: [atLeast(0)] };
const saleFields = (r) => {
  const down = Number(r.downPayment || 0);
  if (down > Number(r.finalAmount)) bad('Down payment cannot exceed the final amount');
  return {
    finalAmount: Number(r.finalAmount), downPayment: down, dealDate: r.dealDate, registryDate: r.registryDate || null,
    totalCommission: Number(r.totalCommission || 0), advanceReceived: !!r.advanceReceived, balanceReceived: !!r.balanceReceived, notes: r.notes ?? null,
  };
};
const saleStatus = (v) => (['ONGOING', 'COMPLETED', 'CANCELLED'].includes(v) ? v : bad('Unknown status'));
function applySaleStatus(db, agent, t, p, status) {
  if (t.status === 'COMPLETED') conflict('A completed deal cannot be changed');
  t.status = status;
  if (status === 'COMPLETED') {
    markStatus(db, p, 'SOLD', agent.id, 'Deal completed');
    moveTo(db, t.enquiryId, 'CLOSED', 'Deal completed', agent.id);
    notify(db, t.buyerId, 'Congratulations - your purchase is complete', p.title, '/enquiries');
  } else if (status === 'CANCELLED') {
    moveTo(db, t.enquiryId, 'NEGOTIATION', null, agent.id);
    notify(db, p.sellerId, 'Deal did not go through', `The deal for ${p.title} was cancelled. Your listing stays as it was.`, '/seller/messages');
  }
}
/** The property and customer come from the enquiry when one is given. */
function parties(db, r, who, message) {
  const e = r.enquiryId ? need(db, 'enquiries', r.enquiryId, 'Enquiry') : null;
  const propertyId = e ? e.propertyId : r.propertyId, personId = e ? e.customerId : r[who];
  if (!propertyId || !personId) bad(message);
  return { enquiryId: e?.id ?? null, property: need(db, 'properties', propertyId, 'Property'), personId: Number(personId) };
}
route('GET', '/agent/sales', 'AGENT', ({ db }) => [...db.sales].sort(desc).map((t) => saleView(db, t)));
route('POST', '/agent/sales', 'AGENT', ({ db, user, body: r }) => {
  validate(r, SALE_RULES);
  const { enquiryId, property: p, personId: buyerId } = parties(db, r, 'buyerId', 'Pick an enquiry, or a property and a buyer');
  const buyer = byId(db, 'users', buyerId);
  if (!buyer || buyer.role === 'AGENT') notFound('Buyer');
  if (p.sellerId === buyerId) bad('Buyer and seller cannot be the same person');
  if (db.sales.some((t) => t.propertyId === p.id && t.status === 'ONGOING')) conflict('This property already has an ongoing deal');
  const fields = saleFields(r);
  const status = saleStatus((r.status || 'ONGOING').toUpperCase());
  const t = insert(db, 'sales', { ...fields, enquiryId, propertyId: p.id, buyerId, sellerId: p.sellerId });
  moveTo(db, enquiryId, 'DEAL_IN_PROGRESS', null, user.id);
  audit(db, user.id, 'SALE_CREATED', 'SaleTransaction', t.id, p.title);
  notify(db, p.sellerId, 'Deal in progress', `A deal is now in progress for ${p.title}. Your agent will keep you updated.`, '/seller/messages');
  if (status !== 'ONGOING') applySaleStatus(db, user, t, p, status);
  return saleView(db, t);
});
route('PUT', '/agent/sales/:id', 'AGENT', ({ db, user, ids: [id], body: r }) => {
  validate(r, SALE_RULES);
  const t = need(db, 'sales', id, 'Sale');
  const p = byId(db, 'properties', t.propertyId);
  Object.assign(t, saleFields(r));
  const status = saleStatus((r.status || t.status).toUpperCase());
  if (status !== t.status) applySaleStatus(db, user, t, p, status);
  audit(db, user.id, 'SALE_UPDATED', 'SaleTransaction', t.id, status);
  return saleView(db, t);
});

const RENTAL_RULES = { rentAmount: [required(), atLeast(1)], securityDeposit: [required(), atLeast(0)], startDate: [required()], endDate: [required()] };
const rentalFields = (r) => {
  if (!(r.endDate > r.startDate)) bad('End date must be after the start date');
  return { rentAmount: Number(r.rentAmount), securityDeposit: Number(r.securityDeposit), startDate: r.startDate, endDate: r.endDate, renewalDate: r.renewalDate || null, notes: r.notes ?? null };
};
route('GET', '/agent/rentals', 'AGENT', ({ db }) => [...db.rentals].sort(desc).map((x) => rentalView(db, x)));
route('POST', '/agent/rentals', 'AGENT', ({ db, user, body: r }) => {
  validate(r, RENTAL_RULES);
  const { enquiryId, property: p, personId: tenantId } = parties(db, r, 'tenantId', 'Pick an enquiry, or a property and a tenant');
  const fields = rentalFields(r);
  const tenant = byId(db, 'users', tenantId);
  if (!tenant || tenant.role === 'AGENT') notFound('Tenant');
  if (p.sellerId === tenantId) bad('Tenant and owner cannot be the same person');
  const rental = insert(db, 'rentals', { ...fields, enquiryId, propertyId: p.id, tenantId });
  if (p.status === PUBLISHED) markStatus(db, p, 'INACTIVE', user.id, 'Rented out');
  moveTo(db, enquiryId, 'CLOSED', 'Rental agreement created', user.id);
  notify(db, tenantId, 'Your rental agreement has been recorded', p.title, '/enquiries');
  audit(db, user.id, 'RENTAL_CREATED', 'RentalAgreement', rental.id, p.title);
  return rentalView(db, rental);
});
route('PUT', '/agent/rentals/:id', 'AGENT', ({ db, user, ids: [id], body: r }) => {
  validate(r, RENTAL_RULES);
  const rental = need(db, 'rentals', id, 'Rental');
  const fields = rentalFields(r);
  const status = (r.status || rental.status).toUpperCase();
  if (!['ACTIVE', 'RENEWAL_DUE', 'EXPIRED', 'TERMINATED'].includes(status)) bad('Unknown status');
  Object.assign(rental, fields, { status });
  audit(db, user.id, 'RENTAL_UPDATED', 'RentalAgreement', rental.id, status);
  return rentalView(db, rental);
});

// ================================================================ dispatch
function signedIn(db, header) {
  const [, id, expires] = /^Bearer demo\.(\d+)\.(\d+)$/.exec(header || '') || [];
  const u = id && Number(expires) > Date.now() ? byId(db, 'users', id) : null;
  return u?.accountEnabled ? u : null;
}

async function handle(config) {
  const method = (config.method || 'get').toUpperCase();
  const url = new URL(config.url, 'http://demo');
  const query = Object.fromEntries(url.searchParams);
  for (const [k, v] of Object.entries(config.params || {})) if (v !== undefined && v !== null) query[k] = v;

  let match, found;
  for (const r of routes) {
    if (r.method === method && (match = r.re.exec(url.pathname))) { found = r; break; }
  }

  const db = await load();
  const user = signedIn(db, config.headers?.Authorization);
  if (!found) fail(404, 'Not found');
  if (found.access !== 'public' && !user) fail(401, 'Please sign in to continue');
  if (['AGENT', 'CUSTOMER'].includes(found.access) && user.role !== found.access) forbidden('You do not have permission to do that');

  const form = typeof FormData !== 'undefined' && config.data instanceof FormData ? config.data : null;
  const body = !form && typeof config.data === 'string' && config.data ? JSON.parse(config.data) : form ? {} : config.data || {};
  let dirty = method !== 'GET';
  try {
    const result = await found.handler({ db, user, query, body, form: form || new FormData(), ids: match.slice(1).map(Number), touch: () => { dirty = true; } });
    // copy before saving so the page can never hold a reference into the stored data
    const out = result instanceof Blob ? result : JSON.parse(JSON.stringify(result));
    if (dirty) await save(db);
    return out;
  } catch (e) {
    if (e.keep) await save(db);
    throw e;
  }
}

// One request at a time (also across tabs), so two writes cannot overwrite each other.
let queue = Promise.resolve();
function exclusive(work) {
  if (navigator.locks) return navigator.locks.request('haven-demo', work);
  const run = queue.then(work);
  queue = run.catch(() => {});
  return run;
}

/** Stands in for the network: axios calls this instead of sending a request. */
export async function adapter(config) {
  const respond = (status, data) => ({ data, status, statusText: String(status), headers: {}, config, request: {} });
  try {
    return respond(200, await exclusive(() => handle(config)));
  } catch (e) {
    let status = 500, data = { message: 'Something went wrong. Please try again.' };
    if (e instanceof ApiError) { status = e.status; data = e.fields ? { message: e.message, fields: e.fields } : { message: e.message }; }
    else if (e?.name === 'QuotaExceededError') { status = 413; data = { message: 'Your browser storage is full. Reset the demo data and try smaller files.' }; }
    else console.error(e);
    throw new AxiosError(data.message, 'ERR_BAD_REQUEST', config, {}, respond(status, data));
  }
}
