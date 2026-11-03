import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { Button, Textarea, fmtDateTime } from './ui.jsx';

/**
 * A message thread. `mine(m)` says which side is "me", `from` classifies a message for bubble styling.
 * System messages (status changes) are shown as centred notes.
 */
export default function Chat({ messages, isMine, onSend, placeholder = 'Write a message…', internalToggle, disabled }) {
  const [text, setText] = useState('');
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const end = useRef();
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [messages?.length]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try { await onSend(text.trim(), internal); setText(''); } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col">
      <div className="max-h-[420px] min-h-40 space-y-3 overflow-y-auto rounded-xl bg-navy-50/60 p-4" aria-live="polite">
        {(!messages || messages.length === 0) && <p className="py-8 text-center text-sm text-muted">No messages yet.</p>}
        {messages?.map((m) => {
          if (m.from === 'SYSTEM') return <p key={m.id} className="text-center text-xs text-muted">— {m.body} · {fmtDateTime(m.at)} —</p>;
          const mine = isMine(m);
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.internal ? 'border border-dashed border-gold-500 bg-gold-100 text-slate-800' : mine ? 'bg-navy-900 text-white' : 'bg-white text-ink shadow-sm'}`}>
                {m.internal && <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-gold-600">Internal note — not visible to the customer</p>}
                <p className="whitespace-pre-line">{m.body}</p>
                <p className={`mt-1 text-[10px] ${mine && !m.internal ? 'text-slate-300' : 'text-slate-400'}`}>{fmtDateTime(m.at)}</p>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      {!disabled && (
        <form onSubmit={send} className="mt-3">
          <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label="Message" />
          <div className="mt-2 flex items-center justify-between">
            {internalToggle ? <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="accent-gold-600" />Internal note (hidden from customer)</label> : <span />}
            <Button type="submit" loading={busy} disabled={!text.trim()}><Send size={15} />Send</Button>
          </div>
        </form>
      )}
    </div>
  );
}
