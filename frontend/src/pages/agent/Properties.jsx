import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileCheck2 } from 'lucide-react';
import api, { errorMessage, openPrivateFile } from '../../api.js';
import { Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Pagination, PrivateImg, Spinner, StatusBadge, Tabs, Textarea, fmtDateTime, inr, label, useLoad, useToast } from '../../components/ui.jsx';

const TABS = [['SUBMITTED,UNDER_REVIEW', 'To review'], ['PUBLISHED', 'Published'], ['REJECTED,SUSPENDED', 'Rejected / suspended'], ['INACTIVE,SOLD', 'Inactive / sold'], ['DRAFT', 'Drafts'], ['', 'All']];

function Detail({ id }) {
  const toast = useToast();
  const { loading, data, error, reload, setData } = useLoad(() => api.get(`/agent/properties/${id}`), [id]);
  const [ask, setAsk] = useState(null); // { action, title, needsReason }
  const [reason, setReason] = useState('');
  const [edit, setEdit] = useState(null);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const p = data.property;
  const run = async (fn, ok) => { try { const r = await fn(); setData(r.data); ok && toast(ok); setAsk(null); setReason(''); } catch (err) { toast(errorMessage(err), 'error'); } };
  const decide = (action) => run(() => api.post(`/agent/properties/${id}/decision`, { action, reason }), 'Decision recorded');

  const saveEdit = (ev) => {
    ev.preventDefault();
    const body = { ...p, ...edit, area: Number(edit.area), price: Number(edit.price), bedrooms: edit.bedrooms === '' || edit.bedrooms == null ? null : Number(edit.bedrooms), bathrooms: edit.bathrooms === '' || edit.bathrooms == null ? null : Number(edit.bathrooms) };
    run(() => api.put(`/agent/properties/${id}`, body), 'Property updated').then(() => setEdit(null));
  };

  return (
    <>
      <Link to="/agent/properties" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-navy-900"><ArrowLeft size={16} />All properties</Link>
      <PageHeader title={p.title} subtitle={`${p.address}, ${p.city}`} action={<StatusBadge status={p.status} />} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{p.images.map((im) => <PrivateImg key={im.id} src={im.url} alt="" className="aspect-[4/3] w-full rounded-lg object-cover" />)}{p.images.length === 0 && <p className="col-span-full text-sm text-muted">No photos.</p>}</div>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              {[['Price', inr(p.price, p.category)], ['Type', p.propertyType], ['For', p.category], ['Area', `${p.area} ${p.measurementUnit}`], ['Bedrooms', p.bedrooms ?? '—'], ['Bathrooms', p.bathrooms ?? '—'],
                ['Furnishing', p.furnishingStatus || '—'], ['Facing', p.facing || '—'], ['Approved by', p.approvedBy || '—'], ['Views', p.viewCount], ['Enquiries', p.enquiryCount], ['PIN', p.postalCode || '—']].map(([k, v]) => (
                <div key={k}><dt className="text-xs uppercase tracking-wide text-muted">{k}</dt><dd className="font-semibold text-navy-900">{v}</dd></div>))}
            </dl>
            {p.description && <p className="mt-4 whitespace-pre-line text-sm text-slate-700">{p.description}</p>}
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold text-navy-900">Ownership & other documents</h2>
            {p.documents.length === 0 ? <p className="text-sm text-muted">No documents uploaded.</p> : <ul className="space-y-2">{p.documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded-lg bg-navy-50 px-3 py-2 text-sm"><span className="flex items-center gap-2"><FileCheck2 size={15} />{label(d.docType)} — {d.originalName}</span>
                <button className="font-semibold text-gold-600" onClick={() => openPrivateFile(`/api/files/property-documents/${d.id}`).catch((e) => toast(errorMessage(e), 'error'))}>Open</button></li>))}</ul>}
          </Card>
        </div>
        <aside className="space-y-6">
          <Card>
            <h2 className="mb-3 font-semibold text-navy-900">Decision</h2>
            <div className="grid gap-2">
              {p.status === 'SUBMITTED' && <Button variant="outline" onClick={() => run(() => api.post(`/agent/properties/${id}/review`), 'Marked under review')}>Start review</Button>}
              {['SUBMITTED', 'UNDER_REVIEW'].includes(p.status) && <><Button variant="gold" onClick={() => decide('APPROVE')}>Approve & publish</Button><Button variant="danger" onClick={() => setAsk({ action: 'REJECT', title: 'Reject listing' })}>Reject…</Button></>}
              {p.status === 'PUBLISHED' && <><Button variant="outline" onClick={() => setAsk({ action: 'SUSPEND', title: 'Suspend listing' })}>Suspend…</Button><Button variant="subtle" onClick={() => run(() => api.post(`/agent/properties/${id}/status`, { status: 'INACTIVE' }), 'Marked inactive')}>Mark inactive</Button><Button variant="subtle" onClick={() => run(() => api.post(`/agent/properties/${id}/status`, { status: 'SOLD' }), 'Marked sold')}>Mark sold</Button></>}
              {p.status === 'SUSPENDED' && <Button variant="gold" onClick={() => decide('RESTORE')}>Restore listing</Button>}
              <Button variant="ghost" onClick={() => setEdit({ title: p.title, price: p.price, area: p.area, bedrooms: p.bedrooms ?? '', bathrooms: p.bathrooms ?? '', description: p.description || '' })}>Edit details</Button>
            </div>
            {p.rejectionReason && <p className="mt-3 rounded bg-amber-50 p-2 text-xs text-amber-900">Reason on file: {p.rejectionReason}</p>}
          </Card>
          <Card>
            <h2 className="mb-2 font-semibold text-navy-900">Seller</h2>
            <p className="text-sm">{data.seller.name}</p><p className="text-sm text-muted">{data.seller.email} · {data.seller.phone}</p>
            <Link to={`/agent/customers/${data.seller.id}`} className="mt-2 inline-block text-xs font-semibold text-gold-600">Open profile & messages →</Link>
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold text-navy-900">History</h2>
            <ol className="space-y-3 text-sm">{data.approvals.map((a, i) => (<li key={i}><b>{label(a.decision)}</b> <span className="text-muted">· {fmtDateTime(a.at)}</span>{a.reason && <p className="text-muted">{a.reason}</p>}</li>))}{data.approvals.length === 0 && <li className="text-muted">No activity yet.</li>}</ol>
          </Card>
        </aside>
      </div>

      <Modal open={!!ask} onClose={() => setAsk(null)} title={ask?.title}>
        <Field label="Reason (shown to the seller)"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Be specific so the seller can fix it" /></Field>
        <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setAsk(null)}>Cancel</Button><Button variant="danger" disabled={!reason.trim()} onClick={() => decide(ask.action)}>Confirm</Button></div>
      </Modal>
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Edit listing details">
        {edit && <form onSubmit={saveEdit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" className="sm:col-span-2"><Input required value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
          <Field label="Price (₹)"><Input type="number" min="1" required value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} /></Field>
          <Field label="Area"><Input type="number" min="0.01" step="any" required value={edit.area} onChange={(e) => setEdit({ ...edit, area: e.target.value })} /></Field>
          <Field label="Bedrooms"><Input type="number" min="0" value={edit.bedrooms} onChange={(e) => setEdit({ ...edit, bedrooms: e.target.value })} /></Field>
          <Field label="Bathrooms"><Input type="number" min="0" value={edit.bathrooms} onChange={(e) => setEdit({ ...edit, bathrooms: e.target.value })} /></Field>
          <Field label="Description" className="sm:col-span-2"><Textarea value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button type="submit">Save</Button></div></form>}
      </Modal>
    </>
  );
}

export default function AgentProperties() {
  const { id } = useParams();
  const nav = useNavigate();
  const [tab, setTab] = useState('SUBMITTED,UNDER_REVIEW');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const { loading, data, error, reload } = useLoad(() => (id ? Promise.resolve({ data: null }) : api.get('/agent/properties', { params: { status: tab || undefined, q: query || undefined, page, size: 12 } })), [id, tab, query, page]);
  if (id) return <Detail id={id} />;
  return (
    <>
      <PageHeader title="Properties" subtitle="Review, approve and manage every listing." />
      <Tabs tabs={TABS.map(([value, text]) => ({ value, label: text }))} value={tab} onChange={(v) => { setTab(v); setPage(0); }} />
      <form className="mb-4 flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); setQuery(q); setPage(0); }}><Input placeholder="Search title, city or address" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} /><Button type="submit" variant="outline">Search</Button></form>
      {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : data.content.length === 0 ? <Empty title="No properties here" text="Nothing matches this view." /> : (
        <>
          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-muted"><tr>{['', 'Property', 'Seller', 'Price', 'Status', 'Updated'].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
              <tbody>{data.content.map(({ property: p, seller }) => (
                <tr key={p.id} onClick={() => nav(`/agent/properties/${p.id}`)} className="cursor-pointer border-t border-line hover:bg-navy-50/60">
                  <td className="w-20 px-4 py-2"><PrivateImg src={p.images[0]?.url} alt="" className="h-12 w-16 rounded object-cover" /></td>
                  <td className="px-4 py-3"><p className="font-semibold text-navy-900">{p.title}</p><p className="text-xs text-muted">{p.locality}, {p.city} · {p.category}</p></td><td className="px-4 py-3">{seller.name}</td>
                  <td className="px-4 py-3">{inr(p.price, p.category)}</td><td className="px-4 py-3"><StatusBadge status={p.status} /></td><td className="px-4 py-3 text-muted">{fmtDateTime(p.updatedAt)}</td></tr>))}</tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={data?.page?.totalPages} onChange={setPage} />
        </>
      )}
    </>
  );
}
