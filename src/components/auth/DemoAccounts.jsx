import { DEMO_ACCOUNTS } from '@/api/seed';

// Shown only when VITE_SHOW_DEMO_ACCOUNTS is not "false", so a real deployment can hide it.
export const SHOW_DEMO_ACCOUNTS = import.meta.env.VITE_SHOW_DEMO_ACCOUNTS !== 'false';

export default function DemoAccounts({ onPick }) {
  if (!SHOW_DEMO_ACCOUNTS) return null;
  return (
    <div className="rounded-md border border-dashed border-border-strong bg-muted/50 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Demo accounts (mock data only)</p>
      <ul className="mt-2 grid gap-0.5">
        {DEMO_ACCOUNTS.map(function (account) {
          return (
            <li key={account.email}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={function () {
                  onPick(account);
                }}
              >
                <span className="font-medium text-foreground">{account.label}</span>
                <span className="text-muted-foreground">{account.note || account.email}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">Sign-in codes appear in the Demo SMS phone at the bottom left.</p>
    </div>
  );
}
