import { Link } from 'react-router-dom';
import { Eye, Home, MessageSquare, PlusCircle, Tag, Timer, XCircle, CheckCircle2 } from 'lucide-react';
import api from '../../api.js';
import { Button, Card, ErrorBox, PageHeader, Spinner, useLoad } from '../../components/ui.jsx';

export default function SellerDashboard() {
  const { loading, data, error, reload } = useLoad(() => api.get('/seller/dashboard'), []);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const tiles = [
    [Home, 'Total properties', data.totalProperties], [CheckCircle2, 'Active listings', data.activeListings], [Timer, 'Pending approval', data.pendingApprovals],
    [XCircle, 'Rejected', data.rejectedListings], [Tag, 'Sold', data.soldProperties], [Eye, 'Property views', data.propertyViews], [MessageSquare, 'Enquiries received', data.enquiryCount],
  ];
  return (
    <>
      <PageHeader title="Seller dashboard" subtitle="Your listings at a glance." action={<Link to="/seller/properties/new"><Button variant="gold"><PlusCircle size={16} />Add property</Button></Link>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map(([Icon, t, v]) => (
          <Card key={t}><Icon size={20} className="text-gold-600" /><p className="mt-3 font-display text-3xl font-semibold text-navy-900">{v}</p><p className="text-sm text-muted">{t}</p></Card>
        ))}
      </div>
      <Card className="mt-6 bg-navy-50/60">
        <p className="text-sm text-slate-700"><b>How it works:</b> you never talk to buyers directly. When someone is interested, our agent coordinates visits and offers with you through <Link to="/seller/messages" className="font-semibold text-gold-600 underline">Agent messages</Link>, and buyers never see your contact details.</p>
      </Card>
    </>
  );
}
