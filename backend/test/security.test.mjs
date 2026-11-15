import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  validateEmail, validatePublicRole, createPassword, verifyPassword,
  safeUser, sha256, cookieFor, emptyCookie, extractToken, otpDigest,
} from '../security.mjs';

test('public registration disallows Admin role', () => {
  assert.equal(validatePublicRole('Owner'), 'Owner');
  assert.equal(validatePublicRole('Officer'), 'Officer');
  assert.throws(() => validatePublicRole('Admin'), /Choose/);
});
test('email normalization and validation', () => {
  assert.equal(validateEmail(' A@EXAMPLE.TEST '), 'a@example.test');
  assert.throws(() => validateEmail('not-an-email'));
});
test('password is hashed server-side and verification rejects mismatches', () => {
  const { salt, hash } = createPassword('MyNewPassword2026');
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, 'MyNewPassword2026');
  assert.equal(verifyPassword('MyNewPassword2026', salt, hash), true);
  assert.equal(verifyPassword('Incorrect2026X', salt, hash), false);
});
test('user DTO excludes password hashes and secret fields', () => {
  const row = { id: 'abc', email: 'a@b.test', role: 'user', ldrs_role: 'Owner',
    password_hash: 'secret', password_salt: 'salt', locked_until: '2027-01-01' };
  const out = safeUser(row);
  assert.equal(out.ldrs_role, 'Owner');
  assert.equal('password_hash' in out, false);
  assert.equal('password_salt' in out, false);
  assert.equal('locked_until' in out, false);
});
test('cookie uses HttpOnly / Strict and supports session revocation', () => {
  const token = 'a'.repeat(64);
  const cookie = cookieFor(token, true);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Secure/);
  assert.equal(extractToken(cookie), token);
  assert.equal(extractToken('ldrs_session=NOT-A-TOKEN'), null);
  assert.match(emptyCookie(), /Max-Age=0/);
});
test('OTP hash is keyed and tied to challenge ID', () => {
  assert.notEqual(otpDigest('key1', 'challenge1', '123456'), otpDigest('key2', 'challenge1', '123456'));
  assert.notEqual(otpDigest('key1', 'challenge1', '123456'), otpDigest('key1', 'challenge2', '123456'));
  assert.match(sha256('token'), /^[a-f0-9]{64}$/);
});
