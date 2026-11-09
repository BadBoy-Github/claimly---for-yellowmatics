import mongoose from 'mongoose';

const loginAttemptSchema = new mongoose.Schema(
  {
    _id: { type: String },
    windowStartedAt: Date,
    attempts: Number,
    lockedUntil: Date,
    expiresAt: Date,
  },
  { versionKey: false },
);

loginAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.LoginAttempt || mongoose.model('LoginAttempt', loginAttemptSchema);
