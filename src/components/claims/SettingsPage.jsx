'use client';

import { useEffect, useState } from 'react';
import { FiCheck, FiMail, FiRefreshCw, FiSettings } from 'react-icons/fi';
import { api } from '../../lib/api.js';
import useToast from '../../lib/useToast.js';
import Toast from './Toast.jsx';
import WorkspaceLayout from './WorkspaceLayout.jsx';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const parseEmails = (value) => value.split(/[,\n;]/).map((email) => email.trim()).filter(Boolean);

export default function SettingsPage() {
  const [emailTo, setEmailTo] = useState('');
  const [emailCc, setEmailCc] = useState('');
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const { toast, showToast, dismissToast } = useToast();

  useEffect(() => {
    api.health()
      .then((health) => setConnected(health.database === 'connected'))
      .catch((error) => showToast(error.message, 'error'));
    api.getSettings()
      .then((settings) => {
        setEmailTo(settings.to.join(', '));
        setEmailCc(settings.cc.join(', '));
      })
      .catch((error) => showToast(error.message, 'error'));
  }, [showToast]);

  async function saveRecipients(event) {
    event.preventDefault();
    const to = parseEmails(emailTo);
    const cc = parseEmails(emailCc);
    if (!to.length) {
      showToast('Add at least one primary recipient.', 'error');
      return;
    }
    if ([...to, ...cc].some((email) => !emailPattern.test(email))) {
      showToast('Check the email addresses; one or more are not valid.', 'error');
      return;
    }
    if (to.length > 20 || cc.length > 20) {
      showToast('You can add up to 20 addresses in each recipient field.', 'error');
      return;
    }

    setBusy(true);
    try {
      await api.saveSettings({ to, cc });
      showToast('Email recipients saved.');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <WorkspaceLayout active="settings" title="Email settings" connected={connected}>
      <Toast toast={toast} onDismiss={dismissToast} />
      <div className="content-wrap settings-wrap">
        <section className="hero-section">
          <div>
            <div className="eyebrow"><span className="eyebrow-dot" /> PREFERENCES</div>
            <h1 className="hero-title">Email settings</h1>
            <p className="hero-description">Choose who receives your submitted expense claims.</p>
          </div>
        </section>

        <section className="panel recipient-panel settings-panel">
          <div className="panel-header">
            <div className="heading-with-icon">
              <div className="section-icon"><FiMail aria-hidden="true" /></div>
              <div>
                <h2 className="panel-title">Claim recipients</h2>
                <p className="panel-subtitle">These addresses are used when you send a claim.</p>
              </div>
            </div>
            <span className="panel-chip panel-chip-neutral"><FiSettings aria-hidden="true" /> SAVED IN MONGODB</span>
          </div>
          <form noValidate onSubmit={saveRecipients}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="field-label">
                To <span className="font-normal text-muted">(required)</span>
                <textarea className="field-input field-textarea" rows="3" value={emailTo} onChange={(event) => setEmailTo(event.target.value)} placeholder="name@example.com" />
                <span className="field-hint">Add one or more addresses, separated by commas.</span>
              </label>
              <label className="field-label">
                CC <span className="font-normal text-muted">(optional)</span>
                <textarea className="field-input field-textarea" rows="3" value={emailCc} onChange={(event) => setEmailCc(event.target.value)} placeholder="name@example.com" />
                <span className="field-hint">CC recipients are visible to everyone on the email.</span>
              </label>
            </div>
            <div className="mt-5 flex justify-end">
              <button className="button-secondary" type="submit" disabled={busy}>
                {busy ? <FiRefreshCw className="spin" aria-hidden="true" /> : <FiCheck aria-hidden="true" />}
                {busy ? 'Saving' : 'Save recipients'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </WorkspaceLayout>
  );
}
