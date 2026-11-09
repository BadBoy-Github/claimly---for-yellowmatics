'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiArrowLeft,
  FiArrowRight,
  FiArrowUpRight,
  FiCheck,
  FiFileText,
  FiFolder,
  FiLock,
  FiMail,
  FiPlus,
  FiRefreshCw,
  FiSend,
  FiShield,
  FiStar,
  FiUploadCloud,
  FiX,
} from 'react-icons/fi';
import { api, currency, monthLabel } from '../../lib/api.js';
import useToast from '../../lib/useToast.js';
import BlurText from './BlurText.jsx';
import ExpenseForm from './ExpenseForm.jsx';
import ExpenseList from './ExpenseList.jsx';
import Toast from './Toast.jsx';
import WorkspaceLayout from './WorkspaceLayout.jsx';
const currentMonth = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};
function Dashboard() {
  const [month, setMonth] = useState(currentMonth);
  const [expenses, setExpenses] = useState([]);
  const [claimId, setClaimId] = useState(null);
  const [claimStatus, setClaimStatus] = useState('draft');
  const [files, setFiles] = useState([]);
  const [health, setHealth] = useState(null);
  const [busy, setBusy] = useState(false);
  const [insight, setInsight] = useState('');
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [editingIndex, setEditingIndex] = useState(null);
  const { toast, showToast, dismissToast } = useToast();

  const total = useMemo(() => expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0), [expenses]);
  const travelTotal = useMemo(() => expenses.filter((item) => item.category === 'travel').reduce((sum, item) => sum + Number(item.amount || 0), 0), [expenses]);
  const foodTotal = useMemo(() => expenses.filter((item) => item.category === 'food').reduce((sum, item) => sum + Number(item.amount || 0), 0), [expenses]);

  const loadData = useCallback(async (selectedMonth) => {
    let service;
    try {
      service = await api.health();
      setHealth(service);
    } catch (healthError) {
      setHealth({ status: 'degraded', database: 'disconnected' });
      showToast(healthError.message, 'error');
      setExpenses([]);
      setClaimId(null);
      setClaimStatus('draft');
      return;
    }
    if (service.database !== 'connected') {
      setExpenses([]);
      setClaimId(null);
      setClaimStatus('draft');
      setFiles([]);
      setFileInputKey((key) => key + 1);
      setInsight('');
      setEditingIndex(null);
      return;
    }
    try {
      const { claim } = await api.getClaim(selectedMonth);
      setExpenses(claim?.expenses ?? []);
      setClaimId(claim?._id ?? null);
      setClaimStatus(claim?.status ?? 'draft');
    } catch (requestError) {
      showToast(requestError.message, 'error');
      setExpenses([]);
      setClaimId(null);
      setClaimStatus('draft');
    }
    setFiles([]);
    setFileInputKey((key) => key + 1);
    setInsight('');
    setEditingIndex(null);
  }, [showToast]);

  useEffect(() => {
    loadData(month);
  }, [month, loadData]);

  function saveExpense(expense, message) {
    if (message) {
      showToast(message, 'error');
      return;
    }
    if (editingIndex === null) {
      setExpenses((items) => [...items, expense]);
      showToast('Expense added to this month.');
    } else {
      setExpenses((items) => items.map((item, index) => index === editingIndex ? { ...item, ...expense } : item));
      setEditingIndex(null);
      showToast('Expense updated.');
    }
    setClaimStatus('draft');
  }

  function changeMonth(direction) {
    const date = new Date(`${month}-01T12:00:00`);
    date.setMonth(date.getMonth() + direction);
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    setEditingIndex(null);
  }

  async function saveClaim(showMessage = true) {
    if (!expenses.length) throw new Error('Add at least one expense before saving this claim.');
    const result = await api.saveClaim({ month, expenses });
    setClaimId(result.claim._id);
    setClaimStatus(result.claim.status);
    if (showMessage) showToast('Your claim is saved.');
    return result.claim;
  }

  async function handleSave() {
    setBusy(true);
    try {
      await saveClaim();
    } catch (requestError) {
      showToast(requestError.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    setBusy(true);
    try {
      if (!files.length) throw new Error('Attach at least one bill PDF before sending the claim.');
      const claim = await saveClaim(false);
      const bills = await Promise.all(files.map(async (file) => {
        const uploadInfo = await api.createBillUpload(claim._id, file);
        const formData = new FormData();
        formData.set('file', file);
        for (const [key, value] of Object.entries(uploadInfo)) {
          if (!['publicId', 'upload_url', 'cloud_name', 'resource_type', 'name'].includes(key)) {
            formData.set(key, String(value));
          }
        }
        const response = await fetch(uploadInfo.upload_url, {
          method: 'POST',
          body: formData,
        });
        const uploaded = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(uploaded.error?.message || `Cloudinary rejected ${file.name} (HTTP ${response.status}).`);
        }
        if (
          uploaded.public_id !== uploadInfo.public_id
          || uploaded.resource_type !== 'image'
          || uploaded.type !== 'authenticated'
          || uploaded.format !== 'pdf'
          || uploaded.bytes > 10 * 1024 * 1024
        ) {
          throw new Error(`Cloudinary did not store ${file.name} as a valid private PDF.`);
        }
        return { publicId: uploaded.public_id, name: file.name };
      }));
      await api.submitClaim(claim._id, bills);
      setClaimStatus('submitted');
      showToast('Claim email sent successfully.');
      setFiles([]);
      setFileInputKey((key) => key + 1);
    } catch (requestError) {
      showToast(requestError.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleInsight() {
    setLoadingInsight(true);
    setInsight('');
    try {
      if (!claimId) await saveClaim(false);
      const result = await api.getInsight(month);
      setInsight(result.insight || 'No summary was returned.');
    } catch (requestError) {
      showToast(requestError.message, 'error');
    } finally {
      setLoadingInsight(false);
    }
  }

  function updateFiles(fileList) {
    const selected = Array.from(fileList || []);
    const invalid = selected.find((file) => file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf'));
    if (invalid) {
      showToast(`${invalid.name} is not a PDF file.`, 'error');
      setFiles([]);
      setFileInputKey((key) => key + 1);
      return;
    }
    const tooLarge = selected.find((file) => file.size > 10 * 1024 * 1024);
    if (tooLarge) {
      showToast(`${tooLarge.name} is larger than the 10 MB per-file limit.`, 'error');
      setFiles([]);
      setFileInputKey((key) => key + 1);
      return;
    }
    if (selected.length > 5) {
      showToast('You can attach up to five bill PDFs.', 'error');
      setFiles([]);
      setFileInputKey((key) => key + 1);
      return;
    }
    setFiles(selected);
    if (selected.length) showToast(`${selected.length} bill${selected.length === 1 ? '' : 's'} ready to upload.`);
  }

  const monthStatus = claimStatus === 'submitted' ? 'Submitted' : claimId ? 'Saved draft' : 'Draft';
  const apiReady = health?.database === 'connected';

  return (
    <WorkspaceLayout active="claims" title="Monthly claim" connected={apiReady}>
      <Toast toast={toast} onDismiss={dismissToast} />
      <div className="content-wrap" id="overview">
          <section className="hero-section">
            <div>
              <div className="eyebrow"><span className="eyebrow-dot" /> MONTHLY EXPENSES</div>
              <div className="hero-title"><BlurText text="Good to see you, Elayabarathi." className="!flex" /></div>
              <p className="hero-description">A clear view of your expenses, ready when you are.</p>
            </div>
            <div className="month-picker">
              <button type="button" className="month-arrow" aria-label="Previous month" onClick={() => changeMonth(-1)}><FiArrowLeft aria-hidden="true" /></button>
              <label>
                <span className="sr-only">Claim month</span>
                <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
              </label>
              <button type="button" className="month-arrow" aria-label="Next month" onClick={() => changeMonth(1)}><FiArrowRight aria-hidden="true" /></button>
            </div>
          </section>

          <AnimatePresence mode="wait">
            {!apiReady && (
              <motion.div className="setup-alert" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <FiLock aria-hidden="true" />
                <div>
                  <p className="font-bold">Connect the backend to save and send claims</p>
                  <p className="mt-1 text-sm text-muted">Set <code>MONGODB_URI</code> in <code>.env.local</code> for local development or in Vercel Environment Variables.</p>
                </div>
                <button className="icon-button ml-auto" onClick={() => loadData(month)} aria-label="Retry connection"><FiRefreshCw aria-hidden="true" /></button>
              </motion.div>
            )}
          </AnimatePresence>
          {health?.template === 'missing' && (
            <div className="setup-alert setup-alert-neutral">
              <FiFileText aria-hidden="true" />
              <div>
                <p className="font-bold">Add your claim workbook</p>
                <p className="mt-1 text-sm text-muted">Place the Excel template at <code>public/claim-template.xlsx</code> to enable exports and email submission.</p>
              </div>
            </div>
          )}
          {apiReady && health?.storage !== 'configured' && (
            <div className="setup-alert">
              <FiLock aria-hidden="true" />
              <div>
                <p className="font-bold">Cloudinary is not configured</p>
                <p className="mt-1 text-sm text-muted">Set <code>CLOUDINARY_CLOUD_NAME</code>, <code>CLOUDINARY_API_KEY</code>, and <code>CLOUDINARY_API_SECRET</code> in your environment.</p>
              </div>
            </div>
          )}
          {apiReady && health?.email !== 'configured' && (
            <div className="setup-alert">
              <FiMail aria-hidden="true" />
              <div>
                <p className="font-bold">Email sending is not configured</p>
                <p className="mt-1 text-sm text-muted">Set <code>GMAIL_APP_PASSWORD</code> in your environment variables to send claims.</p>
              </div>
            </div>
          )}
          {apiReady && health?.gemini !== 'configured' && (
            <div className="setup-alert setup-alert-neutral">
              <FiStar aria-hidden="true" />
              <div>
                <p className="font-bold">Gemini assistant is not configured</p>
                <p className="mt-1 text-sm text-muted">Set <code>GEMINI_API_KEY</code> in your environment variables to enable claim reviews.</p>
              </div>
            </div>
          )}

          <section className="summary-grid" aria-label={`${monthLabel(month)} claim summary`}>
            <div className="summary-card summary-total">
              <div className="summary-top"><span>Total claim</span><span className="summary-icon"><FiArrowUpRight aria-hidden="true" /></span></div>
              <p className="summary-amount">{currency(total)}</p>
              <p className="summary-caption">{monthLabel(month)}</p>
              <div className="total-accent"><span /></div>
            </div>
            <div className="summary-card">
              <div className="summary-top"><span>Travel</span><span className="summary-icon summary-icon-green"><FiArrowRight aria-hidden="true" /></span></div>
              <p className="summary-amount">{currency(travelTotal)}</p>
              <p className="summary-caption">{expenses.filter((item) => item.category === 'travel').length} travel {expenses.filter((item) => item.category === 'travel').length === 1 ? 'expense' : 'expenses'}</p>
            </div>
            <div className="summary-card">
              <div className="summary-top"><span>Food</span><span className="summary-icon summary-icon-orange"><FiArrowRight aria-hidden="true" /></span></div>
              <p className="summary-amount">{currency(foodTotal)}</p>
              <p className="summary-caption">{expenses.filter((item) => item.category === 'food').length} food {expenses.filter((item) => item.category === 'food').length === 1 ? 'expense' : 'expenses'}</p>
            </div>
            <div className="summary-card">
              <div className="summary-top"><span>Claim status</span><span className={`status-badge ${claimStatus === 'submitted' ? 'status-done' : ''}`}><span />{monthStatus}</span></div>
              <p className="status-heading">{claimStatus === 'submitted' ? 'On its way' : claimId ? 'Saved securely' : 'In progress'}</p>
              <p className="summary-caption">{claimStatus === 'submitted' ? 'Email successfully sent' : 'Save as you go'}</p>
            </div>
          </section>

          <div className="workspace-grid">
            <section className="panel expense-panel" id="expenses">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">{editingIndex === null ? 'Add an expense' : 'Edit expense'}</h2>
                  <p className="panel-subtitle">A few details and it’s done.</p>
                </div>
                <span className="panel-chip">{editingIndex === null ? <><FiPlus aria-hidden="true" /> NEW ITEM</> : 'EDITING ITEM'}</span>
              </div>
              {claimStatus === 'submitted' ? (
                <p className="field-hint">This claim has been submitted and can no longer be changed.</p>
              ) : (
                <ExpenseForm
                  key={`${month}-${editingIndex ?? 'new'}`}
                  month={month}
                  expense={editingIndex === null ? null : expenses[editingIndex]}
                  onSave={saveExpense}
                  onCancel={() => setEditingIndex(null)}
                />
              )}
            </section>

            <section className="panel list-panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Your expenses</h2>
                  <p className="panel-subtitle">{expenses.length} {expenses.length === 1 ? 'item' : 'items'} for {monthLabel(month)}</p>
                </div>
                <button className="icon-button" aria-label="Refresh expenses" onClick={() => loadData(month)}><FiRefreshCw aria-hidden="true" /></button>
              </div>
              <ExpenseList
                expenses={expenses}
                readOnly={claimStatus === 'submitted'}
                onEdit={(index) => {
                  setEditingIndex(index);
                  document.getElementById('expenses')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                onRemove={(index) => {
                  setExpenses((items) => items.filter((_, itemIndex) => itemIndex !== index));
                  setClaimStatus('draft');
                  showToast('Expense removed.');
                }}
              />
              <div className="list-footer">
                <span>Monthly total</span>
                <strong>{currency(total)}</strong>
              </div>
            </section>
          </div>

          <section className="assistant-card">
              <div className="assistant-orb"><FiStar aria-hidden="true" /></div>
              <div className="assistant-copy">
                <span className="assistant-kicker">GEMINI CLAIM ASSISTANT</span>
                <h2>One more set of eyes.</h2>
                <p>Get a brief summary and a check for obvious missing details.</p>
              </div>
              <button className="assistant-button" onClick={handleInsight} disabled={loadingInsight || !expenses.length || !apiReady || health?.gemini !== 'configured'}>
                {loadingInsight ? <FiRefreshCw className="spin" aria-hidden="true" /> : <FiStar aria-hidden="true" />}
                {loadingInsight ? 'Reviewing' : 'Review claim'}
              </button>
              {insight && <p className="assistant-insight">{insight}</p>}
          </section>

          <section className="panel submit-panel">
            <div className="panel-header submit-header">
              <div className="heading-with-icon">
                <div className="section-icon section-icon-orange"><FiFolder aria-hidden="true" /></div>
                <div><h2 className="panel-title">Bills & submission</h2><p className="panel-subtitle">Attach your receipts and send the completed claim.</p></div>
              </div>
              <div className="file-format-note"><FiFileText aria-hidden="true" /> PDF only · up to 5 files · 10 MB each</div>
            </div>
            <div className="submit-content">
              <div className="upload-area">
                <input key={fileInputKey} id="bill-files" className="sr-only" type="file" accept="application/pdf,.pdf" multiple onChange={(event) => updateFiles(event.target.files)} />
                <label htmlFor="bill-files" className="upload-label">
                  <span className="upload-icon"><FiUploadCloud aria-hidden="true" /></span>
                  <span className="upload-title">Choose bill PDFs</span>
                  <span className="upload-caption">or browse files from your device</span>
                </label>
                {files.length > 0 && <div className="file-list">{files.map((file) => <div key={`${file.name}-${file.lastModified}`}><FiFileText aria-hidden="true" /><span>{file.name}</span><button aria-label={`Remove ${file.name}`} onClick={() => setFiles((items) => items.filter((item) => item !== file))}><FiX aria-hidden="true" /></button></div>)}</div>}
              </div>
              <div className="submit-actions">
                <p className="recipient-preview"><FiMail aria-hidden="true" /><span>Recipients are managed in <a href="/settings">Email settings</a>.</span></p>
                <div className="button-row">
                  <button className="button-secondary" onClick={handleSave} disabled={busy || !apiReady || claimStatus === 'submitted'}>
                    {busy ? <FiRefreshCw className="spin" aria-hidden="true" /> : <FiCheck aria-hidden="true" />}
                    Save claim
                  </button>
                  <button className="button-submit" onClick={handleSubmit} disabled={busy || !apiReady || !expenses.length || claimStatus === 'submitted' || health?.template !== 'available' || health?.email !== 'configured' || health?.storage !== 'configured'}>
                    {busy ? <FiRefreshCw className="spin" aria-hidden="true" /> : <FiSend aria-hidden="true" />}
                    {claimStatus === 'submitted' ? 'Submitted' : 'Send claim'}
                  </button>
                </div>
                {claimId && <div className="export-links"><a href={`/api/claims/${claimId}/export.xlsx`} target="_blank" rel="noreferrer">Download Excel</a><a href={`/api/claims/${claimId}/export.pdf`} target="_blank" rel="noreferrer">Download PDF</a></div>}
              </div>
            </div>
          </section>

          <footer className="page-footer"><span>Made for a calmer claim day.</span><span><FiLock aria-hidden="true" /> Private workspace</span></footer>
        </div>
    </WorkspaceLayout>
  );
}

export function ErrorPage({ forbidden = false }) {
  return (
    <main className="error-page">
      <div className="error-card">
        <div className="error-icon">{forbidden ? <FiShield aria-hidden="true" /> : <FiFileText aria-hidden="true" />}</div>
        <span className="eyebrow">{forbidden ? '403 · ACCESS RESTRICTED' : '404 · PAGE NOT FOUND'}</span>
        <h1>{forbidden ? 'This page is off limits.' : 'Looks like a wrong turn.'}</h1>
        <p>{forbidden ? 'You don’t have permission to view this page.' : 'The page you’re looking for doesn’t exist or has moved.'}</p>
        <a className="button-primary" href="/"><FiArrowLeft aria-hidden="true" /> Back to dashboard</a>
      </div>
    </main>
  );
}

export default function App() {
  return <Dashboard />;
}
