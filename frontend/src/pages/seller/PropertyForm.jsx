import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FileCheck2, ImagePlus, Trash2, Upload } from 'lucide-react';
import api, { errorMessage, fieldErrors, openPrivateFile } from '../../api.js';
import { Alert } from '../../components/Alert.jsx';
import { Button, Card, ErrorBox, Field, Input, PageHeader, PrivateImg, Select, Spinner, StatusBadge, Textarea, label, useToast } from '../../components/ui.jsx';

const EMPTY = { title: '', propertyType: 'Apartment', category: 'SALE', description: '', city: 'Chandigarh', locality: '', address: '', postalCode: '', area: '', measurementUnit: 'sq ft', price: '', bedrooms: '', bathrooms: '', furnishingStatus: '', parkingAvailable: false, amenities: '', constructionType: '', facing: '', approvedBy: '' };
const AMENITIES = ['Lift', 'Power backup', 'Garden', 'Gym', 'Clubhouse', 'Swimming pool', '24x7 security', 'Park facing', 'Modular kitchen', 'Terrace'];

export default function PropertyForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [f, setF] = useState(EMPTY);
  const [prop, setProp] = useState(null);
  const [loading, setLoading] = useState(!!id);
  const [loadErr, setLoadErr] = useState('');
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState('');

  const hydrate = (p) => {
    setProp(p);
    setF({ ...EMPTY, ...Object.fromEntries(Object.entries(p).filter(([k]) => k in EMPTY).map(([k, v]) => [k, v ?? EMPTY[k]])) });
  };
  useEffect(() => {
    if (!id) return;
    api.get(`/seller/properties/${id}`).then((r) => hydrate(r.data)).catch((e) => setLoadErr(errorMessage(e))).finally(() => setLoading(false));
  }, [id]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const selected = f.amenities ? f.amenities.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const toggleAmenity = (a) => setF({ ...f, amenities: (selected.includes(a) ? selected.filter((x) => x !== a) : [...selected, a]).join(',') });

  const payload = () => ({ ...f, area: f.area === '' ? null : Number(f.area), price: f.price === '' ? null : Number(f.price), bedrooms: f.bedrooms === '' ? null : Number(f.bedrooms), bathrooms: f.bathrooms === '' ? null : Number(f.bathrooms) });

  const save = async (e) => {
    e.preventDefault(); setBusy('save'); setErrs({});
    try {
      const r = id ? await api.put(`/seller/properties/${id}`, payload()) : await api.post('/seller/properties', payload());
      toast(id ? 'Changes saved' : 'Draft created — now add photos and an ownership document');
      if (!id) nav(`/seller/properties/${r.data.id}`, { replace: true }); else hydrate(r.data);
    } catch (err) { setErrs(fieldErrors(err)); toast(errorMessage(err), 'error'); } finally { setBusy(''); }
  };

  const upload = async (kind, files, extra = {}) => {
    if (!files?.length) return;
    setBusy(kind);
    const fd = new FormData();
    if (kind === 'images') [...files].forEach((x) => fd.append('files', x)); else fd.append('file', files[0]);
    Object.entries(extra).forEach(([k, v]) => fd.append(k, v));
    try { const r = await api.post(`/seller/properties/${id}/${kind}`, fd); hydrate(r.data); toast('Uploaded'); }
    catch (err) { toast(errorMessage(err), 'error'); } finally { setBusy(''); }
  };
  const removeImage = async (imageId) => {
    try { const r = await api.delete(`/seller/properties/${id}/images/${imageId}`); hydrate(r.data); } catch (err) { toast(errorMessage(err), 'error'); }
  };
  const submit = async () => {
    setBusy('submit');
    try { const r = await api.post(`/seller/properties/${id}/submit`); hydrate(r.data); toast('Submitted for review'); nav('/seller/properties'); }
    catch (err) { toast(errorMessage(err), 'error'); } finally { setBusy(''); }
  };

  if (loading) return <Spinner />;
  if (loadErr) return <ErrorBox message={loadErr} />;
  const editable = !prop || ['DRAFT', 'REJECTED', 'INACTIVE', 'PUBLISHED'].includes(prop.status);
  const canSubmit = prop && ['DRAFT', 'REJECTED'].includes(prop.status);

  return (
    <>
      <PageHeader title={id ? 'Edit property' : 'Add a property'} subtitle="Accurate details get approved faster." action={prop && <StatusBadge status={prop.status} />} />
      {prop?.rejectionReason && <Alert tone="amber" title="Feedback from the agent">{prop.rejectionReason}</Alert>}
      {prop?.status === 'PUBLISHED' && <Alert tone="blue">This listing is live. Saving changes sends it back for a quick re-review.</Alert>}

      <form onSubmit={save} className="mt-6 space-y-6">
        <Card>
          <h2 className="mb-4 font-semibold text-navy-900">Basics</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Property title" error={errs.title} className="sm:col-span-2"><Input value={f.title} onChange={set('title')} error={errs.title} required maxLength={200} placeholder="e.g. Sunlit 3 BHK near Rock Garden" /></Field>
            <Field label="Rent or sale"><Select value={f.category} onChange={set('category')}><option value="SALE">Sale</option><option value="RENT">Rent</option></Select></Field>
            <Field label="Property type"><Select value={f.propertyType} onChange={set('propertyType')}>{['Apartment', 'House', 'Villa', 'Plot', 'Commercial', 'Office', 'Shop', 'Residential', 'Agricultural', 'Land'].map((t) => <option key={t}>{t}</option>)}</Select></Field>
            <Field label={f.category === 'RENT' ? 'Monthly rent (₹)' : 'Expected price (₹)'} error={errs.price}><Input type="number" min="1" value={f.price} onChange={set('price')} error={errs.price} required /></Field>
            <div className="grid grid-cols-[1fr_110px] gap-2"><Field label="Area" error={errs.area}><Input type="number" min="0.01" step="any" value={f.area} onChange={set('area')} error={errs.area} required /></Field>
              <Field label="Unit"><Select value={f.measurementUnit} onChange={set('measurementUnit')}>{['sq ft', 'sq yd', 'sq m', 'marla', 'kanal', 'acre'].map((u) => <option key={u}>{u}</option>)}</Select></Field></div>
            <Field label="Description" className="sm:col-span-2"><Textarea value={f.description} onChange={set('description')} maxLength={5000} placeholder="What makes this property special?" /></Field>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold text-navy-900">Location</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="City" error={errs.city}><Input value={f.city} onChange={set('city')} required error={errs.city} /></Field>
            <Field label="Locality / sector"><Input value={f.locality} onChange={set('locality')} placeholder="e.g. Sector 21" /></Field>
            <Field label="Full address" error={errs.address} hint="Only our agent sees the exact address" className="sm:col-span-2"><Input value={f.address} onChange={set('address')} required error={errs.address} /></Field>
            <Field label="PIN code" error={errs.postalCode}><Input maxLength={6} inputMode="numeric" value={f.postalCode} onChange={set('postalCode')} error={errs.postalCode} /></Field>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold text-navy-900">Specifications</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Bedrooms"><Input type="number" min="0" max="50" value={f.bedrooms} onChange={set('bedrooms')} /></Field>
            <Field label="Bathrooms"><Input type="number" min="0" max="50" value={f.bathrooms} onChange={set('bathrooms')} /></Field>
            <Field label="Furnishing"><Select value={f.furnishingStatus} onChange={set('furnishingStatus')}><option value="">Not specified</option>{['Unfurnished', 'Semi-furnished', 'Furnished'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
            <Field label="Construction"><Select value={f.constructionType} onChange={set('constructionType')}><option value="">Not specified</option><option>Constructed</option><option>Plot</option></Select></Field>
            <Field label="Facing"><Select value={f.facing} onChange={set('facing')}><option value="">Not specified</option>{['North', 'South', 'East', 'West', 'North-East', 'North-West', 'South-East', 'South-West'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
            <Field label="Approved by"><Select value={f.approvedBy} onChange={set('approvedBy')}><option value="">Not specified</option>{['GMADA', 'PUDA', 'Municipal Corporation', 'Improvement Trust', 'Private Colony', 'Not Approved'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.parkingAvailable} onChange={set('parkingAvailable')} className="h-4 w-4 accent-navy-900" />Parking available</label>
          <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-600">Amenities</p>
          <div className="flex flex-wrap gap-2">{AMENITIES.map((a) => (
            <button type="button" key={a} onClick={() => toggleAmenity(a)} aria-pressed={selected.includes(a)}
              className={`rounded-full border px-3 py-1.5 text-sm ${selected.includes(a) ? 'border-gold-500 bg-gold-100 text-gold-600' : 'border-line text-slate-600'}`}>{a}</button>))}</div>
        </Card>

        {editable && <div className="flex gap-3"><Button type="submit" loading={busy === 'save'}>{id ? 'Save changes' : 'Save draft & continue'}</Button><Button type="button" variant="ghost" onClick={() => nav('/seller/properties')}>Cancel</Button></div>}
      </form>

      {prop && (
        <div className="mt-8 space-y-6">
          <Card>
            <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold text-navy-900">Photos <span className="text-sm font-normal text-muted">({prop.images.length}/12)</span></h2>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-navy-50 px-3 py-2 text-sm font-semibold text-navy-900 hover:bg-navy-100"><ImagePlus size={16} />{busy === 'images' ? 'Uploading…' : 'Add photos'}
                <input type="file" multiple accept="image/png,image/jpeg" className="sr-only" onChange={(e) => { upload('images', e.target.files); e.target.value = ''; }} /></label></div>
            {prop.images.length === 0 ? <p className="text-sm text-muted">At least one photo is required before you can submit.</p> : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{prop.images.map((im) => (
                <div key={im.id} className="group relative"><PrivateImg src={im.url} alt="" className="aspect-[4/3] w-full rounded-lg object-cover" />
                  <button type="button" onClick={() => removeImage(im.id)} aria-label="Remove photo" className="absolute right-1.5 top-1.5 rounded-full bg-white p-1.5 shadow hover:text-red-600"><Trash2 size={14} /></button></div>))}</div>
            )}
          </Card>

          <Card>
            <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold text-navy-900">Ownership documents</h2>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-navy-50 px-3 py-2 text-sm font-semibold text-navy-900 hover:bg-navy-100"><Upload size={16} />{busy === 'documents' ? 'Uploading…' : 'Upload'}
                <input type="file" accept="application/pdf,image/png,image/jpeg" className="sr-only" onChange={(e) => { upload('documents', e.target.files, { docType: 'OWNERSHIP' }); e.target.value = ''; }} /></label></div>
            <p className="mb-3 text-sm text-muted">Sale deed, registry or allotment letter. Private — only you and our agent can open these.</p>
            {prop.documents.length === 0 ? <p className="text-sm text-muted">None uploaded yet.</p> : (
              <ul className="space-y-2">{prop.documents.map((d) => (<li key={d.id} className="flex items-center justify-between rounded-lg bg-navy-50 px-3 py-2 text-sm"><span className="flex items-center gap-2"><FileCheck2 size={15} />{d.originalName}</span>
                <button className="font-semibold text-gold-600" onClick={() => openPrivateFile(`/api/files/property-documents/${d.id}`).catch((e) => toast(errorMessage(e), 'error'))}>View</button></li>))}</ul>
            )}
          </Card>

          {canSubmit && <Card className="flex flex-wrap items-center justify-between gap-3 bg-navy-900 text-white"><div><p className="font-semibold">Ready to go live?</p><p className="text-sm text-slate-300">Our agent will review photos, details and ownership papers.</p></div><Button variant="gold" loading={busy === 'submit'} onClick={submit}>Submit for review</Button></Card>}
        </div>
      )}
    </>
  );
}
