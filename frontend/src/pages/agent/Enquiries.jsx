import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarPlus, Handshake, KeyRound, Mail, Phone, User } from 'lucide-react';
import api, { errorMessage } from '../../api.js';
import Chat from '../../components/Chat.jsx';
import { RentalModal, SaleModal } from '../../components/RecordForms.jsx';
import { Button, Card, Empty, ErrorBox, Field, Input, Pagination, PageHeader, Select, Spinner, StatusBadge, Tabs, Textarea, fmtDate, fmtDateTime, inr, label, useLoad, useToast } from '../../components/ui.jsx';

const STATUSES = ['UNDER_REVIEW', 'CONTACTED', 'DETAILS_SHARED', 'SITE_VISIT_SCHEDULED', 'NEGOTIATION', 'DEAL_IN_PROGRESS', 'ON_HOLD', 'CLOSED', 'REJECTED', 'CANCELLED'];
const TABS = [['', 'Open'], ['NEW', 'New'], ['CLOSED,REJECTED,CANCELLED', 'Finished'], ['ALL', 'All']];
const OPEN = 'NEW,UNDER_REVIEW,CONTACTED,DETAILS_SHARED,SITE_VISIT_SCHEDULED,NEGOTIATION,DEAL_IN_PROGRESS,ON_HOLD';

function Detail({ id }) {
  const toast = useToast();
  const { loading, data, error, reload, setData } = useLoad(() => api.get(`/agent/enquiries/${id}`), [id]);
  const [status, setStatus] = useState('');
  const [reason, setReason] = useState('');
  const [visit, setVisit] = useState({ scheduledAt: '', notes: '' });
  const [offer, setOffer] = useState({ amount: '', note: '' });
  const [triage, setTriage] = useState({ priority: 'NORMAL', followUpDate: '' });
  const [saleOpen, setSaleOpen] = useState(false);
  const [rentalOpen, setRentalOpen] = useState(false);
  useEffect(() => { if (data) { setStatus(data.enquiry.status === 'NEW' ? '' : data.enquiry.status); setTriage({ priority: data.enquiry.priority, followUpDate: data.enquiry.followUpDate || '' }); } }, [data]);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const e = data.enquiry;
  const run = async (fn, ok) => { try { const r = await fn(); setData(r.data); ok && toast(ok); } catch (err) { toast(errorMessage(err), 'error'); } };
  const finishing = ['CLOSED', 'REJECTED', 'CANCELLED'].includes(status);

  return (
    <>
      <Link to="/agent/enquiries" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-navy-900"><ArrowLeft size={16} />All enquiries</Link>
      <div className="mb-5 flex flex-wrap items-center gap-3"><h1 className="font-display text-2xl font-semibold text-navy-900">Enquiry #{e.id}</h1><StatusBadge status={e.status} />{e.priority === 'HIGH' && <StatusBadge status="HIGH" />}</div>
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-semibold text-navy-900">Conversation with the buyer</h2>
            <Chat messages={data.messages} isMine={(m) => m.from === 'ME'} internalToggle placeholder="Reply to the buyer, or tick “Internal note”…"
              onSend={(body, internal) => run(() => api.post(`/agent/enquiries/${id}/messages`, { body, internal }))} />
          </Card>
          <Card>
            <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-navy-900">Offers & negotiation</h2></div>
            {data.offers.length === 0 ? <p className="mb-3 text-sm text-muted">No offers recorded.</p> : (
              <ul className="mb-4 divide-y divide-line">{data.offers.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"><div><b className="text-navy-900">{inr(o.amount)}</b> <span className="text-muted">· {fmtDateTime(o.at)}</span>{o.note && <p className="text-muted">{o.note}</p>}</div>
                  <Select className="w-36" aria-label="Offer status" value={o.status} onChange={(ev) => run(() => api.put(`/agent/offers/${o.id}`, { status: ev.target.value }))}>{['OPEN', 'ACCEPTED', 'REJECTED', 'COUNTERED'].map((s) => <option key={s}>{s}</option>)}</Select></li>))}</ul>
            )}
            <form className="grid gap-3 sm:grid-cols-[160px_1fr_auto]" onSubmit={(ev) => { ev.preventDefault(); run(() => api.post(`/agent/enquiries/${id}/offers`, { amount: Number(offer.amount), note: offer.note }), 'Offer recorded').then(() => setOffer({ amount: '', note: '' })); }}>
              <Input type="number" min="1" required placeholder="Amount ₹" aria-label="Offer amount" value={offer.amount} onChange={(x) => setOffer({ ...offer, amount: x.target.value })} />
              <Input placeholder="Note (optional)" aria-label="Offer note" value={offer.note} onChange={(x) => setOffer({ ...offer, note: x.target.value })} /><Button type="submit" variant="outline">Add offer</Button>
            </form>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <h2 className="mb-3 font-semibold text-navy-900">Buyer</h2>
            <ul className="space-y-1.5 text-sm"><li className="flex items-center gap-2"><User size={15} />{e.buyer.name}</li><li className="flex items-center gap-2"><Mail size={15} />{e.buyer.email}</li><li className="flex items-center gap-2"><Phone size={15} />{e.buyer.phone}</li></ul>
            <Link to={`/agent/customers/${e.buyer.id}`} className="mt-2 inline-block text-xs font-semibold text-gold-600">Open customer →</Link>
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold text-navy-900">Property & seller</h2>
            <p className="font-semibold text-navy-900">{e.property.title}</p><p className="text-sm text-muted">{e.propertyAddress}</p><p className="mt-1 font-display text-lg">{inr(e.property.price, e.property.category)}</p>
            <div className="mt-3 border-t border-line pt-3 text-sm"><p className="mb-1 text-xs font-semibold uppercase text-muted">Seller (private)</p><p>{e.seller.name} · {e.seller.phone}</p>
              <Link to={`/agent/customers/${e.seller.id}`} className="text-xs font-semibold text-gold-600">Message seller →</Link></div>
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold text-navy-900">Update status</h2>
            <Select aria-label="Status" value={status} onChange={(x) => setStatus(x.target.value)}><option value="" disabled>Choose status…</option>{STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>
            {finishing && <Textarea rows={2} className="mt-2" placeholder="Reason (required)" aria-label="Reason" value={reason} onChange={(x) => setReason(x.target.value)} />}
            <Button className="mt-3 w-full" disabled={!status || status === e.status || (finishing && !reason.trim())} onClick={() => run(() => api.post(`/agent/enquiries/${id}/status`, { status, closureReason: reason }), 'Status updated')}>Save status</Button>
            {e.closureReason && <p className="mt-2 text-xs text-muted">Closure reason: {e.closureReason}</p>}
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold text-navy-900">Priority & follow-up</h2>
            <div className="grid grid-cols-2 gap-2"><Select aria-label="Priority" value={triage.priority} onChange={(x) => setTriage({ ...triage, priority: x.target.value })}>{['LOW', 'NORMAL', 'HIGH'].map((p) => <option key={p}>{p}</option>)}</Select>
              <Input type="date" aria-label="Follow-up date" value={triage.followUpDate} onChange={(x) => setTriage({ ...triage, followUpDate: x.target.value })} /></div>
            <Button variant="outline" className="mt-3 w-full" onClick={() => run(() => api.put(`/agent/enquiries/${id}/triage`, { priority: triage.priority, followUpDate: triage.followUpDate || null }), 'Saved')}>Save</Button>
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold text-navy-900">Site visits</h2>
            <ul className="mb-3 space-y-2">{data.visits.map((v) => (<li key={v.id} className="flex items-center justify-between gap-2 text-sm"><span>{fmtDateTime(v.scheduledAt)}</span>
              <Select className="w-36" aria-label="Visit status" value={v.status} onChange={(x) => run(() => api.put(`/agent/site-visits/${v.id}`, { status: x.target.value }))}>{['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].map((s) => <option key={s}>{s}</option>)}</Select></li>))}
              {data.visits.length === 0 && <li className="text-sm text-muted">None yet.</li>}</ul>
            <form className="space-y-2" onSubmit={(ev) => { ev.preventDefault(); run(() => api.post(`/agent/enquiries/${id}/site-visits`, visit), 'Visit scheduled — buyer and seller notified').then(() => setVisit({ scheduledAt: '', notes: '' })); }}>
              <Input type="datetime-local" required aria-label="Visit date and time" value={visit.scheduledAt} min={new Date().toISOString().slice(0, 16)} onChange={(x) => setVisit({ ...visit, scheduledAt: x.target.value })} />
              <Input placeholder="Notes (optional)" aria-label="Visit notes" value={visit.notes} onChange={(x) => setVisit({ ...visit, notes: x.target.value })} />
              <Button type="submit" variant="outline" className="w-full"><CalendarPlus size={15} />Schedule visit</Button></form>
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold text-navy-900">Close the deal</h2>
            {data.saleId ? <p className="text-sm"><Link className="font-semibold text-gold-600" to="/agent/sales">Sale #{data.saleId} recorded →</Link></p> : data.rentalId ? <p className="text-sm"><Link className="font-semibold text-gold-600" to="/agent/rentals">Rental #{data.rentalId} recorded →</Link></p> : (
              <div className="grid gap-2"><Button variant="gold" onClick={() => setSaleOpen(true)}><Handshake size={16} />Record sale</Button><Button variant="outline" onClick={() => setRentalOpen(true)}><KeyRound size={16} />Create rental agreement</Button></div>)}
          </Card>
        </aside>
      </div>
      <SaleModal open={saleOpen} onClose={() => setSaleOpen(false)} initial={{ enquiryId: e.id }} onSaved={reload} />
      <RentalModal open={rentalOpen} onClose={() => setRentalOpen(false)} initial={{ enquiryId: e.id }} onSaved={reload} />
    </>
  );
}

export default function AgentEnquiries() {
  const { id } = useParams();
  const nav = useNavigate();
  const [tab, setTab] = useState('');
  const [page, setPage] = useState(0);
  const status = tab === 'ALL' ? undefined : tab || OPEN;
  const { loading, data, error, reload } = useLoad(() => (id ? Promise.resolve({ data: null }) : api.get('/agent/enquiries', { params: { status, page, size: 15 } })), [id, tab, page]);
  if (id) return <Detail id={id} />;
  return (
    <>
      <PageHeader title="Enquiries" subtitle="All buyer conversations. You are the only point of contact." />
      <Tabs tabs={TABS.map(([value, text]) => ({ value, label: text }))} value={tab} onChange={(v) => { setTab(v); setPage(0); }} />
      {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : data.content.length === 0 ? <Empty title="Nothing here" text="No enquiries match this view." /> : (
        <>
          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-muted"><tr>{['#', 'Property', 'Buyer', 'Type', 'Status', 'Priority', 'Follow-up', 'Updated'].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
              <tbody>{data.content.map((e) => (
                <tr key={e.id} onClick={() => nav(`/agent/enquiries/${e.id}`)} className="cursor-pointer border-t border-line hover:bg-navy-50/60">
                  <td className="px-4 py-3 font-semibold">{e.id}</td><td className="max-w-[220px] truncate px-4 py-3">{e.property.title}</td><td className="px-4 py-3">{e.buyer.name}</td>
                  <td className="px-4 py-3">{label(e.enquiryType)}</td><td className="px-4 py-3"><StatusBadge status={e.status} /></td><td className="px-4 py-3"><StatusBadge status={e.priority} /></td>
                  <td className="px-4 py-3">{fmtDate(e.followUpDate)}</td><td className="px-4 py-3 text-muted">{fmtDateTime(e.updatedAt)}</td></tr>))}</tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={data?.page?.totalPages} onChange={setPage} />
        </>
      )}
    </>
  );
}
