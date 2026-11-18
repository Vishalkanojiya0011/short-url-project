import mongoose from "mongoose";

const urlSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    destination: { type: String, required: true },
    ownerTokenHash: { type: String, required: true, select: false },
    createdAt: { type: Date, default: Date.now, immutable: true },
  },
  { versionKey: false },
);

export const Url = mongoose.model("Url", urlSchema);
