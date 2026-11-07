/**
 * First-run demonstration data. Every name and number below is invented (mock documents
 * only — never test with real people's documents without their consent).
 */
import { insert, isSeeded, markSeeded, transaction, dailyBackup, table } from './db';
import { hashPassword } from './crypto';
import { appendAudit } from './auditStore';
import { DEFAULT_SETTINGS, FUNCTIONS } from './functions';

export const DEMO_ACCOUNTS = [
  { email: 'admin@ldrs.test', password: 'Admin@LDRS2026', label: 'Administrator', note: 'two-step login' },
  { email: 'officer.kisumu@ldrs.test', password: 'Officer@LDRS2026', label: 'Officer · Kisumu Central', note: 'two-step login' },
  { email: 'officer.kondele@ldrs.test', password: 'Officer@LDRS2026', label: 'Officer · Kondele', note: 'two-step login' },
  { email: 'finder@ldrs.test', password: 'Finder@LDRS2026', label: 'Finder' },
  { email: 'owner@ldrs.test', password: 'Owner@LDRS2026', label: 'Owner' },
];

function daysAgo(days) {
  return new Date(Date.now() - days * 86400000);
}

function dateOnly(date) {
  return date.toISOString().slice(0, 10);
}

let seeding = null;

async function seed() {
  const points = [
    { name: 'Kisumu Central Police Station', point_type: 'Police station', location: 'Oginga Odinga Street, Kisumu', county: 'Kisumu', contact_phone: '0700 100 200', opening_hours: 'Mon–Sun, 08:00–18:00' },
    { name: 'Kondele Police Station', point_type: 'Police station', location: 'Kondele, Kisumu', county: 'Kisumu', contact_phone: '0700 100 201', opening_hours: 'Mon–Sat, 08:00–17:00' },
    { name: "Manyatta Chief's Office", point_type: "Chief's office", location: 'Manyatta, Kisumu', county: 'Kisumu', contact_phone: '0700 100 202', opening_hours: 'Mon–Fri, 08:30–16:30' },
    { name: 'Nairobi Central Police Station', point_type: 'Police station', location: 'University Way, Nairobi', county: 'Nairobi', contact_phone: '0700 100 203', opening_hours: 'Mon–Sun, 24 hours' },
    { name: 'Eldoret Police Station', point_type: 'Police station', location: 'Uganda Road, Eldoret', county: 'Uasin Gishu', contact_phone: '0700 100 204', opening_hours: 'Mon–Sun, 08:00–18:00', unverified: true },
  ];

  const hashed = {};
  for (const account of DEMO_ACCOUNTS) {
    hashed[account.email] = await hashPassword(account.password);
  }

  transaction(function () {
    const created = points.map(function (point) {
      const unverified = point.unverified;
      delete point.unverified;
      return insert('PickupPoint', {
        ...point,
        verified: !unverified,
        verification_note: unverified ? 'Awaiting confirmation call with the station commander.' : 'Confirmed by phone with the officer in charge.',
        verified_at: unverified ? '' : daysAgo(60).toISOString(),
        active: true,
      });
    });
    const [kisumu, kondele] = created;

    const user = function (email, data) {
      return insert('User', {
        email,
        password_hash: hashed[email].hash,
        password_salt: hashed[email].salt,
        failed_logins: 0,
        language: 'en',
        ...data,
      });
    };
    user('admin@ldrs.test', { full_name: 'Grace Atieno (Admin)', role: 'admin', phone: '0700000001', phone_verified: true, approved: true });
    const officer = user('officer.kisumu@ldrs.test', { full_name: 'Cpl. David Omondi', role: 'user', ldrs_role: 'Officer', approved: true, pickup_point_id: kisumu.id, phone: '0700000002', phone_verified: true });
    user('officer.kondele@ldrs.test', { full_name: 'Sgt. Lucy Wekesa', role: 'user', ldrs_role: 'Officer', approved: true, pickup_point_id: kondele.id, phone: '0700000003', phone_verified: true });
    const finder = user('finder@ldrs.test', { full_name: 'Kevin Otieno', role: 'user', ldrs_role: 'Finder', phone: '0711000003', phone_verified: true });
    const owner = user('owner@ldrs.test', { full_name: 'Mary Wanjiru Kamau', role: 'user', ldrs_role: 'Owner', phone: '0712345678', phone_verified: true });

    const doc = function (data, ageDays, by) {
      const record = insert('Document', { status: 'Found', duplicate_flag: false, duplicate_reasons: [], ...data }, by.id);
      record.created_date = daysAgo(ageDays).toISOString();
      record.updated_date = record.created_date;
      return record;
    };
    doc({ finder_user_id: finder.id, document_type: 'National ID', owner_name: 'JANE AKINYI OTIENO', document_number: '30123456', found_location: 'Kisumu bus park, near the matatu stage', date_found: dateOnly(daysAgo(3)), pickup_point_id: kisumu.id }, 3, finder);
    doc({ finder_user_id: finder.id, document_type: 'Student ID', owner_name: 'BRIAN OCHIENG ODERO', document_number: 'MSU20230456', found_location: 'Kondele market, outside the supermarket', date_found: dateOnly(daysAgo(2)), pickup_point_id: kondele.id }, 2, finder);
    const mary = doc({ finder_user_id: officer.id, document_type: 'National ID', owner_name: 'MARY WANJIRU KAMAU', document_number: '28456713', found_location: 'Jubilee market, Kisumu', date_found: dateOnly(daysAgo(1)), pickup_point_id: kisumu.id, status: 'Matched' }, 1, officer);
    doc({ finder_user_id: finder.id, document_type: 'Passport', owner_name: 'PETER KIPROTICH', document_number: 'AK7654321', found_location: 'Kisumu International Airport car park', date_found: dateOnly(daysAgo(40)), pickup_point_id: kisumu.id }, 40, finder);

    const report = insert('LossReport', {
      owner_user_id: owner.id,
      document_type: 'National ID',
      owner_name: 'MARY WANJIRU KAMAU',
      document_number: '28456712',
      phone: '0712345678',
      phone_verified: true,
      consent_given: true,
      date_lost: dateOnly(daysAgo(4)),
      status: 'Open',
    }, owner.id);

    insert('Match', {
      document_id: mary.id,
      loss_report_id: report.id,
      owner_user_id: owner.id,
      match_score: 100,
      match_type: 'Fuzzy',
      match_status: 'Pending',
      reference_code: '',
    });

    Object.keys(DEFAULT_SETTINGS).forEach(function (key) {
      insert('Setting', { key, value: DEFAULT_SETTINGS[key] });
    });
  });

  markSeeded();
  await appendAudit({ user_id: null, actor_role: 'System', action: 'System initialised', details: 'Demonstration data created (mock documents only)' });
}

export function ensureSeeded() {
  if (!seeding) {
    seeding = (async function () {
      if (!isSeeded() || !table('User').length) await seed();
      await FUNCTIONS.markUnclaimed();
      dailyBackup(false);
    })().catch(function (error) {
      seeding = null;
      throw error;
    });
  }
  return seeding;
}
