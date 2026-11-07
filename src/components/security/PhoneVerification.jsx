import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isValidKenyanPhone, maskPhone } from '@/lib/ldrs';
import { CheckCircle2, Loader2, Smartphone } from 'lucide-react';

/** Sends a code by SMS and confirms the phone belongs to the user. */
export default function PhoneVerification({ user, onVerified, compact }) {
  const [phone, setPhone] = useState(user.phone || '');
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (user.phone_verified && !challenge) {
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <CheckCircle2 className="h-4 w-4" /> Phone {maskPhone(user.phone)} is verified.
      </p>
    );
  }

  const send = async function () {
    setBusy(true);
    setError('');
    try {
      setChallenge(await base44.functions.invoke('sendPhoneCode', { phone }));
    } catch (sendError) {
      setError(sendError.message || 'The code could not be sent.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async function () {
    setBusy(true);
    setError('');
    try {
      await base44.functions.invoke('verifyPhoneCode', { challenge_id: challenge.challenge_id, code });
      setChallenge(null);
      if (onVerified) await onVerified();
    } catch (verifyError) {
      setError(verifyError.message || 'The code could not be checked.');
      if (verifyError.locked) setChallenge(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={compact ? 'space-y-3' : 'space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4'}>
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <Smartphone className="h-4 w-4" /> Verify your phone number
      </p>
      <p className="text-xs text-amber-900">
        LDRS sends a six-digit code to confirm the number belongs to you. This stops people from reporting or searching for other people's documents.
      </p>
      {!challenge ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1 space-y-1">
            <Label htmlFor="verify_phone">Phone number</Label>
            <Input id="verify_phone" value={phone} placeholder="0712 345 678" onChange={function (e) { setPhone(e.target.value); }} />
          </div>
          <Button type="button" className="rounded-xl bg-blue-900 hover:bg-blue-950" disabled={busy || !isValidKenyanPhone(phone)} onClick={send}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Send code
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[10rem] flex-1 space-y-1">
            <Label htmlFor="verify_code">Code sent to {challenge.phone_hint}</Label>
            <Input id="verify_code" value={code} inputMode="numeric" maxLength={6} placeholder="000000" onChange={function (e) { setCode(e.target.value.replace(/\D/g, '')); }} />
          </div>
          <Button type="button" className="rounded-xl bg-emerald-600 hover:bg-emerald-700" disabled={busy || code.length !== 6} onClick={verify}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Verify
          </Button>
          <Button type="button" variant="outline" className="rounded-xl" disabled={busy} onClick={function () { setChallenge(null); setCode(''); }}>
            Change number
          </Button>
        </div>
      )}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
