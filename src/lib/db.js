import mongoose from 'mongoose';

const cache = globalThis.mongooseCache ?? { connection: null, promise: null };
globalThis.mongooseCache = cache;

export default async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!process.env.MONGODB_URI) {
    const error = new Error('MONGODB_URI is not configured.');
    error.status = 503;
    throw error;
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(process.env.MONGODB_URI).then((connection) => {
      cache.connection = connection;
      return connection;
    }).catch((error) => {
      cache.promise = null;
      throw error;
    });
  }

  try {
    await cache.promise;
  } catch (cause) {
    const error = new Error('Unable to connect to MongoDB.', { cause });
    error.status = 503;
    throw error;
  }

  return cache.connection;
}
