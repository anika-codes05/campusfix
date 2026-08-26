const Issue = require("../models/Issue");

// Valid values, kept in one place so the route and any future validation
// (e.g. a Mongoose enum) can't drift apart.
const VALID_STATUSES = ["reported", "in_progress", "resolved"];
const CATEGORIES = ["electrical", "plumbing", "mess", "infrastructure", "other"];

/**
 * PATCH /api/issues/:id/status
 * Admin only. Body: { status: 'reported' | 'in_progress' | 'resolved' }
 *
 * Updates an issue's status. Sets resolvedAt to now when status becomes
 * 'resolved', and clears it back to null for any other status (covers the
 * case where an admin accidentally resolves an issue and reopens it).
 */
exports.updateIssueStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "status is required" });
    }

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
      });
    }

    // findById first (rather than a blind findByIdAndUpdate) so we can
    // return a clean 404 instead of a null-shaped 200.
    const issue = await Issue.findById(id);

    if (!issue) {
      return res.status(404).json({ message: "Issue not found" });
    }

    issue.status = status;
    issue.resolvedAt = status === "resolved" ? new Date() : null;

    await issue.save();

    // Populate reportedBy the same way the list/detail routes do, so the
    // frontend gets a consistent Issue shape back regardless of which
    // endpoint it came from.
    await issue.populate("reportedBy", "name email");

    return res.status(200).json(issue);
  } catch (err) {
    // Malformed ObjectId (e.g. a truncated or garbage :id) lands here as a
    // CastError — treat it as a 400, not a 500.
    if (err.name === "CastError") {
      return res.status(400).json({ message: "Invalid issue id" });
    }
    console.error("updateIssueStatus error:", err);
    return res.status(500).json({ message: "Server error updating issue status" });
  }
};

/**
 * GET /api/admin/stats
 * Admin only.
 *
 * Returns:
 * {
 *   open: number,          // status === 'reported'
 *   inProgress: number,    // status === 'in_progress'
 *   resolved: number,      // status === 'resolved'
 *   total: number,
 *   byCategory: {
 *     electrical: { open, inProgress, resolved, total },
 *     plumbing:   { ... },
 *     mess:       { ... },
 *     infrastructure: { ... },
 *     other:      { ... }
 *   }
 * }
 *
 * byCategory is additive — open/inProgress/resolved/total stay at the top
 * level exactly as the dashboard already expects, so existing frontend code
 * doesn't need to change to keep working.
 */
exports.getStats = async (req, res) => {
  try {
    // Single aggregation grouping by category + status, rather than one
    // query per category — scales fine as issue volume grows and avoids
    // 5 separate round-trips to Mongo.
    const grouped = await Issue.aggregate([
      {
        $group: {
          _id: { category: "$category", status: "$status" },
          count: { $sum: 1 },
        },
      },
    ]);

    const byCategory = {};
    for (const cat of CATEGORIES) {
      byCategory[cat] = { open: 0, inProgress: 0, resolved: 0, total: 0 };
    }

    let open = 0;
    let inProgress = 0;
    let resolved = 0;
    let total = 0;

    for (const row of grouped) {
      const { category, status } = row._id;
      const count = row.count;

      // Guard against an unexpected/legacy category value rather than
      // throwing on a stats read — surface it in the response instead.
      if (!byCategory[category]) {
        byCategory[category] = { open: 0, inProgress: 0, resolved: 0, total: 0 };
      }

      total += count;
      byCategory[category].total += count;

      if (status === "reported") {
        open += count;
        byCategory[category].open += count;
      } else if (status === "in_progress") {
        inProgress += count;
        byCategory[category].inProgress += count;
      } else if (status === "resolved") {
        resolved += count;
        byCategory[category].resolved += count;
      }
    }

    return res.status(200).json({ open, inProgress, resolved, total, byCategory });
  } catch (err) {
    console.error("getStats error:", err);
    return res.status(500).json({ message: "Server error fetching stats" });
  }
};