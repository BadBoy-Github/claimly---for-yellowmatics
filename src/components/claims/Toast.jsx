'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { FiAlertCircle, FiCheckCircle, FiX } from 'react-icons/fi';

export default function Toast({ toast, onDismiss }) {
  return (
    <div className="toast-region" aria-live="polite" aria-atomic="true">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            className={`toast toast-${toast.type}`}
            role={toast.type === 'error' ? 'alert' : 'status'}
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
          >
            {toast.type === 'error' ? <FiAlertCircle aria-hidden="true" /> : <FiCheckCircle aria-hidden="true" />}
            <span>{toast.message}</span>
            <button type="button" onClick={onDismiss} aria-label="Dismiss notification"><FiX aria-hidden="true" /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
