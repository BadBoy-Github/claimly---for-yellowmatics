import { useMemo, useState } from 'react';
import { FiArrowUpRight, FiPlus } from 'react-icons/fi';
import { currency } from '../../lib/api.js';

const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

export default function ExpenseForm({ month, expense, onSave, onCancel }) {
  const [date, setDate] = useState(expense?.date ?? (today.slice(0, 7) === month ? today : `${month}-01`));
  const [category, setCategory] = useState(expense?.category ?? 'travel');
  const [mode, setMode] = useState(expense?.mode ?? 'bike');
  const [kilometers, setKilometers] = useState(expense?.kilometers?.toString() ?? '');
  const [description, setDescription] = useState(expense?.description ?? '');
  const [foodAmount, setFoodAmount] = useState(expense?.category === 'food' ? expense.amount.toString() : '');
  const amount = useMemo(() => {
    if (category === 'food') return Number(foodAmount) || 0;
    return (Number(kilometers) || 0) * (mode === 'bike' ? 5 : 10);
  }, [category, foodAmount, kilometers, mode]);

  function submit(event) {
    event.preventDefault();
    const dateParts = date.split('-').map(Number);
    const dateIsValid = dateParts.length === 3
      && dateParts.every(Number.isInteger)
      && dateParts[0] > 0
      && dateParts[1] >= 1 && dateParts[1] <= 12
      && dateParts[2] >= 1
      && dateParts[2] <= new Date(dateParts[0], dateParts[1], 0).getDate();
    if (!dateIsValid || date.slice(0, 7) !== month) {
      onSave(null, `Choose a valid date in ${month}.`);
      return;
    }
    if (category === 'travel' && (!Number.isFinite(Number(kilometers)) || Number(kilometers) <= 0 || Number(kilometers) > 10000 || !/^\d+(\.\d)?$/.test(kilometers))) {
      onSave(null, 'Enter a distance greater than zero, up to 10,000 km (one decimal place).');
      return;
    }
    if (category === 'food' && (!Number.isFinite(Number(foodAmount)) || Number(foodAmount) <= 0 || Number(foodAmount) > 10000000 || !/^\d+(\.\d{1,2})?$/.test(foodAmount))) {
      onSave(null, 'Enter a food amount greater than ₹0 and up to ₹10,000,000 (two decimal places).');
      return;
    }
    if (description.trim().length > 500) {
      onSave(null, 'Description must be 500 characters or fewer.');
      return;
    }
    onSave({
      date,
      category,
      mode: category === 'travel' ? mode : null,
      description: description.trim(),
      kilometers: category === 'travel' ? Number(kilometers) : null,
      amount: Number(amount.toFixed(2)),
    });
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field-label">
          Expense date
          <input className="field-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="field-label">
          Category
          <select className="field-input" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="travel">Travel</option>
            <option value="food">Food</option>
          </select>
        </label>
      </div>

      {category === 'travel' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field-label">
            Travel mode
            <select className="field-input" value={mode} onChange={(event) => setMode(event.target.value)}>
              <option value="bike">Bike · ₹5 / km</option>
              <option value="car">Car · ₹10 / km</option>
            </select>
          </label>
          <label className="field-label">
            Distance
            <span className="input-suffix">
              <input className="field-input" type="number" inputMode="decimal" placeholder="0" value={kilometers} onChange={(event) => setKilometers(event.target.value)} />
              <span>km</span>
            </span>
          </label>
        </div>
      ) : (
        <label className="field-label">
          Amount
          <span className="input-prefix">
            <span>₹</span>
            <input className="field-input" type="number" inputMode="decimal" placeholder="0.00" value={foodAmount} onChange={(event) => setFoodAmount(event.target.value)} />
          </span>
        </label>
      )}

      <label className="field-label">
        Description <span className="font-normal text-muted">(optional)</span>
        <input className="field-input" type="text" placeholder={category === 'travel' ? 'e.g. Client visit in Chennai' : 'e.g. Team lunch'} value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>

      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-mint/60 p-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-forest/70">Claim amount</p>
          <p className="mt-1 font-display text-2xl font-extrabold tracking-tight text-forest">{currency(amount)}</p>
        </div>
        <div className="flex items-center gap-2">
          {expense && <button className="button-secondary" type="button" onClick={onCancel}>Cancel</button>}
          <button className="button-primary" type="submit">
            {expense ? <FiArrowUpRight aria-hidden="true" /> : <FiPlus aria-hidden="true" />}
            {expense ? 'Save changes' : 'Add expense'}
            {!expense && <FiArrowUpRight className="ml-1" aria-hidden="true" />}
          </button>
        </div>
      </div>
    </form>
  );
}
