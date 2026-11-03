import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, MailWarning, ShieldAlert, Store } from 'lucide-react';
import api from '../../api.js';
import PropertyCard from '../../components/PropertyCard.jsx';
import { Card, Empty, ErrorBox, PageHeader, Spinner, StatusBadge, fmtDateTime, useLoad } from '../../components/ui.jsx';

function Strip({ title, items, to }) {
  if (!items?.length) return null;
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-2xl font-semibold text-navy-900">{title}</h2>{to && <Link to={to} className="flex items-center gap-1 text-sm font-semibold text-gold-600">See all <ArrowRight size={14} /></Link>}</div>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{items.slice(0, 3).map((p) => <PropertyCard key={p.id} property={p} />)}</div>
    </section>
  );
}

export default function Dashboard() {
  const { loading, data, error, reload } = useLoad(() => api.get('/me/dashboard'), []);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const u = data.user;
  return (
    <>
      <PageHeader title={`Hello, ${u.fullName.split(' ')[0]}`} subtitle="Here’s what’s happening with your search." />

      {(!u.emailVerified || !u.phoneVerified) && (
        <Link to="/account/verify" className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <MailWarning size={20} /><span><b>Verify your {!u.emailVerified ? 'email' : 'mobile number'}</b> to send enquiries{!u.phoneVerified && u.emailVerified ? ' and apply as a seller' : ''}.</span><ArrowRight size={16} className="ml-auto" />
        </Link>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card><p className="text-xs font-semibold uppercase tracking-wide text-muted">Seller status</p>
          <div className="mt-2 flex items-center gap-2">{u.sellerStatus === 'VERIFIED' ? <BadgeCheck className="text-emerald-600" /> : <Store className="text-navy-700" />}<StatusBadge status={u.sellerStatus} /></div>
          <Link to={u.sellerStatus === 'VERIFIED' ? '/seller' : '/account/seller-application'} className="mt-3 inline-block text-sm font-semibold text-gold-600">{u.sellerStatus === 'VERIFIED' ? 'Open seller portal' : u.sellerStatus === 'NONE' ? 'Apply to sell' : 'View application'} →</Link></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-wide text-muted">Saved homes</p><p className="mt-2 font-display text-3xl font-semibold text-navy-900">{data.wishlist.length}</p><Link to="/account/wishlist" className="text-sm font-semibold text-gold-600">View wishlist →</Link></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-wide text-muted">Open enquiries</p><p className="mt-2 font-display text-3xl font-semibold text-navy-900">{data.enquiries.filter((e) => !['CLOSED', 'CANCELLED', 'REJECTED'].includes(e.status)).length}</p><Link to="/account/enquiries" className="text-sm font-semibold text-gold-600">Track enquiries →</Link></Card>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold text-navy-900">Recent enquiry updates</h2>
        {data.enquiries.length === 0 ? (
          <div className="mt-4"><Empty title="No enquiries yet" text="Found something you like? Tap “Enquire now” on any property and our agent will take it from there." action={<Link to="/properties" className="font-semibold text-gold-600">Browse properties →</Link>} /></div>
        ) : (
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
            {data.enquiries.map((e) => (
              <li key={e.id}><Link to={`/account/enquiries/${e.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-navy-50">
                <div className="min-w-0"><p className="truncate font-semibold text-navy-900">{e.property.title}</p><p className="text-xs text-muted">Updated {fmtDateTime(e.updatedAt)}</p></div><StatusBadge status={e.status} /></Link></li>
            ))}
          </ul>
        )}
      </section>

      <Strip title="Recently viewed" items={data.recentlyViewed} />
      <Strip title="Saved for later" items={data.wishlist} to="/account/wishlist" />
      <Strip title="Recommended for you" items={data.recommended} to="/properties" />
    </>
  );
}
