import { createHmac } from 'node:crypto';
import LoginAttempt from '../models/LoginAttempt.js';

const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function getLoginAttemptKey(request) {
  const address = request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
  return createHmac('sha256', process.env.AUTH_SECRET).update(address).digest('hex');
}

export async function getLoginLockout(key) {
  const record = await LoginAttempt.findById(key).select('lockedUntil').lean();
  return record?.lockedUntil && record.lockedUntil > new Date() ? record.lockedUntil : null;
}

export async function recordFailedLogin(key) {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + LOCKOUT_MS);
  const windowExpired = {
    $or: [
      { $eq: [{ $ifNull: ['$windowStartedAt', null] }, null] },
      { $lte: ['$windowStartedAt', new Date(now.getTime() - WINDOW_MS)] },
    ],
  };
  const alreadyLocked = { $gt: [{ $ifNull: ['$lockedUntil', new Date(0)] }, now] };
  const nextAttempts = {
    $cond: [
      windowExpired,
      1,
      { $add: [{ $ifNull: ['$attempts', 0] }, 1] },
    ],
  };

  const record = await LoginAttempt.findOneAndUpdate(
    { _id: key },
    [
      { $set: { _windowExpired: windowExpired, _alreadyLocked: alreadyLocked } },
      {
        $set: {
          windowStartedAt: {
            $cond: ['$_windowExpired', now, { $ifNull: ['$windowStartedAt', now] }],
          },
          attempts: { $cond: ['$_alreadyLocked', '$attempts', nextAttempts] },
          lockedUntil: {
            $cond: [
              '$_alreadyLocked',
              '$lockedUntil',
              { $cond: [{ $gte: [nextAttempts, MAX_ATTEMPTS] }, lockUntil, null] },
            ],
          },
          expiresAt: {
            $cond: ['$_alreadyLocked', '$expiresAt', new Date(now.getTime() + 60 * 60 * 1000)],
          },
        },
      },
      { $unset: ['_windowExpired', '_alreadyLocked'] },
    ],
    { upsert: true, new: true },
  ).select('lockedUntil').lean();

  return record?.lockedUntil && record.lockedUntil > now ? record.lockedUntil : null;
}
