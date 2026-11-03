import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, MessageSquare } from 'lucide-react';
import api, { errorMessage } from '../../api.js';
import Chat from '../../components/Chat.jsx';
import { Button, Card, Empty, ErrorBox, PageHeader, PublicImg, Spinner, StatusBadge, fmtDateTime, inr, label, useLoad, useToast } from '../../components/ui.jsx';

const FLOW = ['NEW', 'UNDER_REVIEW', 'CONTACTED', 'DETAILS_SHARED', 'SITE_VISIT_SCHEDULED', 'NEGOTIATION', 'DEAL_IN_PROGRESS', 'CLOSED'];

function Detail({ id }) {
  const toast = useToast();
  const { loading, data, error, reload, setData } = useLoad(() => api.get(`/me/enquiries/${id}`), [id]);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const e = data.enquiry;
  const finished = ['CLOSED', 'CANCELLED', 'REJECTED'].includes(e.status);
  const idx = FLOW.indexOf(e.status);

  const send = async (body) => {
    try { const r = await api.post(`/me/enquiries/${id}/messages`, { body }); setData(r.data); } catch (err) { toast(errorMessage(err), 'error'); throw err; }
  };
  const cancel = async () => {
    if (!confirm('Cancel this enquiry?')) return;
    try { const r = await api.post(`/me/enquiries/${id}/cancel`); setData(r.data); toast('Enquiry cancelled'); } catch (err) { toast(errorMessage(err), 'error'); }
  };

  return (
    <>
      <Link to="/account/enquiries" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-navy-900"><ArrowLeft size={16} />All enquiries</Link>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="font-display text-2xl font-semibold text-navy-900">Conversation with your agent</h1><StatusBadge status={e.status} /></div>
            {!finished && idx >= 0 && (
              <ol className="mt-5 flex gap-1 overflow-x-auto pb-1" aria-label="Progress">
                {FLOW.map((s, i) => (
                  <li key={s} className="min-w-[88px] flex-1 text-center"><div className={`mx-auto mb-1.5 h-1.5 rounded-full ${i <= idx ? 'bg-gold-500' : 'bg-line'}`} /><span className={`text-[11px] font-semibold ${i === idx ? 'text-navy-900' : 'text-muted'}`}>{label(s)}</span></li>
                ))}
              </ol>
            )}
          </Card>
          <Card><Chat messages={data.messages} isMine={(m) => m.from === 'ME'} onSend={send} disabled={finished} placeholder="Add more details or ask the agent a question…" /></Card>
        </div>
        <aside className="space-y-4">
          <Card className="p-0 overflow-hidden">
            <Link to={`/properties/${e.property.id}`}><PublicImg src={e.property.coverImageUrl} alt={e.property.title} className="aspect-[4/3] w-full object-cover" /></Link>
            <div className="p-4"><p className="font-semibold text-navy-900">{e.property.title}</p><p className="text-sm text-muted">{[e.property.locality, e.property.city].filter(Boolean).join(', ')}</p><p className="mt-1 font-display text-xl text-navy-900">{inr(e.property.price, e.property.category)}</p></div>
          </Card>
          <Card>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy-900"><CalendarClock size={16} />Site visits</h2>
            {data.visits.length === 0 ? <p className="text-sm text-muted">None scheduled yet.</p> : (
              <ul className="space-y-3">{data.visits.map((v) => (<li key={v.id} className="text-sm"><p className="font-semibold text-navy-900">{fmtDateTime(v.scheduledAt)}</p><StatusBadge status={v.status} />{v.notes && <p className="mt-1 text-muted">{v.notes}</p>}</li>))}</ul>
            )}
          </Card>
          {!finished && <Button variant="outline" className="w-full" onClick={cancel}>Cancel enquiry</Button>}
        </aside>
      </div>
    </>
  );
}

export default function Enquiries() {
  const { id } = useParams();
  const { loading, data, error, reload } = useLoad(() => (id ? Promise.resolve({ data: [] }) : api.get('/me/enquiries')), [id]);
  if (id) return <Detail id={id} />;
  return (
    <>
      <PageHeader title="My enquiries" subtitle="Every conversation with our agent, in one place." />
      {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : data.length === 0 ? (
        <Empty icon={MessageSquare} title="No enquiries yet" text="When you enquire about a property, you can follow it here." action={<Link to="/properties"><Button>Browse properties</Button></Link>} />
      ) : (
        <ul className="space-y-3">
          {data.map((e) => (
            <li key={e.id}><Link to={`/account/enquiries/${e.id}`} className="flex items-center gap-4 rounded-xl border border-line bg-white p-3 transition hover:border-navy-700 hover:shadow-md">
              <PublicImg src={e.property.coverImageUrl} alt="" className="h-20 w-28 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1"><p className="truncate font-semibold text-navy-900">{e.property.title}</p><p className="truncate text-sm text-muted">{e.message}</p><p className="mt-1 text-xs text-slate-400">Updated {fmtDateTime(e.updatedAt)}</p></div>
              <StatusBadge status={e.status} />
            </Link></li>
          ))}
        </ul>
      )}
    </>
  );
}
