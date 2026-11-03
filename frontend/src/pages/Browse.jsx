import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SearchX, SlidersHorizontal } from 'lucide-react';
import api from '../api.js';
import PropertyCard, { CardSkeleton } from '../components/PropertyCard.jsx';
import { Button, Empty, ErrorBox, Field, Input, Pagination, Select, useLoad } from '../components/ui.jsx';

const KEYS = ['q', 'city', 'locality', 'type', 'bhk', 'category', 'minPrice', 'maxPrice', 'minArea', 'maxArea', 'sort'];
const TYPES = ['Apartment', 'House', 'Villa', 'Plot', 'Commercial', 'Residential', 'Agricultural', 'Office', 'Shop'];

export default function Browse() {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') || 0);
  const [draft, setDraft] = useState(() => Object.fromEntries(KEYS.map((k) => [k, params.get(k) || ''])));
  const [showFilters, setShowFilters] = useState(false);
  useEffect(() => setDraft(Object.fromEntries(KEYS.map((k) => [k, params.get(k) || '']))), [params]);

  const query = Object.fromEntries([...params.entries()].filter(([k, v]) => v && (KEYS.includes(k) || k === 'page')));
  const { loading, data, error, reload, setData } = useLoad(() => api.get('/properties', { params: { ...query, size: 12 } }), [params.toString()]);

  const apply = (e) => {
    e?.preventDefault();
    const next = new URLSearchParams(Object.entries(draft).filter(([, v]) => v));
    setParams(next);
    setShowFilters(false);
  };
  const reset = () => { setDraft(Object.fromEntries(KEYS.map((k) => [k, '']))); setParams({}); };
  const setSort = (v) => { const n = new URLSearchParams(params); v ? n.set('sort', v) : n.delete('sort'); n.delete('page'); setParams(n); };
  const setPage = (p) => { const n = new URLSearchParams(params); n.set('page', p); setParams(n); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });
  const items = data?.content || [];
  const updateWish = (id, v) => setData({ ...data, content: items.map((p) => (p.id === id ? { ...p, wishlisted: v } : p)) });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-navy-900">Properties</h1>
          <p className="text-sm text-muted" aria-live="polite">{loading ? 'Searching…' : `${data?.page?.totalElements ?? 0} ${data?.page?.totalElements === 1 ? 'property' : 'properties'} found`}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="lg:hidden" onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal size={16} />Filters</Button>
          <Select aria-label="Sort" value={params.get('sort') || ''} onChange={(e) => setSort(e.target.value)} className="w-52">
            <option value="">Most relevant</option><option value="newest">Newest listings</option>
            <option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option>
          </Select>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <form onSubmit={apply} className={`${showFilters ? 'block' : 'hidden'} h-fit space-y-4 rounded-xl border border-line bg-white p-5 lg:sticky lg:top-24 lg:block`}>
          <Field label="Search"><Input placeholder="Title, locality, address" value={draft.q} onChange={set('q')} /></Field>
          <Field label="Buy or rent"><Select value={draft.category} onChange={set('category')}><option value="">Any</option><option value="SALE">For sale</option><option value="RENT">For rent</option></Select></Field>
          <Field label="City"><Select value={draft.city} onChange={set('city')}><option value="">Any city</option>{['Chandigarh', 'Mohali', 'Panchkula', 'Zirakpur'].map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Locality"><Input placeholder="e.g. Sector 21" value={draft.locality} onChange={set('locality')} /></Field>
          <Field label="Property type"><Select value={draft.type} onChange={set('type')}><option value="">Any</option>{TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
          <Field label="Bedrooms (BHK)"><Select value={draft.bhk} onChange={set('bhk')}><option value="">Any</option>{[1, 2, 3].map((n) => <option key={n} value={n}>{n} BHK</option>)}<option value="4">4+ BHK</option></Select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Min price ₹"><Input type="number" min="0" value={draft.minPrice} onChange={set('minPrice')} /></Field>
            <Field label="Max price ₹"><Input type="number" min="0" value={draft.maxPrice} onChange={set('maxPrice')} /></Field>
            <Field label="Min area"><Input type="number" min="0" value={draft.minArea} onChange={set('minArea')} /></Field>
            <Field label="Max area"><Input type="number" min="0" value={draft.maxArea} onChange={set('maxArea')} /></Field>
          </div>
          <div className="flex gap-2 pt-1"><Button type="submit" className="flex-1">Apply</Button><Button type="button" variant="outline" onClick={reset}>Reset</Button></div>
        </form>

        <div>
          {error ? <ErrorBox message={error} onRetry={reload} /> : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {loading ? Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} />) : items.map((p) => <PropertyCard key={p.id} property={p} onWishlistChange={updateWish} />)}
              </div>
              {!loading && items.length === 0 && <Empty icon={SearchX} title="No properties match" text="Try widening your price range or removing a filter." action={<Button variant="outline" onClick={reset}>Clear filters</Button>} />}
              <Pagination page={page} totalPages={data?.page?.totalPages} onChange={setPage} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
