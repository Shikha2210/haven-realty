import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import api, { errorMessage, fieldErrors } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Button, Card, Field, Input, PageHeader, StatusBadge, Textarea, useToast } from '../../components/ui.jsx';

export default function Profile() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [f, setF] = useState(null);
  const [errs, setErrs] = useState({});
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [busy, setBusy] = useState('');
  useEffect(() => { if (user) setF({ fullName: user.fullName, phone: user.phone || '', dateOfBirth: user.dateOfBirth || '', address: user.address || '', city: user.city || '', state: user.state || '', postalCode: user.postalCode || '', preferences: user.preferences || '' }); }, [user]);
  if (!f) return null;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault(); setBusy('save'); setErrs({});
    try { await api.put('/me', { ...f, dateOfBirth: f.dateOfBirth || null }); await refresh(); toast('Profile updated'); }
    catch (err) { setErrs(fieldErrors(err)); toast(errorMessage(err), 'error'); } finally { setBusy(''); }
  };
  const changePw = async (e) => {
    e.preventDefault(); setBusy('pw');
    try { await api.post('/account/change-password', pw); setPw({ currentPassword: '', newPassword: '' }); toast('Password changed'); }
    catch (err) { toast(errorMessage(err), 'error'); } finally { setBusy(''); }
  };
  const tick = (ok, text) => <span className={`flex items-center gap-1.5 text-sm ${ok ? 'text-emerald-700' : 'text-amber-700'}`}>{ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}{text}</span>;

  return (
    <>
      <PageHeader title="Profile & settings" />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" error={errs.fullName} className="sm:col-span-2"><Input value={f.fullName} onChange={set('fullName')} required /></Field>
            <Field label="Email"><Input value={user.email} disabled /></Field>
            <Field label="Mobile number" error={errs.phone}><Input inputMode="numeric" maxLength={10} value={f.phone} onChange={set('phone')} error={errs.phone} /></Field>
            <Field label="Date of birth"><Input type="date" value={f.dateOfBirth} onChange={set('dateOfBirth')} /></Field>
            <Field label="Address"><Input value={f.address} onChange={set('address')} /></Field>
            <Field label="City"><Input value={f.city} onChange={set('city')} /></Field>
            <Field label="State"><Input value={f.state} onChange={set('state')} /></Field>
            <Field label="PIN code" error={errs.postalCode}><Input maxLength={6} value={f.postalCode} onChange={set('postalCode')} error={errs.postalCode} /></Field>
            <Field label="Preferences" hint="E.g. preferred areas or budget — helps the agent suggest better homes" className="sm:col-span-2"><Textarea rows={3} maxLength={1000} value={f.preferences} onChange={set('preferences')} /></Field>
            <div className="sm:col-span-2"><Button type="submit" loading={busy === 'save'}>Save changes</Button></div>
          </form>
        </Card>
        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-semibold text-navy-900">Verification</h2>
            <div className="space-y-2">{tick(user.emailVerified, user.emailVerified ? 'Email verified' : 'Email not verified')}{tick(user.phoneVerified, user.phoneVerified ? 'Mobile verified' : 'Mobile not verified')}</div>
            {(!user.emailVerified || !user.phoneVerified) && <Link to="/account/verify" className="mt-3 inline-block text-sm font-semibold text-gold-600">Verify now →</Link>}
            <div className="mt-4 flex items-center justify-between border-t border-line pt-4"><span className="text-sm text-muted">Seller access</span><StatusBadge status={user.sellerStatus} /></div>
            <Link to={user.sellerStatus === 'VERIFIED' ? '/seller' : '/account/seller-application'} className="mt-2 inline-block text-sm font-semibold text-gold-600">{user.sellerStatus === 'VERIFIED' ? 'Open seller portal →' : 'Seller application →'}</Link>
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold text-navy-900">Change password</h2>
            <form onSubmit={changePw} className="space-y-3">
              <Field label="Current password"><Input type="password" required autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
              <Field label="New password" hint="8+ characters with a letter and a number"><Input type="password" required minLength={8} autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
              <Button type="submit" variant="outline" loading={busy === 'pw'}>Update password</Button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
