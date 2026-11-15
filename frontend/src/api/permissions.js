/**
 * Access rules, checked in the data layer on every request (not only on the screen).
 *
 *  - Officers see and change only the records of their own station, and only once an
 *    administrator has approved their account.
 *  - Finders see only the documents they handed in.
 *  - Owners see only their own reports, claims, matches and alerts. Found documents are
 *    reached only through the masked search function, or once linked to them by a match
 *    or claim, and even then the name and number stay partly hidden.
 *  - Password hashes, phone codes and collection codes are never returned to anyone who
 *    should not have them.
 */
import { resolveRole, maskDocumentNumber, maskName } from '@/lib/ldrs';
import { table, findById } from './db';

export const SYSTEM = { id: 'system', __system: true, full_name: 'LDRS server' };

export function roleOf(actor) {
  if (!actor) return null;
  if (actor.__system) return 'System';
  return resolveRole(actor);
}

function approvedOfficer(actor) {
  return roleOf(actor) === 'Officer' && Boolean(actor.approved) && Boolean(actor.pickup_point_id);
}

function isAdmin(actor) {
  const role = roleOf(actor);
  return role === 'Admin' || role === 'System';
}

function docAtStation(actor, documentId) {
  const doc = findById('Document', documentId);
  return Boolean(doc && actor.pickup_point_id && doc.pickup_point_id === actor.pickup_point_id);
}

function ownerLinkedToDocument(actor, documentId) {
  const linkedByMatch = table('Match').some(function (match) {
    return (
      match.document_id === documentId &&
      match.owner_user_id === actor.id &&
      (match.match_status === 'Confirmed' || match.match_status === 'Returned')
    );
  });
  if (linkedByMatch) return true;
  return table('Claim').some(function (claim) {
    return claim.document_id === documentId && claim.owner_user_id === actor.id;
  });
}

const RULES = {
  Document: {
    read: function (actor, row) {
      const role = roleOf(actor);
      if (isAdmin(actor)) return true;
      if (role === 'Officer') return Boolean(actor.pickup_point_id) && row.pickup_point_id === actor.pickup_point_id;
      if (role === 'Finder') return row.finder_user_id === actor.id;
      if (role === 'Owner') return ownerLinkedToDocument(actor, row.id);
      return false;
    },
    create: function () {
      return false; // only through registerFoundDocument (validation, duplicate check, matching)
    },
    update: function (actor, row) {
      if (isAdmin(actor)) return true;
      return approvedOfficer(actor) && row.pickup_point_id === actor.pickup_point_id;
    },
    remove: isAdmin,
  },
  LossReport: {
    read: function (actor, row) {
      if (isAdmin(actor)) return true;
      const role = roleOf(actor);
      if (role === 'Owner') return row.owner_user_id === actor.id;
      if (role === 'Officer') {
        return table('Match').some(function (match) {
          return match.loss_report_id === row.id && docAtStation(actor, match.document_id);
        });
      }
      return false;
    },
    create: function (actor) {
      return isAdmin(actor) || approvedOfficer(actor); // owners use submitLossReport
    },
    update: function (actor, row) {
      if (isAdmin(actor)) return true;
      if (!approvedOfficer(actor)) return false;
      return (
        row.created_by_id === actor.id ||
        table('Match').some(function (match) {
          return match.loss_report_id === row.id && docAtStation(actor, match.document_id);
        })
      );
    },
    remove: isAdmin,
  },
  Match: {
    read: function (actor, row) {
      if (isAdmin(actor)) return true;
      const role = roleOf(actor);
      if (role === 'Owner') return row.owner_user_id === actor.id && row.match_status !== 'Pending' && row.match_status !== 'Rejected';
      if (role === 'Officer') return docAtStation(actor, row.document_id);
      return false;
    },
    create: function (actor, data) {
      return isAdmin(actor) || (approvedOfficer(actor) && docAtStation(actor, data.document_id));
    },
    update: function (actor, row) {
      return isAdmin(actor) || (approvedOfficer(actor) && docAtStation(actor, row.document_id));
    },
    remove: function () {
      return false;
    },
  },
  Notification: {
    read: function (actor, row) {
      return isAdmin(actor) || row.user_id === actor.id;
    },
    create: function (actor) {
      return isAdmin(actor) || approvedOfficer(actor);
    },
    update: function (actor, row, changes) {
      if (isAdmin(actor)) return true;
      return row.user_id === actor.id && Object.keys(changes).every(function (key) {
        return key === 'read';
      });
    },
    remove: function () {
      return false;
    },
  },
  OtpCode: {
    read: function (actor, row) {
      if (isAdmin(actor)) return true;
      if (roleOf(actor) === 'Owner') return row.owner_user_id === actor.id;
      if (roleOf(actor) === 'Officer') {
        const match = findById('Match', row.match_id);
        return Boolean(match) && docAtStation(actor, match.document_id);
      }
      return false;
    },
    create: function (actor) {
      return roleOf(actor) === 'System';
    },
    update: function (actor) {
      return roleOf(actor) === 'System';
    },
    remove: function () {
      return false;
    },
  },
  Claim: {
    read: function (actor, row) {
      if (isAdmin(actor)) return true;
      const role = roleOf(actor);
      if (role === 'Owner') return row.owner_user_id === actor.id;
      if (role === 'Officer') return docAtStation(actor, row.document_id);
      return false;
    },
    create: function (actor, data) {
      if (roleOf(actor) !== 'Owner' || data.owner_user_id !== actor.id) return false;
      const doc = findById('Document', data.document_id);
      return Boolean(doc) && ['Found', 'Matched', 'Notified'].indexOf(doc.status) >= 0;
    },
    update: function (actor, row) {
      return isAdmin(actor) || (approvedOfficer(actor) && docAtStation(actor, row.document_id));
    },
    remove: isAdmin,
  },
  Handover: {
    read: function (actor, row) {
      if (isAdmin(actor)) return true;
      return roleOf(actor) === 'Officer' && docAtStation(actor, row.document_id);
    },
    create: function (actor) {
      return roleOf(actor) === 'System'; // only through completeHandover
    },
    update: function () {
      return false; // read-only once saved
    },
    remove: function () {
      return false;
    },
  },
  PickupPoint: {
    read: function () {
      return true;
    },
    create: isAdmin,
    update: isAdmin,
    remove: function () {
      return false;
    },
  },
  User: {
    read: function (actor, row) {
      if (isAdmin(actor) || row.id === actor.id) return true;
      // Officers may see the name of officers at their own station (receipts).
      return (
        roleOf(actor) === 'Officer' &&
        row.ldrs_role === 'Officer' &&
        row.pickup_point_id &&
        row.pickup_point_id === actor.pickup_point_id
      );
    },
    create: function () {
      return false; // registration goes through auth.register
    },
    update: function (actor, row, changes) {
      if (isAdmin(actor)) return true;
      if (row.id !== actor.id) return false;
      return Object.keys(changes).every(function (key) {
        return key === 'full_name' || key === 'language';
      });
    },
    remove: function () {
      return false;
    },
  },
  DataRequest: {
    read: function (actor, row) {
      return isAdmin(actor) || row.owner_user_id === actor.id;
    },
    create: function (actor, data) {
      return ['Owner', 'Finder'].indexOf(roleOf(actor)) >= 0 && data.owner_user_id === actor.id;
    },
    update: isAdmin,
    remove: function () {
      return false;
    },
  },
  Setting: {
    read: function () {
      return true;
    },
    create: isAdmin,
    update: isAdmin,
    remove: function () {
      return false;
    },
  },
};

export function can(op, entity, actor, row, changes) {
  if (!actor) return false;
  if (actor.__system) return true;
  if (actor.disabled) return false;
  const rule = RULES[entity] && RULES[entity][op];
  if (!rule) return false;
  return Boolean(rule(actor, row || {}, changes || {}));
}

const ALWAYS_HIDDEN = {
  User: ['password_hash', 'password_salt', 'phone_code_hash', 'phone_code_expires', 'reset_code_hash', 'reset_expires'],
  OtpCode: ['otp_hash'],
};

/** Removes or masks fields the caller is not allowed to see. */
export function shape(entity, actor, row) {
  const out = { ...row };
  (ALWAYS_HIDDEN[entity] || []).forEach(function (field) {
    delete out[field];
  });
  const role = roleOf(actor);
  if (role === 'System') return row;

  if (entity === 'OtpCode' && role !== 'Owner') {
    // Officers verify the code typed by the owner; they never see it.
    delete out.otp_code;
  }
  if (entity === 'Document' && role === 'Owner') {
    out.owner_name = maskName(row.owner_name);
    out.document_number = maskDocumentNumber(row.document_number);
    delete out.image_url;
    delete out.image_sha256;
    delete out.image_phash;
    delete out.finder_user_id;
    delete out.duplicate_reasons;
  }
  if (entity === 'User' && role !== 'Admin' && row.id !== actor.id) {
    return { id: row.id, full_name: row.full_name, ldrs_role: row.ldrs_role };
  }
  return out;
}
