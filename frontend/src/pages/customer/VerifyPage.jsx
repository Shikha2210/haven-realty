import { useNavigate } from 'react-router-dom';
import VerifyPanel from '../../components/VerifyPanel.jsx';
import { PageHeader } from '../../components/ui.jsx';

export default function VerifyPage() {
  const nav = useNavigate();
  return (
    <>
      <PageHeader title="Verify your account" subtitle="Confirm your contact details so the agent can reach you safely." />
      <div className="max-w-xl"><VerifyPanel onDone={() => nav('/account')} /></div>
    </>
  );
}
