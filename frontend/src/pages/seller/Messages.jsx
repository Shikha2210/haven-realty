import api, { errorMessage } from '../../api.js';
import Chat from '../../components/Chat.jsx';
import { Card, ErrorBox, PageHeader, Spinner, useLoad, useToast } from '../../components/ui.jsx';

export default function SellerMessages() {
  const toast = useToast();
  const { loading, data, error, reload } = useLoad(() => api.get('/seller/messages'), []);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const msgs = data.map((m) => ({ id: m.id, from: m.fromAgent ? 'AGENT' : 'ME', body: m.body, at: m.createdAt }));
  const send = async (body) => { try { await api.post('/seller/messages', { body }); reload(); } catch (err) { toast(errorMessage(err), 'error'); throw err; } };
  return (
    <>
      <PageHeader title="Messages with your agent" subtitle="Questions about your listings, visits and offers all go through here." />
      <Card className="max-w-3xl"><Chat messages={msgs} isMine={(m) => m.from === 'ME'} onSend={send} placeholder="Message your agent…" /></Card>
    </>
  );
}
