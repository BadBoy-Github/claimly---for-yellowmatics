import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    category: { type: String, enum: ['travel', 'food'], required: true },
    mode: { type: String, enum: ['bike', 'car'], default: null },
    description: { type: String, default: '' },
    kilometers: { type: Number, default: null },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: true },
);

const billFileSchema = new mongoose.Schema(
  {
    publicId: { type: String, required: true },
    name: { type: String, required: true, maxlength: 255 },
  },
  { _id: false },
);

const claimSchema = new mongoose.Schema(
  {
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    name: { type: String, default: 'Elayabarathi M V' },
    email: { type: String, default: 'elayabarathimv@gmail.com' },
    expenses: { type: [expenseSchema], default: [] },
    billFiles: { type: [billFileSchema], default: [] },
    pdfPublicId: { type: String, default: null },
    status: { type: String, enum: ['draft', 'submitted'], default: 'draft' },
    submittedAt: { type: Date, default: null },
    submittedTo: { type: [String], default: [] },
  },
  { timestamps: true },
);

claimSchema.index({ month: 1 }, { unique: true });

export default mongoose.model('Claim', claimSchema);
