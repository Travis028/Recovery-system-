import { useRef, useState } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import PrivateImage from '@/components/PrivateImage';
import { prepareDocumentPhoto } from '@/lib/image';
import { Camera, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';

/**
 * Takes or uploads the photograph of the document.
 * Before upload the photo is checked (real JPG/PNG, under 5 MB), redrawn to remove hidden
 * photo data such as the GPS location, and fingerprinted for duplicate detection.
 * Photographs are then stored encrypted and only opened for the people allowed to see the record.
 */
export default function PhotoUpload({ id = 'photo', fileUri, onChange, helper, invalid, describedBy }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const prepared = await prepareDocumentPhoto(file);
      const uploaded = await api.integrations.Core.UploadPrivateFile({ file: prepared.file });
      onChange(uploaded.file_uri, { sha256: prepared.sha256, phash: prepared.phash, file: prepared.file });
    } catch (uploadError) {
      console.error('Photograph upload failed', uploadError);
      setError(uploadError.message || 'The photograph could not be uploaded. Please try again.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const open = function () {
    if (inputRef.current) inputRef.current.click();
  };

  return (
    <div className="space-y-3">
      <input ref={inputRef} type="file" accept="image/jpeg,image/png" capture="environment" className="hidden" tabIndex={-1} aria-hidden="true" onChange={handleFile} />

      {fileUri ? (
        <div className="space-y-3">
          <PrivateImage fileUri={fileUri} alt="Photograph of the found document" className="h-56 w-full rounded-md border border-border bg-muted" />
          <p className="flex items-center gap-2 text-xs text-success-subtle-foreground">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Hidden photo data (location, phone model) removed. Stored encrypted.
          </p>
          <Button id={id} type="button" variant="secondary" onClick={open}>
            <RefreshCw aria-hidden="true" />
            Replace photograph
          </Button>
        </div>
      ) : (
        <button
          id={id}
          type="button"
          onClick={open}
          disabled={uploading}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedBy}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border-strong bg-muted/40 px-6 py-12 text-center transition-colors hover:border-primary hover:bg-primary-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 aria-[invalid=true]:border-danger"
        >
          {uploading ? <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" /> : <Camera className="h-6 w-6 text-primary" aria-hidden="true" />}
          <span className="text-sm font-semibold">{uploading ? 'Uploading photograph' : 'Take or upload a photograph'}</span>
          <span className="text-xs text-muted-foreground">
            {helper || 'JPG or PNG, up to 5 MB. Photograph the document clearly, showing the name and number. It is stored privately.'}
          </span>
        </button>
      )}

      {error ? (
        <p role="alert" className="text-sm text-danger-subtle-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
}
