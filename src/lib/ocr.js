/**
 * OCR extraction.
 *
 * Uses tesseract.js (the browser build of the Tesseract engine named in the LDRS design).
 * The engine and English language data are downloaded the first time it runs, so it needs
 * an internet connection; if it cannot load, the finder simply types the details.
 *
 * Production: OCR runs on an internal Python service (Tesseract + OpenCV) that is not
 * reachable from the internet, and temporary images are deleted after processing.
 * Here the cleaned image only exists in memory and is dropped when this function returns.
 */
import { cleanForOcr } from '@/lib/image';
import { normalizeId } from '@/lib/ldrs';
import { checkDocumentNumber } from '@/lib/validation';

export const LOW_CONFIDENCE = 70;

const NUMBER_PATTERNS = {
  'National ID': /\b\d{7,8}\b/g,
  Passport: /\b[A-Z]{1,2}\s?\d{6,8}\b/g,
};

const LABEL_WORDS = /REPUBLIC|KENYA|NATIONAL|IDENTITY|CARD|SERIAL|NUMBER|DATE|BIRTH|SEX|DISTRICT|PLACE|ISSUE|HOLDER|SIGN|PASSPORT|CERTIFICATE|FULL|NAMES?|SURNAME|GIVEN|NATIONALITY|LICEN[CS]E|DRIVING|STUDENT|UNIVERSITY|EMPLOY/;

function pickNumber(text, words, type) {
  const pattern = NUMBER_PATTERNS[type] || /\b[A-Z0-9]{6,12}\b/g;
  const candidates = String(text || '').toUpperCase().match(pattern) || [];
  for (const raw of candidates) {
    const value = normalizeId(raw);
    if (/^\d+$/.test(value) || NUMBER_PATTERNS[type] || /\d/.test(value)) {
      const word = words.find(function (item) {
        return normalizeId(item.text) && value.indexOf(normalizeId(item.text)) >= 0;
      });
      return { value, confidence: word ? Math.round(word.confidence) : 50 };
    }
  }
  return { value: '', confidence: 0 };
}

function pickName(lines) {
  let best = null;
  lines.forEach(function (line) {
    const text = String(line.text || '').replace(/[^A-Za-z' \-]/g, ' ').replace(/\s+/g, ' ').trim();
    const upper = text.toUpperCase();
    const parts = upper.split(' ').filter(function (part) {
      return part.length > 1;
    });
    if (parts.length < 2 || parts.length > 4 || LABEL_WORDS.test(upper)) return;
    if (!best || line.confidence > best.confidence) best = { value: parts.join(' '), confidence: Math.round(line.confidence) };
  });
  return best || { value: '', confidence: 0 };
}

let workerPromise = null;

async function getWorker(onProgress) {
  if (!workerPromise) {
    workerPromise = import('tesseract.js').then(function (module) {
      const createWorker = module.createWorker || (module.default && module.default.createWorker);
      return createWorker('eng', 1, {
        logger: function (message) {
          if (onProgress && message.status) onProgress(message.status, message.progress || 0);
        },
      });
    });
    workerPromise.catch(function () {
      workerPromise = null;
    });
  }
  return workerPromise;
}

/**
 * Reads the owner's name and the document number from a photograph.
 * Returns { name, number, nameConfidence, numberConfidence, numberProblem }.
 */
export async function extractDocumentFields(file, documentType, onProgress) {
  const canvas = await cleanForOcr(file);
  const worker = await getWorker(onProgress);
  const { data } = await worker.recognize(canvas);
  canvas.width = 0; // release the temporary image
  canvas.height = 0;

  const words = data.words || [];
  const lines = data.lines || [];
  const number = pickNumber(data.text, words, documentType);
  const name = pickName(lines);

  return {
    name: name.value,
    number: number.value,
    nameConfidence: name.confidence,
    numberConfidence: number.confidence,
    numberProblem: number.value ? checkDocumentNumber(documentType, number.value) : 'No number could be read.',
  };
}
