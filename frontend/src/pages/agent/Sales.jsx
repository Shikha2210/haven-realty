import { useState } from 'react';
import { Handshake } from 'lucide-react';
import api, { errorMessage } from '../../api.js';
import { SaleModal, downloadExport } from '../../components/RecordForms.jsx';
import { Button, Empty, ErrorBox, PageHeader, Spinner, StatusBadge, fmtDate, inr, useLoad, useToast } from '../../components/ui.jsx';

export default function AgentSales() {
  const toast = useToast();
  const { loading, data, error, reload } = useLoad(() => api.get('/agent/sales'), []);
  const [modal, setModal] = useState(null);
  return (
    <>
      <PageHeader title="Sales" subtitle="Deals from first offer to registry. Completing a deal marks the property sold." action={
        <div className="flex gap-2"><Button variant="outline" onClick={() => downloadExport('sales').catch((e) => toast(errorMessage(e), 'error'))}>Export Excel</Button><Button variant="gold" onClick={() => setModal({})}>Record sale</Button></div>} />
      {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : data.length === 0 ? <Empty icon={Handshake} title="No sales recorded" text="Open an enquiry and choose “Record sale” when a buyer and seller agree." /> : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-muted"><tr>{['#', 'Property', 'Seller', 'Buyer', 'Final amount', 'Down payment', 'Deal date', 'Registry', 'Commission', 'Status', ''].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
            <tbody>{data.map((s) => (
              <tr key={s.id} className="border-t border-line">
                <td className="px-4 py-3">{s.id}</td><td className="max-w-[180px] truncate px-4 py-3 font-semibold text-navy-900">{s.propertyTitle}</td><td className="px-4 py-3">{s.sellerName}<br /><span className="text-xs text-muted">{s.sellerPhone}</span></td>
                <td className="px-4 py-3">{s.buyerName}<br /><span className="text-xs text-muted">{s.buyerPhone}</span></td><td className="px-4 py-3">{inr(s.finalAmount)}</td><td className="px-4 py-3">{inr(s.downPayment)}</td>
                <td className="px-4 py-3">{fmtDate(s.dealDate)}</td><td className="px-4 py-3">{s.registryDate ? fmtDate(s.registryDate) : 'Pending'}</td><td className="px-4 py-3">{inr(s.totalCommission)}</td>
                <td className="px-4 py-3"><StatusBadge status={s.status} /></td><td className="px-4 py-3"><Button variant="ghost" onClick={() => setModal(s)}>Edit</Button></td></tr>))}</tbody>
          </table>
        </div>
      )}
      <SaleModal open={!!modal} onClose={() => setModal(null)} initial={modal} onSaved={reload} />
    </>
  );
}
