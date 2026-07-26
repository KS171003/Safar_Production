import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  Alert,
  Card,
  CardContent,
  Chip,
} from "@mui/material";
import { LocationOn, MyLocation } from "@mui/icons-material";

const LocationTracker = ({ onLocationUpdate, isActive }) => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState("");
  const [tracking, setTracking] = useState(false);
  const [watchId, setWatchId] = useState(null);

  useEffect(() => {
    if (isActive && tracking) {
      startLocationTracking();
    } else {
      stopLocationTracking();
    }

    return () => {
      stopLocationTracking();
    };
  }, [isActive, tracking]);

  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser");
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 1000,
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        setLocation(newLocation);
        setError("");

        // Calculate speed if available
        const speed = position.coords.speed
          ? Math.round(position.coords.speed * 3.6)
          : 0; // Convert m/s to km/h

        const direction = position.coords.heading || 0;

        // Update parent component
        onLocationUpdate(newLocation, speed, direction);
      },
      (error) => {
        console.error("Location error:", error);
        setError("Unable to get location: " + error.message);
      },
      options
    );

    setWatchId(watchId);
  };

  const stopLocationTracking = () => {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
  };

  const toggleTracking = () => {
    if (tracking) {
      setTracking(false);
      stopLocationTracking();
    } else {
      setTracking(true);
    }
  };

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Typography variant="h6">Location Tracking</Typography>
          <Chip
            label={tracking ? "Tracking" : "Stopped"}
            color={tracking ? "success" : "default"}
            icon={tracking ? <LocationOn /> : <MyLocation />}
          />
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {location && (
          <Box mb={2}>
            <Typography variant="body2" color="text.secondary">
              Current Location:
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
            </Typography>
          </Box>
        )}

        <Button
          variant={tracking ? "outlined" : "contained"}
          color={tracking ? "error" : "primary"}
          onClick={toggleTracking}
          disabled={!isActive}
          fullWidth
        >
          {tracking ? "Stop Tracking" : "Start Tracking"}
        </Button>

        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          textAlign="center"
          mt={1}
        >
          {isActive
            ? "Location will be shared with passengers in real-time"
            : "Start a route to enable location tracking"}
        </Typography>
      </CardContent>
    </Card>
  );
};

export default LocationTracker;
