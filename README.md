# Safar - Live Bus Tracking System

A comprehensive real-time bus tracking system that provides live location updates for both bus conductors and passengers. Built with React, Node.js, MongoDB, and Google Maps API.

## Features

### For Bus Conductors

- **Route Management**: Create and manage bus routes with multiple stops
- **Live Tracking**: Real-time location sharing with passengers
- **Emergency SOS**: Quick emergency alert system for various situations
- **Dashboard**: Comprehensive overview of bus status and performance

### For Passengers

- **Route Search**: Find buses based on departure location and destination
- **Live Bus Tracking**: Real-time location updates of buses
- **Arrival Predictions**: AI-powered arrival time predictions
- **Nearby Buses**: Find buses in your vicinity
- **Interactive Maps**: Visual route and bus location display

## Technology Stack

### Backend

- **Node.js** with Express.js
- **MongoDB** with Mongoose ODM
- **Socket.io** for real-time communication
- **JWT** for authentication
- **bcryptjs** for password hashing

### Frontend

- **React 18** with functional components and hooks
- **Material-UI (MUI)** for modern UI components
- **Google Maps API** for mapping and route visualization
- **Socket.io Client** for real-time updates
- **Axios** for API communication

## Prerequisites

Before running this application, make sure you have the following installed:

- **Node.js** (v14 or higher)
- **MongoDB** (v4.4 or higher)
- **npm** or **yarn** package manager
- **Google Maps API Key**

## Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd safar
   ```

2. **Install dependencies**

   ```bash
   npm run install-all
   ```

3. **Set up environment variables**

   Create a `.env` file in the `server` directory:

   ```env
   MONGODB_URI=mongodb://localhost:27017/safar
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   PORT=5000
   GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here
   ```

   Create a `.env` file in the `client` directory:

   ```env
   REACT_APP_GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here
   ```

4. **Start MongoDB**

   ```bash
   mongod
   ```

5. **Run the application**

   ```bash
   npm run dev
   ```

   This will start both the backend server (port 5000) and frontend development server (port 3000).

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile

### Bus Management

- `GET /api/bus` - Get all buses
- `GET /api/bus/:id` - Get bus by ID
- `POST /api/bus/:id/start-route` - Start bus route
- `POST /api/bus/:id/stop-route` - Stop bus route
- `POST /api/bus/:id/location` - Update bus location

### Route Management

- `GET /api/route` - Get all routes
- `POST /api/route` - Create new route
- `PUT /api/route/:id` - Update route
- `DELETE /api/route/:id` - Delete route
- `GET /api/route/search/location` - Search routes by location

### Tracking

- `GET /api/tracking/route/:routeId/live` - Get live bus locations for route
- `GET /api/tracking/bus/:busId/history` - Get bus location history
- `POST /api/tracking/predict-arrival` - Predict bus arrival time
- `GET /api/tracking/nearby` - Get nearby buses

### Emergency

- `POST /api/emergency` - Create emergency alert
- `GET /api/emergency` - Get all emergency alerts
- `PUT /api/emergency/:id/status` - Update emergency alert status

## Database Schema

### Users

- Email, password, name, phone
- User type (conductor/passenger)
- Bus ID (for conductors)
- Last location and timestamp

### Buses

- Bus number, conductor ID, route ID
- Current location, speed, direction
- Active status, emergency status
- Departure time, estimated arrival

### Routes

- Route name, number, description
- Array of stops with coordinates
- Total distance, estimated duration
- Created by user ID

### Tracking Data

- Bus ID, location coordinates
- Speed, direction, accuracy
- Timestamp, stop ID
- Real-time location updates

### Emergency Alerts

- Bus ID, conductor ID
- Alert type, description, priority
- Location, status, resolution info

## Real-time Features

The application uses Socket.io for real-time communication:

- **Location Updates**: Bus locations are broadcast to all connected passengers
- **Emergency Alerts**: Instant emergency notifications to all users
- **Route Updates**: Real-time route status changes
- **Live Tracking**: Continuous location updates every few seconds

## Google Maps Integration

- **Route Visualization**: Display bus routes with stop markers
- **Live Bus Tracking**: Real-time bus location markers
- **Interactive Maps**: Zoom, pan, and click interactions
- **Custom Markers**: Different markers for stops, buses, and emergencies

## Usage Guide

### For Conductors

1. **Register** as a conductor with your bus number
2. **Create Routes** by adding stops with coordinates
3. **Start Route** when beginning your journey
4. **Enable Location Tracking** to share your position
5. **Use Emergency SOS** if needed

### For Passengers

1. **Register** as a passenger
2. **Search for Buses** by location and destination
3. **View Live Tracking** on the interactive map
4. **Get Arrival Predictions** for your selected bus
5. **Find Nearby Buses** in your area

## Security Features

- **JWT Authentication** for secure API access
- **Password Hashing** using bcryptjs
- **Input Validation** on all forms
- **CORS Protection** for cross-origin requests
- **Environment Variables** for sensitive data

## Performance Optimizations

- **Database Indexing** for fast queries
- **Socket.io Rooms** for efficient real-time updates
- **React Memoization** for component optimization
- **Lazy Loading** for better initial load times
- **Responsive Design** for mobile compatibility

## Deployment

### Backend Deployment

1. Set up MongoDB Atlas or local MongoDB
2. Configure environment variables
3. Deploy to Heroku, AWS, or similar platform
4. Set up SSL certificate

### Frontend Deployment

1. Build the React app: `npm run build`
2. Deploy to Netlify, Vercel, or similar platform
3. Configure environment variables
4. Update API endpoints for production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support or questions, please contact the development team or create an issue in the repository.

## Future Enhancements

- **Mobile App** (React Native)
- **Push Notifications** for arrival alerts
- **Analytics Dashboard** for route performance
- **Machine Learning** for better arrival predictions
- **Multi-language Support**
- **Offline Mode** for basic functionality
- **Integration** with payment systems
- **Driver Behavior Analytics**
