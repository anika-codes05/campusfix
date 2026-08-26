const Issue = require("../models/Issue");
const { getDistanceInMeters } = require("../utils/geoDistance");

const DUPLICATE_RADIUS_METERS = 50;

// Shared helper: find open issues near a location with the same category
const findNearbyDuplicates = async (lat, lng, category) => {
  // Narrow down with a rough bounding box first (cheap), then precisely
  // filter with Haversine (accurate) — avoids scanning the whole collection.
  const latDelta = 0.0006; // ~65m buffer
  const lngDelta = 0.0006;

  const candidates = await Issue.find({
    category,
    status: { $ne: "resolved" },
    "location.lat": { $gte: lat - latDelta, $lte: lat + latDelta },
    "location.lng": { $gte: lng - lngDelta, $lte: lng + lngDelta },
  });

  return candidates.filter(
    (issue) =>
      getDistanceInMeters(lat, lng, issue.location.lat, issue.location.lng) <=
      DUPLICATE_RADIUS_METERS
  );
};

// POST /api/issues/check-duplicate
// Called BEFORE final submit so the frontend can ask "is this the same as X?"
const checkDuplicate = async (req, res) => {
  try {
    const { lat, lng, category } = req.body;

    if (lat === undefined || lng === undefined || !category) {
      return res.status(400).json({ message: "lat, lng, and category are required" });
    }

    const matches = await findNearbyDuplicates(lat, lng, category);

    res.json({
      hasDuplicates: matches.length > 0,
      matches: matches.map((m) => ({
        _id: m._id,
        title: m.title,
        category: m.category,
        upvoteCount: m.upvotes.length,
        status: m.status,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/issues
// Creates a new issue, OR joins an existing one if joinExistingId is passed
// (i.e. the student confirmed "yes, this is the same issue")
const createIssue = async (req, res) => {
  try {
    const { title, description, category, lat, lng, blockName, joinExistingId } = req.body;
    const photoUrl = req.file ? `/uploads/${req.file.filename}` : "";

    if (joinExistingId) {
      const existing = await Issue.findById(joinExistingId);
      if (!existing) {
        return res.status(404).json({ message: "Issue to join not found" });
      }
      if (!existing.reportedBy.includes(req.user._id)) {
        existing.reportedBy.push(req.user._id);
      }
      if (!existing.upvotes.includes(req.user._id)) {
        existing.upvotes.push(req.user._id);
      }
      await existing.save();
      return res.status(200).json({ message: "Joined existing issue", issue: existing });
    }

    if (!title || !description || !category || lat === undefined || lng === undefined) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const issue = await Issue.create({
      title,
      description,
      category,
      location: { lat, lng, blockName },
      photoUrl,
      reportedBy: [req.user._id],
      upvotes: [req.user._id], // reporter auto-upvotes their own report
    });

    res.status(201).json(issue);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/issues?category=&status=&sort=upvotes
const getIssues = async (req, res) => {
  try {
    const { category, status, sort } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (status) filter.status = status;

    let query = Issue.find(filter).populate("reportedBy", "name email");

    if (sort === "upvotes") {
      // Sorting by array length needs aggregation; simple approach below
      const issues = await query;
      issues.sort((a, b) => b.upvotes.length - a.upvotes.length);
      return res.json(issues);
    }

    const issues = await query.sort({ createdAt: -1 });
    res.json(issues);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/issues/:id
const getIssueById = async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id).populate("reportedBy", "name email");
    if (!issue) return res.status(404).json({ message: "Issue not found" });
    res.json(issue);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/issues/:id/upvote
const upvoteIssue = async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ message: "Issue not found" });

    const alreadyUpvoted = issue.upvotes.includes(req.user._id);
    if (alreadyUpvoted) {
      issue.upvotes = issue.upvotes.filter((id) => id.toString() !== req.user._id.toString());
    } else {
      issue.upvotes.push(req.user._id);
    }

    await issue.save();
    res.json({ upvoteCount: issue.upvotes.length, upvoted: !alreadyUpvoted });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/issues/my-reports
const getMyReports = async (req, res) => {
  try {
    const issues = await Issue.find({ reportedBy: req.user._id }).sort({ createdAt: -1 });
    res.json(issues);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/issues/:id
const deleteIssue = async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ message: "Issue not found" });

    const isOwner = issue.reportedBy.some((id) => id.toString() === req.user._id.toString());
    if (!isOwner && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to delete this issue" });
    }

    await issue.deleteOne();
    res.json({ message: "Issue deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  checkDuplicate,
  createIssue,
  getIssues,
  getIssueById,
  upvoteIssue,
  getMyReports,
  deleteIssue,
};
