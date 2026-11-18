import mongoose from "mongoose";

const clickSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, index: true },
    clickedAt: { type: Date, default: Date.now, index: true },
    referrer: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { versionKey: false },
);

clickSchema.index({ code: 1, clickedAt: -1 });

export const Click = mongoose.model("Click", clickSchema);
