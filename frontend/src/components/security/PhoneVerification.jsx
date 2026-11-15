import { useState } from 'react';
import { CheckCircle2, Loader2, Smartphone } from 'lucide-react';
import { api } from '@/api/client';
import useFieldErrors from '@/hooks/useFieldErrors';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import FormField from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { maskPhone } from '@/lib/ldrs';
import { checkCode, checkKenyanPhone, collectErrors } from '@/lib/validation';

/** Sends a code by SMS and confirms the phone belongs to the user. */
export default function PhoneVerification({ user, onVerified }) {
  const [phone, setPhone] = useState(user.phone || '');
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const phoneFields = useFieldErrors(collectErrors({ verify_phone: () => checkKenyanPhone(phone) }));
  const codeFields = useFieldErrors(collectErrors({ verify_code: () => checkCode(code) }));

  if (user.phone_verified && !challenge) {
    return (
      <Alert tone="success" icon={CheckCircle2}>
        Phone {maskPhone(user.phone)} is verified.
      </Alert>
    );
  }

  const send = async function (event) {
    event.preventDefault();
    if (!phoneFields.submit()) return;
    setBusy(true);
    setError('');
    try {
      setChallenge(await api.functions.invoke('sendPhoneCode', { phone }));
    } catch (sendError) {
      setError(sendError.message || 'The code could not be sent.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async function (event) {
    event.preventDefault();
    if (!codeFields.submit()) return;
    setBusy(true);
    setError('');
    try {
      await api.functions.invoke('verifyPhoneCode', { challenge_id: challenge.challenge_id, code });
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
    <section aria-labelledby="verify-phone-heading" className="space-y-3 rounded-lg border border-warning-border bg-warning-subtle p-4">
      <div className="text-warning-subtle-foreground">
        <h2 id="verify-phone-heading" className="flex items-center gap-2 text-sm font-semibold">
          <Smartphone className="h-4 w-4" aria-hidden="true" />
          Verify your phone number
        </h2>
        <p className="mt-1 text-sm">LDRS sends a six-digit code to confirm the number is yours. This stops people reporting or searching for other people's documents.</p>
      </div>
      {!challenge ? (
        <form className="flex flex-wrap items-start gap-2" onSubmit={send} noValidate>
          <FormField id="verify_phone" label="Phone number" error={phoneFields.show('verify_phone')} className="min-w-[12rem] flex-1">
            <Input type="tel" autoComplete="tel" value={phone} placeholder="0712 345 678" onBlur={phoneFields.touch('verify_phone')} onChange={function (e) { setPhone(e.target.value); }} />
          </FormField>
          <Button type="submit" className="mt-6" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Send code
          </Button>
        </form>
      ) : (
        <form className="flex flex-wrap items-start gap-2" onSubmit={verify} noValidate>
          <FormField id="verify_code" label={'Code sent to ' + challenge.phone_hint} error={codeFields.show('verify_code')} className="min-w-[10rem] flex-1">
            <Input
              value={code}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              onBlur={codeFields.touch('verify_code')}
              onChange={function (e) {
                setCode(e.target.value.replace(/\D/g, ''));
              }}
            />
          </FormField>
          <Button type="submit" variant="success" className="mt-6" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Verify
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="mt-6"
            disabled={busy}
            onClick={function () {
              setChallenge(null);
              setCode('');
              codeFields.reset();
            }}
          >
            Change number
          </Button>
        </form>
      )}
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </section>
  );
}
