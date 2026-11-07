import { useId, useState } from 'react';
import { ShieldQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Human check shown after a few searches, to slow down automated data harvesting.
 * Prototype: a simple sum checked on the server. Production: a CAPTCHA service such as
 * Cloudflare Turnstile or hCaptcha, verified on the server.
 */
export default function CaptchaPrompt({ captcha, onAnswer, busy }) {
  const id = useId();
  const [answer, setAnswer] = useState('');
  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-lg border border-accent/30 bg-accent-subtle p-4 text-accent-subtle-foreground"
      onSubmit={function (event) {
        event.preventDefault();
        onAnswer(answer.trim());
        setAnswer('');
      }}
    >
      <div className="min-w-[12rem] flex-1 space-y-1.5">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <ShieldQuestion className="h-4 w-4" aria-hidden="true" />
          Quick check
        </p>
        <label htmlFor={id} className="block text-sm">
          You have searched several times. Answer to continue: {captcha.question}
        </label>
        <Input id={id} value={answer} inputMode="numeric" autoComplete="off" onChange={function (event) { setAnswer(event.target.value); }} />
      </div>
      <Button type="submit" disabled={busy || !answer.trim()}>
        Continue
      </Button>
    </form>
  );
}
