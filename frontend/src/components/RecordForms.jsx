import { useEffect, useState } from 'react';
import api, { errorMessage, fieldErrors } from '../api.js';
import { Button, Field, Input, Modal, Select, Textarea, useToast } from './ui.jsx';

const today = () => new Date().toISOString().slice(0, 10);
const num = (v) => (v === '' || v == null ? null : Number(v));

export async function downloadExport(what, ext = 'xlsx') {
  const res = await api.get(`/agent/export/${what}${ext === 'pdf' ? '.pdf' : ''}`, { responseType: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(res.data);
  a.download = `${what}.${ext}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

/** Record or edit a sale. Creating from an enquiry fills in the buyer, seller and property automatically. */
export function SaleModal({ open, onClose, initial, onSaved }) {
  const toast = useToast();
  const editing = !!initial?.id;
  const blank = { enquiryId: '', finalAmount: '', downPayment: '', dealDate: today(), registryDate: '', totalCommission: '', advanceReceived: false, balanceReceived: false, status: 'ONGOING', notes: '' };
  const [f, setF] = useState(blank);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setErrs({}); setF({ ...blank, ...Object.fromEntries(Object.entries(initial || {}).map(([k, v]) => [k, v ?? ''])) }); } }, [open]); // eslint-disable-line
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErrs({});
    const body = { enquiryId: num(f.enquiryId), finalAmount: num(f.finalAmount), downPayment: num(f.downPayment), dealDate: f.dealDate, registryDate: f.registryDate || null, totalCommission: num(f.totalCommission), advanceReceived: f.advanceReceived, balanceReceived: f.balanceReceived, status: f.status, notes: f.notes };
    try {
      const r = editing ? await api.put(`/agent/sales/${initial.id}`, body) : await api.post('/agent/sales', body);
      toast(editing ? 'Sale updated' : 'Sale recorded'); onSaved?.(r.data); onClose();
    } catch (err) { setErrs(fieldErrors(err)); toast(errorMessage(err), 'error'); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit sale' : 'Record a sale'}>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        {!editing && <Field label="Enquiry ID" hint="Buyer, seller and property are taken from it" className="sm:col-span-2"><Input type="number" required value={f.enquiryId} onChange={set('enquiryId')} /></Field>}
        <Field label="Final amount (₹)" error={errs.finalAmount}><Input type="number" min="1" required value={f.finalAmount} onChange={set('finalAmount')} /></Field>
        <Field label="Down payment (₹)"><Input type="number" min="0" value={f.downPayment} onChange={set('downPayment')} /></Field>
        <Field label="Deal date"><Input type="date" required value={f.dealDate} onChange={set('dealDate')} /></Field>
        <Field label="Registry date"><Input type="date" value={f.registryDate} onChange={set('registryDate')} /></Field>
        <Field label="Total commission (₹)"><Input type="number" min="0" value={f.totalCommission} onChange={set('totalCommission')} /></Field>
        <Field label="Status"><Select value={f.status} onChange={set('status')} disabled={editing && initial.status === 'COMPLETED'}><option value="ONGOING">Ongoing</option><option value="COMPLETED">Completed (marks property sold)</option><option value="CANCELLED">Cancelled</option></Select></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-navy-900" checked={f.advanceReceived} onChange={set('advanceReceived')} />Advance received</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-navy-900" checked={f.balanceReceived} onChange={set('balanceReceived')} />Balance received</label>
        <Field label="Notes" className="sm:col-span-2"><Textarea rows={2} value={f.notes} onChange={set('notes')} /></Field>
        <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Save</Button></div>
      </form>
    </Modal>
  );
}

export function RentalModal({ open, onClose, initial, onSaved }) {
  const toast = useToast();
  const editing = !!initial?.id;
  const blank = { enquiryId: '', rentAmount: '', securityDeposit: '', startDate: today(), endDate: '', renewalDate: '', status: 'ACTIVE', notes: '' };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setF({ ...blank, ...Object.fromEntries(Object.entries(initial || {}).map(([k, v]) => [k, v ?? ''])) }); }, [open]); // eslint-disable-line
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    const body = { enquiryId: num(f.enquiryId), rentAmount: num(f.rentAmount), securityDeposit: num(f.securityDeposit), startDate: f.startDate, endDate: f.endDate, renewalDate: f.renewalDate || null, status: f.status, notes: f.notes };
    try {
      const r = editing ? await api.put(`/agent/rentals/${initial.id}`, body) : await api.post('/agent/rentals', body);
      toast(editing ? 'Agreement updated' : 'Agreement recorded'); onSaved?.(r.data); onClose();
    } catch (err) { toast(errorMessage(err), 'error'); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit rental agreement' : 'New rental agreement'}>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        {!editing && <Field label="Enquiry ID" hint="Tenant and property are taken from it" className="sm:col-span-2"><Input type="number" required value={f.enquiryId} onChange={set('enquiryId')} /></Field>}
        <Field label="Monthly rent (₹)"><Input type="number" min="1" required value={f.rentAmount} onChange={set('rentAmount')} /></Field>
        <Field label="Security deposit (₹)"><Input type="number" min="0" required value={f.securityDeposit} onChange={set('securityDeposit')} /></Field>
        <Field label="Start date"><Input type="date" required value={f.startDate} onChange={set('startDate')} /></Field>
        <Field label="End date"><Input type="date" required value={f.endDate} onChange={set('endDate')} /></Field>
        <Field label="Renewal date"><Input type="date" value={f.renewalDate} onChange={set('renewalDate')} /></Field>
        <Field label="Status"><Select value={f.status} onChange={set('status')}>{['ACTIVE', 'RENEWAL_DUE', 'EXPIRED', 'TERMINATED'].map((s) => <option key={s} value={s}>{s.replace('_', ' ').toLowerCase()}</option>)}</Select></Field>
        <Field label="Notes" className="sm:col-span-2"><Textarea rows={2} value={f.notes} onChange={set('notes')} /></Field>
        <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Save</Button></div>
      </form>
    </Modal>
  );
}
