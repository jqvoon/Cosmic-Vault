import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  googleId: { type: String },
  githubId: { type: String },
  name: { type: String, required: true },
  email: { type: String, sparse: true, unique: true }, // github may not provide email
  avatar: { type: String },
}, { timestamps: true });

export const Users = mongoose.model('Users', userSchema);
