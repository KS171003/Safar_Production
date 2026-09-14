import React, { useState, useEffect } from "react";
import api from "../utils/api";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
} from "@mui/material";
import { PlayArrow } from "@mui/icons-material";

const RouteSelector = ({ onRouteSelect }) => {
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchRoutes();
  }, []);

  const fetchRoutes = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/route");
      const list = Array.isArray(res.data) ? res.data : (res.data?.routes || []);
      setRoutes(list);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch routes");
    } finally {
      setLoading(false);
    }
  };

  const handleStartRoute = () => {
    if (selectedRoute) {
      const route = routes.find((r) => r._id === selectedRoute);
      onRouteSelect(route);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" py={2}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <FormControl fullWidth margin="normal">
        <InputLabel id="route-select-label">Select Route</InputLabel>
        <Select
          labelId="route-select-label"
          id="route-select"
          value={selectedRoute}
          label="Select Route"
          onChange={(e) => setSelectedRoute(e.target.value)}
        >
          {routes.map((route) => (
            <MenuItem key={route._id} value={route._id}>
              <Box>
                <Typography variant="body1" fontWeight="medium">
                  {route.routeName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Route {route.routeNumber} • {route.stops.length} stops
                </Typography>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Button
        variant="contained"
        startIcon={<PlayArrow />}
        onClick={handleStartRoute}
        disabled={!selectedRoute}
        fullWidth
        sx={{ mt: 2 }}
      >
        Start Route
      </Button>
    </Box>
  );
};

export default RouteSelector;
