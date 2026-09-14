import React, { useState, useEffect } from "react";
import api from "../utils/api";
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
  TextField,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from "@mui/material";
import {
  DirectionsBus,
  Search,
  MyLocation,
  Route,
} from "@mui/icons-material";
import MapComponent from "./MapComponent";
import BusList from "./BusList";
import ArrivalPrediction from "./ArrivalPrediction";

const PassengerDashboard = () => {
  const [searchForm, setSearchForm] = useState({
    departureLocation: "",
    destination: "",
    departureTime: "",
  });
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userLocation, setUserLocation] = useState(null);
  const [nearbyBuses, setNearbyBuses] = useState([]);

  useEffect(() => {
    fetchRoutes();
    getUserLocation();
    fetchNearbyBuses();
  }, []);

  const fetchRoutes = async () => {
    try {
      const res = await api.get("/api/route");
      const list = Array.isArray(res.data) ? res.data : (res.data?.routes || []);
      setRoutes(list);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch routes");
    }
  };

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  };

  const fetchNearbyBuses = async () => {
    if (!userLocation) return;

    try {
      const res = await api.get(
        `/api/tracking/nearby?latitude=${userLocation.lat}&longitude=${userLocation.lng}&radius=2`
      );
      setNearbyBuses(res.data || []);
    } catch (err) {
      console.error("Failed to fetch nearby buses:", err);
    }
  };

  const handleSearch = async () => {
    if (!searchForm.departureLocation || !searchForm.destination) {
      setError("Please fill in all required fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Search for routes based on location
      const res = await api.get(
        `/api/route/search/location?latitude=${
          userLocation?.lat || 0
        }&longitude=${userLocation?.lng || 0}&radius=5`
      );
      const data = res.data;

      if (Array.isArray(data)) {
        // Filter routes that match destination
        const matchingRoutes = data.filter((route) =>
          route.stops.some((stop) =>
            stop.name
              .toLowerCase()
              .includes(searchForm.destination.toLowerCase())
          )
        );

        if (matchingRoutes.length > 0) {
          setSelectedRoute(matchingRoutes[0]);
          fetchBusesForRoute(matchingRoutes[0]._id);
        } else {
          setError("No routes found for your destination");
        }
      } else {
        setError(data.message || "No routes found");
      }
    } catch (err) {
      setError("Search failed");
    } finally {
      setLoading(false);
    }
  };

  const fetchBusesForRoute = async (routeId) => {
    try {
      const res = await api.get(`/api/tracking/route/${routeId}/live`);
      setBuses(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch buses");
    }
  };

  const handleRouteSelect = (route) => {
    setSelectedRoute(route);
    fetchBusesForRoute(route._id);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box className="main-content">
        <Typography variant="h4" gutterBottom>
          Find Your Bus
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Search Form */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Search for Bus
                </Typography>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Departure Location"
                      value={searchForm.departureLocation}
                      onChange={(e) =>
                        setSearchForm({
                          ...searchForm,
                          departureLocation: e.target.value,
                        })
                      }
                      placeholder="Enter your current location"
                    />
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Destination"
                      value={searchForm.destination}
                      onChange={(e) =>
                        setSearchForm({
                          ...searchForm,
                          destination: e.target.value,
                        })
                      }
                      placeholder="Where do you want to go?"
                    />
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      type="datetime-local"
                      label="Departure Time"
                      value={searchForm.departureTime}
                      onChange={(e) =>
                        setSearchForm({
                          ...searchForm,
                          departureTime: e.target.value,
                        })
                      }
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                </Grid>

                <Box mt={2}>
                  <Button
                    variant="contained"
                    startIcon={<Search />}
                    onClick={handleSearch}
                    disabled={loading}
                    fullWidth
                  >
                    {loading ? <CircularProgress size={24} /> : "Search Buses"}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Nearby Buses */}
          {nearbyBuses.length > 0 && (
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <MyLocation sx={{ mr: 1, verticalAlign: "middle" }} />
                    Buses Near You
                  </Typography>

                  <List>
                    {nearbyBuses.slice(0, 3).map((bus, index) => (
                      <React.Fragment key={bus._id}>
                        <ListItem>
                          <ListItemIcon>
                            <DirectionsBus color="primary" />
                          </ListItemIcon>
                          <ListItemText
                            primary={`Bus ${bus.busNumber}`}
                            secondary={
                              <Box>
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  Route: {bus.routeId?.routeName}
                                </Typography>
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  Speed: {bus.speed || 0} km/h
                                </Typography>
                              </Box>
                            }
                          />
                          <Chip
                            label={bus.isActive ? "Active" : "Inactive"}
                            color={bus.isActive ? "success" : "default"}
                            size="small"
                          />
                        </ListItem>
                        {index < nearbyBuses.length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Route Selection */}
          {routes.length > 0 && !selectedRoute && (
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <Route sx={{ mr: 1, verticalAlign: "middle" }} />
                    Available Routes
                  </Typography>

                  <List>
                    {routes.slice(0, 5).map((route) => (
                      <ListItem
                        key={route._id}
                        button
                        onClick={() => handleRouteSelect(route)}
                        sx={{ borderRadius: 1, mb: 1 }}
                      >
                        <ListItemText
                          primary={route.routeName}
                          secondary={`Route ${route.routeNumber} • ${route.stops.length} stops`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Selected Route and Buses */}
          {selectedRoute && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Route: {selectedRoute.routeName}
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid item xs={12} md={8}>
                      <MapComponent
                        route={selectedRoute}
                        buses={buses}
                        userLocation={userLocation}
                      />
                    </Grid>

                    <Grid item xs={12} md={4}>
                      <BusList buses={buses} route={selectedRoute} />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Arrival Prediction */}
          {selectedRoute && buses.length > 0 && userLocation && (
            <Grid item xs={12}>
              <ArrivalPrediction
                buses={buses}
                userLocation={userLocation}
                route={selectedRoute}
              />
            </Grid>
          )}
        </Grid>
      </Box>
    </Container>
  );
};

export default PassengerDashboard;
