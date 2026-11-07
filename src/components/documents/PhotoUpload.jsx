import { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
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
export default function PhotoUpload({ fileUri, onChange, helper }) {
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
      const uploaded = await base44.integrations.Core.UploadPrivateFile({ file: prepared.file });
      onChange(uploaded.file_uri, { sha256: prepared.sha256, phash: prepared.phash, file: prepared.file });
    } catch (uploadError) {
      console.error('Photograph upload failed', uploadError);
      setError(uploadError.message || 'The photograph could not be uploaded. Please try again.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />

      {fileUri ? (
        <div className="space-y-3">
          <PrivateImage fileUri={fileUri} className="h-56 w-full rounded-2xl border border-slate-200 bg-white" />
          <p className="flex items-center gap-2 text-xs text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            Hidden photo data (location, phone model) removed. Stored encrypted.
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2 rounded-xl sm:w-auto"
            onClick={function () {
              if (inputRef.current) inputRef.current.click();
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Replace photograph
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={function () {
            if (inputRef.current) inputRef.current.click();
          }}
          disabled={uploading}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/50 px-6 py-12 text-center transition hover:border-violet-400 hover:bg-violet-50/50 disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="h-7 w-7 animate-spin text-blue-800" />
          ) : (
            <Camera className="h-7 w-7 text-blue-800" />
          )}
          <span className="font-heading text-sm font-semibold text-slate-800">
            {uploading ? 'Uploading photograph...' : 'Take or upload a photograph'}
          </span>
          <span className="text-xs text-slate-500">
            {helper || 'JPG or PNG, up to 5 MB. Photograph the document clearly, showing the name and number (stored privately).'}
          </span>
        </button>
      )}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
