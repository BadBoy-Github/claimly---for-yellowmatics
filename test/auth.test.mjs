import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { NextRequest } from 'next/server.js';
import { proxy } from '../proxy.js';
import {
  areLoginCredentialsValid,
  createSessionToken,
  isValidSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from '../src/server/services/auth.js';

const savedEnvironment = {
  AUTH_EMAIL: process.env.AUTH_EMAIL,
  AUTH_PASSWORD: process.env.AUTH_PASSWORD,
  AUTH_SECRET: process.env.AUTH_SECRET,
};
let originalDateNow = Date.now;

before(() => {
  process.env.AUTH_EMAIL = 'claims@example.test';
  process.env.AUTH_PASSWORD = 'a-test-only-password';
  process.env.AUTH_SECRET = 'test-secret-with-at-least-thirty-two-bytes';
});

after(() => {
  for (const [key, value] of Object.entries(savedEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  Date.now = originalDateNow;
});

test('credentials are compared and a valid signed session is accepted', () => {
  assert.equal(areLoginCredentialsValid(' CLAIMS@example.test ', 'a-test-only-password'), true);
  assert.equal(areLoginCredentialsValid('claims@example.test', 'wrong-password'), false);

  const token = createSessionToken();
  assert.equal(isValidSessionToken(token), true);
  assert.equal(isValidSessionToken(`${token}tampered`), false);
  assert.equal(isValidSessionToken('not-a-session'), false);
});

test('sessions expire after the configured lifetime', () => {
  const issuedAt = Math.floor(Date.now() / 1000);
  const token = createSessionToken();
  Date.now = () => (issuedAt + SESSION_MAX_AGE_SECONDS + 1) * 1000;
  assert.equal(isValidSessionToken(token), false);
});

test('changing the configured password invalidates existing sessions', () => {
  const token = createSessionToken();
  process.env.AUTH_PASSWORD = 'rotated-test-password';
  assert.equal(isValidSessionToken(token), false);
  process.env.AUTH_PASSWORD = 'a-test-only-password';
});

test('proxy redirects private pages to sign-in and preserves a safe return path', () => {
  const request = new NextRequest('https://claims.example.test/settings?tab=email');
  const response = proxy(request);
  assert.equal(response.status, 307);
  assert.equal(response.headers.get('location'), 'https://claims.example.test/login?next=%2Fsettings%3Ftab%3Demail');
});

test('proxy rejects unauthenticated API requests and allows signed sessions', () => {
  const apiRequest = new NextRequest('https://claims.example.test/api/claims');
  assert.equal(proxy(apiRequest).status, 401);

  const pageRequest = new NextRequest('https://claims.example.test/history');
  pageRequest.cookies.set(SESSION_COOKIE_NAME, createSessionToken());
  assert.equal(proxy(pageRequest).headers.get('x-middleware-next'), '1');
});
