import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download } from 'lucide-react';
import api, { errorMessage } from '../../api.js';
import { Button, Card, ErrorBox, PageHeader, Spinner, label, useLoad, useToast } from '../../components/ui.jsx';
import { downloadExport } from '../../components/RecordForms.jsx';

const NAVY = '#1d2f57', GOLD = '#b08d57', TEAL = '#2f7f79', SLATE = '#8d99ae', RED = '#b4533d';
const PIE = [NAVY, GOLD, TEAL, SLATE, RED, '#6d5aa8'];

const named = (rows = []) => rows.map((r) => ({ ...r, name: label(r.name) }));

function ChartCard({ title, children, empty }) {
  return (
    <Card>
      <h2 className="mb-4 font-semibold text-navy-900">{title}</h2>
      {empty ? <p className="grid h-56 place-items-center text-sm text-muted">No data yet</p> : <div className="h-64">{children}</div>}
    </Card>
  );
}

export default function AgentDashboard() {
  const toast = useToast();
  const { loading, data, error, reload } = useLoad(() => api.get('/agent/dashboard'), []);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const tiles = [
    ['Customers', data.totalCustomers, '/agent/customers'], ['Verified sellers', data.verifiedSellers, '/agent/customers'],
    ['Pending seller checks', data.pendingSellerVerifications, '/agent/verifications', data.pendingSellerVerifications > 0],
    ['Total properties', data.totalProperties, '/agent/properties'], ['Active listings', data.activeProperties, '/agent/properties'],
    ['Awaiting approval', data.pendingPropertyApprovals, '/agent/properties', data.pendingPropertyApprovals > 0],
    ['Total enquiries', data.totalEnquiries, '/agent/enquiries'], ['New enquiries', data.pendingEnquiries, '/agent/enquiries', data.pendingEnquiries > 0],
    ['Ongoing deals', data.ongoingDeals, '/agent/sales'], ['Completed deals', data.completedDeals, '/agent/sales'], ['Active rentals', data.activeRentals, '/agent/rentals'],
  ];
  const exp = (w, ext) => downloadExport(w, ext).catch((e) => toast(errorMessage(e), 'error'));

  return (
    <>
      <PageHeader title="Agent dashboard" subtitle="Everything that needs your attention." action={
        <div className="flex gap-2">{['customers', 'properties', 'sales'].map((w) => <span key={w} className="inline-flex overflow-hidden rounded-lg border border-line bg-white">
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-navy-900 hover:bg-navy-50" onClick={() => exp(w)} aria-label={`Export ${w} to Excel`}><Download size={15} />{label(w)}</button>
          <button className="border-l border-line px-2.5 py-2 text-xs font-bold text-gold-600 hover:bg-navy-50" onClick={() => exp(w, 'pdf')} aria-label={`Export ${w} to PDF`}>PDF</button></span>)}</div>} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {tiles.map(([t, v, to, alert]) => (
          <Link key={t} to={to}><Card className={`transition hover:shadow-md ${alert ? 'border-gold-500 bg-gold-100/40' : ''}`}><p className="text-xs font-semibold uppercase tracking-wide text-muted">{t}</p><p className="mt-1 font-display text-3xl font-semibold text-navy-900">{v}</p></Card></Link>
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <ChartCard title="Enquiry pipeline" empty={!data.enquiriesByStatus.length}>
          <ResponsiveContainer><BarChart data={named(data.enquiriesByStatus)} layout="vertical" margin={{ left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} />
            <Tooltip /><Bar dataKey="value" name="Enquiries" fill={NAVY} radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Deals by status" empty={!data.dealsByStatus.length}>
          <ResponsiveContainer><PieChart><Pie data={named(data.dealsByStatus)} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
            {data.dealsByStatus.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Properties by type" empty={!data.propertiesByType.length}>
          <ResponsiveContainer><BarChart data={data.propertiesByType}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} />
            <Tooltip /><Bar dataKey="value" name="Properties" fill={GOLD} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Listings by status" empty={!data.propertiesByStatus.length}>
          <ResponsiveContainer><BarChart data={named(data.propertiesByStatus)}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} />
            <Tooltip /><Bar dataKey="value" name="Listings" fill={TEAL} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </ChartCard>
      </div>
    </>
  );
}
