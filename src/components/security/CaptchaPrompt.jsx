import { useState } from 'react';
import { ShieldQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Human check shown after a few searches, to slow down automated data harvesting.
 * Prototype: a simple sum checked on the server. Production: a CAPTCHA service such as
 * Cloudflare Turnstile or hCaptcha, verified on the server.
 */
export default function CaptchaPrompt({ captcha, onAnswer, busy }) {
  const [answer, setAnswer] = useState('');
  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4"
      onSubmit={function (event) {
        event.preventDefault();
        onAnswer(answer.trim());
        setAnswer('');
      }}
    >
      <div className="min-w-[12rem] flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold text-violet-900">
          <ShieldQuestion className="h-4 w-4" /> Quick check
        </p>
        <p className="mt-1 text-xs text-violet-900">You have searched several times. Answer to continue: {captcha.question}</p>
        <Input
          className="mt-2"
          value={answer}
          inputMode="numeric"
          aria-label={captcha.question}
          onChange={function (event) {
            setAnswer(event.target.value);
          }}
        />
      </div>
      <Button type="submit" className="rounded-xl bg-violet-700 hover:bg-violet-800" disabled={busy || !answer.trim()}>
        Continue
      </Button>
    </form>
  );
}
