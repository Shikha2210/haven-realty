import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Headset, ShieldCheck, Search } from 'lucide-react';
import api from '../api.js';
import PropertyCard, { CardSkeleton } from '../components/PropertyCard.jsx';
import { Button, Empty, ErrorBox, Select, useLoad } from '../components/ui.jsx';

export default function Home() {
  const nav = useNavigate();
  const [f, setF] = useState({ category: '', city: '', type: '' });
  const featured = useLoad(() => api.get('/properties', { params: { size: 6, sort: 'relevance' } }), []);
  const go = (e) => {
    e.preventDefault();
    const p = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
    nav(`/properties?${p}`);
  };
  const items = featured.data?.content || [];
  return (
    <>
      <section className="relative overflow-hidden bg-navy-900 text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-gold-500/10 blur-3xl" />
        <div className="mx-auto max-w-7xl px-4 pb-24 pt-16 sm:px-6 sm:pt-24">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-gold-500">Chandigarh · Mohali · Panchkula</p>
          <h1 className="font-display max-w-3xl text-4xl font-semibold leading-tight sm:text-6xl">Find a place to <em className="text-gold-500 not-italic">belong</em>.</h1>
          <p className="mt-5 max-w-xl text-lg text-slate-300">Verified homes, plots and offices. One dedicated agent handles every enquiry, visit and negotiation — so you never chase anyone.</p>
          <form onSubmit={go} className="mt-10 grid max-w-4xl gap-3 rounded-2xl bg-white p-3 text-ink shadow-2xl sm:grid-cols-[1fr_1fr_1fr_auto]">
            <Select aria-label="Buy or rent" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">Buy or rent</option><option value="SALE">Buy</option><option value="RENT">Rent</option></Select>
            <Select aria-label="City" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })}><option value="">Any city</option>{['Chandigarh', 'Mohali', 'Panchkula', 'Zirakpur'].map((c) => <option key={c}>{c}</option>)}</Select>
            <Select aria-label="Property type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="">Any type</option>{['Apartment', 'House', 'Villa', 'Plot', 'Commercial'].map((c) => <option key={c}>{c}</option>)}</Select>
            <Button variant="gold" type="submit" className="px-7"><Search size={16} />Search</Button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex items-end justify-between">
          <div><h2 className="font-display text-3xl font-semibold text-navy-900">Featured homes</h2><p className="mt-1 text-muted">Hand-checked listings, approved by our agent.</p></div>
          <Link to="/properties" className="hidden items-center gap-1 text-sm font-semibold text-gold-600 sm:flex">View all <ArrowRight size={16} /></Link>
        </div>
        {featured.error ? <ErrorBox message={featured.error} onRetry={featured.reload} /> : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.loading ? Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} />) : items.map((p) => <PropertyCard key={p.id} property={p} />)}
          </div>
        )}
        {!featured.loading && !featured.error && items.length === 0 && <Empty title="No listings yet" text="Approved properties will appear here." />}
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-3">
          {[[ShieldCheck, 'Verified sellers', 'Every seller’s identity and every ownership paper is checked before a listing goes live.'],
            [Headset, 'One agent, start to finish', 'You talk only to our agent. Seller details stay private, and so do yours.'],
            [BadgeCheck, 'Track every step', 'Follow your enquiry from first reply to site visit and closing, right in your account.']].map(([Icon, t, d]) => (
            <div key={t}><div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-gold-100 text-gold-600"><Icon size={24} /></div><h3 className="font-display text-xl font-semibold text-navy-900">{t}</h3><p className="mt-2 text-muted">{d}</p></div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl bg-navy-900 p-8 text-white sm:flex-row sm:items-center sm:p-12">
          <div><h2 className="font-display text-3xl font-semibold">Have a property to sell or rent?</h2><p className="mt-2 max-w-lg text-slate-300">Create one account, get verified once, and list as many properties as you like.</p></div>
          <Link to="/signup"><Button variant="gold" className="px-6 py-3">Start selling<ArrowRight size={16} /></Button></Link>
        </div>
      </section>
    </>
  );
}
