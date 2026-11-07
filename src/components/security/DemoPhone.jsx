import { useEffect, useState } from 'react';
import { MessageSquareText, Smartphone, Trash2, X } from 'lucide-react';
import { readOutbox, clearOutbox, SMS_SENDER_ID } from '@/lib/sms';
import { formatDateTime } from '@/lib/ldrs';

/**
 * Prototype only: shows the SMS messages LDRS would send (login codes, phone checks,
 * collection codes, alerts). In production these go through the SMS gateway and this
 * panel is removed.
 */
export default function DemoPhone() {
  const [messages, setMessages] = useState(readOutbox());
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(function () {
    const refresh = function (event) {
      setMessages(readOutbox());
      if (event && event.detail) {
        setUnread(function (n) { return n + 1; });
        setOpen(true);
      }
    };
    const onStorage = function (event) {
      if (event.key === 'ldrs.demo-sms.v1') refresh();
    };
    window.addEventListener('ldrs:sms', refresh);
    window.addEventListener('storage', onStorage);
    return function () {
      window.removeEventListener('ldrs:sms', refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const latest = messages.slice().reverse();

  return (
    <div className="fixed bottom-20 right-4 z-40 lg:bottom-6 print:hidden">
      {open ? (
        <div className="mb-3 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl border border-slate-300 bg-slate-900 text-white shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Smartphone className="h-4 w-4" /> Demo phone (SMS)
            </p>
            <div className="flex gap-1">
              <button type="button" aria-label="Clear messages" className="rounded-lg p-1 hover:bg-white/10" onClick={clearOutbox}>
                <Trash2 className="h-4 w-4" />
              </button>
              <button type="button" aria-label="Close demo phone" className="rounded-lg p-1 hover:bg-white/10" onClick={function () { setOpen(false); }}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto bg-slate-800 p-3">
            {latest.length ? (
              latest.map(function (sms, index) {
                return (
                  <div key={sms.at + index} className="rounded-2xl bg-white p-3 text-slate-800">
                    <p className="text-[11px] font-semibold text-slate-500">
                      {sms.from || SMS_SENDER_ID} → {sms.to} · {formatDateTime(sms.at)}
                    </p>
                    <p className="mt-1 text-sm">{sms.message}</p>
                  </div>
                );
              })
            ) : (
              <p className="p-3 text-center text-xs text-slate-300">No messages yet.</p>
            )}
          </div>
          <p className="px-4 py-2 text-[11px] text-slate-400">Prototype only. In production these messages go by SMS through Africa's Talking.</p>
        </div>
      ) : null}
      <button
        type="button"
        onClick={function () { setOpen(!open); setUnread(0); }}
        className="ml-auto flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-slate-800"
      >
        <MessageSquareText className="h-4 w-4" />
        Demo SMS
        {unread ? <span className="rounded-full bg-rose-500 px-1.5 text-xs">{unread}</span> : null}
      </button>
    </div>
  );
}
