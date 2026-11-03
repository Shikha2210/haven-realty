import { Link } from 'react-router-dom';
import { GitCompare, X } from 'lucide-react';
import api from '../api.js';
import { useCompare } from '../compare.js';
import { Button, Empty, ErrorBox, PublicImg, Spinner, inr, useLoad } from '../components/ui.jsx';

export default function Compare() {
  const compare = useCompare();
  const { loading, data, error, reload } = useLoad(
    () => (compare.ids.length ? api.get('/properties/compare', { params: { ids: compare.ids.join(',') } }) : Promise.resolve({ data: [] })),
    [compare.ids.join(',')]);

  const rows = [
    ['Price', (p) => inr(p.price, p.category)], ['Type', (p) => p.propertyType], ['For', (p) => (p.category === 'RENT' ? 'Rent' : 'Sale')],
    ['Location', (p) => [p.locality, p.city].filter(Boolean).join(', ')], ['Area', (p) => `${Number(p.area).toLocaleString('en-IN')} ${p.measurementUnit}`],
    ['Bedrooms', (p) => p.bedrooms ?? '—'], ['Bathrooms', (p) => p.bathrooms ?? '—'], ['Furnishing', (p) => p.furnishingStatus || '—'],
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-end justify-between"><div><h1 className="font-display text-3xl font-semibold text-navy-900">Compare properties</h1><p className="text-sm text-muted">Up to four, side by side.</p></div>
        {compare.ids.length > 0 && <Button variant="outline" onClick={compare.clear}>Clear all</Button>}</div>
      {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data?.length ? (
        <Empty icon={GitCompare} title="Nothing to compare yet" text="Tap the compare icon on any listing to add it here." action={<Link to="/properties"><Button>Browse properties</Button></Link>} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr><th className="w-36 p-4" />{data.map((p) => (
              <th key={p.id} className="p-4 text-left align-top">
                <div className="relative"><PublicImg src={p.coverImageUrl} alt={p.title} className="aspect-[4/3] w-full rounded-lg object-cover" />
                  <button onClick={() => compare.toggle(p.id)} aria-label={`Remove ${p.title}`} className="absolute right-2 top-2 rounded-full bg-white p-1.5 shadow"><X size={14} /></button></div>
                <Link to={`/properties/${p.id}`} className="mt-2 block font-semibold text-navy-900 hover:text-gold-600">{p.title}</Link>
              </th>))}</tr></thead>
            <tbody>{rows.map(([k, fn]) => (
              <tr key={k} className="border-t border-line"><th scope="row" className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-muted">{k}</th>{data.map((p) => <td key={p.id} className="p-4 font-medium text-navy-900">{fn(p)}</td>)}</tr>))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
