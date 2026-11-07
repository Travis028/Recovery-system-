/**
 * "Server functions": operations that must not be trusted to the screen. Each one checks
 * the caller's role itself, uses the privileged server client only where it must read
 * across users (matching, search), and writes to the audit trail.
 */
import { ApiError, table, findById, insert, patch, transaction, exportDatabase, importDatabase, dailyBackup, listBackups, restoreBackup } from './db';
import { roleOf, shape, SYSTEM } from './permissions';
import { listAudit, verifyChain, purgeAuditOlderThan, exportAuditStore, importAuditStore } from './auditStore';
import { deletePrivateFile } from './fileStore';
import { randomDigits, randomHex, sha256Hex, safeEqual } from './crypto';
import { checkChallenge, sendChallengeSms } from './base44Client';
import { assertStation, audit, notifyUser, pointName, requireApprovedStaff, requireRole } from './serverHelpers';
import { REVIEW_FUNCTIONS } from './reviewFunctions';
import {
  documentTypeLabel,
  isValidKenyanPhone,
  maskDocumentNumber,
  maskName,
  maskPhone,
  nameSimilarity,
  normalizeId,
  normalizePhone,
} from '@/lib/ldrs';
import { checkDocumentNumber, checkPersonName } from '@/lib/validation';
import { hammingDistance } from '@/lib/image';
import { createMatchesForDocument, matchLossReportAgainstHeldDocuments } from '@/lib/matching';
import { buildOtpMessage } from '@/lib/notifications';
import { buildOtpSms } from '@/lib/sms';
import { AUDIT_ACTIONS } from '@/lib/audit';
import { toCsv } from '@/lib/csv';

export const OTP_MINUTES = 5;
export const MAX_OTP_ATTEMPTS = 3;
const CLAIMANT_ID_TYPES = ['National ID', 'Passport', "Driver's License", 'Employment ID', 'Other'];

export const DEFAULT_SETTINGS = {
  search_limit_per_hour: 10,
  captcha_after_searches: 3,
  max_open_reports_per_phone: 3,
  rapid_upload_threshold: 5,
  unclaimed_after_days: 30,
  document_retention_days: 180,
  audit_retention_days: 365,
};

export function getSetting(key) {
  const row = table('Setting').find(function (item) {
    return item.key === key;
  });
  return row && row.value !== undefined && row.value !== null && row.value !== '' ? row.value : DEFAULT_SETTINGS[key];
}

/* ---------- helpers ---------- */

function recentEvents(userId, kind, minutes) {
  const since = Date.now() - minutes * 60 * 1000;
  return table('RateEvent').filter(function (row) {
    return row.user_id === userId && row.kind === kind && new Date(row.created_date).getTime() >= since;
  });
}

async function receiptHash(fields) {
  return sha256Hex(
    JSON.stringify([
      fields.document_id,
      fields.match_id,
      fields.officer_user_id,
      fields.released_to,
      fields.claimant_id_type,
      maskDocumentNumber(fields.claimant_id_number),
      fields.released_at,
    ]),
  );
}

/* ---------- functions ---------- */

export const FUNCTIONS = {
  /** Public list of verified, active pickup points (registration and help screens). */
  async listPublicPickupPoints() {
    return table('PickupPoint')
      .filter(function (point) {
        return point.active && point.verified;
      })
      .map(function (point) {
        return {
          id: point.id,
          name: point.name,
          point_type: point.point_type,
          location: point.location,
          county: point.county,
          opening_hours: point.opening_hours,
          contact_phone: point.contact_phone,
        };
      })
      .sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });
  },

  /* --- phone verification (owners must verify before a loss report is accepted) --- */
  async sendPhoneCode({ actor, args }) {
    requireRole(actor, ['Owner', 'Finder', 'Officer', 'Admin']);
    if (!isValidKenyanPhone(args.phone)) throw new ApiError(422, 'Enter a Kenyan phone number, for example 0712 345 678.');
    if (recentEvents(actor.id, 'phone_code', 15).length >= 3) {
      throw new ApiError(429, 'Too many codes requested. Wait 15 minutes and try again.');
    }
    insert('RateEvent', { user_id: actor.id, kind: 'phone_code' });
    const phone = normalizePhone(args.phone);
    const challengeId = await sendChallengeSms({
      userId: actor.id,
      purpose: 'phone',
      phone,
      minutes: 10,
      text: function (code) {
        return 'LDRS: Your phone verification code is ' + code + '. It expires in 10 minutes. Never share it with anyone.';
      },
    });
    return { challenge_id: challengeId, phone_hint: maskPhone(phone) };
  },

  async verifyPhoneCode({ actor, args }) {
    requireRole(actor, ['Owner', 'Finder', 'Officer', 'Admin']);
    const row = await checkChallenge({
      challengeId: args.challenge_id,
      code: args.code,
      purpose: 'phone',
      userId: actor.id,
      maxAttempts: 3,
    });
    patch('User', actor.id, { phone: row.phone, phone_verified: true });
    await audit(actor, AUDIT_ACTIONS.PHONE_VERIFIED, 'Phone ' + maskPhone(row.phone) + ' verified');
    return { status: 'ok', phone: row.phone };
  },

  /* --- owner search: masked results, login, verified phone, rate limit, CAPTCHA, logged --- */
  async getCaptcha({ actor }) {
    requireRole(actor, ['Owner', 'Admin']);
    const a = Number(randomDigits(1)) + 2;
    const b = Number(randomDigits(1)) + 1;
    const id = randomHex(10);
    insert('Challenge', {
      challenge_id: id,
      user_id: actor.id,
      purpose: 'captcha',
      code_hash: await sha256Hex(id + ':' + String(a + b)),
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      attempts: 0,
      used: false,
    });
    return { captcha_id: id, question: 'What is ' + a + ' + ' + b + '?' };
  },

  async searchStatus({ actor }) {
    requireRole(actor, ['Owner', 'Admin']);
    const used = recentEvents(actor.id, 'search', 60).length;
    const limit = Number(getSetting('search_limit_per_hour'));
    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      captcha_required: used >= Number(getSetting('captcha_after_searches')),
    };
  },

  async searchFoundDocuments({ actor, args }) {
    requireRole(actor, ['Owner', 'Admin'], 'Only document owners can search the register.');
    if (roleOf(actor) === 'Owner' && !actor.phone_verified) {
      throw new ApiError(403, 'Verify your phone number before searching.', { code: 'phone_unverified' });
    }
    const limit = Number(getSetting('search_limit_per_hour'));
    const used = recentEvents(actor.id, 'search', 60).length;
    if (used >= limit) {
      await audit(actor, AUDIT_ACTIONS.SEARCH_LIMIT, used + ' searches in the last hour');
      throw new ApiError(429, 'You have reached ' + limit + ' searches this hour. Please try again later.');
    }
    if (used >= Number(getSetting('captcha_after_searches'))) {
      if (!args.captcha_id) throw new ApiError(428, 'Answer the check question to continue searching.', { code: 'captcha_required' });
      await checkChallenge({ challengeId: args.captcha_id, code: args.captcha_answer, purpose: 'captcha', userId: actor.id, maxAttempts: 1 }).catch(function () {
        throw new ApiError(428, 'The answer to the check question was wrong. Try a new question.', { code: 'captcha_required' });
      });
    }

    const name = String(args.name || '').trim();
    const number = normalizeId(args.number);
    if (number.length < 4 && name.length < 3) {
      throw new ApiError(422, 'Enter the full name on the document or at least 4 characters of its number.');
    }

    insert('RateEvent', { user_id: actor.id, kind: 'search' });

    const results = table('Document')
      .filter(function (doc) {
        if (['Found', 'Matched', 'Notified'].indexOf(doc.status) < 0) return false;
        if (args.document_type && doc.document_type !== args.document_type) return false;
        const numberHit = number.length >= 4 && normalizeId(doc.document_number) === number;
        const nameHit = name.length >= 3 && nameSimilarity(doc.owner_name, name) >= 0.75;
        return numberHit || nameHit;
      })
      .slice(0, 10)
      .map(function (doc) {
        const point = findById('PickupPoint', doc.pickup_point_id);
        return {
          id: doc.id,
          document_type: doc.document_type,
          owner_name: maskName(doc.owner_name),
          document_number: maskDocumentNumber(doc.document_number),
          found_location: doc.found_location,
          date_found: doc.date_found,
          status: doc.status === 'Notified' ? 'Matched' : doc.status,
          county: point ? point.county : '',
        };
      });

    await audit(
      actor,
      AUDIT_ACTIONS.OWNER_SEARCH,
      'Search for ' +
        (args.document_type || 'any type') +
        (name ? ' by name ' + maskName(name) : '') +
        (number ? ' by number ' + maskDocumentNumber(number) : '') +
        ' — ' + results.length + ' result(s)',
    );

    const usedNow = used + 1;
    return {
      results,
      remaining: Math.max(0, limit - usedNow),
      captcha_required: usedNow >= Number(getSetting('captcha_after_searches')),
    };
  },

  /* --- loss report: consent, verified phone, limit per phone, then matching --- */
  async submitLossReport({ actor, args, server }) {
    requireRole(actor, ['Owner'], 'Only owners can report a lost document.');
    if (!args.consent) throw new ApiError(422, 'Consent is required to store your details.');
    if (!actor.phone_verified || !actor.phone) {
      throw new ApiError(403, 'Verify your phone number before submitting a report.', { code: 'phone_unverified' });
    }
    const nameProblem = checkPersonName(args.owner_name);
    if (nameProblem) throw new ApiError(422, nameProblem);
    const numberProblem = checkDocumentNumber(args.document_type, args.document_number);
    if (numberProblem) throw new ApiError(422, numberProblem);
    if (args.date_lost && args.date_lost > new Date().toISOString().slice(0, 10)) {
      throw new ApiError(422, 'The date lost cannot be in the future.');
    }
    const openForPhone = table('LossReport').filter(function (row) {
      return row.phone === actor.phone && (row.status === 'Open' || row.status === 'Matched');
    }).length;
    const maxReports = Number(getSetting('max_open_reports_per_phone'));
    if (openForPhone >= maxReports) {
      throw new ApiError(429, 'A phone number can have at most ' + maxReports + ' open reports. Close an old report first.');
    }
    const duplicate = table('LossReport').find(function (row) {
      return (
        row.owner_user_id === actor.id &&
        row.document_type === args.document_type &&
        normalizeId(row.document_number) === normalizeId(args.document_number) &&
        row.status !== 'Closed'
      );
    });
    if (duplicate) throw new ApiError(409, 'You already have an open report for this document.');

    const report = insert(
      'LossReport',
      {
        owner_user_id: actor.id,
        document_type: args.document_type,
        owner_name: String(args.owner_name).trim(),
        document_number: String(args.document_number).trim(),
        phone: actor.phone,
        phone_verified: true,
        consent_given: true,
        date_lost: args.date_lost,
        status: 'Open',
      },
      actor.id,
    );
    await audit(actor, AUDIT_ACTIONS.LOST_SUBMITTED, 'Lost report submitted for ' + documentTypeLabel(args.document_type));

    const matched = await matchLossReportAgainstHeldDocuments({ report, actor, client: server });
    return {
      report: shape('LossReport', actor, findById('LossReport', report.id)),
      matches: matched.map(function (item) {
        return { match_type: item.match.match_type, pickup_point_name: item.pickupPoint ? item.pickupPoint.name : '' };
      }),
    };
  },

  async closeLossReport({ actor, args }) {
    requireRole(actor, ['Owner']);
    const report = findById('LossReport', args.report_id);
    if (!report || report.owner_user_id !== actor.id) throw new ApiError(404, 'Report not found.');
    patch('LossReport', report.id, { status: 'Closed' });
    await audit(actor, 'Lost report closed', 'Owner closed report ' + report.id.slice(0, 8));
    return { status: 'ok' };
  },

  /* --- found document: validation, duplicate detection, matching --- */
  async registerFoundDocument({ actor, args, server }) {
    const role = requireRole(actor, ['Finder', 'Officer', 'Admin'], 'Only finders and officers can register found documents.');
    if (role === 'Officer' && (!actor.approved || !actor.pickup_point_id)) {
      throw new ApiError(403, 'Your officer account is waiting for approval by an administrator.');
    }
    const pickupPointId = role === 'Officer' ? actor.pickup_point_id : args.pickup_point_id;
    const point = findById('PickupPoint', pickupPointId);
    if (!point || !point.active || !point.verified) throw new ApiError(422, 'Choose a verified pickup point.');

    const nameProblem = checkPersonName(args.owner_name);
    if (nameProblem) throw new ApiError(422, nameProblem);
    const numberProblem = checkDocumentNumber(args.document_type, args.document_number);
    if (numberProblem) throw new ApiError(422, numberProblem);
    if (!String(args.found_location || '').trim()) throw new ApiError(422, 'Enter where the document was found.');
    const today = new Date().toISOString().slice(0, 10);
    if (!args.date_found || args.date_found > today) throw new ApiError(422, 'Enter a valid date found (not in the future).');

    if (!args.image_url) throw new ApiError(422, 'A photograph of the document is required.');
    const upload = table('Upload').find(function (row) {
      return row.file_uri === args.image_url;
    });
    if (!upload || upload.uploaded_by !== actor.id) throw new ApiError(403, 'This photograph was not uploaded from your account.');

    // Duplicate detection
    const reasons = [];
    let duplicateOf = '';
    const number = normalizeId(args.document_number);
    const active = table('Document').filter(function (doc) {
      return doc.status !== 'Returned';
    });
    active.forEach(function (doc) {
      if (doc.document_type === args.document_type && normalizeId(doc.document_number) === number) {
        reasons.push('Same ' + documentTypeLabel(doc.document_type) + ' number as a document registered on ' + doc.date_found + ' at ' + pointName(doc.pickup_point_id) + '.');
        duplicateOf = duplicateOf || doc.id;
      }
    });
    table('Document').forEach(function (doc) {
      if (args.image_sha256 && doc.image_sha256 === args.image_sha256) {
        reasons.push('The exact same photograph was already uploaded (' + documentTypeLabel(doc.document_type) + ', ' + doc.date_found + ').');
        duplicateOf = duplicateOf || doc.id;
      } else if (args.image_phash && doc.image_phash && hammingDistance(doc.image_phash, args.image_phash) <= 5) {
        reasons.push('The photograph looks almost identical to one registered on ' + doc.date_found + ' at ' + pointName(doc.pickup_point_id) + '.');
        duplicateOf = duplicateOf || doc.id;
      }
    });
    const lastHour = Date.now() - 60 * 60 * 1000;
    const recentByUser = table('Document').filter(function (doc) {
      return doc.finder_user_id === actor.id && new Date(doc.created_date).getTime() >= lastHour;
    }).length;
    const rapid = role === 'Finder' && recentByUser + 1 >= Number(getSetting('rapid_upload_threshold'));
    if (rapid) reasons.push('This account has uploaded ' + (recentByUser + 1) + ' documents within one hour.');

    const ocr = args.ocr || {};
    const doc = insert(
      'Document',
      {
        finder_user_id: actor.id,
        document_type: args.document_type,
        owner_name: String(args.owner_name).trim().toUpperCase(),
        document_number: String(args.document_number).trim().toUpperCase(),
        found_location: String(args.found_location).trim(),
        date_found: args.date_found,
        pickup_point_id: pickupPointId,
        image_url: args.image_url,
        image_sha256: args.image_sha256 || '',
        image_phash: args.image_phash || '',
        ocr_used: Boolean(ocr.used),
        ocr_name_accepted: ocr.used ? Boolean(ocr.name_accepted) : undefined,
        ocr_number_accepted: ocr.used ? Boolean(ocr.number_accepted) : undefined,
        ocr_name_confidence: typeof ocr.name_confidence === 'number' ? ocr.name_confidence : undefined,
        ocr_number_confidence: typeof ocr.number_confidence === 'number' ? ocr.number_confidence : undefined,
        status: 'Found',
        duplicate_flag: reasons.length > 0,
        duplicate_reasons: reasons,
        duplicate_of_id: duplicateOf,
      },
      actor.id,
    );

    await audit(actor, AUDIT_ACTIONS.FOUND_REGISTERED, documentTypeLabel(doc.document_type) + ' (' + maskDocumentNumber(doc.document_number) + ') registered at ' + point.name);
    if (reasons.length) await audit(actor, AUDIT_ACTIONS.DUPLICATE_FLAGGED, 'Document ' + doc.id.slice(0, 8) + ': ' + reasons.join(' '));
    if (rapid) await audit(actor, AUDIT_ACTIONS.RAPID_UPLOADS, (recentByUser + 1) + ' uploads in one hour by this account');

    const created = await createMatchesForDocument({ doc, pickupPoint: point, actor, client: server });
    const exact = created.filter(function (item) { return item.match.match_type === 'Exact'; }).length;
    const fuzzy = created.length - exact;
    if (exact) patch('Document', doc.id, { status: 'Notified' });
    else if (fuzzy) patch('Document', doc.id, { status: 'Matched' });

    return {
      document: shape('Document', actor, findById('Document', doc.id)),
      exact,
      fuzzy,
      duplicate_reasons: reasons,
      pickup_point_name: point.name,
    };
  },

  /* --- handover --- */
  async generateCollectionCode({ actor, args, server }) {
    requireApprovedStaff(actor);
    const match = findById('Match', args.match_id);
    if (!match) throw new ApiError(404, 'Match not found.');
    const doc = findById('Document', match.document_id);
    if (!doc) throw new ApiError(404, 'Document not found.');
    assertStation(actor, doc);
    if (match.match_status !== 'Confirmed' || doc.status === 'Returned') {
      throw new ApiError(409, 'This document is not waiting for collection.');
    }
    const owner = findById('User', match.owner_user_id);
    const code = randomDigits(6);
    const expiresAt = new Date(Date.now() + OTP_MINUTES * 60 * 1000).toISOString();

    const record = transaction(function () {
      table('OtpCode')
        .filter(function (row) {
          return row.match_id === match.id && !row.used;
        })
        .forEach(function (row) {
          patch('OtpCode', row.id, { used: true });
        });
      return insert('OtpCode', { match_id: match.id, owner_user_id: match.owner_user_id, otp_code: code, otp_hash: '', expires_at: expiresAt, used: false, attempts: 0, locked: false }, actor.id);
    });
    patch('OtpCode', record.id, { otp_hash: await sha256Hex(record.id + ':' + code) });

    const point = findById('PickupPoint', doc.pickup_point_id);
    await FUNCTIONS.notifyOwner({
      actor: SYSTEM,
      server,
      args: {
        userId: match.owner_user_id,
        message: buildOtpMessage({ referenceCode: match.reference_code, pickupPointName: point ? point.name : '' }),
        messageSw: buildOtpMessage({ referenceCode: match.reference_code, pickupPointName: point ? point.name : '', lang: 'sw' }),
        smsMessage: buildOtpSms({ referenceCode: match.reference_code, pickupPointName: point ? point.name : '', otpCode: code, minutes: OTP_MINUTES }),
        smsMessageSw: buildOtpSms({ referenceCode: match.reference_code, pickupPointName: point ? point.name : '', otpCode: code, minutes: OTP_MINUTES, lang: 'sw' }),
      },
    });
    await audit(actor, AUDIT_ACTIONS.OTP_GENERATED, 'Collection code generated for match ' + match.id.slice(0, 8) + ' (expires in ' + OTP_MINUTES + ' minutes)' + (owner ? '' : ' — owner account missing'));
    return shape('OtpCode', actor, findById('OtpCode', record.id));
  },

  async completeHandover({ actor, args }) {
    requireApprovedStaff(actor);
    const match = findById('Match', args.match_id);
    if (!match) throw new ApiError(404, 'Match not found.');
    const doc = findById('Document', match.document_id);
    if (!doc) throw new ApiError(404, 'Document not found.');
    assertStation(actor, doc);

    if (!safeEqual(String(args.reference_code || '').trim().toUpperCase(), String(match.reference_code || '').toUpperCase())) {
      throw new ApiError(422, 'The reference code does not match this record.');
    }
    if (normalizeId(args.document_number) !== normalizeId(doc.document_number)) {
      throw new ApiError(422, 'The document number presented does not match the record.');
    }
    const releasedTo = String(args.released_to || '').trim();
    if (releasedTo.length < 3) throw new ApiError(422, 'Enter the name of the person collecting.');
    if (CLAIMANT_ID_TYPES.indexOf(args.claimant_id_type) < 0) throw new ApiError(422, 'Choose the ID type the claimant showed.');
    if (String(args.claimant_id_number || '').trim().length < 4) throw new ApiError(422, 'Enter the number on the ID the claimant showed.');

    const otp = table('OtpCode')
      .filter(function (row) {
        return row.match_id === match.id;
      })
      .sort(function (a, b) {
        return a.created_date < b.created_date ? 1 : -1;
      })[0];
    if (!otp) throw new ApiError(422, 'Generate a collection code for the owner first.');
    if (otp.used || otp.locked) throw new ApiError(422, 'This collection code can no longer be used. Generate a new one.', { otpLocked: true });
    if (new Date(otp.expires_at).getTime() < Date.now()) {
      patch('OtpCode', otp.id, { used: true });
      throw new ApiError(422, 'The collection code has expired. Generate a new one.', { otpLocked: true });
    }
    const ok = safeEqual(await sha256Hex(otp.id + ':' + String(args.otp || '').trim()), otp.otp_hash);
    if (!ok) {
      const attempts = (otp.attempts || 0) + 1;
      const locked = attempts >= MAX_OTP_ATTEMPTS;
      patch('OtpCode', otp.id, { attempts, locked, used: locked });
      await audit(actor, AUDIT_ACTIONS.OTP_FAILED, 'Wrong collection code for match ' + match.id.slice(0, 8) + ' (attempt ' + attempts + ' of ' + MAX_OTP_ATTEMPTS + ')' + (locked ? ' — code locked' : ''));
      throw new ApiError(
        422,
        locked
          ? 'Too many wrong codes. This code is now blocked — generate a new one for the owner.'
          : 'The collection code is wrong. ' + (MAX_OTP_ATTEMPTS - attempts) + ' attempt(s) left before the code is blocked.',
        { attemptsLeft: MAX_OTP_ATTEMPTS - attempts, otpLocked: locked },
      );
    }

    const releasedAt = new Date().toISOString();
    const fields = {
      document_id: doc.id,
      match_id: match.id,
      officer_user_id: actor.id,
      released_to: releasedTo,
      claimant_id_type: args.claimant_id_type,
      claimant_id_number: String(args.claimant_id_number).trim(),
      released_at: releasedAt,
    };
    const integrity = await receiptHash(fields);

    // One step: if the document was released in the meantime, nothing is written.
    const handover = transaction(function () {
      const freshDoc = findById('Document', doc.id);
      const freshMatch = findById('Match', match.id);
      const already = table('Handover').some(function (row) {
        return row.document_id === doc.id;
      });
      if (freshDoc.status === 'Returned' || freshMatch.match_status === 'Returned' || already) {
        throw new ApiError(409, 'This document has already been released.');
      }
      const created = insert(
        'Handover',
        {
          document_id: doc.id,
          match_id: match.id,
          officer_user_id: actor.id,
          pickup_point_id: doc.pickup_point_id,
          released_to: releasedTo,
          claimant_id_type: args.claimant_id_type,
          claimant_id_number: fields.claimant_id_number,
          verification_method: 'Reference code, document number, officer check of the physical ID and one-time collection code',
          notes: String(args.notes || '').trim(),
          released_at: releasedAt,
          integrity_hash: integrity,
        },
        actor.id,
      );
      patch('Document', doc.id, { status: 'Returned', returned_at: releasedAt });
      if (match.loss_report_id && findById('LossReport', match.loss_report_id)) patch('LossReport', match.loss_report_id, { status: 'Closed' });
      patch('Match', match.id, { match_status: 'Returned' });
      patch('OtpCode', otp.id, { used: true });
      table('Match')
        .filter(function (row) {
          return row.document_id === doc.id && row.id !== match.id && (row.match_status === 'Pending' || row.match_status === 'Confirmed');
        })
        .forEach(function (row) {
          patch('Match', row.id, { match_status: 'Rejected' });
        });
      return created;
    });

    const point = findById('PickupPoint', doc.pickup_point_id);
    await audit(actor, AUDIT_ACTIONS.HANDOVER_COMPLETED, documentTypeLabel(doc.document_type) + ' (' + maskDocumentNumber(doc.document_number) + ') released to ' + releasedTo + ' (' + args.claimant_id_type + ') at ' + (point ? point.name : 'the pickup point'));
    return { id: handover.id };
  },

  /** Public check of a receipt QR code. Shows no personal data. */
  async verifyReceipt({ args }) {
    const handover = findById('Handover', args.id);
    if (!handover) return { valid: false };
    const expected = await receiptHash(handover);
    const doc = findById('Document', handover.document_id);
    const intact = expected === handover.integrity_hash && (!args.h || args.h === handover.integrity_hash.slice(0, 16));
    return {
      valid: intact,
      receipt_number: handover.id.slice(0, 8).toUpperCase(),
      released_at: handover.released_at || handover.created_date,
      document_type: doc ? documentTypeLabel(doc.document_type) : '',
      pickup_point: pointName(handover.pickup_point_id || (doc && doc.pickup_point_id)),
    };
  },

  /* --- notifications (in-app + SMS, owner's language) --- */
  async notifyOwner({ actor, args }) {
    const role = roleOf(actor);
    if (role !== 'System' && role !== 'Admin' && !(role === 'Officer' && actor.approved)) {
      throw new ApiError(403, 'Your role cannot send notifications.');
    }
    return notifyUser({ actor, ...args });
  },

  /* --- statistics: totals only, no personal details --- */
  async statistics({ actor }) {
    const role = requireRole(actor, ['Officer', 'Admin'], 'Only officers and administrators can view statistics.');
    const docs = table('Document').filter(function (doc) {
      return role !== 'Officer' || doc.pickup_point_id === actor.pickup_point_id;
    });
    const docIds = {};
    docs.forEach(function (doc) { docIds[doc.id] = true; });
    const matchesForDocs = table('Match').filter(function (match) { return docIds[match.document_id]; });
    const matchedDocs = {};
    matchesForDocs.forEach(function (match) {
      if (match.match_status === 'Confirmed' || match.match_status === 'Returned') matchedDocs[match.document_id] = true;
    });
    const returned = docs.filter(function (doc) { return doc.status === 'Returned'; });
    const recoveryDays = returned
      .filter(function (doc) { return doc.returned_at; })
      .map(function (doc) { return (new Date(doc.returned_at) - new Date(doc.created_date)) / 86400000; });
    const ocrDocs = docs.filter(function (doc) { return doc.ocr_used; });
    const ocrFields = ocrDocs.length * 2;
    const ocrAccepted = ocrDocs.reduce(function (sum, doc) {
      return sum + (doc.ocr_name_accepted ? 1 : 0) + (doc.ocr_number_accepted ? 1 : 0);
    }, 0);

    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), label: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()], found: 0, returned: 0 });
    }
    docs.forEach(function (doc) {
      const found = months.find(function (m) { return m.key === String(doc.created_date).slice(0, 7); });
      if (found) found.found += 1;
      const back = doc.returned_at && months.find(function (m) { return m.key === String(doc.returned_at).slice(0, 7); });
      if (back) back.returned += 1;
    });

    const byType = {};
    docs.forEach(function (doc) { byType[doc.document_type] = (byType[doc.document_type] || 0) + 1; });
    const byStation = {};
    if (role !== 'Officer') {
      docs.forEach(function (doc) {
        const name = pointName(doc.pickup_point_id) || 'Unknown';
        byStation[name] = byStation[name] || { found: 0, returned: 0 };
        byStation[name].found += 1;
        if (doc.status === 'Returned') byStation[name].returned += 1;
      });
    }

    return {
      scope: role === 'Officer' ? pointName(actor.pickup_point_id) : 'All pickup points',
      found: docs.length,
      matched: Object.keys(matchedDocs).length,
      returned: returned.length,
      unclaimed: docs.filter(function (doc) { return doc.status === 'Unclaimed'; }).length,
      duplicates: docs.filter(function (doc) { return doc.duplicate_flag; }).length,
      recovery_rate: docs.length ? Math.round((returned.length / docs.length) * 100) : 0,
      avg_days_to_recovery: recoveryDays.length ? Math.round((recoveryDays.reduce(function (a, b) { return a + b; }, 0) / recoveryDays.length) * 10) / 10 : null,
      ocr_accuracy: ocrFields ? Math.round((ocrAccepted / ocrFields) * 100) : null,
      ocr_documents: ocrDocs.length,
      open_reports: role === 'Officer' ? null : table('LossReport').filter(function (r) { return r.status === 'Open'; }).length,
      months,
      by_type: byType,
      by_station: byStation,
    };
  },

  /** Admin-only anonymised export. No names, numbers, phones or exact dates. */
  async exportAnonymised({ actor }) {
    requireRole(actor, ['Admin'], 'Only administrators can export data.');
    const header = ['record', 'document_type', 'status', 'pickup_point', 'county', 'month_registered', 'days_to_recovery', 'duplicate_flag', 'ocr_used'];
    const rows = await Promise.all(
      table('Document').map(async function (doc) {
        const point = findById('PickupPoint', doc.pickup_point_id);
        const days = doc.returned_at ? Math.round((new Date(doc.returned_at) - new Date(doc.created_date)) / 86400000) : '';
        return [
          (await sha256Hex('ldrs-export:' + doc.id)).slice(0, 10),
          doc.document_type,
          doc.status,
          point ? point.name : '',
          point ? point.county : '',
          String(doc.created_date).slice(0, 7),
          days,
          doc.duplicate_flag ? 'yes' : 'no',
          doc.ocr_used ? 'yes' : 'no',
        ];
      }),
    );
    const csv = toCsv([header].concat(rows));
    await audit(actor, AUDIT_ACTIONS.DATA_EXPORT, 'Anonymised document export (' + rows.length + ' rows)');
    return { filename: 'ldrs-anonymised-' + new Date().toISOString().slice(0, 10) + '.csv', csv };
  },

  /* --- audit and security --- */
  async verifyAuditChain({ actor }) {
    requireRole(actor, ['Admin']);
    const result = await verifyChain();
    await audit(actor, 'Audit chain verified', result.ok ? 'Chain intact (' + result.checked + ' entries)' : 'Chain BROKEN at entry ' + result.brokenAt);
    return result;
  },

  async securityAlerts({ actor }) {
    requireRole(actor, ['Admin']);
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const recent = listAudit().filter(function (entry) {
      return new Date(entry.created_date).getTime() >= since;
    });
    const count = function (action) {
      return recent.filter(function (entry) { return entry.action === action; });
    };
    const alerts = [];
    const failed = count('Failed login').concat(count('Failed two-step login'));
    if (failed.length >= 5) alerts.push({ level: 'high', title: failed.length + ' failed logins in the last 24 hours', detail: 'Check for password guessing. Locked accounts are listed under Users.' });
    const locked = count('Account locked');
    if (locked.length) alerts.push({ level: 'high', title: locked.length + ' account(s) locked after repeated failures', detail: locked.map(function (e) { return e.details; }).join('; ') });
    const otp = count(AUDIT_ACTIONS.OTP_FAILED);
    if (otp.length >= 2) alerts.push({ level: 'medium', title: otp.length + ' wrong collection codes entered', detail: 'Possible impersonation attempts at handover.' });
    const limits = count(AUDIT_ACTIONS.SEARCH_LIMIT);
    if (limits.length) alerts.push({ level: 'medium', title: limits.length + ' search rate-limit hit(s)', detail: 'Possible data harvesting. Review the Owner search entries.' });
    const rapid = count(AUDIT_ACTIONS.RAPID_UPLOADS);
    if (rapid.length) alerts.push({ level: 'medium', title: rapid.length + ' rapid-upload warning(s)', detail: 'A finder account uploaded many documents quickly.' });
    const exports = count(AUDIT_ACTIONS.DATA_EXPORT);
    if (exports.length >= 3) alerts.push({ level: 'low', title: exports.length + ' data exports today', detail: 'Confirm each export was needed.' });
    return alerts;
  },

  /* --- retention (Data Protection Act) --- */
  async runRetention({ actor }) {
    const role = requireRole(actor, ['Admin']);
    const now = Date.now();
    const unclaimedAfter = Number(getSetting('unclaimed_after_days')) * 86400000;
    const disposeAfter = Number(getSetting('document_retention_days')) * 86400000;
    let markedUnclaimed = 0;
    let disposed = 0;
    const toDelete = [];
    transaction(function () {
      table('Document').forEach(function (doc) {
        const age = now - new Date(doc.created_date).getTime();
        if ((doc.status === 'Found' || doc.status === 'Matched') && age > unclaimedAfter) {
          patch('Document', doc.id, { status: 'Unclaimed' });
          markedUnclaimed += 1;
        }
        if (doc.status === 'Unclaimed' && age > disposeAfter && !doc.disposed) {
          if (doc.image_url) toDelete.push(doc.image_url);
          patch('Document', doc.id, { disposed: true, owner_name: 'REMOVED', document_number: 'REMOVED', image_url: '', image_sha256: '', image_phash: '' });
          disposed += 1;
        }
      });
    });
    for (const uri of toDelete) await deletePrivateFile(uri).catch(function () {});
    const auditRemoved = await purgeAuditOlderThan(Number(getSetting('audit_retention_days')));
    await audit(actor, AUDIT_ACTIONS.RETENTION, markedUnclaimed + ' marked unclaimed, ' + disposed + ' disposed (handed to the registration authority), ' + auditRemoved + ' old audit entries removed');
    return { role, markedUnclaimed, disposed, auditRemoved };
  },

  /* --- backups --- */
  async backupNow({ actor }) {
    requireRole(actor, ['Admin']);
    const entry = dailyBackup(true);
    await audit(actor, AUDIT_ACTIONS.BACKUP, entry ? 'Manual snapshot taken' : 'Snapshot failed');
    return { taken_at: entry ? entry.taken_at : null };
  },

  async listBackups({ actor }) {
    requireRole(actor, ['Admin']);
    return listBackups().map(function (b) {
      return { id: b.id, taken_at: b.taken_at };
    });
  },

  async restoreBackup({ actor, args }) {
    requireRole(actor, ['Admin']);
    const entry = restoreBackup(args.id);
    await audit(actor, AUDIT_ACTIONS.BACKUP, 'Database restored from snapshot of ' + entry.taken_at);
    return { status: 'ok' };
  },

  async downloadBackup({ actor }) {
    requireRole(actor, ['Admin']);
    const data = exportDatabase();
    data.tables.Session = [];
    data.tables.Challenge = [];
    await audit(actor, AUDIT_ACTIONS.BACKUP, 'Full backup downloaded');
    return { filename: 'ldrs-backup-' + new Date().toISOString().slice(0, 10) + '.json', data: { database: data, audit: exportAuditStore() } };
  },

  async uploadBackup({ actor, args }) {
    requireRole(actor, ['Admin']);
    const payload = args.data || {};
    importDatabase(payload.database || payload);
    if (payload.audit) importAuditStore(payload.audit);
    await audit(actor, AUDIT_ACTIONS.BACKUP, 'Database restored from an uploaded backup file');
    return { status: 'ok' };
  },

  /* --- owner rights --- */
  async exportMyData({ actor }) {
    requireRole(actor, ['Owner', 'Finder']);
    const mine = function (name, field) {
      return table(name).filter(function (row) { return row[field] === actor.id; }).map(function (row) { return shape(name, actor, row); });
    };
    await audit(actor, AUDIT_ACTIONS.DATA_REQUEST, 'Owner downloaded a copy of their data');
    return {
      generated_at: new Date().toISOString(),
      account: shape('User', actor, actor),
      loss_reports: mine('LossReport', 'owner_user_id'),
      claims: mine('Claim', 'owner_user_id'),
      notifications: mine('Notification', 'user_id'),
      data_requests: mine('DataRequest', 'owner_user_id'),
      documents_handed_in: mine('Document', 'finder_user_id'),
    };
  },

  async completeDataRequest({ actor, args }) {
    requireRole(actor, ['Admin']);
    const request = findById('DataRequest', args.request_id);
    if (!request) throw new ApiError(404, 'Request not found.');
    let summary = args.response || '';
    if (request.request_type === 'Removal' && args.decision === 'Completed') {
      let removed = 0;
      transaction(function () {
        table('LossReport').filter(function (r) { return r.owner_user_id === request.owner_user_id && r.status !== 'Matched'; }).forEach(function (r) {
          patch('LossReport', r.id, { status: 'Closed', owner_name: 'REMOVED', document_number: 'REMOVED', phone: '' });
          removed += 1;
        });
        table('Claim').filter(function (c) { return c.owner_user_id === request.owner_user_id && c.status === 'Pending'; }).forEach(function (c) {
          patch('Claim', c.id, { status: 'Rejected', owner_name: 'REMOVED', phone: '', document_number: '', note: '' });
        });
      });
      summary = summary || removed + ' report(s) anonymised.';
    }
    patch('DataRequest', request.id, { status: args.decision === 'Declined' ? 'Declined' : 'Completed', response: summary });
    await audit(actor, AUDIT_ACTIONS.DATA_REQUEST, request.request_type + ' request ' + request.id.slice(0, 8) + ' ' + (args.decision || 'Completed').toLowerCase());
    return { status: 'ok' };
  },

  /** Marks documents held longer than the setting as Unclaimed. Runs at start-up. */
  async markUnclaimed() {
    const cutoff = Date.now() - Number(getSetting('unclaimed_after_days')) * 86400000;
    let count = 0;
    table('Document').forEach(function (doc) {
      if ((doc.status === 'Found' || doc.status === 'Matched') && new Date(doc.created_date).getTime() < cutoff) {
        patch('Document', doc.id, { status: 'Unclaimed' });
        count += 1;
      }
    });
    return { count };
  },
  ...REVIEW_FUNCTIONS,
};
