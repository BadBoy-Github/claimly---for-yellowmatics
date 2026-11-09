import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: 'default' },
    to: { type: [String], default: ['elayabarathiedison@gmail.com'] },
    cc: { type: [String], default: ['mvelayabarathi@gmail.com'] },
  },
  { timestamps: true },
);

export default mongoose.model('Settings', settingsSchema);
