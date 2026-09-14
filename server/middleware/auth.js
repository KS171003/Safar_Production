const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Bus = require("../models/Bus");

/**
 * Middleware to authenticate JWT access token from Authorization header.
 * Attaches decoded user payload to req.user.
 */
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token required",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // If token has a tokenVersion, verify against DB to support instant global logout
    if (decoded.tokenVersion !== undefined && decoded.userId) {
      const user = await User.findById(decoded.userId).select("tokenVersion isActive");
      if (!user || !user.isActive || user.tokenVersion !== decoded.tokenVersion) {
        return res.status(401).json({
          success: false,
          message: "Session revoked or expired. Please re-authenticate.",
          code: "SESSION_REVOKED",
        });
      }
    }

    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired",
        code: "TOKEN_EXPIRED",
      });
    }
    return res.status(403).json({
      success: false,
      message: "Invalid token",
    });
  }
};

/**
 * Middleware factory for role-based access control (RBAC).
 * Supports: 'passenger', 'conductor', 'dispatcher', 'admin'.
 * @param {...string} roles - Allowed roles
 * @returns {Function} Express middleware
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userRole = req.user.userType;
    // Admins always have access
    if (userRole === "admin" || roles.includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Access denied. Required role: ${roles.join(" or ")} (current: ${userRole})`,
    });
  };
};

/**
 * Resource Ownership Authorization Middleware.
 * Ensures a conductor can ONLY mutate their explicitly assigned bus.
 * Dispatchers and admins bypass this check.
 * Attaches the retrieved bus document to req.bus to prevent duplicate queries.
 */
const verifyBusOwnership = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  // Admins and dispatchers can manage all vehicles
  if (req.user.userType === "admin" || req.user.userType === "dispatcher") {
    return next();
  }

  const busId = req.params.id || req.body.busId;
  if (!busId) {
    return res.status(400).json({ success: false, message: "Bus ID is required for ownership verification" });
  }

  try {
    const bus = await Bus.findById(busId);
    if (!bus) {
      return res.status(404).json({ success: false, message: "Bus not found" });
    }

    if (bus.conductorId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You are not authorized to operate or mutate this vehicle.",
      });
    }

    req.bus = bus;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Optional authentication middleware.
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
  } catch (err) {
    // Ignored in optional auth
  }

  next();
};

module.exports = {
  authenticateToken,
  requireRole,
  verifyBusOwnership,
  optionalAuth,
};
