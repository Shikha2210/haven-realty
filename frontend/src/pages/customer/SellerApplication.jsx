import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileCheck2, ShieldCheck, Upload } from 'lucide-react';
import api, { errorMessage, openPrivateFile } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Alert } from '../../components/Alert.jsx';
import { Button, Card, ErrorBox, Field, PageHeader, Spinner, StatusBadge, fmtDateTime, label, useLoad, useToast } from '../../components/ui.jsx';

const DOCS = [
  ['identity', 'IDENTITY', 'Government ID', 'Aadhaar, passport or driving licence (JPG, PNG or PDF)', 'image/png,image/jpeg,application/pdf'],
  ['address', 'ADDRESS', 'Address proof', 'Utility bill, bank statement or rent agreement (JPG, PNG or PDF)', 'image/png,image/jpeg,application/pdf'],
  ['photo', 'PHOTO', 'Recent photograph', 'A clear passport-style photo (JPG or PNG)', 'image/png,image/jpeg'],
];

export default function SellerApplication() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const { loading, data, error, reload, setData } = useLoad(() => api.get('/me/seller-application').then((r) => ({ data: r.data || null })), []);
  const [files, setFiles] = useState({});
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const status = data?.status;
  const canSubmit = !data || status === 'REJECTED' || status === 'RESUBMISSION_REQUIRED';
  const needsVerification = !user.emailVerified || !user.phoneVerified;

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    const fd = new FormData();
    fd.append('consent', consent);
    Object.entries(files).forEach(([k, v]) => v && fd.append(k, v));
    try {
      const r = await api.post('/me/seller-application', fd);
      setData(r.data); setFiles({}); await refresh();
      toast('Application submitted. We’ll notify you once it’s reviewed.');
    } catch (err) { toast(errorMessage(err), 'error'); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Become a seller" subtitle="Verify once, then list as many properties as you like — from the same account." />

      {data && (
        <Card className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3"><ShieldCheck className="text-navy-700" /><div><p className="text-sm text-muted">Application status</p><StatusBadge status={status} /></div></div>
            {status === 'VERIFIED' && <Link to="/seller"><Button variant="gold">Open seller portal</Button></Link>}
          </div>
          {data.rejectionReason && <Alert tone="amber" title={status === 'REJECTED' ? 'Why it was rejected' : 'What needs to change'}>{data.rejectionReason}</Alert>}
          {status === 'PENDING' && <p className="mt-3 text-sm text-muted">Submitted {fmtDateTime(data.submittedAt)}. Our agent will review it shortly.</p>}
          {status === 'UNDER_REVIEW' && <p className="mt-3 text-sm text-muted">Your documents are being reviewed.</p>}
          <div className="mt-4 grid gap-4 border-t border-line pt-4 md:grid-cols-2">
            <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Your documents</p>
              <ul className="space-y-1.5">{data.documents.map((d) => (<li key={d.id} className="flex items-center justify-between rounded-lg bg-navy-50 px-3 py-2 text-sm"><span className="flex items-center gap-2"><FileCheck2 size={15} />{label(d.docType)}</span>
                <button className="font-semibold text-gold-600" onClick={() => openPrivateFile(`/api/files/verification-documents/${d.id}`).catch((e) => toast(errorMessage(e), 'error'))}>View</button></li>))}</ul></div>
            <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">History</p>
              <ol className="space-y-2 text-sm">{data.history.map((h, i) => (<li key={i}><b>{label(h.toStatus)}</b> <span className="text-muted">· {fmtDateTime(h.at)}</span>{h.note && <p className="text-muted">{h.note}</p>}</li>))}</ol></div>
          </div>
        </Card>
      )}

      {canSubmit && (
        <Card>
          <h2 className="font-display mb-1 text-xl font-semibold text-navy-900">{data ? 'Resubmit your documents' : 'Upload your documents'}</h2>
          <p className="mb-5 text-sm text-muted">{data ? 'Replace only the documents that need fixing.' : 'All three are required. We never ask for bank or card details.'} Files are stored privately and only you and our agent can open them.</p>
          {needsVerification ? (
            <Alert tone="amber" title="Verify your contact details first">Confirm your email and mobile number before applying. <Link to="/account/verify" className="font-semibold underline">Verify now</Link></Alert>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {DOCS.map(([key, , title, hint, accept]) => (
                <Field key={key} label={title} hint={hint}>
                  <div className="flex items-center gap-3 rounded-lg border border-dashed border-line bg-paper p-3">
                    <Upload size={18} className="text-muted" />
                    <input type="file" accept={accept} onChange={(e) => setFiles({ ...files, [key]: e.target.files[0] })} className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-navy-900 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white" />
                  </div>
                </Field>
              ))}
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 accent-navy-900" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>I consent to Haven Realty reviewing these documents to verify my identity as a seller, and storing them securely.</span></label>
              <Button type="submit" loading={busy} disabled={!consent}>Submit for verification</Button>
            </form>
          )}
        </Card>
      )}
    </>
  );
}
