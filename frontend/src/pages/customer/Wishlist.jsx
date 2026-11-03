import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import api from '../../api.js';
import PropertyCard, { CardSkeleton } from '../../components/PropertyCard.jsx';
import { Button, Empty, ErrorBox, PageHeader, useLoad } from '../../components/ui.jsx';

export default function Wishlist() {
  const { loading, data, error, reload, setData } = useLoad(() => api.get('/me/wishlist'), []);
  return (
    <>
      <PageHeader title="Your wishlist" subtitle="Homes you’ve saved." />
      {error ? <ErrorBox message={error} onRetry={reload} /> : loading ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <CardSkeleton key={i} />)}</div>
      ) : data.length === 0 ? (
        <Empty icon={Heart} title="Nothing saved yet" text="Tap the heart on a property to keep it here." action={<Link to="/properties"><Button>Browse properties</Button></Link>} />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((p) => <PropertyCard key={p.id} property={{ ...p, wishlisted: true }} onWishlistChange={(id) => setData(data.filter((x) => x.id !== id))} />)}
        </div>
      )}
    </>
  );
}
