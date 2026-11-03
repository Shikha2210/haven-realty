import { useState } from 'react';
import api from '../../api.js';
import { ErrorBox, PageHeader, Pagination, Spinner, fmtDateTime, label, useLoad } from '../../components/ui.jsx';

export default function AgentAudit() {
  const [page, setPage] = useState(0);
  const { loading, data, error, reload } = useLoad(() => api.get('/agent/audit-logs', { params: { page, size: 30 } }), [page]);
  return (
    <>
      <PageHeader title="Audit log" subtitle="A permanent record of logins, decisions, document access and changes." />
      {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <>
          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-muted"><tr>{['When', 'Who', 'Action', 'Record', 'Details'].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
              <tbody>{data.content.map((a) => (
                <tr key={a.id} className="border-t border-line align-top"><td className="whitespace-nowrap px-4 py-2.5 text-muted">{fmtDateTime(a.at)}</td><td className="px-4 py-2.5">{a.actorName}</td>
                  <td className="px-4 py-2.5 font-semibold text-navy-900">{label(a.action)}</td><td className="px-4 py-2.5 text-muted">{a.entityType ? `${a.entityType} #${a.entityId}` : '—'}</td><td className="max-w-xs truncate px-4 py-2.5 text-muted">{a.details || ''}</td></tr>))}</tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={data?.page?.totalPages} onChange={setPage} />
        </>
      )}
    </>
  );
}
