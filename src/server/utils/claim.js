import { z } from 'zod';

const expenseSchema = z.object({
  date: z.iso.date(),
  category: z.enum(['travel', 'food']),
  mode: z.enum(['bike', 'car']).nullable().optional(),
  description: z.string().trim().max(500).default(''),
  kilometers: z.number().positive().max(10000).nullable().optional(),
  amount: z.number().positive().max(10000000),
});

export const claimSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  expenses: z.array(expenseSchema).min(1).max(200),
});

export const settingsSchema = z.object({
  to: z.array(z.email()).min(1).max(20),
  cc: z.array(z.email()).max(20),
});

export function validateExpenseAmounts(expenses) {
  for (const [index, expense] of expenses.entries()) {
    if (expense.category === 'travel') {
      if (!expense.mode || !expense.kilometers) {
        return `Travel expense ${index + 1} needs a travel mode and distance.`;
      }
      const rate = expense.mode === 'bike' ? 5 : 10;
      const expected = Math.round(expense.kilometers * rate * 100) / 100;
      if (expense.amount !== expected) {
        return `Travel expense ${index + 1} amount does not match its distance and rate.`;
      }
    } else if (expense.mode || expense.kilometers) {
      return `Food expense ${index + 1} cannot include travel details.`;
    }
  }
  return null;
}
