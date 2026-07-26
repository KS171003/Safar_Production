import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Grid,
  Paper,
} from "@mui/material";
import {
  Warning,
  Emergency,
  MedicalServices,
  CarCrash,
  Build,
  Security,
  Help,
  CheckCircle,
  Cancel,
} from "@mui/icons-material";

const EmergencyAlert = () => {
  const { user } = useAuth();
  const [emergencyDialog, setEmergencyDialog] = useState(false);
  const [emergencyForm, setEmergencyForm] = useState({
    alertType: "medical",
    description: "",
    priority: "high",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [alerts, setAlerts] = useState([]);
  const [location, setLocation] = useState(null);

  useEffect(() => {
    fetchAlerts();
    getUserLocation();
  }, []);

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await fetch("/api/emergency");
      const data = await response.json();

      if (response.ok) {
        setAlerts(data);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Failed to fetch emergency alerts");
    }
  };

  const handleEmergencySubmit = async () => {
    if (!emergencyForm.description.trim()) {
      setError("Please provide a description");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/emergency", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          busId: user.busId,
          conductorId: user.id,
          alertType: emergencyForm.alertType,
          description: emergencyForm.description,
          priority: emergencyForm.priority,
          location: location,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess("Emergency alert sent successfully");
        setEmergencyDialog(false);
        setEmergencyForm({
          alertType: "medical",
          description: "",
          priority: "high",
        });
        fetchAlerts();
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Failed to send emergency alert");
    } finally {
      setLoading(false);
    }
  };

  const getAlertIcon = (alertType) => {
    switch (alertType) {
      case "medical":
        return <MedicalServices color="error" />;
      case "accident":
        return <CarCrash color="error" />;
      case "breakdown":
        return <Build color="warning" />;
      case "security":
        return <Security color="error" />;
      default:
        return <Help color="error" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "critical":
        return "error";
      case "high":
        return "warning";
      case "medium":
        return "info";
      case "low":
        return "default";
      default:
        return "default";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "error";
      case "acknowledged":
        return "warning";
      case "resolved":
        return "success";
      default:
        return "default";
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box className="main-content">
        <Typography variant="h4" gutterBottom>
          Emergency Management
        </Typography>

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
          {/* Emergency Button */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Send Emergency Alert
                </Typography>

                <Button
                  variant="contained"
                  color="error"
                  size="large"
                  startIcon={<Emergency />}
                  onClick={() => setEmergencyDialog(true)}
                  fullWidth
                  sx={{ py: 2, fontSize: "1.2rem" }}
                >
                  EMERGENCY SOS
                </Button>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 2 }}
                >
                  Press this button to send an emergency alert to the control
                  center
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Quick Actions */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Quick Actions
                </Typography>

                <Grid container spacing={1}>
                  {[
                    {
                      type: "medical",
                      label: "Medical Emergency",
                      icon: <MedicalServices />,
                    },
                    { type: "accident", label: "Accident", icon: <CarCrash /> },
                    { type: "breakdown", label: "Breakdown", icon: <Build /> },
                    {
                      type: "security",
                      label: "Security Issue",
                      icon: <Security />,
                    },
                  ].map((action) => (
                    <Grid item xs={6} key={action.type}>
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={action.icon}
                        onClick={() => {
                          setEmergencyForm({
                            ...emergencyForm,
                            alertType: action.type,
                          });
                          setEmergencyDialog(true);
                        }}
                        fullWidth
                        sx={{ py: 1 }}
                      >
                        {action.label}
                      </Button>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Recent Alerts */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Recent Emergency Alerts
                </Typography>

                {alerts.length === 0 ? (
                  <Alert severity="info">No emergency alerts found</Alert>
                ) : (
                  <List>
                    {alerts.slice(0, 5).map((alert, index) => (
                      <React.Fragment key={alert._id}>
                        <ListItem>
                          <ListItemIcon>
                            {getAlertIcon(alert.alertType)}
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Box
                                display="flex"
                                justifyContent="space-between"
                                alignItems="center"
                              >
                                <Typography variant="subtitle1">
                                  {alert.alertType.charAt(0).toUpperCase() +
                                    alert.alertType.slice(1)}{" "}
                                  Emergency
                                </Typography>
                                <Box>
                                  <Chip
                                    label={alert.priority}
                                    color={getPriorityColor(alert.priority)}
                                    size="small"
                                    sx={{ mr: 1 }}
                                  />
                                  <Chip
                                    label={alert.status}
                                    color={getStatusColor(alert.status)}
                                    size="small"
                                  />
                                </Box>
                              </Box>
                            }
                            secondary={
                              <Box>
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  {alert.description}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {new Date(alert.createdAt).toLocaleString()}
                                </Typography>
                              </Box>
                            }
                          />
                        </ListItem>
                        {index < alerts.length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Emergency Dialog */}
        <Dialog
          open={emergencyDialog}
          onClose={() => setEmergencyDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" alignItems="center">
              <Warning color="error" sx={{ mr: 1 }} />
              Send Emergency Alert
            </Box>
          </DialogTitle>
          <DialogContent>
            <FormControl fullWidth margin="normal">
              <InputLabel>Emergency Type</InputLabel>
              <Select
                value={emergencyForm.alertType}
                label="Emergency Type"
                onChange={(e) =>
                  setEmergencyForm({
                    ...emergencyForm,
                    alertType: e.target.value,
                  })
                }
              >
                <MenuItem value="medical">Medical Emergency</MenuItem>
                <MenuItem value="accident">Accident</MenuItem>
                <MenuItem value="breakdown">Vehicle Breakdown</MenuItem>
                <MenuItem value="security">Security Issue</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth margin="normal">
              <InputLabel>Priority</InputLabel>
              <Select
                value={emergencyForm.priority}
                label="Priority"
                onChange={(e) =>
                  setEmergencyForm({
                    ...emergencyForm,
                    priority: e.target.value,
                  })
                }
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              margin="normal"
              label="Description"
              multiline
              rows={4}
              value={emergencyForm.description}
              onChange={(e) =>
                setEmergencyForm({
                  ...emergencyForm,
                  description: e.target.value,
                })
              }
              placeholder="Please describe the emergency situation..."
            />

            {location && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Your current location will be included with this alert
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEmergencyDialog(false)}>Cancel</Button>
            <Button
              onClick={handleEmergencySubmit}
              variant="contained"
              color="error"
              disabled={loading}
              startIcon={
                loading ? <CircularProgress size={20} /> : <Emergency />
              }
            >
              {loading ? "Sending..." : "Send Alert"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default EmergencyAlert;
