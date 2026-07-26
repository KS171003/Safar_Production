const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
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

    // Create sample routes
    const routes = [
      {
        routeName: "Downtown Express",
        routeNumber: "D1",
        description: "Fast service from downtown to airport",
        stops: [
          {
            name: "Central Station",
            location: { latitude: 28.6139, longitude: 77.209 },
            estimatedTime: 0,
          },
          {
            name: "City Center",
            location: { latitude: 28.614, longitude: 77.21 },
            estimatedTime: 5,
          },
          {
            name: "Airport Terminal",
            location: { latitude: 28.615, longitude: 77.22 },
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
            location: { latitude: 28.62, longitude: 77.2 },
            estimatedTime: 0,
          },
          {
            name: "Student Housing",
            location: { latitude: 28.625, longitude: 77.205 },
            estimatedTime: 8,
          },
          {
            name: "Shopping Mall",
            location: { latitude: 28.63, longitude: 77.21 },
            estimatedTime: 15,
          },
          {
            name: "Residential Area",
            location: { latitude: 28.635, longitude: 77.215 },
            estimatedTime: 25,
          },
        ],
        totalDistance: 8.2,
        estimatedDuration: 30,
      },
      {
        routeName: "Hospital Shuttle",
        routeNumber: "H3",
        description: "Medical center and hospital connections",
        stops: [
          {
            name: "Main Hospital",
            location: { latitude: 28.6, longitude: 77.18 },
            estimatedTime: 0,
          },
          {
            name: "Medical Center",
            location: { latitude: 28.605, longitude: 77.185 },
            estimatedTime: 5,
          },
          {
            name: "Pharmacy",
            location: { latitude: 28.61, longitude: 77.19 },
            estimatedTime: 10,
          },
        ],
        totalDistance: 5.8,
        estimatedDuration: 15,
      },
    ];

    const createdRoutes = await Route.insertMany(routes);
    console.log(`✅ Created ${createdRoutes.length} routes`);

    // Create conductor users and buses
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
      const hashedPassword = await bcrypt.hash(conductor.password, 10);

      const user = new User({
        ...conductor,
        password: hashedPassword,
      });

      const savedUser = await user.save();
      createdConductors.push(savedUser);

      // Create bus for conductor
      const bus = new Bus({
        busNumber: `BUS${String(i + 1).padStart(3, "0")}`,
        conductorId: savedUser._id,
        routeId: createdRoutes[i % createdRoutes.length]._id,
        isActive: i === 0, // First bus is active
        isOnRoute: i === 0,
        currentLocation: {
          latitude:
            createdRoutes[i % createdRoutes.length].stops[0].location.latitude,
          longitude:
            createdRoutes[i % createdRoutes.length].stops[0].location.longitude,
          timestamp: new Date(),
        },
        speed: i === 0 ? 25 : 0,
        direction: 0,
        departureTime: i === 0 ? new Date() : null,
        lastUpdateTime: new Date(),
      });

      await bus.save();

      // Update user with bus ID
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
      {
        email: "passenger3@safar.com",
        password: "password123",
        name: "Anita Gupta",
        phone: "+91-9876543215",
        userType: "passenger",
      },
    ];

    for (const passenger of passengers) {
      const hashedPassword = await bcrypt.hash(passenger.password, 10);

      const user = new User({
        ...passenger,
        password: hashedPassword,
      });

      await user.save();
    }

    console.log(`✅ Created ${passengers.length} passengers`);

    console.log("\n🎉 Database seeded successfully!");
    console.log("\n📋 Test Accounts:");
    console.log("Conductors:");
    conductors.forEach((conductor, index) => {
      console.log(
        `  ${conductor.email} / ${conductor.password} (Bus BUS${String(
          index + 1
        ).padStart(3, "0")})`
      );
    });
    console.log("\nPassengers:");
    passengers.forEach((passenger) => {
      console.log(`  ${passenger.email} / ${passenger.password}`);
    });
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
