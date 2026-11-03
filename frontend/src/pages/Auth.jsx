import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Home, Key, ShieldCheck, Store } from 'lucide-react';
import api, { errorMessage, fieldErrors } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Button, Field, Input, Select, useToast } from '../components/ui.jsx';
import VerifyPanel from '../components/VerifyPanel.jsx';

function Shell({ title, subtitle, children, wide }) {
  return (
    <div className="grid min-h-[calc(100vh-4rem)] place-items-center bg-gradient-to-b from-navy-50 to-paper px-4 py-10">
      <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="mb-6 text-center"><h1 className="font-display text-3xl font-semibold text-navy-900">{title}</h1>{subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}</div>
        <div className="rounded-2xl border border-line bg-white p-6 shadow-[0_10px_40px_rgba(20,33,61,0.08)] sm:p-8">{children}</div>
        {children && null}
      </div>
    </div>
  );
}

function PasswordInput({ value, onChange, error, autoComplete, id }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? 'text' : 'password'} value={value} onChange={onChange} error={error} autoComplete={autoComplete} required className="pr-11" />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-500 hover:text-navy-900">
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ login */
export function Login() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [sp] = useSearchParams();
  const [portal, setPortal] = useState(sp.get('portal') === 'agent' ? 'AGENT' : 'CUSTOMER');
  const [f, setF] = useState({ email: '', password: '', remember: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const u = await login(f.email, f.password, portal, f.remember);
      nav(loc.state?.from && u.role === 'CUSTOMER' ? loc.state.from : u.role === 'AGENT' ? '/agent' : '/account', { replace: true });
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <Shell title="Welcome back" subtitle="Sign in to continue to Haven Realty">
      <div className="mb-6 grid grid-cols-2 rounded-lg bg-navy-50 p-1" role="tablist">
        {[['CUSTOMER', 'Customer'], ['AGENT', 'Agent']].map(([v, t]) => (
          <button key={v} role="tab" aria-selected={portal === v} onClick={() => { setPortal(v); setError(''); }}
            className={`rounded-md py-2 text-sm font-semibold transition ${portal === v ? 'bg-white text-navy-900 shadow' : 'text-muted'}`}>{t}</button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-4">
        <Field label={portal === 'AGENT' ? 'Agent email' : 'Email address'}><Input type="email" required autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Password"><PasswordInput value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="current-password" /></Field>
        {portal === 'CUSTOMER' && (
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={f.remember} onChange={(e) => setF({ ...f, remember: e.target.checked })} className="h-4 w-4 accent-navy-900" />Remember me</label>
            <Link to="/forgot-password" className="font-semibold text-gold-600">Forgot password?</Link>
          </div>
        )}
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <Button type="submit" loading={busy} className="w-full py-3">Sign in</Button>
      </form>
      {portal === 'CUSTOMER'
        ? <p className="mt-6 text-center text-sm text-muted">New here? <Link to="/signup" className="font-semibold text-navy-900 underline">Create an account</Link></p>
        : <p className="mt-6 text-center text-xs text-muted">Agent access is provisioned by the administrator. There is no agent sign-up.</p>}
    </Shell>
  );
}

/* ------------------------------------------------------------------ signup */
const STEPS = ['Your details', 'Account', 'Purpose', 'Verify'];
const hasUpper = /[A-Za-z]/, hasNum = /\d/;

export function Signup() {
  const { register, user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ fullName: '', email: '', phone: '', dateOfBirth: '', address: '', city: '', state: 'Punjab', postalCode: '', password: '', confirm: '', purpose: 'BUY', consent: false });
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const [dev, setDev] = useState({});
  const [created, setCreated] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const validate = (s) => {
    const e = {};
    if (s === 0) {
      if (f.fullName.trim().length < 2) e.fullName = 'Enter your full name';
      if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'Enter a valid email';
      if (!/^\d{10}$/.test(f.phone)) e.phone = 'Enter a 10-digit mobile number';
      if (!f.address.trim()) e.address = 'Enter your address';
      if (!f.city.trim()) e.city = 'Enter your city';
      if (!f.state.trim()) e.state = 'Enter your state';
      if (!/^\d{6}$/.test(f.postalCode)) e.postalCode = 'Enter a 6-digit PIN code';
    }
    if (s === 1) {
      if (f.password.length < 8 || !hasUpper.test(f.password) || !hasNum.test(f.password)) e.password = 'At least 8 characters, with a letter and a number';
      if (f.password !== f.confirm) e.confirm = 'Passwords do not match';
    }
    if (s === 2 && !f.consent) e.consent = 'Please accept to continue';
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const next = () => validate(step) && setStep(step + 1);

  const create = async () => {
    if (!validate(2)) return;
    setBusy(true);
    try {
      const { confirm, consent, dateOfBirth, ...rest } = f;
      const res = await register({ ...rest, dateOfBirth: dateOfBirth || null });
      setDev({ email: res.devEmailCode, phone: res.devPhoneCode });
      setCreated(res);
      setStep(3);
    } catch (err) {
      const fe = fieldErrors(err);
      setErrs(fe);
      toast(errorMessage(err), 'error');
      if (fe.email || fe.phone || fe.fullName || fe.address || fe.city || fe.state || fe.postalCode || err.response?.status === 409) setStep(0);
      else if (fe.password) setStep(1);
    } finally { setBusy(false); }
  };

  const finish = () => nav(f.purpose === 'BUY' ? '/account' : '/account/seller-application', { replace: true });

  return (
    <Shell title="Create your account" subtitle="One account for buying, renting and selling" wide>
      <ol className="mb-8 flex items-center gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2" aria-current={i === step}>
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${i <= step ? 'bg-navy-900 text-white' : 'bg-navy-50 text-muted'}`}>{i + 1}</span>
            <span className={`hidden text-xs font-semibold sm:block ${i === step ? 'text-navy-900' : 'text-muted'}`}>{s}</span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-line" />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" error={errs.fullName} className="sm:col-span-2"><Input value={f.fullName} onChange={set('fullName')} error={errs.fullName} autoComplete="name" /></Field>
          <Field label="Email address" error={errs.email}><Input type="email" value={f.email} onChange={set('email')} error={errs.email} autoComplete="email" /></Field>
          <Field label="Mobile number" error={errs.phone}><Input inputMode="numeric" maxLength={10} value={f.phone} onChange={set('phone')} error={errs.phone} autoComplete="tel" /></Field>
          <Field label="Date of birth (optional)"><Input type="date" max={new Date().toISOString().slice(0, 10)} value={f.dateOfBirth} onChange={set('dateOfBirth')} /></Field>
          <Field label="Current address" error={errs.address}><Input value={f.address} onChange={set('address')} error={errs.address} autoComplete="street-address" /></Field>
          <Field label="City" error={errs.city}><Input value={f.city} onChange={set('city')} error={errs.city} /></Field>
          <Field label="State" error={errs.state}><Input value={f.state} onChange={set('state')} error={errs.state} /></Field>
          <Field label="PIN code" error={errs.postalCode}><Input inputMode="numeric" maxLength={6} value={f.postalCode} onChange={set('postalCode')} error={errs.postalCode} /></Field>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <Field label="Password" error={errs.password} hint="At least 8 characters, with a letter and a number"><PasswordInput value={f.password} onChange={set('password')} error={errs.password} autoComplete="new-password" /></Field>
          <Field label="Confirm password" error={errs.confirm}><PasswordInput value={f.confirm} onChange={set('confirm')} error={errs.confirm} autoComplete="new-password" /></Field>
          <p className="text-sm text-muted">After creating your account we’ll ask you to confirm your email and mobile number with a one-time code.</p>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-navy-900">What would you like to do?</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[['BUY', Home, 'Buy or rent', 'Browse, save and enquire'], ['SELL', Store, 'Sell or let', 'List your properties'], ['BOTH', Key, 'Both', 'Switch any time']].map(([v, Icon, t, d]) => (
              <button type="button" key={v} onClick={() => setF({ ...f, purpose: v })} aria-pressed={f.purpose === v}
                className={`rounded-xl border-2 p-4 text-left transition ${f.purpose === v ? 'border-gold-500 bg-gold-100/40' : 'border-line hover:border-navy-700'}`}>
                <Icon size={22} className="text-gold-600" /><p className="mt-2 font-semibold text-navy-900">{t}</p><p className="text-xs text-muted">{d}</p>
              </button>
            ))}
          </div>
          {f.purpose !== 'BUY' && <p className="flex items-start gap-2 rounded-lg bg-navy-50 p-3 text-sm text-slate-700"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-navy-700" />Sellers are verified once with an ID, address proof and photo before listing. You can start that right after signing up — or later from your profile.</p>}
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 accent-navy-900" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} />
            <span>I agree that Haven Realty may store my details to run my account, and that its agent may contact me about my enquiries.</span></label>
          {errs.consent && <p className="text-xs font-medium text-red-600">{errs.consent}</p>}
        </div>
      )}

      {step === 3 && (
        <div>
          <p className="mb-4 text-sm text-muted">Your account is ready. Confirm your contact details to start sending enquiries.</p>
          <VerifyPanel devCodes={dev} onDone={finish} />
          <div className="mt-6 text-center"><button className="text-sm font-semibold text-muted underline" onClick={finish}>Skip for now</button></div>
        </div>
      )}

      {step < 3 && (
        <div className="mt-8 flex items-center justify-between">
          {step > 0 ? <Button variant="ghost" onClick={() => setStep(step - 1)}>Back</Button> : <Link to="/login" className="text-sm font-semibold text-muted">Already registered? Sign in</Link>}
          {step < 2 ? <Button onClick={next}>Continue</Button> : <Button variant="gold" loading={busy} onClick={create}>Create account</Button>}
        </div>
      )}
    </Shell>
  );
}

/* ------------------------------------------------------------------ forgot password */
export function Forgot() {
  const nav = useNavigate();
  const toast = useToast();
  const [stage, setStage] = useState(0);
  const [f, setF] = useState({ email: '', code: '', newPassword: '' });
  const [dev, setDev] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const { data } = await api.post('/auth/forgot-password', { email: f.email }); setDev(data.devCode || ''); setStage(1); toast(data.message); }
    catch (err) { toast(errorMessage(err), 'error'); } finally { setBusy(false); }
  };
  const reset = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.post('/auth/reset-password', f); toast('Password updated. Please sign in.'); nav('/login'); }
    catch (err) { toast(errorMessage(err), 'error'); } finally { setBusy(false); }
  };

  return (
    <Shell title="Reset your password" subtitle={stage === 0 ? 'We’ll email you a one-time code' : 'Enter the code and choose a new password'}>
      {stage === 0 ? (
        <form onSubmit={send} className="space-y-4">
          <Field label="Email address"><Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Button type="submit" loading={busy} className="w-full py-3">Send code</Button>
        </form>
      ) : (
        <form onSubmit={reset} className="space-y-4">
          <Field label="6-digit code"><Input inputMode="numeric" maxLength={6} required value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>
          {dev && <p className="rounded bg-gold-100 px-3 py-2 text-xs text-gold-600">Demo mode — your code is <b>{dev}</b></p>}
          <Field label="New password" hint="At least 8 characters, with a letter and a number"><PasswordInput value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} autoComplete="new-password" /></Field>
          <Button type="submit" loading={busy} className="w-full py-3">Update password</Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm"><Link to="/login" className="font-semibold text-navy-900 underline">Back to sign in</Link></p>
    </Shell>
  );
}
