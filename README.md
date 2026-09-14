# SAFAR — Production-Ready Enterprise Bus Tracking & ETA Prediction Platform

[![CI/CD Pipeline](https://github.com/KS171003/SAFAR-offline-bus-tracking-system/actions/workflows/ci.yml/badge.svg)](https://github.com/KS171003/SAFAR-offline-bus-tracking-system/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/Node.js-18.x%20%7C%2020.x%20%7C%2025.x-green)](https://nodejs.org)
[![React Version](https://img.shields.io/badge/React-18.2.0-blue)](https://reactjs.org/)
[![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-4.22.0-orange)](https://www.tensorflow.org/js)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

SAFAR is a distributed, real-time public transit tracking and arrival prediction system. Upgraded to enterprise standards with genuine Deep Learning (TensorFlow.js), role-based JWT security, WebSocket room multiplexing, rate-limiting, and containerized orchestration.

---

## 🏛️ System Architecture

```mermaid
graph TD
    subgraph Client Layer [Frontend - React 18 SPA]
        A[Conductor Dashboard] -->|GPS Stream| SC[Socket.IO Client]
        B[Passenger Dashboard] -->|Live Subscriptions| SC
        C[Admin / Routes] -->|REST API| AC[Axios Client with Retry]
    end

    subgraph Gateway & Security [Express.js API Gateway]
        H[Helmet / HPP / MongoSanitize]
        RL[Tiered Rate Limiters]
        JWT[JWT Auth & RBAC Middleware]
        VAL[Joi Schema Validator]
    end

    subgraph Core Services [Modular Monolith]
        BUS[Bus & Telemetry Engine]
        ROUTE[Route & Stop Manager]
        EMERGENCY[Emergency Dispatch]
        ML[TensorFlow.js Neural ETA Predictor]
        SOCK[Socket.IO Room Manager]
    end

    subgraph Data & Persistence [Storage Layer]
        MDB[(MongoDB with 2dsphere & TTL Indexes)]
        MODEL[Trained Neural Net Weights & Norm Params]
    end

    Client Layer -->|HTTPS / WSS| Gateway & Security
    Gateway & Security --> Core Services
    Core Services --> Data & Persistence
```

---

## 🧠 Real Machine Learning ETA Prediction Engine

Unlike naive prototypes that estimate arrival times using straight-line Euclidean distance divided by static speed (`distance / speed * 60`), SAFAR deploys a **custom-trained deep neural network powered by TensorFlow.js (`@tensorflow/tfjs-node`)**:

### 1. 14-Feature Input Vector
1. `distanceToDestination`: Haversine distance along geographic curvature to target stop (km).
2. `distanceToNextStop`: Proximity to the immediate upcoming stop on the route (km).
3. `routeProgress`: Normalized journey completion metric ($[0, 1]$).
4. `currentSpeed`: Instantaneous GPS telemetry speed (km/h).
5. `avgSpeedRecent`: Exponentially smoothed historical speed over recent tracking pings.
6. `speedVariance`: Standard deviation of vehicle velocity over previous intervals.
7. `sinHour`: Cyclical periodic encoding: $\sin(2\pi \cdot \text{hour} / 24)$.
8. `cosHour`: Cyclical periodic encoding: $\cos(2\pi \cdot \text{hour} / 24)$.
9. `sinDay`: Cyclical day-of-week encoding: $\sin(2\pi \cdot \text{day} / 7)$.
10. `cosDay`: Cyclical day-of-week encoding: $\cos(2\pi \cdot \text{day} / 7)$.
11. `isRushHour`: Dynamic binary flag identifying peak traffic congestion windows (07:00–10:00 & 17:00–20:00).
12. `remainingStops`: Count of intermediate bus stops remaining.
13. `totalRouteDistance`: Cumulative route path distance (km).
14. `scheduledDuration`: Base scheduled route duration (minutes).

### 2. Neural Network Topology & Training
- **Architecture**: `Dense(64, ReLU) -> Dropout(0.2) -> Dense(32, ReLU) -> Dense(16, ReLU) -> Dense(1, Linear)`
- **Loss Function**: Mean Squared Error (MSE)
- **Optimizer**: Adam ($\alpha = 0.001$)
- **Dataset**: 19,500 synthetic trip data points generated across metropolitan Delhi transit corridors.
- **Trained Model Performance**:
  - **Mean Absolute Error (MAE)**: **0.8053 minutes (~48 seconds)**
  - **Root Mean Squared Error (RMSE)**: **1.1943 minutes**
  - **Coefficient of Determination ($R^2$)**: **0.8863 (88.63% variance explained)**
- **Confidence Intervals**: Dynamically calculated for every ETA ($\pm 1.5 \times \text{MAE}$).
- **Resilient Fallback**: Automatic graceful fallback to Haversine kinematics if ML tensors are initializing.

---

## 🔒 Enterprise Security & Resiliency

- **Role-Based Access Control (RBAC)**: Strict separation between `conductor` and `passenger` scopes.
- **Defensive HTTP Pipeline**:
  - `helmet`: Enforces HSTS, X-Content-Type-Options, X-Frame-Options, DNS prefetch control.
  - `hpp`: HTTP Parameter Pollution protection.
  - `express-mongo-sanitize`: Strips dangerous query operators (`$`, `.`) to defeat NoSQL injection.
- **Three-Tier Rate Limiting**:
  - Standard REST: 100 requests / 15 min per IP.
  - Authentication: 20 requests / 15 min per IP (brute-force prevention).
  - Telemetry updates: 300 updates / 5 min per IP (high-frequency streaming).
- **Socket.IO Handshake Authentication**: JWT verification on connection handshake; prevents unauthorized socket eavesdropping and spoofed location updates.
- **Centralized Error Hierarchy**: Operational `AppError` class with HTTP status codes and structured logging via `Winston`.
- **Database Index Optimization**: Compound indexes (`{ routeId: 1, isActive: 1 }`), unique indexes, and 30-day TTL indexes (`expireAfterSeconds: 2592000`) on high-frequency telemetry.

---

## 🚀 Quick Start & Deployment

### Option 1: Docker Compose (Recommended)

Run the full stack (MongoDB 7 + Node.js API + React Nginx) with a single command:

```bash
docker-compose up --build -d
```

- **Frontend Application**: `http://localhost:3000`
- **Backend API & Health**: `http://localhost:5000/health`
- **MongoDB**: `localhost:27017`

### Option 2: Local Development

#### 1. Prerequisites
- Node.js (v18.x or higher)
- MongoDB running locally or on MongoDB Atlas

#### 2. Backend Setup
```bash
cd server
npm install
npm run seed     # Seeds routes, conductors, and passengers
node ml/trainModel.js  # Trains the TensorFlow.js neural net
npm run dev      # Starts server on http://localhost:5000
```

#### 3. Frontend Setup
```bash
cd client
npm install
npm start        # Starts React development server on http://localhost:3000
```

---

## 🧪 Testing

Comprehensive test suites covering unit tests, ML inference, middleware security, and Supertest API integration:

```bash
cd server
npm test
```

```
Test Suites: 3 passed, 3 total
Tests:       21 passed, 21 total
Snapshots:   0 total
Time:        1.45 s
```

---

## 📡 REST API Reference

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register passenger or conductor |
| `POST` | `/api/auth/login` | Public | Authenticate user & issue JWT |
| `GET` | `/api/auth/profile` | Bearer | Retrieve authenticated user profile |
| `GET` | `/api/bus` | Public | List all registered buses |
| `POST` | `/api/bus/:id/start-route` | Conductor | Activate bus route tracking |
| `POST` | `/api/bus/:id/stop-route` | Conductor | Deactivate route tracking |
| `POST` | `/api/bus/:id/location` | Conductor | Ingest GPS coordinates & broadcast |
| `POST` | `/api/tracking/predict-arrival` | Public | Neural ML arrival time prediction |
| `GET` | `/api/tracking/nearby` | Public | Query nearby buses |
| `GET` | `/api/ml/status` | Public | Model readiness and training metrics |
| `GET` | `/api/ml/metrics` | Public | Continuous live evaluation metrics |
| `POST` | `/api/emergency` | Conductor | Broadcast emergency SOS alert |
| `GET` | `/health` | Public | Service health, uptime & observability |
| `GET` | `/ready` | Public | Kubernetes / Container readiness probe |

---

## 👥 Default Demo Credentials

After running `npm run seed`:

| Role | Email | Password | Assigned Vehicle |
| :--- | :--- | :--- | :--- |
| **Conductor** | `conductor1@safar.com` | `password123` | BUS001 (Downtown Express) |
| **Conductor** | `conductor2@safar.com` | `password123` | BUS002 (University Line) |
| **Conductor** | `conductor3@safar.com` | `password123` | BUS003 (Hospital Shuttle) |
| **Passenger** | `passenger1@safar.com` | `password123` | N/A |
| **Passenger** | `passenger2@safar.com` | `password123` | N/A |

---

## 📄 License
This project is licensed under the MIT License.
