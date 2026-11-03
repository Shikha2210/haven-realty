import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api, { errorMessage } from '../../api.js';
import Chat from '../../components/Chat.jsx';
import { downloadExport } from '../../components/RecordForms.jsx';
import { Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Pagination, Select, Spinner, StatusBadge, Textarea, fmtDate, fmtDateTime, useLoad, useToast } from '../../components/ui.jsx';

function Detail({ id }) {
  const toast = useToast();
  const { loading, data, error, reload, setData } = useLoad(() => api.get(`/agent/customers/${id}`), [id]);
  const thread = useLoad(() => (data?.user.sellerEnabled ? api.get(`/agent/customers/${id}/messages`) : Promise.resolve({ data: [] })), [id, data?.user.sellerEnabled]);
  const [ask, setAsk] = useState(false);
  const [reason, setReason] = useState('');
  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const u = data.user;

  const suspend = async () => { try { const r = await api.post(`/agent/customers/${id}/suspend`, { reason }); setData(r.data); setAsk(false); setReason(''); toast('Account suspended'); } catch (e) { toast(errorMessage(e), 'error'); } };
  const reactivate = async () => { try { const r = await api.post(`/agent/customers/${id}/reactivate`); setData(r.data); toast('Account reactivated'); } catch (e) { toast(errorMessage(e), 'error'); } };
  const msgs = (thread.data || []).map((m) => ({ id: m.id, from: m.fromAgent ? 'ME' : 'SELLER', body: m.body, at: m.createdAt }));

  return (
    <>
      <Link to="/agent/customers" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-navy-900"><ArrowLeft size={16} />All customers</Link>
      <PageHeader title={u.fullName} subtitle={`Joined ${fmtDate(data.joinedAt)}`} action={data.accountEnabled ? <Button variant="danger" onClick={() => setAsk(true)}>Suspend account</Button> : <Button variant="gold" onClick={reactivate}>Reactivate account</Button>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {[['Email', u.email], ['Mobile', u.phone], ['City', `${u.city || '—'}, ${u.state || ''}`], ['Address', u.address || '—'], ['PIN', u.postalCode || '—'], ['Date of birth', fmtDate(u.dateOfBirth)]].map(([k, v]) => <div key={k}><dt className="text-xs uppercase tracking-wide text-muted">{k}</dt><dd className="font-semibold text-navy-900">{v}</dd></div>)}
          </dl>
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4 text-sm">
            <span className="text-muted">Account:</span><StatusBadge status={data.accountEnabled ? 'ACTIVE' : 'SUSPENDED'} />
            <span className="ml-3 text-muted">Seller:</span><StatusBadge status={data.sellerApplicationStatus} />
            <span className="ml-3 text-muted">Email</span><StatusBadge status={u.emailVerified ? 'VERIFIED' : 'PENDING'} /><span className="text-muted">Mobile</span><StatusBadge status={u.phoneVerified ? 'VERIFIED' : 'PENDING'} />
          </div>
          <p className="mt-4 text-sm text-muted">{data.enquiryCount} enquiries · {data.propertyCount} properties listed</p>
          {u.preferences && <p className="mt-3 rounded-lg bg-navy-50 p-3 text-sm"><b>Preferences:</b> {u.preferences}</p>}
        </Card>
        {u.sellerEnabled && (
          <Card>
            <h2 className="mb-3 font-semibold text-navy-900">Seller channel</h2>
            <Chat messages={msgs} isMine={(m) => m.from === 'ME'} placeholder="Message this seller…" onSend={async (body) => { try { await api.post(`/agent/customers/${id}/messages`, { body }); thread.reload(); } catch (e) { toast(errorMessage(e), 'error'); throw e; } }} />
          </Card>
        )}
      </div>
      <Modal open={ask} onClose={() => setAsk(false)} title="Suspend account">
        <Field label="Reason (recorded in the audit log)"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setAsk(false)}>Cancel</Button><Button variant="danger" disabled={!reason.trim()} onClick={suspend}>Suspend</Button></div>
      </Modal>
    </>
  );
}

export default function AgentCustomers() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('');
  const [page, setPage] = useState(0);
  const { loading, data, error, reload } = useLoad(() => (id ? Promise.resolve({ data: null }) : api.get('/agent/customers', { params: { q: query || undefined, kind: kind || undefined, page, size: 15 } })), [id, query, kind, page]);
  if (id) return <Detail id={id} />;
  return (
    <>
      <PageHeader title="Customers" subtitle="Every registered buyer and seller." action={<Button variant="outline" onClick={() => downloadExport('customers').catch((e) => toast(errorMessage(e), 'error'))}>Export Excel</Button>} />
      <form className="mb-4 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setQuery(q); setPage(0); }}>
        <Input className="w-72" placeholder="Search name, email or mobile" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select className="w-40" aria-label="Filter" value={kind} onChange={(e) => { setKind(e.target.value); setPage(0); }}><option value="">All customers</option><option value="seller">Sellers only</option></Select>
        <Button type="submit" variant="outline">Search</Button>
      </form>
      {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : data.content.length === 0 ? <Empty title="No customers found" /> : (
        <>
          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-muted"><tr>{['Name', 'Email', 'Mobile', 'City', 'Seller', 'Account', 'Joined'].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
              <tbody>{data.content.map((c) => (
                <tr key={c.user.id} onClick={() => nav(`/agent/customers/${c.user.id}`)} className="cursor-pointer border-t border-line hover:bg-navy-50/60">
                  <td className="px-4 py-3 font-semibold text-navy-900">{c.user.fullName}</td><td className="px-4 py-3">{c.user.email}</td><td className="px-4 py-3">{c.user.phone}</td><td className="px-4 py-3">{c.user.city}</td>
                  <td className="px-4 py-3"><StatusBadge status={c.sellerApplicationStatus} /></td><td className="px-4 py-3"><StatusBadge status={c.accountEnabled ? 'ACTIVE' : 'SUSPENDED'} /></td><td className="px-4 py-3 text-muted">{fmtDate(c.joinedAt)}</td></tr>))}</tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={data?.page?.totalPages} onChange={setPage} />
        </>
      )}
    </>
  );
}
