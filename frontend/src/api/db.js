/**
 * Prototype data store.
 *
 * The real LDRS uses PostgreSQL (records) and MongoDB (images/OCR output) on a secured
 * server. For the prototype every record lives in the browser's localStorage under one
 * key, and every change is applied as a single synchronous step, so a multi-record change
 * (for example a handover) either happens completely or not at all.
 *
 * Schemas come from the entities/*.json files: required fields, enum values and defaults
 * are enforced on every create and update.
 */
import { randomId } from './crypto';
import { checkRecord } from './recordChecks';

const DB_KEY = 'ldrs.db.v1';
const BACKUP_KEY = 'ldrs.backups.v1';

const schemaModules = import.meta.glob('../entities/*.json', { eager: true });
export const SCHEMAS = {};
Object.keys(schemaModules).forEach(function (path) {
  const schema = schemaModules[path].default || schemaModules[path];
  SCHEMAS[schema.name] = schema;
});

const ENTITY_NAMES = Object.keys(SCHEMAS).filter(function (name) {
  return name !== 'AuditLog';
});

// Internal tables that are not exposed as entities.
const INTERNAL_TABLES = ['Session', 'Challenge', 'Upload', 'RateEvent'];

let state = null;

function emptyState() {
  const tables = {};
  ENTITY_NAMES.concat(INTERNAL_TABLES).forEach(function (name) {
    tables[name] = [];
  });
  return { version: 1, seeded: false, tables };
}

function load() {
  if (state) return state;
  try {
    const raw = localStorage.getItem(DB_KEY);
    state = raw ? JSON.parse(raw) : emptyState();
  } catch (error) {
    console.error('LDRS database could not be read; starting empty', error);
    state = emptyState();
  }
  ENTITY_NAMES.concat(INTERNAL_TABLES).forEach(function (name) {
    if (!state.tables[name]) state.tables[name] = [];
  });
  return state;
}

function persist() {
  localStorage.setItem(DB_KEY, JSON.stringify(state));
}


export function table(name) {
  return load().tables[name];
}

export class ApiError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    Object.assign(this, extra || {});
  }
}

function validate(name, record, isCreate) {
  const schema = SCHEMAS[name];
  if (!schema) return;
  if (isCreate) {
    (schema.required || []).forEach(function (field) {
      const value = record[field];
      if (value === undefined || value === null || value === '') {
        throw new ApiError(422, name + ': "' + field + '" is required.');
      }
    });
  }
  Object.keys(schema.properties || {}).forEach(function (field) {
    const def = schema.properties[field];
    const value = record[field];
    if (value === undefined || value === null || value === '') return;
    if (def.enum && def.enum.indexOf(value) < 0) {
      throw new ApiError(422, name + ': "' + value + '" is not an allowed value for ' + field + '.');
    }
    if (def.type === 'number' && typeof value !== 'number') {
      throw new ApiError(422, name + ': ' + field + ' must be a number.');
    }
    if (def.type === 'boolean' && typeof value !== 'boolean') {
      throw new ApiError(422, name + ': ' + field + ' must be true or false.');
    }
    if (def.type === 'string' && typeof value !== 'string') {
      throw new ApiError(422, name + ': ' + field + ' must be text.');
    }
    if (def.type === 'string' && value.length > 5000) {
      throw new ApiError(422, name + ': ' + field + ' is too long.');
    }
  });
  const problem = checkRecord(name, record);
  if (problem) throw new ApiError(422, problem);
}

function applyDefaults(name, record) {
  const schema = SCHEMAS[name];
  if (!schema) return record;
  Object.keys(schema.properties || {}).forEach(function (field) {
    const def = schema.properties[field];
    if (record[field] === undefined && def.default !== undefined) record[field] = def.default;
  });
  return record;
}

/**
 * Runs a group of changes as one unit. If anything throws, nothing is saved.
 * The callback must be synchronous so no other request can interleave.
 */
export function transaction(fn) {
  load();
  const snapshot = JSON.stringify(state);
  try {
    const result = fn();
    persist();
    return result;
  } catch (error) {
    state = JSON.parse(snapshot);
    throw error;
  }
}

export function insert(name, data, actorId) {
  const now = new Date().toISOString();
  const record = applyDefaults(name, {
    ...data,
    id: randomId(),
    created_date: now,
    updated_date: now,
    created_by_id: actorId || null,
  });
  validate(name, record, true);
  table(name).push(record);
  persist();
  return record;
}

export function patch(name, id, changes) {
  const rows = table(name);
  const index = rows.findIndex(function (row) {
    return row.id === id;
  });
  if (index < 0) throw new ApiError(404, name + ' not found.');
  const clean = { ...changes };
  delete clean.id;
  delete clean.created_date;
  delete clean.created_by_id;
  const updated = { ...rows[index], ...clean, updated_date: new Date().toISOString() };
  validate(name, updated, false);
  rows[index] = updated;
  persist();
  return updated;
}

export function remove(name, id) {
  const rows = table(name);
  const index = rows.findIndex(function (row) {
    return row.id === id;
  });
  if (index < 0) throw new ApiError(404, name + ' not found.');
  rows.splice(index, 1);
  persist();
}

export function findById(name, id) {
  return (
    table(name).find(function (row) {
      return row.id === id;
    }) || null
  );
}

/* ---------- Query matching ---------- */

function matchValue(actual, expected) {
  if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
    return Object.keys(expected).every(function (op) {
      const value = expected[op];
      switch (op) {
        case '$in':
          return Array.isArray(value) && value.indexOf(actual) >= 0;
        case '$nin':
          return Array.isArray(value) && value.indexOf(actual) < 0;
        case '$ne':
          return actual !== value;
        case '$gt':
          return actual > value;
        case '$gte':
          return actual >= value;
        case '$lt':
          return actual < value;
        case '$lte':
          return actual <= value;
        case '$exists':
          return value ? actual !== undefined && actual !== null : actual === undefined || actual === null;
        default:
          return false;
      }
    });
  }
  return actual === expected;
}

export function matches(row, query) {
  if (!query) return true;
  return Object.keys(query).every(function (key) {
    if (key === '$or') {
      return query.$or.some(function (sub) {
        return matches(row, sub);
      });
    }
    if (key === '$and') {
      return query.$and.every(function (sub) {
        return matches(row, sub);
      });
    }
    return matchValue(row[key], query[key]);
  });
}

export function sortRows(rows, sort) {
  if (!sort) return rows;
  const desc = sort.charAt(0) === '-';
  const field = desc ? sort.slice(1) : sort;
  return rows.slice().sort(function (a, b) {
    const left = a[field];
    const right = b[field];
    if (left === right) return 0;
    if (left === undefined || left === null) return 1;
    if (right === undefined || right === null) return -1;
    const result = left > right ? 1 : -1;
    return desc ? -result : result;
  });
}

/* ---------- Backups ---------- */

export function exportDatabase() {
  return JSON.parse(JSON.stringify(load()));
}

export function importDatabase(data) {
  if (!data || !data.tables || typeof data.tables !== 'object') {
    throw new ApiError(422, 'This file is not an LDRS backup.');
  }
  const next = emptyState();
  Object.keys(next.tables).forEach(function (name) {
    if (Array.isArray(data.tables[name])) next.tables[name] = data.tables[name];
  });
  next.seeded = true;
  // Sessions are never restored from a backup.
  next.tables.Session = [];
  next.tables.Challenge = [];
  state = next;
  persist();
}

export function listBackups() {
  try {
    return JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]');
  } catch {
    return [];
  }
}

/** Takes a daily snapshot automatically and keeps the last seven. */
export function dailyBackup(force) {
  const backups = listBackups();
  const last = backups[backups.length - 1];
  const dayMs = 24 * 60 * 60 * 1000;
  if (!force && last && Date.now() - new Date(last.taken_at).getTime() < dayMs) return null;
  const copy = exportDatabase();
  copy.tables.Session = [];
  copy.tables.Challenge = [];
  const entry = { id: randomId(), taken_at: new Date().toISOString(), data: copy };
  const next = backups.concat([entry]).slice(-7);
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn('Backup could not be stored (storage full?)', error);
    return null;
  }
  return entry;
}

export function restoreBackup(id) {
  const entry = listBackups().find(function (item) {
    return item.id === id;
  });
  if (!entry) throw new ApiError(404, 'Backup not found.');
  importDatabase(entry.data);
  return entry;
}

export function markSeeded() {
  load().seeded = true;
  persist();
}

export function isSeeded() {
  return Boolean(load().seeded);
}
