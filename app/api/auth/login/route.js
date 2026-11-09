import { NextResponse } from 'next/server';
import {
  areLoginCredentialsValid,
  assertAuthConfiguration,
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from '../../../../src/server/services/auth.js';
import LoginAttempt from '../../../../src/server/models/LoginAttempt.js';
import connectDB from '../../../../src/lib/db.js';
import { getLoginAttemptKey, getLoginLockout, recordFailedLogin } from '../../../../src/server/services/loginRateLimit.js';
import { apiError, invalidRequest } from '../../../../src/lib/http.js';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const origin = request.headers.get('origin');
    if (origin && new URL(origin).origin !== new URL(request.url).origin) {
      return Response.json({ error: 'Sign-in request was rejected.' }, { status: 403 });
    }
    if (request.headers.get('sec-fetch-site') === 'cross-site') {
      return Response.json({ error: 'Sign-in request was rejected.' }, { status: 403 });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      throw invalidRequest('Enter your email and password.');
    }
    const { email, password } = payload ?? {};
    if (
      typeof email !== 'string'
      || email.length > 320
      || typeof password !== 'string'
      || password.length > 1024
    ) {
      return Response.json({ error: 'Enter your email and password.' }, { status: 400 });
    }

    assertAuthConfiguration();
    await connectDB();
    const attemptKey = getLoginAttemptKey(request);
    if (await getLoginLockout(attemptKey)) {
      return Response.json({ error: 'Too many unsuccessful attempts. Try again in 15 minutes.' }, { status: 429 });
    }

    if (!areLoginCredentialsValid(email, password)) {
      const lockedUntil = await recordFailedLogin(attemptKey);
      return Response.json(
        {
          error: lockedUntil
            ? 'Too many unsuccessful attempts. Try again in 15 minutes.'
            : 'The email or password is incorrect.',
        },
        { status: lockedUntil ? 429 : 403 },
      );
    }

    await LoginAttempt.deleteOne({ _id: attemptKey });

    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    return apiError(error, 'Sign-in is temporarily unavailable. Check the app configuration and try again.');
  }
}
