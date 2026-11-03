import { Link } from 'react-router-dom';
import { Eye, MessageSquare, PlusCircle, Home } from 'lucide-react';
import api, { errorMessage } from '../../api.js';
import { Alert } from '../../components/Alert.jsx';
import { Button, Card, Empty, ErrorBox, PageHeader, PrivateImg, Spinner, StatusBadge, inr, useLoad, useToast } from '../../components/ui.jsx';

export default function SellerProperties() {
  const toast = useToast();
  const { loading, data, error, reload } = useLoad(() => api.get('/seller/properties'), []);
  const act = async (id, action) => {
    try { await api.post(`/seller/properties/${id}/${action}`); toast('Done'); reload(); } catch (err) { toast(errorMessage(err), 'error'); }
  };
  return (
    <>
      <PageHeader title="My properties" action={<Link to="/seller/properties/new"><Button variant="gold"><PlusCircle size={16} />Add property</Button></Link>} />
      {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : data.length === 0 ? (
        <Empty icon={Home} title="No properties yet" text="Add your first listing. It goes live after our agent reviews it." action={<Link to="/seller/properties/new"><Button>Add property</Button></Link>} />
      ) : (
        <div className="space-y-4">
          {data.map((p) => (
            <Card key={p.id} className="p-0">
              <div className="flex flex-col gap-4 p-4 sm:flex-row">
                <PrivateImg src={p.images[0]?.url} alt="" className="h-32 w-full shrink-0 rounded-lg object-cover sm:w-48" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-semibold text-navy-900">{p.title}</h2><StatusBadge status={p.status} /></div>
                  <p className="text-sm text-muted">{[p.locality, p.city].filter(Boolean).join(', ')} · {p.category === 'RENT' ? 'Rent' : 'Sale'}</p>
                  <p className="mt-1 font-display text-xl text-navy-900">{inr(p.price, p.category)}</p>
                  <p className="mt-1 flex gap-4 text-xs text-muted"><span className="flex items-center gap-1"><Eye size={13} />{p.viewCount} views</span><span className="flex items-center gap-1"><MessageSquare size={13} />{p.enquiryCount} enquiries</span></p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {['DRAFT', 'REJECTED', 'INACTIVE', 'PUBLISHED'].includes(p.status) && <Link to={`/seller/properties/${p.id}`}><Button variant="outline">{p.status === 'PUBLISHED' ? 'Edit (re-review)' : 'Edit'}</Button></Link>}
                    {(p.status === 'DRAFT' || p.status === 'REJECTED') && <Button onClick={() => act(p.id, 'submit')}>{p.status === 'REJECTED' ? 'Resubmit' : 'Submit for review'}</Button>}
                    {p.status === 'PUBLISHED' && <Button variant="subtle" onClick={() => act(p.id, 'deactivate')}>Pause listing</Button>}
                    {p.status === 'INACTIVE' && <Button variant="subtle" onClick={() => act(p.id, 'activate')}>Reactivate</Button>}
                    {p.status === 'PUBLISHED' && <Link to={`/properties/${p.id}`}><Button variant="ghost">View public page</Button></Link>}
                  </div>
                </div>
              </div>
              {p.rejectionReason && ['REJECTED', 'SUSPENDED'].includes(p.status) && <div className="px-4 pb-4"><Alert tone="amber" title={p.status === 'REJECTED' ? 'Changes requested' : 'Listing suspended'}>{p.rejectionReason}</Alert></div>}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
