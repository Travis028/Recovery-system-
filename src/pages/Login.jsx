import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, Loader2, LockKeyhole, UserPlus } from 'lucide-react';
import { api } from '@/api/client';
import { reloadLdrsUser } from '@/hooks/useLdrsUser';
import Brand from '@/components/layout/Brand';
import DemoAccounts from '@/components/auth/DemoAccounts';
import DemoPhone from '@/components/security/DemoPhone';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import FormField from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ThemeToggle from '@/theme/ThemeToggle';
import { cn } from '@/lib/utils';
import useFieldErrors from '@/hooks/useFieldErrors';
import { checkCode, checkEmail, checkFullName, checkKenyanPhone, checkPassword, checkRequired, collectErrors } from '@/lib/validation';

const ROLE_OPTIONS = [
  ['Owner', 'I lost a document'],
  ['Finder', 'I found a document'],
  ['Officer', 'I work at a station'],
];
const PASSWORD_HINT = 'At least 10 characters with upper and lower case letters and a number.';

function FormTitle({ icon: Icon, title, description }) {
  return (
    <div className="space-y-1">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        {Icon ? <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> : null}
        {title}
      </h2>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

function SubmitButton({ busy, disabled, children }) {
  return (
    <Button type="submit" className="w-full" disabled={busy || disabled}>
      {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </Button>
  );
}

function LinkButton({ onClick, children, className }) {
  return (
    <button type="button" onClick={onClick} className={cn('rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}>
      {children}
    </button>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  // Where the visitor was going before being sent here; only paths inside the app are followed.
  const requested = location.state && location.state.from;
  const destination = typeof requested === 'string' && requested.charAt(0) === '/' && requested.indexOf('//') !== 0 ? requested : '/dashboard';
  const [mode, setMode] = useState('login'); // login | two_step | register | forgot | reset
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState(location.state && location.state.expired ? 'Your session has ended. Sign in again to continue.' : '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [points, setPoints] = useState([]);
  const [reg, setReg] = useState({ full_name: '', email: '', phone: '', password: '', ldrs_role: 'Owner', pickup_point_id: '', language: 'en' });
  const [consent, setConsent] = useState(false);

  const registerErrors = collectErrors({
    reg_name: () => checkFullName(reg.full_name),
    reg_email: () => checkEmail(reg.email),
    reg_phone: () => checkKenyanPhone(reg.phone, { optional: reg.ldrs_role !== 'Officer' }),
    reg_point: () => (reg.ldrs_role === 'Officer' ? checkRequired(reg.pickup_point_id, 'Choose the station you work at.') : ''),
    reg_password: () => checkPassword(reg.password),
    reg_consent: () => (consent ? '' : 'Tick the box to agree before creating an account.'),
  });
  const registerFields = useFieldErrors(registerErrors);

  const loginFields = useFieldErrors(
    collectErrors({ email: () => checkEmail(email), password: () => checkRequired(password, 'Enter your password.') }),
  );
  const codeFields = useFieldErrors(collectErrors({ code: () => checkCode(code) }));
  const forgotFields = useFieldErrors(collectErrors({ forgot_email: () => checkEmail(email) }));
  const resetFields = useFieldErrors(
    collectErrors({ reset_code: () => checkCode(code), reset_password: () => checkPassword(password) }),
  );

  useEffect(function () {
    api.auth
      .me()
      .then(function () {
        setSignedIn(true);
      })
      .catch(function () {});
    api.functions
      .invoke('listPublicPickupPoints')
      .then(setPoints)
      .catch(function () {});
  }, []);

  if (signedIn) return <Navigate to={destination} replace />;

  const go = function (next) {
    setMode(next);
    setError('');
    setInfo('');
    setCode('');
    [loginFields, codeFields, registerFields, forgotFields, resetFields].forEach(function (fields) {
      fields.reset();
    });
  };

  const finish = async function () {
    await reloadLdrsUser();
    navigate(destination, { replace: true });
  };

  const run = async function (fn) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (runError) {
      setError(runError.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const submitLogin = function (event) {
    event.preventDefault();
    if (!loginFields.submit()) return;
    run(async function () {
      const result = await api.auth.login({ email, password });
      setPassword('');
      if (result.status === 'two_step') {
        setChallenge(result);
        go('two_step');
        setInfo('A six-digit login code was sent by SMS to ' + result.phone_hint + '.');
        return;
      }
      await finish();
    });
  };

  const submitTwoStep = function (event) {
    event.preventDefault();
    if (!codeFields.submit()) return;
    run(async function () {
      await api.auth.verifyTwoStep({ challenge_id: challenge.challenge_id, code });
      await finish();
    });
  };

  const submitRegister = function (event) {
    event.preventDefault();
    if (!registerFields.submit()) return;
    run(async function () {
      const result = await api.auth.register(reg);
      setEmail(reg.email);
      go('login');
      setInfo(
        result.needs_approval
          ? 'Officer account created. An administrator must approve it and confirm your station before you can release documents. You can sign in now.'
          : 'Account created. Sign in to continue.',
      );
    });
  };

  const submitForgot = function (event) {
    event.preventDefault();
    if (!forgotFields.submit()) return;
    run(async function () {
      const result = await api.auth.requestPasswordReset({ email });
      setChallenge(result);
      go('reset');
      setInfo('If an account with a phone number exists for this email, a reset code has been sent by SMS.');
    });
  };

  const submitReset = function (event) {
    event.preventDefault();
    if (!resetFields.submit()) return;
    run(async function () {
      await api.auth.resetPassword({ challenge_id: challenge.challenge_id, code, password });
      setPassword('');
      go('login');
      setInfo('Password changed. Sign in with your new password.');
    });
  };

  const setRegField = function (field, value) {
    setReg(function (previous) {
      return { ...previous, [field]: value };
    });
  };

  const notices = (
    <>
      {info ? <Alert tone="info">{info}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex h-topbar max-w-6xl items-center justify-between px-page-x">
        <Brand to="/login" />
        <ThemeToggle />
      </header>

      <main className="mx-auto grid max-w-6xl items-start gap-10 px-page-x pb-16 pt-6 lg:grid-cols-[1fr_28rem] lg:pt-16">
        <section className="max-w-xl lg:pt-6">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Lost Documents Recovery System</h1>
          <p className="mt-4 text-base text-muted-foreground">
            Found an ID or certificate? Hand it in at a police station or chief's office. Lost one? Report it and LDRS tells you where to
            collect it, with your identity checked before it is released.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {['Masked search results', 'One-time collection codes', 'Encrypted photographs', 'Tamper-evident audit trail'].map(function (item) {
              return (
                <li key={item} className="flex items-center gap-2.5 text-sm text-foreground">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-subtle text-primary-subtle-foreground">
                    <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  {item}
                </li>
              );
            })}
          </ul>
        </section>

        <div className="rounded-lg border border-border bg-card p-6 shadow-md sm:p-8">
          {mode === 'login' ? (
            <form onSubmit={submitLogin} className="space-y-5" noValidate>
              <FormTitle title="Sign in" description="Officers and administrators also confirm a code sent to their phone." />
              <FormField id="email" label="Email" error={loginFields.show('email')}>
                <Input type="email" autoComplete="username" value={email} onBlur={loginFields.touch('email')} onChange={function (e) { setEmail(e.target.value); }} />
              </FormField>
              <FormField id="password" label="Password" error={loginFields.show('password')}>
                <Input type="password" autoComplete="current-password" value={password} onBlur={loginFields.touch('password')} onChange={function (e) { setPassword(e.target.value); }} />
              </FormField>
              {notices}
              <SubmitButton busy={busy}>
                Sign in
              </SubmitButton>
              <div className="flex flex-wrap justify-between gap-2">
                <LinkButton onClick={function () { go('register'); }}>Create an account</LinkButton>
                <LinkButton onClick={function () { go('forgot'); }} className="text-muted-foreground">
                  Forgot password?
                </LinkButton>
              </div>
              <DemoAccounts
                onPick={function (account) {
                  setEmail(account.email);
                  setPassword(account.password);
                }}
              />
            </form>
          ) : null}

          {mode === 'two_step' ? (
            <form onSubmit={submitTwoStep} className="space-y-5" noValidate>
              <FormTitle icon={KeyRound} title="Two-step sign-in" description="The code expires in 5 minutes. Three wrong codes block it." />
              <FormField id="code" label="Six-digit code" error={codeFields.show('code')}>
                <Input onBlur={codeFields.touch('code')} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={function (e) { setCode(e.target.value.replace(/\D/g, '')); }} />
              </FormField>
              {notices}
              <SubmitButton busy={busy}>
                Confirm and sign in
              </SubmitButton>
              <LinkButton onClick={function () { go('login'); }}>Back to sign in</LinkButton>
            </form>
          ) : null}

          {mode === 'register' ? (
            <form onSubmit={submitRegister} className="space-y-5" noValidate>
              <FormTitle icon={UserPlus} title="Create an account" description="Administrator accounts are created by the LDRS team only." />
              <fieldset>
                <legend className="mb-2 text-sm font-medium">How will you use LDRS?</legend>
                <div className="grid grid-cols-3 gap-2">
                  {ROLE_OPTIONS.map(function (option) {
                    const active = reg.ldrs_role === option[0];
                    return (
                      <button
                        key={option[0]}
                        type="button"
                        aria-pressed={active}
                        onClick={function () { setRegField('ldrs_role', option[0]); }}
                        className={cn(
                          'rounded-md border p-2.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          active ? 'border-primary bg-primary-subtle text-primary-subtle-foreground' : 'border-border text-muted-foreground hover:bg-muted',
                        )}
                      >
                        <span className="block text-sm font-medium">{option[0]}</span>
                        {option[1]}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <FormField id="reg_name" label="Full name" error={registerFields.show('reg_name')}>
                <Input autoComplete="name" value={reg.full_name} onBlur={registerFields.touch('reg_name')} onChange={function (e) { setRegField('full_name', e.target.value); }} />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="reg_email" label="Email" error={registerFields.show('reg_email')}>
                  <Input type="email" autoComplete="email" value={reg.email} onBlur={registerFields.touch('reg_email')} onChange={function (e) { setRegField('email', e.target.value); }} />
                </FormField>
                <FormField
                  id="reg_phone"
                  label="Phone number"
                  optional={reg.ldrs_role !== 'Officer'}
                  hint={reg.ldrs_role === 'Officer' ? 'Needed for the two-step sign-in code.' : undefined}
                  error={registerFields.show('reg_phone')}
                >
                  <Input type="tel" autoComplete="tel" value={reg.phone} placeholder="0712 345 678" onBlur={registerFields.touch('reg_phone')} onChange={function (e) { setRegField('phone', e.target.value); }} />
                </FormField>
              </div>
              {reg.ldrs_role === 'Officer' ? (
                <FormField
                  id="reg_point"
                  label="Station you work at"
                  hint="An administrator confirms this before your account can release documents."
                  error={registerFields.show('reg_point')}
                >
                  <Select value={reg.pickup_point_id} onValueChange={function (value) { setRegField('pickup_point_id', value); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose your station" />
                    </SelectTrigger>
                    <SelectContent>
                      {points.map(function (point) {
                        return (
                          <SelectItem key={point.id} value={point.id}>
                            {point.name}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </FormField>
              ) : null}
              <FormField id="reg_password" label="Password" hint={PASSWORD_HINT} error={registerFields.show('reg_password')}>
                <Input type="password" autoComplete="new-password" value={reg.password} onBlur={registerFields.touch('reg_password')} onChange={function (e) { setRegField('password', e.target.value); }} />
              </FormField>
              <FormField id="reg_language" label="Language for SMS and alerts">
                <Select value={reg.language} onValueChange={function (value) { setRegField('language', value); }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="sw">Kiswahili</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <div className="space-y-1.5">
                <label htmlFor="reg_consent" className="flex items-start gap-3 rounded-md border border-border bg-muted/50 p-3">
                  <Checkbox
                    id="reg_consent"
                    checked={consent}
                    aria-invalid={registerFields.show('reg_consent') ? true : undefined}
                    aria-describedby={registerFields.show('reg_consent') ? 'reg_consent-error' : undefined}
                    onCheckedChange={function (v) { setConsent(Boolean(v)); }}
                    className="mt-0.5"
                  />
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    I agree that LDRS stores my name, email and phone number to run my account, as allowed by the Data Protection Act, 2019. I
                    can ask for a copy, correction or removal at any time.
                  </span>
                </label>
                {registerFields.show('reg_consent') ? (
                  <p id="reg_consent-error" className="text-xs font-medium text-danger-subtle-foreground">
                    {registerFields.show('reg_consent')}
                  </p>
                ) : null}
              </div>
              {notices}
              <SubmitButton busy={busy}>
                Create account
              </SubmitButton>
              <LinkButton onClick={function () { go('login'); }}>I already have an account</LinkButton>
            </form>
          ) : null}

          {mode === 'forgot' ? (
            <form onSubmit={submitForgot} className="space-y-5" noValidate>
              <FormTitle title="Reset your password" description="We send a reset code to the phone number on your account." />
              <FormField id="forgot_email" label="Email" error={forgotFields.show('forgot_email')}>
                <Input type="email" autoComplete="username" value={email} onBlur={forgotFields.touch('forgot_email')} onChange={function (e) { setEmail(e.target.value); }} />
              </FormField>
              {notices}
              <SubmitButton busy={busy}>
                Send reset code
              </SubmitButton>
              <LinkButton onClick={function () { go('login'); }}>Back to sign in</LinkButton>
            </form>
          ) : null}

          {mode === 'reset' ? (
            <form onSubmit={submitReset} className="space-y-5" noValidate>
              <FormTitle title="Choose a new password" />
              <FormField id="reset_code" label="Reset code" error={resetFields.show('reset_code')}>
                <Input onBlur={resetFields.touch('reset_code')} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={function (e) { setCode(e.target.value.replace(/\D/g, '')); }} />
              </FormField>
              <FormField id="reset_password" label="New password" hint={PASSWORD_HINT} error={resetFields.show('reset_password')}>
                <Input type="password" autoComplete="new-password" value={password} onBlur={resetFields.touch('reset_password')} onChange={function (e) { setPassword(e.target.value); }} />
              </FormField>
              {notices}
              <SubmitButton busy={busy}>
                Change password
              </SubmitButton>
              <LinkButton onClick={function () { go('login'); }}>Back to sign in</LinkButton>
            </form>
          ) : null}
        </div>
      </main>
      <DemoPhone />
    </div>
  );
}
