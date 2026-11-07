import { useEffect, useState } from 'react';
import { MessageSquareText, Smartphone, Trash2, X } from 'lucide-react';
import { readOutbox, clearOutbox, SMS_SENDER_ID, smsGatewayConfigured } from '@/lib/sms';
import { formatDateTime } from '@/lib/ldrs';

const OUTBOX_KEY = 'ldrs.demo-sms.v1';
const WIDE_SCREEN = '(min-width: 1024px)';

/**
 * Prototype only: shows the SMS messages LDRS would send (login codes, phone checks,
 * collection codes, alerts). Hidden when a real SMS gateway is configured.
 *
 * On wide screens a new message opens the panel; on phones it only raises the unread
 * badge, so the panel never covers the form the user is filling in.
 */
export default function DemoPhone() {
  const [messages, setMessages] = useState(readOutbox);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(function () {
    const refresh = function (event) {
      setMessages(readOutbox());
      if (event && event.detail) {
        setUnread(function (count) {
          return count + 1;
        });
        if (window.matchMedia && window.matchMedia(WIDE_SCREEN).matches) setOpen(true);
      }
    };
    const onStorage = function (event) {
      if (event.key === OUTBOX_KEY) refresh();
    };
    window.addEventListener('ldrs:sms', refresh);
    window.addEventListener('storage', onStorage);
    return function () {
      window.removeEventListener('ldrs:sms', refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  if (smsGatewayConfigured) return null;

  const latest = messages.slice().reverse();

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3 print:hidden">
      {open ? (
        <section
          aria-label="Demo phone messages"
          className="pointer-events-auto w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Smartphone className="h-4 w-4" aria-hidden="true" />
              Demo phone (SMS)
            </h2>
            <div className="flex gap-1">
              <button type="button" aria-label="Clear messages" className="rounded-sm p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={clearOutbox}>
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Close demo phone"
                className="rounded-sm p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={function () {
                  setOpen(false);
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <ol className="max-h-[min(20rem,50vh)] space-y-2 overflow-y-auto bg-muted/50 p-3" aria-live="polite">
            {latest.length ? (
              latest.map(function (sms, index) {
                return (
                  <li key={sms.at + index} className="rounded-md border border-border bg-card p-3">
                    <p className="text-xs text-muted-foreground">
                      {sms.from || SMS_SENDER_ID} to {sms.to} · {formatDateTime(sms.at)}
                    </p>
                    <p className="mt-1 text-sm">{sms.message}</p>
                  </li>
                );
              })
            ) : (
              <li className="p-3 text-center text-sm text-muted-foreground">No messages yet.</li>
            )}
          </ol>
          <p className="px-4 py-2 text-xs text-muted-foreground">Prototype only. In production these go by SMS through Africa's Talking.</p>
        </section>
      ) : null}
      <button
        type="button"
        aria-expanded={open}
        onClick={function () {
          setOpen(!open);
          setUnread(0);
        }}
        className="pointer-events-auto flex items-center gap-2 rounded-full bg-foreground px-3.5 py-2 text-sm font-medium text-background shadow-lg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <MessageSquareText className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Demo SMS</span>
        <span className="sr-only sm:hidden">Demo SMS</span>
        {unread ? (
          <span className="rounded-full bg-danger px-1.5 text-xs text-danger-foreground">
            {unread}
            <span className="sr-only"> new</span>
          </span>
        ) : null}
      </button>
    </div>
  );
}
