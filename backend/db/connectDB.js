import mongoose from 'mongoose';
import { createLogger } from "../utils/logger.js";

const logger = createLogger("db");

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('MongoDB connected');
  } catch (err) {
    logger.error('MongoDB connection error:', err.message);
  }
};
