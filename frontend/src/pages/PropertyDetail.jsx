import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { BadgeCheck, Bath, BedDouble, CalendarClock, Car, Check, Compass, GitCompare, Heart, Landmark, MapPin, Maximize2, Send, Sofa } from 'lucide-react';
import api, { errorMessage, fieldErrors } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useCompare } from '../compare.js';
import { Button, Card, ErrorBox, Field, Modal, PublicImg, Spinner, Textarea, Input, inr, label, useLoad, useToast } from '../components/ui.jsx';

export default function PropertyDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const compare = useCompare();
  const { loading, data, error, reload, setData } = useLoad(() => api.get(`/properties/${id}`), [id]);
  const [active, setActive] = useState(0);
  const [modal, setModal] = useState(null); // 'enquire' | 'visit'
  const [message, setMessage] = useState('');
  const [when, setWhen] = useState('');
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);

  if (loading) return <Spinner />;
  if (error) return <div className="mx-auto max-w-3xl p-6"><ErrorBox message={error === 'Property not found' ? 'This property is no longer available.' : error} onRetry={reload} /></div>;
  const p = data.card;
  const isBuyer = user?.role === 'CUSTOMER';

  const requireSignIn = () => { nav('/login', { state: { from: loc.pathname } }); toast('Please sign in to continue', 'error'); };
  const open = (kind) => {
    if (!user) return requireSignIn();
    if (!isBuyer) return toast('Only customer accounts can send enquiries', 'error');
    if (!user.emailVerified) { toast('Please verify your email first', 'error'); return nav('/account/verify'); }
    setMessage(kind === 'visit' ? '' : `Hi, I'm interested in "${p.title}". Is it still available?`);
    setErrs({});
    setModal(kind);
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErrs({});
    try {
      const text = modal === 'visit' ? `Site visit request for ${when.replace('T', ' ')}. ${message}`.trim() : message;
      const { data: enq } = await api.post('/me/enquiries', { propertyId: p.id, enquiryType: modal === 'visit' ? 'SITE_VISIT' : p.category === 'RENT' ? 'RENT' : 'BUY', message: text });
      toast('Sent! Our agent will contact you shortly.');
      setModal(null);
      nav(`/account/enquiries/${enq.id}`);
    } catch (err) {
      setErrs(fieldErrors(err));
      toast(errorMessage(err), 'error');
      if (err.response?.status === 409) { setModal(null); nav('/account/enquiries'); }
    } finally { setBusy(false); }
  };

  const toggleSave = async () => {
    if (!isBuyer) return requireSignIn();
    try {
      if (p.wishlisted) await api.delete(`/me/wishlist/${p.id}`); else await api.post(`/me/wishlist/${p.id}`);
      setData({ ...data, card: { ...p, wishlisted: !p.wishlisted } });
    } catch (err) { toast(errorMessage(err), 'error'); }
  };

  const specs = [
    [BedDouble, 'Bedrooms', p.bedrooms], [Bath, 'Bathrooms', p.bathrooms],
    [Maximize2, 'Area', `${Number(p.area).toLocaleString('en-IN')} ${p.measurementUnit}`], [Sofa, 'Furnishing', p.furnishingStatus],
    [Car, 'Parking', data.parkingAvailable ? 'Available' : 'Not available'], [Compass, 'Facing', data.facing], [Landmark, 'Approved by', data.approvedBy],
  ].filter(([, , v]) => v != null && v !== '');

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav className="mb-4 text-sm text-muted"><Link to="/properties" className="hover:text-navy-900">Properties</Link> / {p.city} / <span className="text-ink">{p.title}</span></nav>
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="overflow-hidden rounded-2xl bg-navy-50">
            <PublicImg src={data.imageUrls[active]} alt={p.title} className="aspect-[16/10] w-full object-cover" />
          </div>
          {data.imageUrls.length > 1 && (
            <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6">
              {data.imageUrls.map((u, i) => (
                <button key={u} onClick={() => setActive(i)} aria-label={`Photo ${i + 1}`} aria-current={i === active}
                  className={`overflow-hidden rounded-lg border-2 ${i === active ? 'border-gold-500' : 'border-transparent'}`}>
                  <PublicImg src={u} alt="" className="aspect-[4/3] w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="mt-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-navy-900 px-2.5 py-1 text-xs font-bold uppercase text-white">{p.category === 'RENT' ? 'For rent' : 'For sale'}</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"><BadgeCheck size={14} />Verified listing</span>
              <span className="rounded-md bg-navy-50 px-2.5 py-1 text-xs font-semibold text-navy-700">{p.propertyType}</span>
            </div>
            <h1 className="font-display mt-3 text-3xl font-semibold text-navy-900 sm:text-4xl">{p.title}</h1>
            <p className="mt-2 flex items-center gap-1.5 text-muted"><MapPin size={16} />{[p.locality, p.city, data.postalCode].filter(Boolean).join(', ')}</p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {specs.map(([Icon, k, v]) => (
              <div key={k} className="rounded-xl border border-line bg-white p-4"><Icon size={18} className="text-gold-600" /><p className="mt-2 text-xs uppercase tracking-wide text-muted">{k}</p><p className="font-semibold text-navy-900">{v}</p></div>
            ))}
          </div>

          <section className="mt-8"><h2 className="font-display text-2xl font-semibold text-navy-900">About this property</h2><p className="mt-3 whitespace-pre-line leading-relaxed text-slate-700">{data.description || 'Details are shared by our agent on request.'}</p></section>

          {data.amenities.length > 0 && (
            <section className="mt-8"><h2 className="font-display text-2xl font-semibold text-navy-900">Amenities</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">{data.amenities.map((a) => <li key={a} className="flex items-center gap-2 text-slate-700"><Check size={16} className="text-emerald-600" />{a}</li>)}</ul>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <Card>
            <p className="font-display text-3xl font-semibold text-navy-900">{inr(p.price, p.category)}</p>
            <p className="mt-1 text-sm text-muted">{label(p.category === 'RENT' ? 'monthly rent' : 'asking price')}</p>
            <div className="mt-5 space-y-3">
              <Button className="w-full py-3" onClick={() => open('enquire')}><Send size={16} />Enquire now</Button>
              <Button variant="outline" className="w-full py-3" onClick={() => open('visit')}><CalendarClock size={16} />Request a site visit</Button>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="subtle" onClick={toggleSave} aria-pressed={!!p.wishlisted}><Heart size={16} className={p.wishlisted ? 'fill-red-500 text-red-500' : ''} />{p.wishlisted ? 'Saved' : 'Save'}</Button>
                <Button variant="subtle" onClick={() => compare.toggle(p.id) === false && toast('You can compare up to 4 properties', 'error')} aria-pressed={compare.has(p.id)}><GitCompare size={16} />{compare.has(p.id) ? 'Added' : 'Compare'}</Button>
              </div>
            </div>
            <div className="mt-5 rounded-lg bg-gold-100/60 p-4 text-sm text-slate-700">
              <p className="font-semibold text-navy-900">Handled by Haven Realty’s agent</p>
              <p className="mt-1">{data.contactedThrough}. Owner details are kept private to protect everyone involved.</p>
            </div>
          </Card>
        </aside>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'visit' ? 'Request a site visit' : 'Send an enquiry'}>
        <form onSubmit={submit} className="space-y-4">
          {modal === 'visit' && <Field label="Preferred date & time" error={errs.message}><Input type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)} min={new Date().toISOString().slice(0, 16)} /></Field>}
          <Field label={modal === 'visit' ? 'Anything we should know? (optional)' : 'Your message'} error={errs.message}>
            <Textarea required={modal !== 'visit'} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} />
          </Field>
          <p className="text-xs text-muted">Our agent will reply here and in your account. Your phone number is shared only with the agent.</p>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button type="submit" loading={busy}>Send</Button></div>
        </form>
      </Modal>
    </div>
  );
}
