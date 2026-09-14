import React, { useState, useEffect } from "react";
import api from "../utils/api";
import {
  Container,
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Chip,
  Grid,
  Divider,
  CircularProgress,
} from "@mui/material";
import {
  Add,
  Edit,
  Delete,
  LocationOn,
  Save,
} from "@mui/icons-material";

const RouteManagement = () => {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState(null);
  const [routeForm, setRouteForm] = useState({
    routeName: "",
    routeNumber: "",
    description: "",
    stops: [],
  });
  const [newStop, setNewStop] = useState({
    name: "",
    latitude: "",
    longitude: "",
    estimatedTime: "",
  });

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

  const handleCreateRoute = () => {
    setEditingRoute(null);
    setRouteForm({
      routeName: "",
      routeNumber: "",
      description: "",
      stops: [],
    });
    setDialogOpen(true);
  };

  const handleEditRoute = (route) => {
    setEditingRoute(route);
    setRouteForm({
      routeName: route.routeName,
      routeNumber: route.routeNumber,
      description: route.description || "",
      stops: route.stops || [],
    });
    setDialogOpen(true);
  };

  const handleSaveRoute = async () => {
    if (
      !routeForm.routeName ||
      !routeForm.routeNumber ||
      routeForm.stops.length < 2
    ) {
      setError("Please fill in all required fields and add at least 2 stops");
      return;
    }

    try {
      if (editingRoute) {
        await api.put(`/api/route/${editingRoute._id}`, routeForm);
        setSuccess("Route updated successfully");
      } else {
        await api.post("/api/route", routeForm);
        setSuccess("Route created successfully");
      }
      setDialogOpen(false);
      fetchRoutes();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save route");
    }
  };

  const handleDeleteRoute = async (routeId) => {
    if (!window.confirm("Are you sure you want to delete this route?")) {
      return;
    }

    try {
      await api.delete(`/api/route/${routeId}`);
      setSuccess("Route deleted successfully");
      fetchRoutes();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete route");
    }
  };

  const addStop = () => {
    if (!newStop.name || !newStop.latitude || !newStop.longitude) {
      setError("Please fill in all stop fields");
      return;
    }

    const stop = {
      name: newStop.name,
      location: {
        latitude: parseFloat(newStop.latitude),
        longitude: parseFloat(newStop.longitude),
      },
      estimatedTime: parseInt(newStop.estimatedTime) || 0,
    };

    setRouteForm({
      ...routeForm,
      stops: [...routeForm.stops, stop],
    });

    setNewStop({
      name: "",
      latitude: "",
      longitude: "",
      estimatedTime: 0,
    });
  };

  const removeStop = (index) => {
    const newStops = routeForm.stops.filter((_, i) => i !== index);
    setRouteForm({
      ...routeForm,
      stops: newStops,
    });
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
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={3}
        >
          <Typography variant="h4">Route Management</Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleCreateRoute}
          >
            Create Route
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        <Grid container spacing={3}>
          {routes.map((route) => (
            <Grid item xs={12} md={6} key={route._id}>
              <Card>
                <CardContent>
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="start"
                    mb={2}
                  >
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        {route.routeName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Route {route.routeNumber}
                      </Typography>
                    </Box>
                    <Box>
                      <IconButton
                        size="small"
                        onClick={() => handleEditRoute(route)}
                        color="primary"
                      >
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteRoute(route._id)}
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    </Box>
                  </Box>

                  {route.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 2 }}
                    >
                      {route.description}
                    </Typography>
                  )}

                  <Box display="flex" alignItems="center" mb={2}>
                    <LocationOn sx={{ mr: 1, fontSize: 16 }} />
                    <Typography variant="body2">
                      {route.stops.length} stops
                    </Typography>
                  </Box>

                  <List dense>
                    {route.stops.slice(0, 3).map((stop, index) => (
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
                          secondary={`${stop.location.latitude.toFixed(
                            4
                          )}, ${stop.location.longitude.toFixed(4)}`}
                        />
                      </ListItem>
                    ))}
                    {route.stops.length > 3 && (
                      <ListItem>
                        <ListItemText
                          primary={`... and ${
                            route.stops.length - 3
                          } more stops`}
                          sx={{ fontStyle: "italic" }}
                        />
                      </ListItem>
                    )}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Route Dialog */}
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            {editingRoute ? "Edit Route" : "Create New Route"}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Route Name"
                  value={routeForm.routeName}
                  onChange={(e) =>
                    setRouteForm({
                      ...routeForm,
                      routeName: e.target.value,
                    })
                  }
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Route Number"
                  value={routeForm.routeNumber}
                  onChange={(e) =>
                    setRouteForm({
                      ...routeForm,
                      routeNumber: e.target.value,
                    })
                  }
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  multiline
                  rows={2}
                  value={routeForm.description}
                  onChange={(e) =>
                    setRouteForm({
                      ...routeForm,
                      description: e.target.value,
                    })
                  }
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>
              Add Stops
            </Typography>

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Stop Name"
                  value={newStop.name}
                  onChange={(e) =>
                    setNewStop({
                      ...newStop,
                      name: e.target.value,
                    })
                  }
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="Latitude"
                  type="number"
                  value={newStop.latitude}
                  onChange={(e) =>
                    setNewStop({
                      ...newStop,
                      latitude: e.target.value,
                    })
                  }
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="Longitude"
                  type="number"
                  value={newStop.longitude}
                  onChange={(e) =>
                    setNewStop({
                      ...newStop,
                      longitude: e.target.value,
                    })
                  }
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField
                  fullWidth
                  label="Time (min)"
                  type="number"
                  value={newStop.estimatedTime}
                  onChange={(e) =>
                    setNewStop({
                      ...newStop,
                      estimatedTime: e.target.value,
                    })
                  }
                />
              </Grid>
            </Grid>

            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={addStop}
              sx={{ mb: 2 }}
            >
              Add Stop
            </Button>

            {routeForm.stops.length > 0 && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Route Stops ({routeForm.stops.length})
                </Typography>
                <List>
                  {routeForm.stops.map((stop, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <Chip label={index + 1} size="small" color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={stop.name}
                        secondary={`${stop.location.latitude}, ${stop.location.longitude} • ${stop.estimatedTime} min`}
                      />
                      <IconButton
                        size="small"
                        onClick={() => removeStop(index)}
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSaveRoute}
              variant="contained"
              startIcon={<Save />}
            >
              {editingRoute ? "Update" : "Create"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default RouteManagement;
