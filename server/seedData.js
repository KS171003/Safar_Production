const mongoose = require("mongoose");
require("dotenv").config();

const User = require("./models/User");
const Bus = require("./models/Bus");
const Route = require("./models/Route");

const connectDB = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/safar"
    );
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

const seedData = async () => {
  try {
    console.log("🌱 Seeding database...");

    // Clear existing data
    await User.deleteMany({});
    await Bus.deleteMany({});
    await Route.deleteMany({});

    // Create sample routes with GeoJSON stops
    const routes = [
      {
        routeName: "Downtown Express",
        routeNumber: "D1",
        description: "Fast service from downtown to airport",
        stops: [
          {
            name: "Central Station",
            location: { type: "Point", coordinates: [77.209, 28.6139] },
            estimatedTime: 0,
          },
          {
            name: "City Center",
            location: { type: "Point", coordinates: [77.21, 28.614] },
            estimatedTime: 5,
          },
          {
            name: "Airport Terminal",
            location: { type: "Point", coordinates: [77.22, 28.615] },
            estimatedTime: 15,
          },
        ],
        totalDistance: 10.5,
        estimatedDuration: 20,
      },
      {
        routeName: "University Line",
        routeNumber: "U2",
        description: "Connects university to residential areas",
        stops: [
          {
            name: "University Campus",
            location: { type: "Point", coordinates: [77.2, 28.62] },
            estimatedTime: 0,
          },
          {
            name: "Student Housing",
            location: { type: "Point", coordinates: [77.205, 28.625] },
            estimatedTime: 8,
          },
          {
            name: "Shopping Mall",
            location: { type: "Point", coordinates: [77.21, 28.63] },
            estimatedTime: 15,
          },
          {
            name: "Residential Area",
            location: { type: "Point", coordinates: [77.215, 28.635] },
            estimatedTime: 22,
          },
        ],
        totalDistance: 15.2,
        estimatedDuration: 30,
      },
      {
        routeName: "Hospital Shuttle",
        routeNumber: "H3",
        description: "Direct service to major medical facilities",
        stops: [
          {
            name: "Main Hospital",
            location: { type: "Point", coordinates: [77.18, 28.6] },
            estimatedTime: 0,
          },
          {
            name: "Medical Center",
            location: { type: "Point", coordinates: [77.185, 28.605] },
            estimatedTime: 6,
          },
          {
            name: "Pharmacy",
            location: { type: "Point", coordinates: [77.19, 28.61] },
            estimatedTime: 12,
          },
        ],
        totalDistance: 8.7,
        estimatedDuration: 18,
      },
    ];

    const createdRoutes = [];
    for (const route of routes) {
      const newRoute = new Route(route);
      const savedRoute = await newRoute.save();
      createdRoutes.push(savedRoute);
    }

    console.log(`✅ Created ${createdRoutes.length} routes`);

    // Create conductor users
    const conductors = [
      {
        email: "conductor1@safar.com",
        password: "password123",
        name: "Rajesh Kumar",
        phone: "+91-9876543210",
        userType: "conductor",
      },
      {
        email: "conductor2@safar.com",
        password: "password123",
        name: "Priya Sharma",
        phone: "+91-9876543211",
        userType: "conductor",
      },
      {
        email: "conductor3@safar.com",
        password: "password123",
        name: "Amit Singh",
        phone: "+91-9876543212",
        userType: "conductor",
      },
    ];

    const createdConductors = [];
    for (let i = 0; i < conductors.length; i++) {
      const conductor = conductors[i];
      const targetRoute = createdRoutes[i % createdRoutes.length];

      // Create user first without busId
      const user = new User({
        ...conductor,
      });

      const savedUser = await user.save();
      createdConductors.push(savedUser);

      // Create bus for conductor with GeoJSON location
      const bus = new Bus({
        busNumber: `BUS${String(i + 1).padStart(3, "0")}`,
        conductorId: savedUser._id,
        routeId: targetRoute._id,
        isActive: i === 0, // First bus is active
        isOnRoute: i === 0,
        location: {
          type: "Point",
          coordinates: [
            targetRoute.stops[0].location.coordinates[0],
            targetRoute.stops[0].location.coordinates[1],
          ],
        },
        speed: i === 0 ? 25 : 0,
        direction: 0,
        departureTime: i === 0 ? new Date() : null,
        lastUpdatedAt: new Date(),
        locationStatus: "LIVE",
        gpsQuality: "VALID",
      });

      await bus.save();

      // Link bus to conductor
      savedUser.busId = bus._id;
      await savedUser.save();
    }

    console.log(`✅ Created ${createdConductors.length} conductors with buses`);

    // Create passenger users
    const passengers = [
      {
        email: "passenger1@safar.com",
        password: "password123",
        name: "Sneha Patel",
        phone: "+91-9876543213",
        userType: "passenger",
      },
      {
        email: "passenger2@safar.com",
        password: "password123",
        name: "Vikram Joshi",
        phone: "+91-9876543214",
        userType: "passenger",
      },
    ];

    for (const passenger of passengers) {
      const user = new User({ ...passenger });
      await user.save();
    }
    console.log(`✅ Created ${passengers.length} passengers`);

    // Create dispatcher user
    const dispatcher = new User({
      email: "dispatcher1@safar.com",
      password: "password123",
      name: "Operations Dispatcher",
      phone: "+91-9876543220",
      userType: "dispatcher",
    });
    await dispatcher.save();
    console.log(`✅ Created Dispatcher account`);

    // Create admin user
    const admin = new User({
      email: "admin@safar.com",
      password: "password123",
      name: "System Admin",
      phone: "+91-9876543299",
      userType: "admin",
    });
    await admin.save();
    console.log(`✅ Created Admin account`);

    console.log("\n🎉 Database seeded successfully with GeoJSON & 4-role RBAC!");
    console.log("\n📋 Test Accounts:");
    console.log("Admin:      admin@safar.com / password123");
    console.log("Dispatcher: dispatcher1@safar.com / password123");
    console.log("Conductor:  conductor1@safar.com / password123 (BUS001)");
    console.log("Passenger:  passenger1@safar.com / password123");
  } catch (error) {
    console.error("Error seeding database:", error);
  } finally {
    mongoose.connection.close();
  }
};

// Run seeder
connectDB().then(() => {
  seedData();
});
