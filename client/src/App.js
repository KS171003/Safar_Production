import React, { Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { CircularProgress, Box } from "@mui/material";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SocketProvider } from "./contexts/SocketContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Navbar from "./components/Navbar";

import "./App.css";

const Login = React.lazy(() => import("./components/Login"));
const Register = React.lazy(() => import("./components/Register"));
const ConductorDashboard = React.lazy(() => import("./components/ConductorDashboard"));
const PassengerDashboard = React.lazy(() => import("./components/PassengerDashboard"));
const RouteManagement = React.lazy(() => import("./components/RouteManagement"));
const BusTracking = React.lazy(() => import("./components/BusTracking"));
const EmergencyAlert = React.lazy(() => import("./components/EmergencyAlert"));

const theme = createTheme({
  palette: {
    primary: {
      main: "#1976d2",
    },
    secondary: {
      main: "#dc004e",
    },
  },
});

function ProtectedRoute({ children, userType }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (userType && user.userType !== userType) {
    return <Navigate to="/" />;
  }

  return children;
}

const LoadingFallback = () => (
  <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
    <CircularProgress />
  </Box>
);

function AppContent() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <>
      <Navbar />
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route
            path="/"
            element={
              user.userType === "conductor" ? (
                <Navigate to="/conductor" />
              ) : (
                <Navigate to="/passenger" />
              )
            }
          />
          <Route
            path="/conductor"
            element={
              <ProtectedRoute userType="conductor">
                <ConductorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/passenger"
            element={
              <ProtectedRoute userType="passenger">
                <PassengerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/routes"
            element={
              <ProtectedRoute userType="conductor">
                <RouteManagement />
              </ProtectedRoute>
            }
          />
          <Route path="/tracking/:busId" element={<BusTracking />} />
          <Route
            path="/emergency"
            element={
              <ProtectedRoute userType="conductor">
                <EmergencyAlert />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <AuthProvider>
          <SocketProvider>
            <Router>
              <div className="App">
                <AppContent />
              </div>
            </Router>
          </SocketProvider>
        </AuthProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
