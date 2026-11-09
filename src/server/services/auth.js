import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE_NAME = 'claimly_session';
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

function getAuthConfig() {
  const { AUTH_EMAIL, AUTH_PASSWORD, AUTH_SECRET } = process.env;
  if (!AUTH_EMAIL || !AUTH_PASSWORD || !AUTH_SECRET || Buffer.byteLength(AUTH_SECRET) < 32) {
    const error = new Error('Configure AUTH_EMAIL, AUTH_PASSWORD, and an AUTH_SECRET of at least 32 bytes.');
    error.status = 503;
    throw error;
  }
  return { email: AUTH_EMAIL.trim().toLowerCase(), password: AUTH_PASSWORD, secret: AUTH_SECRET };
}

export function assertAuthConfiguration() {
  getAuthConfig();
}

function safeEqual(left, right) {
  const leftHash = createHmac('sha256', 'claimly-auth-compare').update(left).digest();
  const rightHash = createHmac('sha256', 'claimly-auth-compare').update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function signature(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function areLoginCredentialsValid(email, password) {
  const config = getAuthConfig();
  const emailMatches = safeEqual(String(email).trim().toLowerCase(), config.email);
  const passwordMatches = safeEqual(String(password), config.password);
  return emailMatches && passwordMatches;
}

export function createSessionToken() {
  const { email, password, secret } = getAuthConfig();
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    email,
    credentialVersion: signature(`${email}\0${password}`, secret),
    issuedAt,
    expiresAt: issuedAt + SESSION_MAX_AGE_SECONDS,
  })).toString('base64url');
  return `${payload}.${signature(payload, secret)}`;
}

export function isValidSessionToken(token) {
  if (typeof token !== 'string') return false;
  const [payload, providedSignature, extra] = token.split('.');
  if (!payload || !providedSignature || extra) return false;

  try {
    const {
      email,
      credentialVersion,
      issuedAt,
      expiresAt,
    } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const { email: expectedEmail, password, secret } = getAuthConfig();
    if (!safeEqual(providedSignature, signature(payload, secret))) return false;
    if (!safeEqual(credentialVersion, signature(`${expectedEmail}\0${password}`, secret))) return false;

    const now = Math.floor(Date.now() / 1000);
    return typeof email === 'string'
      && safeEqual(email, expectedEmail)
      && Number.isInteger(issuedAt)
      && Number.isInteger(expiresAt)
      && issuedAt <= now
      && expiresAt > now
      && expiresAt - issuedAt <= SESSION_MAX_AGE_SECONDS;
  } catch {
    return false;
  }
}
