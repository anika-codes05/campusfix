const mongoose = require("mongoose");

const issueSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ["electrical", "plumbing", "mess", "infrastructure", "other"],
      required: true,
    },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      blockName: { type: String, trim: true },
    },
    photoUrl: {
      type: String,
      default: "",
    },
    reportedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    upvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    status: {
      type: String,
      enum: ["reported", "in_progress", "resolved"],
      default: "reported",
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Helpful for duplicate-detection radius queries later
issueSchema.index({ "location.lat": 1, "location.lng": 1 });

module.exports = mongoose.model("Issue", issueSchema);
