import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Inbox, Loader2, TriangleAlert, X, ImageOff } from 'lucide-react';
import api from '../api.js';

/* ---------- formatting ---------- */
export const inr = (v, category) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(v || 0)) +
  (category === 'RENT' ? ' / mo' : '');
export const shortInr = (v) => {
  const n = Number(v || 0);
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2).replace(/\.?0+$/, '')} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2).replace(/\.?0+$/, '')} L`;
  return inr(n);
};
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
export const label = (s) => (s ? s.toString().replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : '');

/* ---------- toasts ---------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, type = 'success') => {
    const id = Math.random();
    setItems((x) => [...x, { id, message, type }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg ${t.type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-white text-ink'}`}>
            {t.type === 'error' ? <TriangleAlert size={18} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- basic controls ---------- */
const btnBase = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';
const variants = {
  primary: 'bg-navy-900 text-white hover:bg-navy-800',
  gold: 'bg-gold-500 text-white hover:bg-gold-600',
  outline: 'border border-line bg-white text-navy-900 hover:border-navy-900',
  ghost: 'text-navy-900 hover:bg-navy-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  subtle: 'bg-navy-50 text-navy-900 hover:bg-navy-100',
};
export function Button({ variant = 'primary', loading, className = '', children, ...rest }) {
  return (
    <button className={`${btnBase} ${variants[variant]} ${className}`} disabled={loading || rest.disabled} {...rest}>
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

const inputCls = 'w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-ink placeholder:text-slate-400 focus:border-navy-900 focus:outline-none';
export function Field({ label: text, error, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {text && <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">{text}</span>}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}
export const Input = ({ error, className = '', ...p }) => <input className={`${inputCls} ${error ? 'border-red-400' : 'border-line'} ${className}`} {...p} />;
export const Select = ({ error, className = '', children, ...p }) => (
  <select className={`${inputCls} ${error ? 'border-red-400' : 'border-line'} ${className}`} {...p}>{children}</select>
);
export const Textarea = ({ error, className = '', ...p }) => <textarea className={`${inputCls} ${error ? 'border-red-400' : 'border-line'} ${className}`} rows={4} {...p} />;

/* ---------- layout bits ---------- */
export const Card = ({ className = '', children }) => <div className={`rounded-xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${className}`}>{children}</div>;

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl font-semibold text-navy-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const statusTone = {
  PUBLISHED: 'green', VERIFIED: 'green', COMPLETED: 'green', ACTIVE: 'green', ACCEPTED: 'green', CLOSED: 'slate', SOLD: 'navy',
  PENDING: 'amber', SUBMITTED: 'amber', UNDER_REVIEW: 'blue', NEW: 'blue', DRAFT: 'slate', ONGOING: 'blue', OPEN: 'blue',
  REJECTED: 'red', SUSPENDED: 'red', CANCELLED: 'red', TERMINATED: 'red', RESUBMISSION_REQUIRED: 'amber', ON_HOLD: 'amber',
  INACTIVE: 'slate', NONE: 'slate', HIGH: 'red', NORMAL: 'slate', LOW: 'slate', EXPIRED: 'slate', RENEWAL_DUE: 'amber',
  CONTACTED: 'blue', DETAILS_SHARED: 'blue', SITE_VISIT_SCHEDULED: 'violet', NEGOTIATION: 'violet', DEAL_IN_PROGRESS: 'violet',
  SCHEDULED: 'violet', NO_SHOW: 'red', COUNTERED: 'amber',
};
const tones = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200', amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200', blue: 'bg-sky-50 text-sky-700 ring-sky-200', slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200', navy: 'bg-navy-900 text-white ring-navy-900',
};
export const StatusBadge = ({ status }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${tones[statusTone[status] || 'slate']}`}>{label(status)}</span>
);

export const Spinner = ({ text = 'Loading…' }) => (
  <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted"><Loader2 size={18} className="animate-spin" />{text}</div>
);

export function Empty({ title, text, action, icon: Icon = Inbox }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line bg-white px-6 py-14 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-navy-50 text-navy-700"><Icon size={22} /></div>
      <h3 className="font-semibold text-navy-900">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
      <p className="font-semibold">We couldn’t load this.</p>
      <p className="mt-1">{message}</p>
      {onRetry && <Button variant="outline" className="mt-3" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function Modal({ open, title, onClose, children, wide }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-950/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`max-h-[90vh] w-full overflow-auto rounded-2xl bg-white p-6 shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-navy-900">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-slate-500 hover:bg-navy-50"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Pagination({ page, totalPages, onChange }) {
  if (!totalPages || totalPages <= 1) return null;
  return (
    <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Pagination">
      <Button variant="outline" disabled={page === 0} onClick={() => onChange(page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></Button>
      <span className="text-sm text-muted">Page {page + 1} of {totalPages}</span>
      <Button variant="outline" disabled={page + 1 >= totalPages} onClick={() => onChange(page + 1)} aria-label="Next page"><ChevronRight size={16} /></Button>
    </nav>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}
          className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition ${value === t.value ? 'border-gold-500 text-navy-900' : 'border-transparent text-muted hover:text-navy-900'}`}>
          {t.label}{t.count != null && <span className="ml-1.5 rounded-full bg-navy-50 px-1.5 py-0.5 text-xs">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------- images ---------- */
const blobCache = new Map();
/** Fetches through axios so the bearer token is sent (needed for not-yet-published listings). */
export function PrivateImg({ src, alt, className = '' }) {
  const [url, setUrl] = useState(blobCache.get(src));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    if (!src || blobCache.has(src)) return;
    api.get(src.replace(/^\/api/, ''), { responseType: 'blob' })
      .then((r) => { const u = URL.createObjectURL(r.data); blobCache.set(src, u); if (live) setUrl(u); })
      .catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [src]);
  if (!src || failed) return <Placeholder className={className} />;
  if (!url) return <div className={`skeleton ${className}`} />;
  return <img src={url} alt={alt} className={className} />;
}

export function Placeholder({ className = '' }) {
  return <div className={`grid place-items-center bg-navy-50 text-navy-700/40 ${className}`}><ImageOff size={28} /></div>;
}

export function PublicImg({ src, alt, className = '' }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) return <Placeholder className={className} />;
  return <img src={`${import.meta.env.VITE_API_URL || ''}${src}`} alt={alt} loading="lazy" onError={() => setBad(true)} className={className} />;
}

/* ---------- data loading ---------- */
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const run = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    return fnRef.current()
      .then((res) => setState({ loading: false, data: res && 'data' in res ? res.data : res, error: null }))
      .catch((e) => setState({ loading: false, data: null, error: e?.response?.data?.message || 'Cannot reach the server.' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  return { ...state, reload: run, setData: (d) => setState((s) => ({ ...s, data: d })) };
}
