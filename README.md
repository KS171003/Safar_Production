# SAFAR — Production-Ready Enterprise Bus Tracking & ETA Prediction Platform

[![CI/CD Pipeline](https://github.com/KS171003/Safar_Production/actions/workflows/ci.yml/badge.svg)](https://github.com/KS171003/Safar_Production/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/Node.js-18.x%20%7C%2020.x%20%7C%2025.x-green)](https://nodejs.org)
[![React Version](https://img.shields.io/badge/React-18.2.0-blue)](https://reactjs.org/)
[![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-4.22.0-orange)](https://www.tensorflow.org/js)
[![MongoDB Geospatial](https://img.shields.io/badge/MongoDB-2dsphere%20%26%20TTL-13aa52?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

SAFAR is an enterprise-grade, distributed public transit tracking and arrival prediction system. Engineered with a canonical GPS telemetry ingestion pipeline, a zero-leakage hybrid neural ETA prediction engine (TensorFlow.js), multi-role RBAC with refresh token family rotation, native MongoDB `2dsphere` geospatial indexing, and dual-engine mapping (Leaflet / OpenStreetMap default with Google Maps switcher).

---

## 🏛️ System Architecture

```mermaid
graph TD
    subgraph Client Layer [Frontend - React 18 SPA]
        A[Conductor Dashboard] -->|GPS Stream with SeqNo| SC[Socket.IO Client]
        B[Passenger Dashboard] -->|Live Room Subscriptions| SC
        C[Admin / Dispatcher UI] -->|REST API with Auto-Refresh| AC[Axios Client with Retry & Backoff]
        M[Dual-Engine Map Component] -->|Default / Fallback| L[Leaflet / OpenStreetMap]
        M -->|Optional Switch| G[Google Maps JS API]
    end

    subgraph Gateway & Security [Express.js Gateway & RBAC]
        H[Helmet / HPP / MongoSanitize]
        RL[Tiered Rate Limiters: API, Auth, Telemetry]
        JWT[JWT Auth & TokenVersion Revocation]
        RBAC[RBAC: Passenger, Conductor, Dispatcher, Admin]
        OWN[Conductor Vehicle Ownership Verification]
        VAL[Joi Schema Validator]
    end

    subgraph Ingestion & Telemetry [Canonical Telemetry Pipeline]
        TEL[TelemetryService]
        DEDUP[Idempotency & Sequence Number Filter]
        QCHK[GPS Quality Validation: VALID, SUSPICIOUS, INVALID]
        STALE[Vehicle Staleness Detector: 120s TTL]
    end

    subgraph Core Services [Modular Monolith Engine]
        BUS[Bus State Manager]
        ROUTE[Route & Stop Manager]
        EMG[Emergency Dispatch & Resolver]
        ML[Zero-Leakage Hybrid ML ETA Engine]
        SOCK[Socket.IO Room Multiplexer]
    end

    subgraph Data & Storage [MongoDB 7.0 Persistence]
        MDB_GEO[(GeoJSON Point & 2dsphere Geospatial Queries)]
        MDB_TTL[(Tracking History with 30-Day TTL Index)]
        MDB_AUTH[(Hashed Refresh Token Families & tokenVersion)]
        MDB_MODEL[(Trained Weights, Norm Scalers & Metadata)]
    end

    Client Layer -->|HTTPS / WSS| Gateway & Security
    Gateway & Security --> Ingestion & Telemetry
    Ingestion & Telemetry --> Core Services
    Core Services --> Data & Storage
```

---

## 🛰️ Canonical GPS Telemetry Ingestion Pipeline

All vehicle telemetry (whether arriving via authenticated WebSocket `location-update` or HTTP `POST /api/bus/:id/location`) flows through a single authoritative [`TelemetryService`](file:///Users/kunalsharma/Desktop/Safar/server/services/telemetryService.js):

1. **Deduplication & Idempotency**:
   - Every telemetry packet is identified by a monotonic `sequenceNumber` and optional `eventId`.
   - If an incoming ping has a `sequenceNumber <= lastProcessedSequenceNumber`, it is flagged as duplicate/out-of-order. It is stored in tracking history without overwriting live vehicle state.
2. **GPS Quality & Plausibility Validation**:
   - Coordinates are checked against valid geographic bounds (latitude $[-90, 90]$, longitude $[-180, 180]$).
   - Telemetry velocity is compared against maximum physical bus speeds ($> 120\text{ km/h}$ flagged as suspicious; impossible teleportation velocities flagged as invalid).
   - GPS accuracy bounds ($> 200\text{m}$ radius flagged as low-confidence).
   - Each ping is tagged with a quality status: `VALID`, `SUSPICIOUS`, or `INVALID`.
3. **Vehicle Staleness Detection**:
   - Vehicles emit pings periodically. If no update is received for $\ge 120\text{ seconds}$, the bus status is automatically promoted from `LIVE` to `STALE`.
   - The UI visually reflects staleness to prevent passengers from acting on frozen telemetry.

---

## 🧠 Zero-Leakage Hybrid ML ETA Prediction Engine

Rather than relying on uncalibrated Euclidean distance or naive constant-speed division, SAFAR implements a **Zero-Leakage Hybrid Machine Learning Model** combining physics-based kinematic baselines with a deep neural network residual corrector:

$$\text{Predicted ETA} = \text{Kinematic Baseline Travel Time} + \text{Standardized Residual Correction}$$

### 1. 16-Dimensional Feature Vector
- `distanceToDestination`: Haversine geographic curvature distance to destination stop (km).
- `distanceToNextStop`: Proximity to the immediate upcoming stop (km).
- `routeProgress`: Normalized journey completion metric ($[0, 1]$).
- `currentSpeed`: Instantaneous GPS telemetry speed (km/h).
- `avgSpeedRecent`: Exponentially Smoothed Moving Average (EMA, $\alpha=0.3$) over tracking pings.
- `speedVariance`: Variance of vehicle velocity over previous intervals.
- `sinHour`, `cosHour`: Cyclical periodic time-of-day encoding ($\sin/\cos$ of $2\pi \cdot \text{hour} / 24$).
- `sinDay`, `cosDay`: Cyclical day-of-week encoding ($\sin/\cos$ of $2\pi \cdot \text{day} / 7$).
- `isRushHour`: Dynamic binary indicator for peak metropolitan traffic windows (07:00–10:00 & 17:00–20:00).
- `remainingStops`: Count of intermediate stops remaining.
- `totalRouteDistance`: Cumulative route path distance (km).
- `scheduledDuration`: Base timetable route duration (minutes).
- `speedRatio`: Ratio of current speed to route design speed.
- `kinematicTravelTime`: Physical baseline travel time estimate.

### 2. Zero-Leakage Data Partitioning
- **Dataset**: 1,500 simulated bus trips (19,500 observation waypoints) across realistic metropolitan corridors, explicitly tagged as synthetic (`datasetType: 'synthetic'`).
- **Trip-Level Split**: Split strictly by unique `tripId` (70% train trips, 15% validation trips, 15% held-out test trips). **No waypoints from the same trip exist across splits**, guaranteeing zero temporal or spatial leakage.
- **Normalization**: Min-Max scalers and target residual standardization parameters are fitted **strictly on the training partition** and applied without modification to validation and held-out test sets. Feature scaling is clamped to $[0, 1]$ to prevent out-of-distribution explosions during inference.

### 3. Empirical Benchmark on Held-Out Test Set (2,925 Samples)

All models are evaluated on the exact same unseen held-out test dataset (`/api/ml/baselines`):

| Model / Approach | MAE (min) | RMSE (min) | $R^2$ Score | Median Error | 90th Percentile (P90) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Constant-Speed Kinematic** | 22.18 min | 28.46 min | -0.635 | 16.89 min | 48.74 min |
| **Historical Average** | 17.38 min | 22.15 min | 0.011 | 14.88 min | 34.34 min |
| **Hybrid Neural Network (Ours)** | **2.82 min** | **3.55 min** | **0.974** | **2.43 min** | **5.03 min** |

#### Traffic Segment Breakdown (Held-Out Test Set):
- **Peak Rush Hour (Congested)**: MAE = **2.88 min**, RMSE = **3.67 min**
- **Off-Peak (Free Flow)**: MAE = **2.76 min**, RMSE = **3.42 min**

---

## 🔒 Enterprise Security, Auth & RBAC

- **Multi-Role RBAC**: Granular permission matrix across 4 roles:
  - `passenger`: Read-only tracking, nearby search, ETA predictions.
  - `conductor`: Start/stop assigned route, transmit GPS telemetry, trigger emergency SOS alerts.
  - `dispatcher`: Route management, vehicle assignment, emergency resolution.
  - `admin`: Full system management, retraining triggers, user management.
- **Vehicle Ownership Verification**: The `verifyBusOwnership` middleware strictly enforces that a conductor can only transmit GPS telemetry or start/stop routes for their assigned vehicle.
- **Mass-Assignment Protection**: Conductor identity (`conductorId`), timestamping, and resolution status are derived server-side from JWT claims; user input cannot tamper with ownership or audit fields.
- **Refresh Token Family Rotation & Reuse Detection**:
  - Access tokens are short-lived (15 minutes).
  - Refresh tokens are cryptographically hashed (SHA-256) before database storage.
  - Each refresh token belongs to a `familyId`. If a previously consumed refresh token is presented, the system detects a token replay/theft attack and immediately revokes all refresh tokens in that family.
- **Global Session Invalidation**: `POST /api/auth/logout-all` increments `tokenVersion`, instantly invalidating all existing access and refresh tokens across all devices.
- **Hardened HTTP Gateway**:
  - `helmet`: HSTS, X-Content-Type-Options, X-Frame-Options, DNS prefetch control.
  - `hpp`: Parameter pollution defense.
  - `express-mongo-sanitize`: Strips `$`, `.` characters from incoming payloads to prevent NoSQL query injection.
  - Tiered rate limiters: General API (100 req/15m), Auth (20 req/15m with account lockout), Telemetry (300 req/5m).

---

## 🗺️ Geospatial Engineering & Dual-Engine Maps

### 1. MongoDB 2dsphere & GeoJSON
- All locations in `Bus`, `Route`, and `TrackingData` are stored as formal GeoJSON `Point` objects (`{ type: 'Point', coordinates: [lng, lat] }`).
- Indexed with native MongoDB `2dsphere` spatial indexes.
- In-memory Haversine filtering was replaced with native MongoDB `$nearSphere` spatial queries, delegating spatial calculations directly to the database engine.

### 2. Dual-Engine Map Component
- Default map engine: **Leaflet + OpenStreetMap** (zero API keys required, works 100% out of the box).
- Switchable map engine: **Google Maps JavaScript API** with live in-app API key configuration and dynamic script injection.

---

## 📡 Comprehensive REST API Matrix

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register passenger or conductor |
| `POST` | `/api/auth/login` | Public (Rate-limited) | Authenticate user, issue access + refresh tokens |
| `POST` | `/api/auth/refresh-token` | Public | Rotate refresh token with family theft detection |
| `POST` | `/api/auth/logout` | Public | Invalidate presented refresh token |
| `POST` | `/api/auth/logout-all` | Authenticated | Revoke all active sessions across all devices |
| `GET` | `/api/auth/profile` | Authenticated | Retrieve authenticated user profile |
| `GET` | `/api/bus` | Public | List all buses with staleness indicators |
| `GET` | `/api/bus/:id` | Public | Get bus details, current coordinates, and route |
| `POST` | `/api/bus/:id/start-route` | Conductor (Assigned) | Start route tracking on assigned vehicle |
| `POST` | `/api/bus/:id/stop-route` | Conductor (Assigned) | Stop route tracking on assigned vehicle |
| `POST` | `/api/bus/:id/location` | Conductor (Assigned) | Ingest GPS telemetry through canonical pipeline |
| `GET` | `/api/route` | Public | List routes with pagination (`page`, `limit`) |
| `GET` | `/api/route/:id` | Public | Get route geometry and stop sequence |
| `POST` | `/api/route` | Dispatcher/Admin/Conductor | Create new transit route |
| `PUT` | `/api/route/:id` | Dispatcher/Admin | Update route stops and geometry |
| `DELETE` | `/api/route/:id` | Dispatcher/Admin | Soft-delete route |
| `POST` | `/api/tracking/predict-arrival` | Public | Predict ETA using Hybrid ML Engine |
| `GET` | `/api/tracking/nearby` | Public | Query nearby buses using `$nearSphere` |
| `GET` | `/api/tracking/route/:routeId/live` | Public | Get all active buses on a route |
| `POST` | `/api/emergency` | Conductor (Assigned) | Broadcast emergency alert (SOS) |
| `GET` | `/api/emergency` | Authenticated | List recent emergency alerts |
| `PUT` | `/api/emergency/:id` | Dispatcher/Admin | Update/resolve emergency status |
| `GET` | `/api/ml/status` | Public | ML model readiness and training metadata |
| `GET` | `/api/ml/baselines` | Public | Comparative benchmarks on held-out test set |
| `GET` | `/api/ml/metrics` | Public | Live prediction accuracy ring-buffer metrics |
| `POST` | `/api/ml/retrain` | Admin | Trigger background model retraining |
| `GET` | `/health` | Public | System uptime, memory, and observability metadata |
| `GET` | `/ready` | Public | Kubernetes / container readiness probe |

---

## 🧪 Verification & Test Suite

All tests execute against local mock models and services with zero external network dependencies:

```bash
cd server
npm test
```

```
PASS tests/api.test.js
PASS tests/ml.test.js
PASS tests/middleware.test.js
PASS tests/telemetry.test.js
PASS tests/security.test.js

Test Suites: 5 passed, 5 total
Tests:       29 passed, 29 total
Snapshots:   0 total
Time:        1.458 s
```

---

## 👥 Seed Accounts & Demo Credentials

Run `npm run seed` in `server/` to initialize test data:

| Role | Email | Password | Assigned Vehicle | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Conductor** | `conductor1@safar.com` | `password123` | BUS001 (Downtown Express) | Assigned vehicle ownership |
| **Conductor** | `conductor2@safar.com` | `password123` | BUS002 (University Line) | Assigned vehicle ownership |
| **Conductor** | `conductor3@safar.com` | `password123` | BUS003 (Hospital Shuttle) | Assigned vehicle ownership |
| **Passenger** | `passenger1@safar.com` | `password123` | N/A | Standard commuter account |
| **Passenger** | `passenger2@safar.com` | `password123` | N/A | Standard commuter account |
| **Dispatcher** | `dispatcher@safar.com` | `password123` | Fleet Wide | Route management & dispatch |
| **Admin** | `admin@safar.com` | `password123` | System Wide | Retrain models & full access |

---

## 🚀 Getting Started

### Option 1: Docker Compose

```bash
docker-compose up --build -d
```
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5001` (or `5000` depending on port configuration)

### Option 2: Local Setup

1. **Start MongoDB**: Ensure MongoDB is running on `mongodb://localhost:27017/safar`.
2. **Server**:
   ```bash
   cd server
   npm install
   npm run seed
   node ml/trainModel.js
   npm run dev
   ```
3. **Client**:
   ```bash
   cd client
   npm install
   npm start
   ```

---

## 📄 License
This project is licensed under the MIT License.

