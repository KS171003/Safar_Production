const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Bus = require("../models/Bus");
const { authenticateToken } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const { validate, schemas } = require("../middleware/validate");
const { authLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

// Register
router.post("/register", authLimiter, validate(schemas.register), asyncHandler(async (req, res) => {
  const { email, password, name, phone, userType, busNumber } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ message: "User already exists" });
  }

  // Create user
  const user = new User({
    email,
    password,
    name,
    phone,
    userType,
  });

  await user.save();

  // If conductor, create bus
  if (userType === "conductor" && busNumber) {
    const bus = new Bus({
      busNumber,
      conductorId: user._id,
      routeId: null
    });
    await bus.save();

    user.busId = bus._id;
    await user.save();
  }

  // Generate JWT
  const token = jwt.sign(
    { userId: user._id, userType: user.userType },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );

  const refreshToken = jwt.sign(
    { userId: user._id },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
  
  user.refreshToken = refreshToken;
  await user.save();

  res.status(201).json({
    message: "User created successfully",
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
}));

// Login
router.post("/login", authLimiter, validate(schemas.login), asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  // Check password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  // Generate JWT
  const token = jwt.sign(
    { userId: user._id, userType: user.userType },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );
  
  const refreshToken = jwt.sign(
    { userId: user._id },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
  
  user.refreshToken = refreshToken;
  await user.save();

  res.json({
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
}));

// Refresh Token
router.post("/refresh-token", asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh token is required" });
  }
  
  const user = await User.findOne({ refreshToken });
  if (!user) {
    return res.status(403).json({ message: "Invalid refresh token" });
  }
  
  jwt.verify(refreshToken, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired refresh token" });
    }
    
    const token = jwt.sign(
      { userId: user._id, userType: user.userType },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );
    
    res.json({ token });
  });
}));

// Get user profile
router.get("/profile", authenticateToken, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId).select("-password");
  res.json(user);
}));

module.exports = router;
