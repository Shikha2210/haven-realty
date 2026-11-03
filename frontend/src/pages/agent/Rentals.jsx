import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { RentalModal } from '../../components/RecordForms.jsx';
import api from '../../api.js';
import { Button, Empty, ErrorBox, PageHeader, Spinner, StatusBadge, fmtDate, inr, useLoad } from '../../components/ui.jsx';

export default function AgentRentals() {
  const { loading, data, error, reload } = useLoad(() => api.get('/agent/rentals'), []);
  const [modal, setModal] = useState(null);
  return (
    <>
      <PageHeader title="Rental agreements" subtitle="Tenants, deposits and renewal dates." action={<Button variant="gold" onClick={() => setModal({})}>New agreement</Button>} />
      {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : data.length === 0 ? <Empty icon={KeyRound} title="No agreements yet" text="Open a rental enquiry and choose “Create rental agreement”." /> : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-muted"><tr>{['#', 'Property', 'Tenant', 'Rent / mo', 'Deposit', 'Start', 'End', 'Renewal', 'Status', ''].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
            <tbody>{data.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-4 py-3">{r.id}</td><td className="max-w-[180px] truncate px-4 py-3 font-semibold text-navy-900">{r.propertyTitle}</td><td className="px-4 py-3">{r.tenantName}<br /><span className="text-xs text-muted">{r.tenantPhone}</span></td>
                <td className="px-4 py-3">{inr(r.rentAmount)}</td><td className="px-4 py-3">{inr(r.securityDeposit)}</td><td className="px-4 py-3">{fmtDate(r.startDate)}</td><td className="px-4 py-3">{fmtDate(r.endDate)}</td>
                <td className="px-4 py-3">{fmtDate(r.renewalDate)}</td><td className="px-4 py-3"><StatusBadge status={r.status} /></td><td className="px-4 py-3"><Button variant="ghost" onClick={() => setModal(r)}>Edit</Button></td></tr>))}</tbody>
          </table>
        </div>
      )}
      <RentalModal open={!!modal} onClose={() => setModal(null)} initial={modal} onSaved={reload} />
    </>
  );
}
