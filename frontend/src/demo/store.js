// The demo "database": one object kept in the visitor's own browser (IndexedDB), plus the sample data.
import { stamp } from './http.js';
import { sampleImage, samplePdf } from './files.js';

const DB_NAME = 'haven-demo';
const VERSION = 1; // bump to replace every visitor's stored demo data
let memory = null; // used when the browser blocks IndexedDB

const request = (r) => new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
async function idb(mode, work) {
  const open = indexedDB.open(DB_NAME, 1);
  open.onupgradeneeded = () => open.result.createObjectStore('state');
  const db = await request(open);
  try {
    const tx = db.transaction('state', mode);
    const done = new Promise((ok, no) => { tx.oncomplete = ok; tx.onerror = tx.onabort = () => no(tx.error); });
    const result = await request(work(tx.objectStore('state')));
    await done;
    return result;
  } finally { db.close(); }
}

export async function load() {
  let data = null;
  try { data = await idb('readonly', (s) => s.get('db')); } catch { data = memory && structuredClone(memory); }
  if (data?.version === VERSION) return data;
  data = await seed();
  await save(data);
  return data;
}

export async function save(data) {
  try { await idb('readwrite', (s) => s.put(data, 'db')); } catch (e) {
    if (e?.name === 'QuotaExceededError') throw e;
    memory = structuredClone(data);
  }
}

export async function reset() {
  memory = null;
  try { await idb('readwrite', (s) => s.delete('db')); } catch { /* nothing stored */ }
}

export async function hash(password, salt = crypto.randomUUID()) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`));
  return `${salt}:${Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')}`;
}
export const passwordMatches = async (password, stored) => (await hash(password, stored.split(':')[0])) === stored;

// ------------------------------------------------------------------ rows with the same defaults as the Java entities
const DEFAULTS = {
  users: { accountEnabled: true, emailVerified: false, phoneVerified: false, buyerEnabled: true, sellerEnabled: false, dateOfBirth: null, city: null, state: null, address: null, postalCode: null, preferences: null },
  tokens: { usedAt: null, attempts: 0 },
  verifications: { status: 'PENDING', rejectionReason: null, reviewNotes: null, consentGiven: false, reviewedAt: null },
  verificationDocs: { superseded: false },
  history: {}, approvals: { reason: null },
  properties: { measurementUnit: 'sq ft', parkingAvailable: false, status: 'DRAFT', rejectionReason: null, viewCount: 0 },
  images: { sortOrder: 0 }, propertyDocs: {}, wishlist: {}, recent: {},
  enquiries: { status: 'NEW', priority: 'NORMAL', followUpDate: null, closureReason: null },
  buyerMessages: { internalNote: false }, sellerMessages: { propertyId: null },
  visits: { status: 'SCHEDULED', notes: null }, offers: { status: 'OPEN', note: null },
  rentals: { enquiryId: null, renewalDate: null, status: 'ACTIVE', notes: null },
  sales: { enquiryId: null, registryDate: null, downPayment: 0, totalCommission: 0, advanceReceived: false, balanceReceived: false, status: 'ONGOING', notes: null },
  notifications: { body: null, link: null, read: false }, audit: { details: null },
};
const TIMESTAMPS = { verifications: ['submittedAt', 'updatedAt'], verificationDocs: ['uploadedAt'], propertyDocs: ['uploadedAt'], properties: ['createdAt', 'updatedAt'], enquiries: ['createdAt', 'updatedAt'], recent: ['viewedAt'] };

export function insert(db, table, values) {
  const now = stamp();
  const times = Object.fromEntries((TIMESTAMPS[table] || ['createdAt']).map((k) => [k, now]));
  const row = { ...DEFAULTS[table], ...times, ...values, id: (db.seq[table] = (db.seq[table] || 0) + 1) };
  db[table].push(row);
  return row;
}

export function storeFile(db, { name, type, blob }) {
  const key = crypto.randomUUID();
  db.files[key] = blob;
  return { storedName: key, originalName: name, contentType: type, size: blob.size };
}

// ------------------------------------------------------------------ sample data
async function seed() {
  const db = { version: VERSION, seq: {}, files: {} };
  for (const t of Object.keys(DEFAULTS)) db[t] = [];

  const demoPassword = await hash('Demo@12345');
  insert(db, 'users', { fullName: 'Aarav Kapoor', email: 'agent@haven.test', password: await hash('Agent@12345'), phone: '9000000000', city: 'Chandigarh', state: 'Punjab', role: 'AGENT', emailVerified: true, phoneVerified: true, buyerEnabled: false });
  const customer = (fullName, email, phone, city, sellerEnabled) => insert(db, 'users', { fullName, email, password: demoPassword, phone, address: 'Demo address', city, state: 'Punjab', postalCode: '160001', role: 'CUSTOMER', emailVerified: true, phoneVerified: true, sellerEnabled, dateOfBirth: '1990-05-17' });
  const meera = customer('Meera Sharma', 'meera@haven.test', '9811100001', 'Chandigarh', true);
  const rohan = customer('Rohan Gill', 'rohan@haven.test', '9811100002', 'Mohali', true);
  const priya = customer('Priya Malhotra', 'priya@haven.test', '9811100003', 'Panchkula', false);
  const kabir = customer('Kabir Singh', 'kabir@haven.test', '9811100004', 'Chandigarh', false);
  const neha = customer('Neha Verma', 'neha@haven.test', '9811100005', 'Zirakpur', false);

  const vdoc = (verificationId, docType) => insert(db, 'verificationDocs', { verificationId, docType, ...storeFile(db, { name: `${docType.toLowerCase()}.pdf`, type: 'application/pdf', blob: samplePdf(`${docType.toLowerCase()} proof`) }) });
  for (const s of [meera, rohan]) vdoc(insert(db, 'verifications', { userId: s.id, status: 'VERIFIED', consentGiven: true }).id, 'IDENTITY');
  const pending = insert(db, 'verifications', { userId: neha.id, consentGiven: true });
  vdoc(pending.id, 'IDENTITY');
  vdoc(pending.id, 'ADDRESS');

  const property = (seller, title, propertyType, category, city, locality, price, area, bedrooms, bathrooms, furnishingStatus, parkingAvailable, amenities, colour, status = 'PUBLISHED') => {
    const created = stamp(new Date(Date.now() - Math.floor(Math.random() * 40) * 86400000));
    const p = insert(db, 'properties', {
      sellerId: seller.id, title, propertyType, category, city, locality, price, area, bedrooms, bathrooms, furnishingStatus, parkingAvailable, amenities, status,
      description: `A well-kept ${propertyType.toLowerCase()} in ${locality}, ${city}. Close to schools, markets and public transport. Sample listing for demonstration purposes.`,
      address: `House/Unit 12, ${locality}, ${city}`, postalCode: '160022', facing: 'East', approvedBy: 'Municipal Corporation', constructionType: 'Constructed',
      viewCount: Math.floor(Math.random() * 120), createdAt: created, updatedAt: created,
    });
    for (let i = 0; i < 3; i++) insert(db, 'images', { propertyId: p.id, sortOrder: i, ...storeFile(db, { name: `photo${i + 1}.svg`, type: 'image/svg+xml', blob: sampleImage(title, `${locality}, ${city}`, colour, i) }) });
    insert(db, 'propertyDocs', { propertyId: p.id, docType: 'OWNERSHIP', ...storeFile(db, { name: 'ownership.pdf', type: 'application/pdf', blob: samplePdf('Ownership proof') }) });
    return p;
  };
  const p1 = property(meera, 'The Courtyard House', 'Villa', 'SALE', 'Chandigarh', 'Sector 8', 38500000, 3200, 4, 4, 'Semi-furnished', true, 'Private garden,Lift,Power backup,24x7 security', '#1f3a5f');
  property(meera, 'Sunlit apartment near Rock Garden', 'Apartment', 'SALE', 'Chandigarh', 'Sector 16', 14200000, 1680, 3, 2, 'Furnished', true, 'Gym,Clubhouse,Lift', '#2d5a7b');
  const p3 = property(rohan, 'Garden-view independent floor', 'House', 'RENT', 'Mohali', 'Sector 66', 48000, 2100, 3, 3, 'Semi-furnished', true, 'Garden,Parking,Modular kitchen', '#3b6e5b');
  property(rohan, 'Designed for slow mornings', 'Apartment', 'SALE', 'Panchkula', 'Sector 20', 9600000, 1250, 2, 2, 'Unfurnished', true, 'Park facing,Lift', '#6b5b3b');
  property(meera, 'The open-plan residence', 'Villa', 'RENT', 'Chandigarh', 'Sector 5', 85000, 2850, 4, 3, 'Furnished', true, 'Garden,Terrace,Servant quarter', '#4a3f6b');
  property(rohan, 'A home with room to grow', 'House', 'SALE', 'Zirakpur', 'VIP Road', 7800000, 1900, 3, 2, 'Unfurnished', true, 'Gated society,Park', '#7b3f3f');
  property(rohan, 'Commercial showroom on main road', 'Commercial', 'SALE', 'Mohali', 'Phase 7', 21500000, 1500, 0, 2, 'Unfurnished', true, 'Corner plot,Ample parking', '#35505e');
  property(meera, 'Two-bedroom flat awaiting review', 'Apartment', 'RENT', 'Chandigarh', 'Sector 35', 32000, 1100, 2, 2, 'Semi-furnished', false, 'Lift', '#555555', 'SUBMITTED');

  const e = insert(db, 'enquiries', { propertyId: p1.id, customerId: priya.id, enquiryType: 'BUY', status: 'CONTACTED', message: 'Hello, I am interested in this villa. Is the price negotiable?' });
  insert(db, 'buyerMessages', { enquiryId: e.id, senderRole: 'CUSTOMER', senderId: priya.id, body: e.message });
  insert(db, 'buyerMessages', { enquiryId: e.id, senderRole: 'SYSTEM', senderId: 0, body: 'Your enquiry was received. Our agent will contact you shortly.' });
  insert(db, 'buyerMessages', { enquiryId: e.id, senderRole: 'AGENT', senderId: 1, body: 'Thank you Priya, I will call you today with details.' });
  insert(db, 'enquiries', { propertyId: p3.id, customerId: kabir.id, enquiryType: 'SITE_VISIT', message: 'Could we visit this Saturday morning?' });
  insert(db, 'wishlist', { userId: priya.id, propertyId: p3.id });
  return db;
}
