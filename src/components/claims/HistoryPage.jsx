'use client';

import { useCallback, useEffect, useState } from 'react';
import { FiArchive, FiDownload, FiFileText, FiRefreshCw } from 'react-icons/fi';
import { api, currency, monthLabel } from '../../lib/api.js';
import useToast from '../../lib/useToast.js';
import Toast from './Toast.jsx';
import WorkspaceLayout from './WorkspaceLayout.jsx';

function submittedDate(value) {
  if (!value) return 'Date unavailable';
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function HistoryPage() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const { toast, showToast, dismissToast } = useToast();

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getHistory();
      setClaims(result.claims);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    api.health()
      .then((health) => setConnected(health.database === 'connected'))
      .catch((error) => showToast(error.message, 'error'));
    loadHistory();
  }, [loadHistory, showToast]);

  return (
    <WorkspaceLayout active="history" title="Previous claims" connected={connected}>
      <Toast toast={toast} onDismiss={dismissToast} />
      <div className="content-wrap">
        <section className="hero-section">
          <div>
            <div className="eyebrow"><span className="eyebrow-dot" /> CLAIM ARCHIVE</div>
            <h1 className="hero-title">Previous claims</h1>
            <p className="hero-description">Review submitted claims and download their completed documents.</p>
          </div>
          <button type="button" className="button-secondary" onClick={loadHistory} disabled={loading}>
            <FiRefreshCw className={loading ? 'spin' : ''} aria-hidden="true" />
            Refresh
          </button>
        </section>

        <section className="panel history-panel">
          <div className="panel-header">
            <div className="heading-with-icon">
              <div className="section-icon"><FiArchive aria-hidden="true" /></div>
              <div>
                <h2 className="panel-title">Submitted claims</h2>
                <p className="panel-subtitle">{claims.length} {claims.length === 1 ? 'claim' : 'claims'} in your archive</p>
              </div>
            </div>
          </div>

          {loading && <div className="empty-state"><FiRefreshCw className="spin" aria-hidden="true" /><p className="mt-3 text-sm text-muted">Loading submitted claims…</p></div>}
          {!loading && !claims.length && (
            <div className="empty-state">
              <div className="empty-icon"><FiArchive aria-hidden="true" /></div>
              <p className="font-semibold text-ink">No submitted claims yet</p>
              <p className="mt-1 text-sm text-muted">Claims you send will appear here.</p>
            </div>
          )}
          {!loading && claims.length > 0 && (
            <div className="history-list">
              {claims.map((claim) => {
                const total = claim.expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
                return (
                  <article className="history-item" key={claim._id}>
                    <div className="history-item-icon"><FiFileText aria-hidden="true" /></div>
                    <div className="history-item-copy">
                      <h3>{monthLabel(claim.month)} claim</h3>
                      <p>Submitted {submittedDate(claim.submittedAt)} · {claim.expenses.length} {claim.expenses.length === 1 ? 'expense' : 'expenses'}</p>
                    </div>
                    <strong className="history-total">{currency(total)}</strong>
                    <div className="history-downloads">
                      <a href={`/api/claims/${claim._id}/export.xlsx`} aria-label={`Download ${monthLabel(claim.month)} claim Excel`}><FiDownload aria-hidden="true" /><span>Excel</span></a>
                      <a href={`/api/claims/${claim._id}/export.pdf`} aria-label={`Download ${monthLabel(claim.month)} claim PDF`}><FiDownload aria-hidden="true" /><span>PDF</span></a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </WorkspaceLayout>
  );
}
