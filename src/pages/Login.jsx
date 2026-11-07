import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { DEMO_ACCOUNTS } from '@/api/seed';
import { reloadLdrsUser } from '@/hooks/useLdrsUser';
import DemoPhone from '@/components/security/DemoPhone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import ThemeToggle from '@/theme/ThemeToggle';
import { KeyRound, Loader2, LockKeyhole, ShieldCheck, UserPlus } from 'lucide-react';

function Field({ id, label, children, hint }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // login | two_step | register | forgot | reset
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [points, setPoints] = useState([]);
  const [reg, setReg] = useState({ full_name: '', email: '', phone: '', password: '', ldrs_role: 'Owner', pickup_point_id: '', language: 'en' });
  const [consent, setConsent] = useState(false);

  useEffect(function () {
    base44.auth.me().then(function () {
      setSignedIn(true);
    }).catch(function () {});
    base44.functions.invoke('listPublicPickupPoints').then(setPoints).catch(function () {});
  }, []);

  if (signedIn) return <Navigate to="/dashboard" replace />;

  const go = function (next) {
    setMode(next);
    setError('');
    setInfo('');
    setCode('');
  };

  const finish = async function () {
    await reloadLdrsUser();
    navigate('/dashboard', { replace: true });
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
    run(async function () {
      const result = await base44.auth.login({ email, password });
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
    run(async function () {
      await base44.auth.verifyTwoStep({ challenge_id: challenge.challenge_id, code });
      await finish();
    });
  };

  const submitRegister = function (event) {
    event.preventDefault();
    run(async function () {
      const result = await base44.auth.register(reg);
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
    run(async function () {
      const result = await base44.auth.requestPasswordReset({ email });
      setChallenge(result);
      go('reset');
      setInfo('If an account with a phone number exists for this email, a reset code has been sent by SMS.');
    });
  };

  const submitReset = function (event) {
    event.preventDefault();
    run(async function () {
      await base44.auth.resetPassword({ challenge_id: challenge.challenge_id, code, password });
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-violet-800">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-4 py-10 lg:grid-cols-[1.1fr_1fr] lg:px-8">
        <div className="text-white">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 shadow-sm">
            <ShieldCheck className="h-8 w-8" />
          </span>
          <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-blue-200">Project 65 · LDRS</p>
          <h1 className="mt-2 font-heading text-3xl font-bold sm:text-4xl">Lost Documents Recovery System</h1>
          <p className="mt-3 max-w-lg text-sm text-blue-100">
            Found an ID or certificate? Hand it in at a police station or chief's office. Lost one? Report it and we will
            tell you where to collect it — safely, with your identity checked before it is released.
          </p>
          <ul className="mt-6 grid max-w-lg gap-2 text-sm text-blue-50 sm:grid-cols-2">
            {['Masked search results', 'One-time collection codes', 'Encrypted photographs', 'Tamper-evident audit trail'].map(function (item) {
              return (
                <li key={item} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
                  <LockKeyhole className="h-4 w-4 shrink-0 text-blue-200" />
                  {item}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="relative rounded-3xl bg-card p-6 shadow-xl sm:p-8">
          <ThemeToggle className="absolute right-4 top-4" />
          {mode === 'login' ? (
            <form onSubmit={submitLogin} className="space-y-4">
              <div>
                <h2 className="font-heading text-xl font-bold text-slate-900">Sign in</h2>
                <p className="text-sm text-slate-500">Officers and administrators also confirm a code sent to their phone.</p>
              </div>
              <Field id="email" label="Email">
                <Input id="email" type="email" autoComplete="username" value={email} onChange={function (e) { setEmail(e.target.value); }} />
              </Field>
              <Field id="password" label="Password">
                <Input id="password" type="password" autoComplete="current-password" value={password} onChange={function (e) { setPassword(e.target.value); }} />
              </Field>
              {info ? <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">{info}</p> : null}
              {error ? <p className="text-sm text-rose-600">{error}</p> : null}
              <Button type="submit" className="w-full rounded-xl bg-blue-900 hover:bg-blue-950" disabled={busy || !email || !password}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Sign in
              </Button>
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <button type="button" className="font-semibold text-blue-900 hover:underline" onClick={function () { go('register'); }}>
                  Create an account
                </button>
                <button type="button" className="text-slate-500 hover:underline" onClick={function () { go('forgot'); }}>
                  Forgot password?
                </button>
              </div>

              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Demo accounts (mock data only)</p>
                <div className="mt-2 grid gap-1.5">
                  {DEMO_ACCOUNTS.map(function (account) {
                    return (
                      <button
                        key={account.email}
                        type="button"
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white"
                        onClick={function () {
                          setEmail(account.email);
                          setPassword(account.password);
                        }}
                      >
                        <span className="font-semibold text-slate-700">{account.label}</span>
                        <span className="text-slate-500">{account.note || account.email}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-slate-500">Login codes appear in the "Demo SMS" phone at the bottom right.</p>
              </div>
            </form>
          ) : null}

          {mode === 'two_step' ? (
            <form onSubmit={submitTwoStep} className="space-y-4">
              <div>
                <h2 className="flex items-center gap-2 font-heading text-xl font-bold text-slate-900">
                  <KeyRound className="h-5 w-5" /> Two-step login
                </h2>
                <p className="text-sm text-slate-500">The code expires in 5 minutes. Three wrong codes block it.</p>
              </div>
              {info ? <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">{info}</p> : null}
              <Field id="code" label="Six-digit code">
                <Input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={function (e) { setCode(e.target.value.replace(/\D/g, '')); }} />
              </Field>
              {error ? <p className="text-sm text-rose-600">{error}</p> : null}
              <Button type="submit" className="w-full rounded-xl bg-blue-900 hover:bg-blue-950" disabled={busy || code.length !== 6}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Confirm and sign in
              </Button>
              <button type="button" className="text-sm text-slate-500 hover:underline" onClick={function () { go('login'); }}>
                Back to sign in
              </button>
            </form>
          ) : null}

          {mode === 'register' ? (
            <form onSubmit={submitRegister} className="space-y-4">
              <div>
                <h2 className="flex items-center gap-2 font-heading text-xl font-bold text-slate-900">
                  <UserPlus className="h-5 w-5" /> Create an account
                </h2>
                <p className="text-sm text-slate-500">Administrator accounts are created by the LDRS team only.</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['Owner', 'I lost a document'],
                  ['Finder', 'I found a document'],
                  ['Officer', 'I work at a station'],
                ].map(function (option) {
                  const active = reg.ldrs_role === option[0];
                  return (
                    <button
                      key={option[0]}
                      type="button"
                      onClick={function () { setRegField('ldrs_role', option[0]); }}
                      className={cn('rounded-xl border p-2.5 text-left text-xs', active ? 'border-blue-900 bg-blue-50 text-blue-900' : 'border-slate-200 text-slate-600 hover:border-blue-300')}
                    >
                      <span className="block font-semibold">{option[0]}</span>
                      {option[1]}
                    </button>
                  );
                })}
              </div>
              <Field id="reg_name" label="Full name">
                <Input id="reg_name" value={reg.full_name} onChange={function (e) { setRegField('full_name', e.target.value); }} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="reg_email" label="Email">
                  <Input id="reg_email" type="email" autoComplete="username" value={reg.email} onChange={function (e) { setRegField('email', e.target.value); }} />
                </Field>
                <Field id="reg_phone" label={reg.ldrs_role === 'Officer' ? 'Phone number' : 'Phone number (optional)'}>
                  <Input id="reg_phone" value={reg.phone} placeholder="0712 345 678" onChange={function (e) { setRegField('phone', e.target.value); }} />
                </Field>
              </div>
              {reg.ldrs_role === 'Officer' ? (
                <Field id="reg_point" label="Station you work at" hint="An administrator confirms this before your account can release documents.">
                  <Select value={reg.pickup_point_id} onValueChange={function (value) { setRegField('pickup_point_id', value); }}>
                    <SelectTrigger id="reg_point">
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
                </Field>
              ) : null}
              <Field id="reg_password" label="Password" hint="At least 10 characters with upper and lower case letters and a number.">
                <Input id="reg_password" type="password" autoComplete="new-password" value={reg.password} onChange={function (e) { setRegField('password', e.target.value); }} />
              </Field>
              <Field id="reg_language" label="Language for SMS and alerts">
                <Select value={reg.language} onValueChange={function (value) { setRegField('language', value); }}>
                  <SelectTrigger id="reg_language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="sw">Kiswahili</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <label htmlFor="reg_consent" className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <Checkbox id="reg_consent" checked={consent} onCheckedChange={function (v) { setConsent(Boolean(v)); }} className="mt-0.5" />
                <span className="text-xs leading-relaxed text-slate-600">
                  I agree that LDRS stores my name, email and phone number to run my account, as allowed by the Data Protection Act, 2019. I can ask for a copy, correction or removal at any time.
                </span>
              </label>
              {error ? <p className="text-sm text-rose-600">{error}</p> : null}
              <Button type="submit" className="w-full rounded-xl bg-blue-900 hover:bg-blue-950" disabled={busy || !consent}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Create account
              </Button>
              <button type="button" className="text-sm text-slate-500 hover:underline" onClick={function () { go('login'); }}>
                I already have an account
              </button>
            </form>
          ) : null}

          {mode === 'forgot' ? (
            <form onSubmit={submitForgot} className="space-y-4">
              <div>
                <h2 className="font-heading text-xl font-bold text-slate-900">Reset your password</h2>
                <p className="text-sm text-slate-500">We send a reset code to the phone number on your account.</p>
              </div>
              <Field id="forgot_email" label="Email">
                <Input id="forgot_email" type="email" value={email} onChange={function (e) { setEmail(e.target.value); }} />
              </Field>
              {error ? <p className="text-sm text-rose-600">{error}</p> : null}
              <Button type="submit" className="w-full rounded-xl bg-blue-900 hover:bg-blue-950" disabled={busy || !email}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Send reset code
              </Button>
              <button type="button" className="text-sm text-slate-500 hover:underline" onClick={function () { go('login'); }}>
                Back to sign in
              </button>
            </form>
          ) : null}

          {mode === 'reset' ? (
            <form onSubmit={submitReset} className="space-y-4">
              <div>
                <h2 className="font-heading text-xl font-bold text-slate-900">Choose a new password</h2>
              </div>
              {info ? <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">{info}</p> : null}
              <Field id="reset_code" label="Reset code">
                <Input id="reset_code" inputMode="numeric" maxLength={6} value={code} onChange={function (e) { setCode(e.target.value.replace(/\D/g, '')); }} />
              </Field>
              <Field id="reset_password" label="New password" hint="At least 10 characters with upper and lower case letters and a number.">
                <Input id="reset_password" type="password" autoComplete="new-password" value={password} onChange={function (e) { setPassword(e.target.value); }} />
              </Field>
              {error ? <p className="text-sm text-rose-600">{error}</p> : null}
              <Button type="submit" className="w-full rounded-xl bg-blue-900 hover:bg-blue-950" disabled={busy || code.length !== 6 || !password}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Change password
              </Button>
              <button type="button" className="text-sm text-slate-500 hover:underline" onClick={function () { go('login'); }}>
                Back to sign in
              </button>
            </form>
          ) : null}
        </div>
      </div>
      <DemoPhone />
    </div>
  );
}
