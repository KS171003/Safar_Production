import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Alert,
  CircularProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from "@mui/material";
import {
  DirectionsBus,
  PlayArrow,
  Stop,
  LocationOn,
  Speed,
  Schedule,
  Warning,
} from "@mui/icons-material";
import MapComponent from "./MapComponent";
import RouteSelector from "./RouteSelector";
import LocationTracker from "./LocationTracker";

const ConductorDashboard = () => {
  const { user } = useAuth();
  const [bus, setBus] = useState(null);
  const [route, setRoute] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [location, setLocation] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [emergency, setEmergency] = useState(false);

  useEffect(() => {
    fetchBusData();
  }, []);

  const fetchBusData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/bus/${user.busId}`);
      const data = await response.json();

      if (response.ok) {
        setBus(data);
        setIsActive(data.isActive);
        if (data.routeId) {
          setRoute(data.routeId);
        }
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Failed to fetch bus data");
    } finally {
      setLoading(false);
    }
  };

  const startRoute = async (selectedRoute) => {
    try {
      const response = await fetch(`/api/bus/${user.busId}/start-route`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ routeId: selectedRoute._id }),
      });

      const data = await response.json();

      if (response.ok) {
        setRoute(selectedRoute);
        setIsActive(true);
        setBus(data.bus);
        setError("");
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Failed to start route");
    }
  };

  const stopRoute = async () => {
    try {
      const response = await fetch(`/api/bus/${user.busId}/stop-route`, {
        method: "POST",
      });

      const data = await response.json();

      if (response.ok) {
        setIsActive(false);
        setBus(data.bus);
        setError("");
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Failed to stop route");
    }
  };

  const updateLocation = async (newLocation, newSpeed, direction) => {
    try {
      const response = await fetch(`/api/bus/${user.busId}/location`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latitude: newLocation.lat,
          longitude: newLocation.lng,
          speed: newSpeed,
          direction: direction,
          accuracy: 10,
        }),
      });

      if (response.ok) {
        setLocation(newLocation);
        setSpeed(newSpeed);
      }
    } catch (err) {
      console.error("Failed to update location:", err);
    }
  };

  const handleEmergency = () => {
    setEmergency(true);
    // Emergency functionality will be implemented in EmergencyAlert component
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="400px"
        >
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box className="main-content">
        <Typography variant="h4" gutterBottom>
          Conductor Dashboard
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Bus Status Card */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Bus Status
                </Typography>
                <Box display="flex" alignItems="center" mb={2}>
                  <DirectionsBus sx={{ mr: 1, color: "primary.main" }} />
                  <Typography variant="h5">
                    {bus?.busNumber || "N/A"}
                  </Typography>
                </Box>

                <Chip
                  label={isActive ? "Active" : "Inactive"}
                  color={isActive ? "success" : "default"}
                  sx={{ mb: 2 }}
                />

                {route && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Route: {route.routeName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Route Number: {route.routeNumber}
                    </Typography>
                  </Box>
                )}

                <Box mt={2}>
                  {!isActive ? (
                    <RouteSelector onRouteSelect={startRoute} />
                  ) : (
                    <Button
                      variant="contained"
                      color="error"
                      startIcon={<Stop />}
                      onClick={stopRoute}
                      fullWidth
                    >
                      Stop Route
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Location Info Card */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Current Status
                </Typography>

                <List>
                  <ListItem>
                    <ListItemIcon>
                      <LocationOn color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Location"
                      secondary={
                        location
                          ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(
                              6
                            )}`
                          : "Not available"
                      }
                    />
                  </ListItem>

                  <ListItem>
                    <ListItemIcon>
                      <Speed color="primary" />
                    </ListItemIcon>
                    <ListItemText primary="Speed" secondary={`${speed} km/h`} />
                  </ListItem>

                  <ListItem>
                    <ListItemIcon>
                      <Schedule color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Last Update"
                      secondary={
                        bus?.lastUpdateTime
                          ? new Date(bus.lastUpdateTime).toLocaleTimeString()
                          : "Never"
                      }
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* Emergency Card */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Emergency
                </Typography>

                <Button
                  variant="contained"
                  color="error"
                  size="large"
                  startIcon={<Warning />}
                  onClick={handleEmergency}
                  fullWidth
                  sx={{ py: 2 }}
                >
                  EMERGENCY SOS
                </Button>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 2 }}
                >
                  Press this button in case of emergency
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Map Card */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Live Tracking Map
                </Typography>

                {isActive ? (
                  <Box>
                    <MapComponent
                      bus={bus}
                      route={route}
                      location={location}
                      onLocationUpdate={updateLocation}
                    />
                    <LocationTracker
                      onLocationUpdate={updateLocation}
                      isActive={isActive}
                    />
                  </Box>
                ) : (
                  <Box
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                    minHeight="400px"
                    bgcolor="grey.100"
                    borderRadius={1}
                  >
                    <Typography variant="h6" color="text.secondary">
                      Start a route to begin tracking
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default ConductorDashboard;
