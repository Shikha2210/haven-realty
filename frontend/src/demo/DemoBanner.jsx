import { useState } from 'react';
import api, { errorMessage, fieldErrors, tokenStore } from '../api.js';
import { reset } from './store.js';

const LOGINS = [['Buyer (Customer tab)', 'priya@haven.test', 'Demo@12345'], ['Seller (Customer tab)', 'meera@haven.test', 'Demo@12345'], ['Agent (Agent tab)', 'agent@haven.test', 'Agent@12345']];

function AgentLoginForm() {
  const [f, setF] = useState({ email: '', password: '' });
  const [result, setResult] = useState({ ok: false, text: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.put('/demo/agent-login', f);
      setF({ email: '', password: '' });
      setResult({ ok: true, text: `${data.message}. Sign in on the Agent tab.` });
    } catch (err) { setResult({ ok: false, text: Object.values(fieldErrors(err))[0] || errorMessage(err) }); }
  };
  const input = 'w-full rounded-lg border border-line px-2 py-1.5';
  return (
    <form onSubmit={save} className="space-y-2 border-t border-line pt-2">
      <p className="text-muted">Saved only in this browser. It is not published or sent anywhere. Use a password you do not use elsewhere.</p>
      <input type="email" required placeholder="New agent email" aria-label="New agent email" autoComplete="off" value={f.email} onChange={set('email')} className={input} />
      <input type="password" required placeholder="New password (8+, letter and number)" aria-label="New agent password" autoComplete="new-password" value={f.password} onChange={set('password')} className={input} />
      <button type="submit" className="rounded-lg bg-navy-900 px-3 py-1.5 font-semibold text-white">Save agent login</button>
      {result.text && <p role="status" className={result.ok ? 'text-emerald-600' : 'text-red-600'}>{result.text}</p>}
    </form>
  );
}

/** Tells visitors this is a browser-only demo and gives them the sample logins. */
export default function DemoBanner() {
  const [open, setOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const restart = async () => {
    await reset();
    tokenStore.clear();
    window.location.assign(import.meta.env.BASE_URL);
  };
  return (
    <div className="fixed bottom-3 right-3 z-50 max-w-[min(92vw,340px)] max-h-[92vh] overflow-auto text-right text-xs">
      {open && (
        <div className="mb-2 space-y-2 rounded-xl border border-line bg-white p-4 text-left shadow-xl">
          <p className="font-semibold text-navy-900">Demo version</p>
          <p className="text-muted">Everything runs in your browser. Your changes are saved only on this device, nothing is sent anywhere, and no email or SMS is sent. Please do not enter real personal details or documents.</p>
          <ul className="space-y-1">
            {LOGINS.map(([who, email, password]) => <li key={email}><span className="font-semibold text-navy-900">{who}</span><br /><span className="select-all">{email}</span> / <span className="select-all">{password}</span></li>)}
          </ul>
          <div className="flex flex-wrap gap-4">
            <button type="button" onClick={() => setChanging(!changing)} aria-expanded={changing} className="font-semibold text-gold-600 underline">Change agent login</button>
            <button type="button" onClick={restart} className="font-semibold text-gold-600 underline">Reset demo data</button>
          </div>
          {changing && <AgentLoginForm />}
        </div>
      )}
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="rounded-full bg-navy-900 px-4 py-2 font-semibold text-white shadow-lg">
        {open ? 'Close' : 'Demo logins'}
      </button>
    </div>
  );
}
