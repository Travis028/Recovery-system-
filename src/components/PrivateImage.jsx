import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ImageOff, Lock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Decrypts and shows a private photograph, only if the signed-in role is allowed to see it. */
export default function PrivateImage({ fileUri, className, alt }) {
  const [url, setUrl] = useState('');
  const [state, setState] = useState('loading');

  useEffect(
    function () {
      let active = true;
      let objectUrl = '';
      if (!fileUri) {
        setState('none');
        return undefined;
      }
      setState('loading');
      base44.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri })
        .then(function (result) {
          objectUrl = result.signed_url;
          if (!active) return URL.revokeObjectURL(objectUrl);
          setUrl(objectUrl);
          setState('ready');
        })
        .catch(function (error) {
          if (active) setState(error && error.status === 403 ? 'denied' : 'error');
        });
      return function () {
        active = false;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    },
    [fileUri],
  );

  if (state === 'ready') {
    return <img src={url} alt={alt || 'Document photograph'} className={cn('object-contain', className)} onContextMenu={function (e) { e.preventDefault(); }} />;
  }
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 text-slate-400', className)}>
      {state === 'loading' ? <Loader2 className="h-6 w-6 animate-spin" /> : state === 'denied' ? <Lock className="h-6 w-6" /> : <ImageOff className="h-6 w-6" />}
      <span className="text-xs">
        {state === 'loading' ? 'Opening the encrypted photograph' : state === 'denied' ? 'You are not allowed to view this photograph' : state === 'none' ? 'No photograph on record' : 'Photograph not available on this device'}
      </span>
    </div>
  );
}
