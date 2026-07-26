import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Navbar from "./components/Navbar";
import Login from "./components/Login";
import Register from "./components/Register";
import ConductorDashboard from "./components/ConductorDashboard";
import PassengerDashboard from "./components/PassengerDashboard";
import RouteManagement from "./components/RouteManagement";
import BusTracking from "./components/BusTracking";
import EmergencyAlert from "./components/EmergencyAlert";
import "./App.css";

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

function AppContent() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  return (
    <>
      <Navbar />
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
    </>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <div className="App">
            <AppContent />
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
