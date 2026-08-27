const express = require("express");
const router = express.Router();

const { updateIssueStatus, getStats } = require("../controllers/adminController");
const { protect, adminOnly } = require("../middleware/auth");

// NOTE on paths: the API contract has PATCH /api/issues/:id/status living
// under the *issues* base path, not /api/admin — so this router expects to
// be mounted twice in server.js (or split), e.g.:
//
//   app.use("/api/issues", issueRoutes);   // Aradhya's router
//   app.use("/api/issues", adminRoutes);   // this router, adds the status route
//   app.use("/api/admin", adminRoutes);    // this router, adds /stats
//
// If issueRoutes already owns /:id/status as a stub, delete that line there
// instead of double-registering it — Express will use whichever matches
// first and a duplicate route is a silent bug waiting to happen.

// PATCH /api/issues/:id/status — admin only
router.patch("/:id/status", protect, adminOnly, updateIssueStatus);

// GET /api/admin/stats — admin only
router.get("/stats", protect, adminOnly, getStats);

module.exports = router;