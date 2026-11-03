import { Link } from 'react-router-dom';
import { BadgeCheck, Bath, BedDouble, GitCompare, Heart, MapPin, Maximize2 } from 'lucide-react';
import { PublicImg, inr, useToast } from './ui.jsx';
import { useAuth } from '../auth.jsx';
import { useCompare } from '../compare.js';
import api, { errorMessage } from '../api.js';

export default function PropertyCard({ property: p, onWishlistChange }) {
  const { user } = useAuth();
  const toast = useToast();
  const compare = useCompare();
  const canSave = user?.role === 'CUSTOMER';

  const toggleSave = async (e) => {
    e.preventDefault();
    try {
      if (p.wishlisted) await api.delete(`/me/wishlist/${p.id}`);
      else await api.post(`/me/wishlist/${p.id}`);
      onWishlistChange?.(p.id, !p.wishlisted);
      toast(p.wishlisted ? 'Removed from your wishlist' : 'Saved to your wishlist');
    } catch (err) { toast(errorMessage(err), 'error'); }
  };

  const toggleCompare = (e) => {
    e.preventDefault();
    if (compare.toggle(p.id) === false) toast('You can compare up to 4 properties', 'error');
  };

  return (
    <article className="group overflow-hidden rounded-xl border border-line bg-white transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(20,33,61,0.12)]">
      <Link to={`/properties/${p.id}`} className="block" aria-label={p.title}>
        <div className="relative aspect-[4/3] overflow-hidden bg-navy-50">
          <PublicImg src={p.coverImageUrl} alt={p.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          <span className={`absolute left-3 top-3 rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${p.category === 'RENT' ? 'bg-gold-500 text-white' : 'bg-navy-900 text-white'}`}>
            {p.category === 'RENT' ? 'For rent' : 'For sale'}
          </span>
          {p.verified && <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-xs font-semibold text-emerald-700"><BadgeCheck size={14} />Verified</span>}
          <div className="absolute right-3 top-3 flex flex-col gap-2">
            {canSave && (
              <button onClick={toggleSave} aria-label={p.wishlisted ? 'Remove from wishlist' : 'Save to wishlist'} aria-pressed={!!p.wishlisted}
                className="grid h-9 w-9 place-items-center rounded-full bg-white/95 shadow hover:scale-105">
                <Heart size={18} className={p.wishlisted ? 'fill-red-500 text-red-500' : 'text-navy-900'} />
              </button>
            )}
            <button onClick={toggleCompare} aria-label="Add to compare" aria-pressed={compare.has(p.id)}
              className={`grid h-9 w-9 place-items-center rounded-full shadow hover:scale-105 ${compare.has(p.id) ? 'bg-gold-500 text-white' : 'bg-white/95 text-navy-900'}`}>
              <GitCompare size={17} />
            </button>
          </div>
        </div>
        <div className="p-4">
          <p className="font-display text-xl font-semibold text-navy-900">{inr(p.price, p.category)}</p>
          <h3 className="mt-1 line-clamp-1 font-semibold text-ink">{p.title}</h3>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted"><MapPin size={14} />{[p.locality, p.city].filter(Boolean).join(', ')}</p>
          <div className="mt-3 flex items-center gap-4 border-t border-line pt-3 text-sm text-slate-600">
            {p.bedrooms > 0 && <span className="flex items-center gap-1.5"><BedDouble size={16} />{p.bedrooms}</span>}
            {p.bathrooms > 0 && <span className="flex items-center gap-1.5"><Bath size={16} />{p.bathrooms}</span>}
            <span className="flex items-center gap-1.5"><Maximize2 size={15} />{Number(p.area).toLocaleString('en-IN')} {p.measurementUnit}</span>
          </div>
        </div>
      </Link>
    </article>
  );
}

export function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="skeleton aspect-[4/3]" />
      <div className="space-y-2 p-4"><div className="skeleton h-5 w-1/2 rounded" /><div className="skeleton h-4 w-3/4 rounded" /><div className="skeleton h-4 w-2/3 rounded" /></div>
    </div>
  );
}
