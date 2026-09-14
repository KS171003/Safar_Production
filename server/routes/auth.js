const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Bus = require("../models/Bus");
const { authenticateToken } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const { validate, schemas } = require("../middleware/validate");
const { authLimiter } = require("../middleware/rateLimiter");
const logger = require("../utils/logger");

const router = express.Router();

// Helper to hash token before storing in MongoDB
const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

// Helper to generate access & refresh token pair
const generateTokens = (user, familyId = null) => {
  const token = jwt.sign(
    {
      userId: user._id,
      userType: user.userType,
      tokenVersion: user.tokenVersion || 0,
    },
    process.env.JWT_SECRET,
    { expiresIn: "15m" } // Short-lived access token
  );

  const rawRefreshToken = crypto.randomBytes(40).toString("hex");
  const tokenHash = hashToken(rawRefreshToken);
  const activeFamilyId = familyId || crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  return {
    token,
    refreshToken: rawRefreshToken,
    tokenRecord: {
      tokenHash,
      familyId: activeFamilyId,
      expiresAt,
      createdAt: new Date(),
    },
  };
};

/**
 * POST /api/auth/register
 * Register passenger, conductor, dispatcher, or admin
 */
router.post(
  "/register",
  authLimiter,
  validate(schemas.register),
  asyncHandler(async (req, res) => {
    const { email, password, name, phone, userType, busNumber } = req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "User already exists with this email" });
    }

    const user = new User({
      email: email.toLowerCase(),
      password,
      name,
      phone,
      userType,
    });

    await user.save();

    // If conductor, associate a bus
    if (userType === "conductor" && busNumber) {
      const bus = new Bus({
        busNumber,
        conductorId: user._id,
        routeId: null,
      });
      await bus.save();

      user.busId = bus._id;
      await user.save();
    }

    const { token, refreshToken, tokenRecord } = generateTokens(user);
    user.refreshTokens.push(tokenRecord);
    await user.save();

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        userType: user.userType,
        busId: user.busId,
      },
    });
  })
);

/**
 * POST /api/auth/login
 * Authenticate user with account locking protection
 */
router.post(
  "/login",
  authLimiter,
  validate(schemas.login),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid email or password" });
    }

    if (user.isLocked()) {
      const remainingMinutes = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        message: `Account is temporarily locked due to repeated failed login attempts. Try again in ${remainingMinutes} minute(s).`,
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await user.incLoginAttempts();
      return res.status(400).json({ success: false, message: "Invalid email or password" });
    }

    await user.resetLoginAttempts();

    const { token, refreshToken, tokenRecord } = generateTokens(user);

    // Prune expired refresh tokens
    user.refreshTokens = user.refreshTokens.filter((rt) => rt.expiresAt > new Date());
    user.refreshTokens.push(tokenRecord);
    await user.save();

    res.json({
      success: true,
      message: "Login successful",
      token,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        userType: user.userType,
        busId: user.busId,
      },
    });
  })
);

/**
 * POST /api/auth/refresh-token
 * Rotate refresh token with token reuse and theft detection
 */
router.post(
  "/refresh-token",
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ success: false, message: "Refresh token is required" });
    }

    const hashed = hashToken(refreshToken);

    // Find user holding this refresh token
    const user = await User.findOne({ "refreshTokens.tokenHash": hashed });

    if (!user) {
      logger.warn("Potential refresh token reuse detected or invalid token presented");
      return res.status(403).json({ success: false, message: "Invalid or revoked refresh token" });
    }

    const matchedRecord = user.refreshTokens.find((rt) => rt.tokenHash === hashed);

    if (!matchedRecord || matchedRecord.expiresAt < new Date()) {
      // Remove expired token
      user.refreshTokens = user.refreshTokens.filter((rt) => rt.tokenHash !== hashed);
      await user.save();
      return res.status(403).json({ success: false, message: "Refresh token has expired" });
    }

    // Token is valid: rotate it!
    // Issue a new token in the same family and invalidate the consumed one
    const familyId = matchedRecord.familyId;
    user.refreshTokens = user.refreshTokens.filter((rt) => rt.tokenHash !== hashed);

    const { token, refreshToken: newRefreshToken, tokenRecord } = generateTokens(user, familyId);
    user.refreshTokens.push(tokenRecord);
    await user.save();

    res.json({
      success: true,
      token,
      refreshToken: newRefreshToken,
    });
  })
);

/**
 * POST /api/auth/logout
 * Invalidate the currently presented refresh token
 */
router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const hashed = hashToken(refreshToken);
      await User.updateOne(
        { "refreshTokens.tokenHash": hashed },
        { $pull: { refreshTokens: { tokenHash: hashed } } }
      );
    }
    res.json({ success: true, message: "Logged out successfully" });
  })
);

/**
 * POST /api/auth/logout-all
 * Revoke all active sessions across all devices
 */
router.post(
  "/logout-all",
  authenticateToken,
  asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user.userId, {
      $inc: { tokenVersion: 1 },
      $set: { refreshTokens: [] },
    });

    res.json({ success: true, message: "All active sessions have been revoked." });
  })
);

/**
 * GET /api/auth/profile
 * Retrieve authenticated user profile
 */
router.get(
  "/profile",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.userId)
      .populate("busId", "busNumber isActive isOnRoute")
      .select("-password -refreshTokens");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        userType: user.userType,
        busId: user.busId,
      },
    });
  })
);

module.exports = router;
