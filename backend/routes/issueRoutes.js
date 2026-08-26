const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const upload = require("../utils/upload");

const {
  checkDuplicate,
  createIssue,
  getIssues,
  getIssueById,
  upvoteIssue,
  getMyReports,
  deleteIssue,
} = require("../controllers/issueController");

router.get("/my-reports", protect, getMyReports);
router.post("/check-duplicate", protect, checkDuplicate);

router.get("/", getIssues);
router.get("/:id", getIssueById);
router.post("/", protect, upload.single("photo"), createIssue);
router.post("/:id/upvote", protect, upvoteIssue);
router.delete("/:id", protect, deleteIssue);

module.exports = router;