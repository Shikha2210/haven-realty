import { useState } from 'react';
import { CheckCircle2, Mail, Smartphone } from 'lucide-react';
import api, { errorMessage } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Button, Field, Input, useToast } from './ui.jsx';

/** Email + mobile one-time-code verification. In demo mode the server returns the codes so no SMS gateway is needed. */
export default function VerifyPanel({ devCodes = {}, onDone }) {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [codes, setCodes] = useState({ EMAIL: '', PHONE: '' });
  const [dev, setDev] = useState({ EMAIL: devCodes.email, PHONE: devCodes.phone });
  const [busy, setBusy] = useState('');

  const done = { EMAIL: user?.emailVerified, PHONE: user?.phoneVerified };

  const verify = async (channel) => {
    setBusy(channel);
    try {
      await api.post('/me/verify', { channel, code: codes[channel] });
      const u = await refresh();
      toast(`${channel === 'EMAIL' ? 'Email' : 'Mobile number'} verified`);
      if (u?.emailVerified && u?.phoneVerified) onDone?.();
    } catch (err) { toast(errorMessage(err), 'error'); } finally { setBusy(''); }
  };

  const resend = async (channel) => {
    try {
      const { data } = await api.post('/me/resend', { channel });
      if (data.devCode) setDev((d) => ({ ...d, [channel]: data.devCode }));
      toast('A new code has been sent');
    } catch (err) { toast(errorMessage(err), 'error'); }
  };

  const row = (channel, Icon, title, target) => (
    <div className="rounded-xl border border-line bg-white p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-navy-50 text-navy-700"><Icon size={18} /></span>
        <div className="min-w-0 flex-1"><p className="font-semibold text-navy-900">{title}</p><p className="truncate text-sm text-muted">{target}</p></div>
        {done[channel] && <span className="flex items-center gap-1 text-sm font-semibold text-emerald-600"><CheckCircle2 size={18} />Verified</span>}
      </div>
      {!done[channel] && (
        <>
          <div className="flex gap-2">
            <Field className="flex-1"><Input inputMode="numeric" maxLength={6} placeholder="6-digit code" aria-label={`${title} code`} value={codes[channel]} onChange={(e) => setCodes({ ...codes, [channel]: e.target.value })} /></Field>
            <Button loading={busy === channel} disabled={codes[channel].length !== 6} onClick={() => verify(channel)}>Verify</Button>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <button className="font-semibold text-gold-600" onClick={() => resend(channel)}>Resend code</button>
            {dev[channel] && <span className="rounded bg-gold-100 px-2 py-1 text-gold-600">Demo mode — your code is <b>{dev[channel]}</b></span>}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {row('EMAIL', Mail, 'Verify your email', user?.email)}
      {row('PHONE', Smartphone, 'Verify your mobile number', user?.phone)}
    </div>
  );
}
