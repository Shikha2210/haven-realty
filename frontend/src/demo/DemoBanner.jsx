import { useState } from 'react';
import { tokenStore } from '../api.js';
import { reset } from './store.js';

const LOGINS = [['Buyer (Customer tab)', 'priya@haven.test', 'Demo@12345'], ['Seller (Customer tab)', 'meera@haven.test', 'Demo@12345'], ['Agent (Agent tab)', 'agent@haven.test', 'Agent@12345']];

/** Tells visitors this is a browser-only demo and gives them the sample logins. */
export default function DemoBanner() {
  const [open, setOpen] = useState(false);
  const restart = async () => {
    await reset();
    tokenStore.clear();
    window.location.assign(import.meta.env.BASE_URL);
  };
  return (
    <div className="fixed bottom-3 right-3 z-50 max-w-[min(92vw,340px)] text-right text-xs">
      {open && (
        <div className="mb-2 space-y-2 rounded-xl border border-line bg-white p-4 text-left shadow-xl">
          <p className="font-semibold text-navy-900">Demo version</p>
          <p className="text-muted">Everything runs in your browser. Your changes are saved only on this device, nothing is sent anywhere, and no email or SMS is sent. Please do not enter real personal details or documents.</p>
          <ul className="space-y-1">
            {LOGINS.map(([who, email, password]) => <li key={email}><span className="font-semibold text-navy-900">{who}</span><br /><span className="select-all">{email}</span> / <span className="select-all">{password}</span></li>)}
          </ul>
          <button type="button" onClick={restart} className="font-semibold text-gold-600 underline">Reset demo data</button>
        </div>
      )}
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="rounded-full bg-navy-900 px-4 py-2 font-semibold text-white shadow-lg">
        {open ? 'Close' : 'Demo logins'}
      </button>
    </div>
  );
}
