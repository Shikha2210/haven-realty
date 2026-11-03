import { useState } from 'react';
import { FileCheck2, ShieldCheck } from 'lucide-react';
import api, { errorMessage, openPrivateFile } from '../../api.js';
import { Button, Card, Empty, ErrorBox, Field, Modal, PageHeader, Pagination, Spinner, StatusBadge, Tabs, Textarea, fmtDateTime, label, useLoad, useToast } from '../../components/ui.jsx';

const TABS = [['PENDING,UNDER_REVIEW', 'To review'], ['RESUBMISSION_REQUIRED', 'Awaiting resubmission'], ['VERIFIED', 'Verified'], ['REJECTED', 'Rejected']];

export default function Verifications() {
  const toast = useToast();
  const [tab, setTab] = useState('PENDING,UNDER_REVIEW');
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(null);
  const [ask, setAsk] = useState(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const { loading, data, error, reload } = useLoad(() => api.get('/agent/verifications', { params: { status: tab, page, size: 10 } }), [tab, page]);

  const act = async (fn, ok) => {
    try { await fn(); toast(ok); setAsk(null); setReason(''); setOpen(null); reload(); } catch (err) { toast(errorMessage(err), 'error'); }
  };
  const decide = (v, action) => act(() => api.post(`/agent/verifications/${v.id}/decision`, { action, reason, notes }), 'Decision recorded and applicant notified');

  return (
    <>
      <PageHeader title="Seller verification" subtitle="Check identity documents before anyone can list a property." />
      <Tabs tabs={TABS.map(([value, text]) => ({ value, label: text }))} value={tab} onChange={(v) => { setTab(v); setPage(0); }} />
      {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : data.content.length === 0 ? <Empty icon={ShieldCheck} title="Nothing in this queue" /> : (
        <>
          <div className="space-y-4">
            {data.content.map((v) => (
              <Card key={v.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-semibold text-navy-900">{v.applicantName}</p><p className="text-sm text-muted">{v.applicantEmail} · {v.applicantPhone} · {v.applicantCity}</p><p className="mt-1 text-xs text-muted">Submitted {fmtDateTime(v.submittedAt)}</p></div>
                  <StatusBadge status={v.status} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {v.documents.map((d) => (
                    <button key={d.id} onClick={() => openPrivateFile(`/api/files/verification-documents/${d.id}`).catch((e) => toast(errorMessage(e), 'error'))}
                      className="inline-flex items-center gap-2 rounded-lg border border-line bg-navy-50 px-3 py-2 text-sm font-semibold text-navy-900 hover:border-navy-700"><FileCheck2 size={15} />{label(d.docType)}</button>))}
                </div>
                {v.rejectionReason && <p className="mt-3 rounded bg-amber-50 p-2 text-sm text-amber-900">Last reason given: {v.rejectionReason}</p>}
                <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold text-muted">History</summary>
                  <ol className="mt-2 space-y-1">{v.history.map((h, i) => <li key={i}><b>{label(h.toStatus)}</b> <span className="text-muted">· {fmtDateTime(h.at)}{h.note ? ` · ${h.note}` : ''}</span></li>)}</ol></details>
                {['PENDING', 'UNDER_REVIEW'].includes(v.status) && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                    {v.status === 'PENDING' && <Button variant="outline" onClick={() => act(() => api.post(`/agent/verifications/${v.id}/review`), 'Marked under review')}>Start review</Button>}
                    <Button variant="gold" onClick={() => { setNotes(v.reviewNotes || ''); decide(v, 'APPROVE'); }}>Approve seller</Button>
                    <Button variant="subtle" onClick={() => { setOpen(v); setAsk('RESUBMIT'); }}>Request resubmission…</Button>
                    <Button variant="danger" onClick={() => { setOpen(v); setAsk('REJECT'); }}>Reject…</Button>
                  </div>)}
              </Card>
            ))}
          </div>
          <Pagination page={page} totalPages={data?.page?.totalPages} onChange={setPage} />
        </>
      )}
      <Modal open={!!ask} onClose={() => setAsk(null)} title={ask === 'REJECT' ? 'Reject application' : 'Request corrected documents'}>
        <Field label="Reason (shown to the applicant)"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. The ID photo is blurred — please upload a clear copy" /></Field>
        <Field label="Internal remarks (not shown)" className="mt-3"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setAsk(null)}>Cancel</Button><Button variant="danger" disabled={!reason.trim()} onClick={() => decide(open, ask)}>Confirm</Button></div>
      </Modal>
    </>
  );
}
