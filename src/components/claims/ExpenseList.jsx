import { FiArrowUpRight, FiCoffee, FiEdit2, FiTrash2, FiTruck } from 'react-icons/fi';
import { currency } from '../../lib/api.js';

export default function ExpenseList({ expenses, onEdit, onRemove, readOnly = false }) {
  if (!expenses.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><FiArrowUpRight aria-hidden="true" /></div>
        <p className="font-semibold text-ink">Nothing here yet</p>
        <p className="mt-1 text-sm text-muted">Your monthly expenses will appear here.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-line">
      {expenses.map((expense, index) => {
        const isTravel = expense.category === 'travel';
        const Icon = isTravel ? FiTruck : FiCoffee;
        return (
          <div className="flex items-center gap-3 py-4 first:pt-0 last:pb-0" key={expense._id || `${expense.date}-${index}`}>
            <div className={`expense-icon ${isTravel ? 'bg-mint text-forest' : 'bg-orange-50 text-tangerine'}`}><Icon aria-hidden="true" /></div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{expense.description || (isTravel ? `${expense.mode} travel` : 'Food expense')}</p>
              <p className="mt-1 text-xs capitalize text-muted">
                {new Date(`${expense.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                <span className="px-1.5">·</span>
                {isTravel ? `${expense.kilometers} km · ${expense.mode}` : 'Food'}
              </p>
            </div>
            <p className="whitespace-nowrap text-sm font-bold text-ink">{currency(expense.amount)}</p>
            {!readOnly && (
              <>
                <button type="button" className="icon-button ml-1" onClick={() => onEdit(index)} aria-label={`Edit ${expense.description || expense.category} expense`}>
                  <FiEdit2 aria-hidden="true" />
                </button>
                <button type="button" className="icon-button" onClick={() => onRemove(index)} aria-label={`Remove ${expense.description || expense.category} expense`}>
                  <FiTrash2 aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
