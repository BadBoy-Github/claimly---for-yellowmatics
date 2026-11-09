async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
  return payload;
}

export const api = {
  health: async () => {
    const response = await fetch('/health');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok && response.status !== 503) {
      throw new Error(payload.error || `Request failed (${response.status}).`);
    }
    return payload;
  },
  getClaim: (month) => request(`/api/claims?month=${encodeURIComponent(month)}`),
  getHistory: () => request('/api/claims?history=true'),
  saveClaim: (claim) => request('/api/claims', { method: 'POST', body: JSON.stringify(claim) }),
  getSettings: () => request('/api/settings'),
  saveSettings: (settings) => request('/api/settings', { method: 'PUT', body: JSON.stringify(settings) }),
  getInsight: (month) => request('/api/assistant/insights', { method: 'POST', body: JSON.stringify({ month }) }),
  submitClaim: (id, bills) => request(`/api/claims/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify({ bills }),
  }),
};

export function monthLabel(month) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function currency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value || 0);
}
