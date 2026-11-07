import { format, parseISO, isValid } from 'date-fns';

const BULLET = '\u2022';
const DASH = '\u2014';

export const DOCUMENT_TYPES = [
    { value: 'National ID', label: 'National ID', idLabel: 'ID Number' },
{ value: 'Passport', label: 'Passport', idLabel: 'Passport Number' },
{ value: "Driver's License", label: "Driver's License", idLabel: 'Licence Number' },
{ value: 'Birth Certificate', label: 'Birth Certificate', idLabel: 'Certificate Number' },
{ value: 'Academic Certificate', label: 'Academic Certificate', idLabel: 'Certificate Serial Number' },
{ value: 'Student ID', label: 'Student ID', idLabel: 'Student ID Number' },
{ value: 'NHIF Health Card', label: 'NHIF Health Card', idLabel: 'Member Number' },
{ value: 'NSSF Card', label: 'NSSF Card', idLabel: 'Member Number' },
{ value: 'Employment ID', label: 'Employment ID', idLabel: 'Staff Number' },
{ value: 'Other', label: 'Other document', idLabel: 'Document Number' },
];

export function idLabelFor(type) {
    const found = DOCUMENT_TYPES.find(function (item) {
        return item.value === type;
    });
    return found ? found.idLabel : 'Document Number';
}

export function documentTypeLabel(type) {
    const found = DOCUMENT_TYPES.find(function (item) {
        return item.value === type;
    });
    return found ? found.label : type || DASH;
}

export const DOCUMENT_STATUSES = ['Found', 'Matched', 'Notified', 'Returned', 'Unclaimed'];

export const DOC_STATUS_STYLES = {
    Found: 'bg-blue-50 text-blue-700 border-blue-200',
    Matched: 'bg-violet-50 text-violet-700 border-violet-200',
    Notified: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    Returned: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Unclaimed: 'bg-amber-50 text-amber-700 border-amber-200',
};

export const MATCH_STATUS_STYLES = {
    Pending: 'bg-amber-50 text-amber-700 border-amber-200',
    Confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Rejected: 'bg-rose-50 text-rose-700 border-rose-200',
    Returned: 'bg-slate-100 text-slate-700 border-slate-200',
};

export const CLAIM_STATUS_STYLES = {
    Pending: 'bg-amber-50 text-amber-700 border-amber-200',
    Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Rejected: 'bg-rose-50 text-rose-700 border-rose-200',
};

export const LOSS_STATUS_STYLES = {
    Open: 'bg-blue-50 text-blue-700 border-blue-200',
    Matched: 'bg-violet-50 text-violet-700 border-violet-200',
    Closed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export const DELIVERY_STATUS_LABELS = {
    Simulated: 'System alert',
    'In-app': 'Delivered in the app',
    Sent: 'Sent',
    Pending: 'Pending',
    Failed: 'Failed',
};

export const ROLE_LABELS = {
    Finder: 'Finder',
    Owner: 'Owner',
    Officer: 'Officer',
    Admin: 'Administrator',
};

export function resolveRole(user) {
    if (!user) return null;
    if (user.role === 'admin') return 'Admin';
    if (user.ldrs_role === 'Officer') return 'Officer';
    if (user.ldrs_role === 'Finder') return 'Finder';
    if (user.ldrs_role === 'Owner') return 'Owner';
    return null;
}


export function formatDate(value) {
    if (!value) return DASH;
    const date = typeof value === 'string' ? parseISO(value) : new Date(value);
    return isValid(date) ? format(date, 'd MMM yyyy') : DASH;
}

export function formatDateTime(value) {
    if (!value) return DASH;
    const date = typeof value === 'string' ? parseISO(value) : new Date(value);
    return isValid(date) ? format(date, 'd MMM yyyy, HH:mm') : DASH;
}

export function maskDocumentNumber(value) {
    const raw = String(value || '').replace(/\s+/g, '');
    if (!raw) return 'Not provided';
    if (raw.length <= 4) return BULLET.repeat(raw.length);
    return BULLET.repeat(Math.max(4, raw.length - 4)) + raw.slice(-4);
}

export function maskName(value) {
    const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'Not provided';
    return parts
    .map(function (part, index) {
        if (index === 0) return part;
        return part.charAt(0) + BULLET.repeat(Math.max(1, part.length - 1));
    })
    .join(' ');
}

export function maskPhone(value) {
    const raw = String(value || '').replace(/\s+/g, '');
    if (raw.length < 6) return 'Not provided';
    return raw.slice(0, 4) + BULLET.repeat(3) + raw.slice(-3);
}

export function normalizePhone(value) {
    const raw = String(value || '').replace(/[^0-9+]/g, '');
    if (!raw) return '';
    if (raw.indexOf('+254') === 0) return '0' + raw.slice(4);
    if (raw.indexOf('254') === 0 && raw.length === 12) return '0' + raw.slice(3);
    return raw;
}

export function isValidKenyanPhone(value) {
    return /^(07|01)\d{8}$/.test(normalizePhone(value));
}

export function normalizeId(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeName(value) {
    return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function bigrams(value) {
    const grams = [];
    for (let index = 0; index < value.length - 1; index += 1) {
        grams.push(value.slice(index, index + 2));
    }
    return grams;
}

export function nameSimilarity(left, right) {
    const first = normalizeName(left);
    const second = normalizeName(right);
    if (!first || !second) return 0;
    if (first === second) return 1;

    const firstGrams = bigrams(first);
    const secondGrams = bigrams(second);
    if (!firstGrams.length || !secondGrams.length) return 0;

    const counts = {};
    secondGrams.forEach(function (gram) {
        counts[gram] = (counts[gram] || 0) + 1;
    });

    let shared = 0;
    firstGrams.forEach(function (gram) {
        const remaining = counts[gram] || 0;
        if (remaining > 0) {
            shared += 1;
            counts[gram] = remaining - 1;
        }
    });

    const dice = (2 * shared) / (firstGrams.length + secondGrams.length);
    const firstTokens = first.split(' ');
    const secondTokens = second.split(' ');
    const common = firstTokens.filter(function (token) {
        return secondTokens.indexOf(token) >= 0;
    }).length;
    const overlap = common / Math.max(firstTokens.length, secondTokens.length);
    return Math.max(dice, overlap);
}

const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomIndex(size) {
    const webCrypto = globalThis.crypto;
    if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
        const buffer = new Uint8Array(1);
        webCrypto.getRandomValues(buffer);
        return buffer[0] % size;
    }
    return Math.floor(Math.random() * size);
}

function randomChars(length, alphabet) {
    let result = '';
    for (let index = 0; index < length; index += 1) {
        result += alphabet.charAt(randomIndex(alphabet.length));
    }
    return result;
}

export function generateReferenceCode() {
    return 'LDRS-' + randomChars(6, REFERENCE_ALPHABET);
}
