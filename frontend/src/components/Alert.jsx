import { Info, TriangleAlert } from 'lucide-react';

const tones = {
  amber: 'border-amber-200 bg-amber-50 text-amber-900',
  blue: 'border-sky-200 bg-sky-50 text-sky-900',
  red: 'border-red-200 bg-red-50 text-red-800',
};

export function Alert({ tone = 'blue', title, children }) {
  const Icon = tone === 'blue' ? Info : TriangleAlert;
  return (
    <div role="note" className={`mt-4 flex gap-3 rounded-lg border p-4 text-sm ${tones[tone]}`}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div>{title && <p className="font-semibold">{title}</p>}<div>{children}</div></div>
    </div>
  );
}
