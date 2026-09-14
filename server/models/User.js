const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

/**
 * User Schema for Safar application
 * Multi-role RBAC: passenger, conductor, dispatcher, admin
 * Cryptographically hashed refresh token storage with rotation and family tracking
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    tokenHash: {
      type: String,
      required: true,
    },
    familyId: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    userType: {
      type: String,
      enum: ["passenger", "conductor", "dispatcher", "admin"],
      default: "passenger",
      required: true,
      index: true,
    },
    busId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    refreshTokens: [refreshTokenSchema],
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.refreshTokens;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Hash password before saving
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    throw error;
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Check if account is temporarily locked
userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Increment login attempts and lock after 5 failures
userSchema.methods.incLoginAttempts = async function () {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    this.failedLoginAttempts = 1;
    this.lockUntil = null;
    return this.save();
  }

  this.failedLoginAttempts += 1;
  if (this.failedLoginAttempts >= 5 && !this.isLocked()) {
    this.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lock
  }
  return this.save();
};

// Reset login attempts on successful login
userSchema.methods.resetLoginAttempts = async function () {
  this.failedLoginAttempts = 0;
  this.lockUntil = null;
  return this.save();
};

module.exports = mongoose.model("User", userSchema);
