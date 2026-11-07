/**
 * Encrypted private storage for document photographs.
 *
 * Images are encrypted with AES-256-GCM before they are stored in IndexedDB. The key is
 * generated as a non-extractable CryptoKey, so page scripts can use it but cannot read
 * it out. Images are never placed in a public folder; they are only decrypted for a user
 * whose role allows them to see the record (checked in base44Client).
 *
 * Production: object storage outside the web folder, encrypted at rest with a key held
 * in a key-management service, and short-lived signed URLs.
 */
import { randomId } from './crypto';

const DB_NAME = 'ldrs-private-files';
const STORE = 'files';
const KEYS = 'keys';

function openDb() {
  return new Promise(function (resolve, reject) {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = function () {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(KEYS)) db.createObjectStore(KEYS);
    };
    request.onsuccess = function () {
      resolve(request.result);
    };
    request.onerror = function () {
      reject(request.error);
    };
  });
}

function run(storeName, mode, fn) {
  return openDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = fn(store);
      tx.oncomplete = function () {
        resolve(request ? request.result : undefined);
      };
      tx.onerror = function () {
        reject(tx.error);
      };
    });
  });
}

let keyPromise = null;

function getKey() {
  if (keyPromise) return keyPromise;
  keyPromise = run(KEYS, 'readonly', function (store) {
    return store.get('master');
  }).then(async function (existing) {
    if (existing) return existing;
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await run(KEYS, 'readwrite', function (store) {
      return store.put(key, 'master');
    });
    return key;
  });
  return keyPromise;
}

export async function putPrivateFile(blob, meta) {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = await blob.arrayBuffer();
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
  const id = randomId();
  await run(STORE, 'readwrite', function (store) {
    return store.put({ iv, cipher, type: blob.type, size: blob.size, ...meta }, id);
  });
  return 'private://' + id;
}

export async function getPrivateFile(fileUri) {
  const id = String(fileUri || '').replace('private://', '');
  const record = await run(STORE, 'readonly', function (store) {
    return store.get(id);
  });
  if (!record) return null;
  const key = await getKey();
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: record.iv }, key, record.cipher);
  return { blob: new Blob([plain], { type: record.type }), meta: record };
}


export async function deletePrivateFile(fileUri) {
  const id = String(fileUri || '').replace('private://', '');
  await run(STORE, 'readwrite', function (store) {
    return store.delete(id);
  });
}
