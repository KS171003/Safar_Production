#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("🚌 Setting up Safar - Live Bus Tracking System\n");

// Check if Node.js is installed
try {
  const nodeVersion = execSync("node --version", { encoding: "utf8" });
  console.log(`✅ Node.js version: ${nodeVersion.trim()}`);
} catch (error) {
  console.error(
    "❌ Node.js is not installed. Please install Node.js v14 or higher."
  );
  process.exit(1);
}

// Check if MongoDB is running
try {
  execSync("mongod --version", { encoding: "utf8" });
  console.log("✅ MongoDB is available");
} catch (error) {
  console.log("⚠️  MongoDB not found. Please install and start MongoDB.");
}

// Create .env files if they don't exist
const serverEnvPath = path.join(__dirname, "server", ".env");
const clientEnvPath = path.join(__dirname, "client", ".env");

if (!fs.existsSync(serverEnvPath)) {
  const serverEnvContent = `MONGODB_URI=mongodb://localhost:27017/safar
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
PORT=5000
GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here`;

  fs.writeFileSync(serverEnvPath, serverEnvContent);
  console.log("✅ Created server/.env file");
} else {
  console.log("✅ server/.env file already exists");
}

if (!fs.existsSync(clientEnvPath)) {
  const clientEnvContent = `REACT_APP_GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here`;

  fs.writeFileSync(clientEnvPath, clientEnvContent);
  console.log("✅ Created client/.env file");
} else {
  console.log("✅ client/.env file already exists");
}

// Install dependencies
console.log("\n📦 Installing dependencies...");

try {
  console.log("Installing root dependencies...");
  execSync("npm install", { stdio: "inherit" });

  console.log("Installing server dependencies...");
  execSync("npm install", {
    cwd: path.join(__dirname, "server"),
    stdio: "inherit",
  });

  console.log("Installing client dependencies...");
  execSync("npm install", {
    cwd: path.join(__dirname, "client"),
    stdio: "inherit",
  });

  console.log("✅ All dependencies installed successfully");
} catch (error) {
  console.error("❌ Error installing dependencies:", error.message);
  process.exit(1);
}

console.log("\n🎉 Setup completed successfully!");
console.log("\n📋 Next steps:");
console.log(
  "1. Get a Google Maps API key from https://console.cloud.google.com/"
);
console.log("2. Update the API keys in server/.env and client/.env files");
console.log("3. Start MongoDB: mongod");
console.log("4. Run the application: npm run dev");
console.log("\n🌐 The application will be available at:");
console.log("   Frontend: http://localhost:3000");
console.log("   Backend: http://localhost:5000");
console.log("\n📚 For more information, see README.md");
