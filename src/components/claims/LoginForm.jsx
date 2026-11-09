'use client';

import { useState } from 'react';
import { FiArrowRight, FiLock, FiMail, FiShield } from 'react-icons/fi';

function safeNextPath(path) {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && !path.includes('\\')
    ? path
    : '/';
}

export default function LoginForm({ nextPath = '/' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 403 || response.status === 429) {
        window.location.assign('/403?reason=login');
        return;
      }
      if (!response.ok) throw new Error(result.error || 'Sign-in is temporarily unavailable.');
      window.location.assign(safeNextPath(nextPath));
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <a href="/login" className="login-brand" aria-label="Claimly sign in">
          <span className="brand-mark">C</span>
          <span>claimly<span className="brand-dot">.</span></span>
        </a>
        <div className="login-icon"><FiShield aria-hidden="true" /></div>
        <p className="eyebrow">PRIVATE WORKSPACE</p>
        <h1 id="login-title">Welcome back.</h1>
        <p className="login-description">Sign in to securely access your expense claims.</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="login-email">Email address</label>
          <div className="login-input-wrap">
            <FiMail aria-hidden="true" />
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
              maxLength={320}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <label htmlFor="login-password">Password</label>
          <div className="login-input-wrap">
            <FiLock aria-hidden="true" />
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              maxLength={1024}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="button-primary login-submit" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
            {!busy && <FiArrowRight aria-hidden="true" />}
          </button>
        </form>

        <p className="login-privacy"><FiLock aria-hidden="true" /> Your claims are visible only after sign-in.</p>
      </section>
    </main>
  );
}
