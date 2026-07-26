import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  Container,
  Card,
  CardContent,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Chip,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Paper,
} from "@mui/material";
import {
  DirectionsBus,
  LocationOn,
  Speed,
  Schedule,
  Route,
  Warning,
} from "@mui/icons-material";
import MapComponent from "./MapComponent";
import io from "socket.io-client";

const BusTracking = () => {
  const { busId } = useParams();
  const [bus, setBus] = useState(null);
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [socket, setSocket] = useState(null);
  const [realTimeLocation, setRealTimeLocation] = useState(null);

  useEffect(() => {
    fetchBusData();
    initializeSocket();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [busId]);

  const fetchBusData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/bus/${busId}`);
      const data = await response.json();

      if (response.ok) {
        setBus(data);
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

  const initializeSocket = () => {
    const newSocket = io("http://localhost:5000");
    setSocket(newSocket);

    newSocket.emit("join-bus-tracking", busId);

    newSocket.on("bus-location-update", (data) => {
      if (data.busId === busId) {
        setRealTimeLocation({
          lat: data.location.latitude,
          lng: data.location.longitude,
        });

        setBus((prev) => ({
          ...prev,
          currentLocation: {
            latitude: data.location.latitude,
            longitude: data.location.longitude,
            timestamp: data.timestamp,
          },
          speed: data.speed,
          direction: data.direction,
          lastUpdateTime: data.timestamp,
        }));
      }
    });

    newSocket.on("emergency-broadcast", (data) => {
      if (data.busId === busId) {
        // Show emergency alert
        console.log("Emergency alert for this bus:", data);
      }
    });

    newSocket.on("connect", () => {
      console.log("Connected to server");
    });

    newSocket.on("disconnect", () => {
      console.log("Disconnected from server");
    });
  };

  const getBusStatus = (bus) => {
    if (bus?.emergencyStatus === "emergency")
      return { label: "Emergency", color: "error" };
    if (bus?.isActive && bus?.isOnRoute)
      return { label: "Active", color: "success" };
    if (bus?.isActive) return { label: "Starting", color: "warning" };
    return { label: "Inactive", color: "default" };
  };

  const getNextStop = (bus) => {
    if (!bus?.routeId || !bus?.currentStopIndex) return "Unknown";

    const currentStopIndex = bus.currentStopIndex || 0;
    const nextStop = bus.routeId.stops[currentStopIndex + 1];

    return nextStop ? nextStop.name : "End of Route";
  };

  const getEstimatedArrival = (bus) => {
    if (!bus?.estimatedArrivalTime) return "Unknown";

    const now = new Date();
    const arrival = new Date(bus.estimatedArrivalTime);
    const diffMinutes = Math.round((arrival - now) / (1000 * 60));

    if (diffMinutes <= 0) return "Arriving now";
    if (diffMinutes < 60) return `${diffMinutes} min`;

    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    return `${hours}h ${minutes}m`;
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

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!bus) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">Bus not found</Alert>
      </Container>
    );
  }

  const status = getBusStatus(bus);

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box className="main-content">
        <Typography variant="h4" gutterBottom>
          Bus Tracking - {bus.busNumber}
        </Typography>

        <Grid container spacing={3}>
          {/* Bus Information */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Bus Information
                </Typography>

                <Box display="flex" alignItems="center" mb={2}>
                  <DirectionsBus sx={{ mr: 1, color: "primary.main" }} />
                  <Typography variant="h5">Bus {bus.busNumber}</Typography>
                </Box>

                <Chip
                  label={status.label}
                  color={status.color}
                  sx={{ mb: 2 }}
                />

                {route && (
                  <Box mb={2}>
                    <Typography variant="body2" color="text.secondary">
                      Route: {route.routeName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Route Number: {route.routeNumber}
                    </Typography>
                  </Box>
                )}

                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <LocationOn color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Current Location"
                      secondary={
                        bus.currentLocation
                          ? `${bus.currentLocation.latitude.toFixed(
                              6
                            )}, ${bus.currentLocation.longitude.toFixed(6)}`
                          : "Not available"
                      }
                    />
                  </ListItem>

                  <ListItem>
                    <ListItemIcon>
                      <Speed color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Speed"
                      secondary={`${bus.speed || 0} km/h`}
                    />
                  </ListItem>

                  <ListItem>
                    <ListItemIcon>
                      <Schedule color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Last Update"
                      secondary={
                        bus.lastUpdateTime
                          ? new Date(bus.lastUpdateTime).toLocaleTimeString()
                          : "Never"
                      }
                    />
                  </ListItem>

                  <ListItem>
                    <ListItemIcon>
                      <Route color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Next Stop"
                      secondary={getNextStop(bus)}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* Route Information */}
          {route && (
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Route Information
                  </Typography>

                  <Typography variant="body1" fontWeight="medium" gutterBottom>
                    {route.routeName}
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                  >
                    Route {route.routeNumber}
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                  >
                    {route.stops.length} stops
                  </Typography>

                  <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                    Stops
                  </Typography>

                  <List dense>
                    {route.stops.slice(0, 5).map((stop, index) => (
                      <ListItem key={index} sx={{ py: 0.5 }}>
                        <ListItemIcon>
                          <Chip
                            label={index + 1}
                            size="small"
                            color="primary"
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={stop.name}
                          secondary={`${stop.estimatedTime} min`}
                        />
                      </ListItem>
                    ))}
                    {route.stops.length > 5 && (
                      <ListItem>
                        <ListItemText
                          primary={`... and ${
                            route.stops.length - 5
                          } more stops`}
                          sx={{ fontStyle: "italic" }}
                        />
                      </ListItem>
                    )}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Emergency Alert */}
          {bus.emergencyStatus === "emergency" && (
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Alert severity="error" icon={<Warning />}>
                    <Typography variant="h6" gutterBottom>
                      Emergency Alert
                    </Typography>
                    <Typography variant="body2">
                      This bus has an active emergency alert. Please contact
                      authorities immediately.
                    </Typography>
                  </Alert>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>

        {/* Map */}
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Live Tracking Map
            </Typography>

            <MapComponent
              bus={bus}
              route={route}
              location={
                realTimeLocation ||
                (bus.currentLocation
                  ? {
                      lat: bus.currentLocation.latitude,
                      lng: bus.currentLocation.longitude,
                    }
                  : null)
              }
            />
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default BusTracking;
