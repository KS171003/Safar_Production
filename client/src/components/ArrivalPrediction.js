import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  Chip,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from "@mui/material";
import {
  Schedule,
  LocationOn,
  Speed,
  DirectionsBus,
  Warning,
} from "@mui/icons-material";

const ArrivalPrediction = ({ buses, userLocation, route }) => {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (buses.length > 0 && userLocation && route) {
      calculateArrivalPredictions();
    }
  }, [buses, userLocation, route]);

  const calculateArrivalPredictions = async () => {
    setLoading(true);
    setError("");

    try {
      const predictions = await Promise.all(
        buses.map(async (bus) => {
          try {
            const response = await fetch("/api/tracking/predict-arrival", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                busId: bus._id,
                passengerLat: userLocation.lat,
                passengerLon: userLocation.lng,
                destinationStopId: route.stops[route.stops.length - 1]._id,
              }),
            });

            const data = await response.json();

            if (response.ok) {
              return {
                bus,
                ...data,
              };
            } else {
              throw new Error(data.message);
            }
          } catch (err) {
            console.error(
              `Error predicting arrival for bus ${bus.busNumber}:`,
              err
            );
            return {
              bus,
              error: err.message,
            };
          }
        })
      );

      setPredictions(predictions);
    } catch (err) {
      setError("Failed to calculate arrival predictions");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (minutes) => {
    if (minutes < 1) return "Less than 1 minute";
    if (minutes < 60) return `${Math.round(minutes)} minutes`;

    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const formatDistance = (meters) => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const getArrivalStatus = (minutes) => {
    if (minutes < 5) return { label: "Arriving Soon", color: "success" };
    if (minutes < 15) return { label: "On Time", color: "primary" };
    if (minutes < 30) return { label: "Delayed", color: "warning" };
    return { label: "Late", color: "error" };
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Arrival Predictions
          </Typography>
          <LinearProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Calculating arrival times...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Arrival Predictions
          </Typography>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  if (predictions.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Arrival Predictions
          </Typography>
          <Alert severity="info">No buses available for prediction</Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          <Typography variant="h6" sx={{ mr: 2 }}>
            <Schedule sx={{ mr: 1, verticalAlign: "middle" }} />
            Arrival Predictions
          </Typography>
          <Chip label="ML-Powered" color="secondary" size="small" variant="outlined" />
        </Box>

        <Grid container spacing={2}>
          {predictions.map((prediction, index) => {
            if (prediction.error) {
              return (
                <Grid item xs={12} md={6} key={prediction.bus._id}>
                  <Alert severity="warning">
                    Unable to predict arrival for Bus {prediction.bus.busNumber}
                  </Alert>
                </Grid>
              );
            }

            const arrivalStatus = getArrivalStatus(prediction.timeToPassenger);
            const progress = Math.min(
              100,
              Math.max(0, 100 - (prediction.timeToPassenger / 30) * 100)
            );

            return (
              <Grid item xs={12} md={6} key={prediction.bus._id}>
                <Card variant="outlined">
                  <CardContent>
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                      mb={2}
                    >
                      <Typography variant="h6">
                        Bus {prediction.bus.busNumber}
                      </Typography>
                      <Chip
                        label={arrivalStatus.label}
                        color={arrivalStatus.color}
                        size="small"
                      />
                    </Box>

                    <Box mb={2}>
                      <Box display="flex" alignItems="baseline" gutterBottom>
                        <Typography variant="h4" color="primary" sx={{ mr: 1 }}>
                          {formatTime(prediction.timeToPassenger)}
                        </Typography>
                        {prediction.confidenceInterval && (
                          <Typography variant="subtitle1" color="text.secondary">
                            ± {prediction.confidenceInterval} min
                          </Typography>
                        )}
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                    </Box>

                    <List dense>
                      <ListItem>
                        <ListItemIcon>
                          <LocationOn color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Distance to you"
                          secondary={formatDistance(
                            prediction.distanceToPassenger
                          )}
                        />
                      </ListItem>

                      <ListItem>
                        <ListItemIcon>
                          <Speed color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Current speed"
                          secondary={`${prediction.currentSpeed} km/h`}
                        />
                      </ListItem>

                      <ListItem>
                        <ListItemIcon>
                          <DirectionsBus color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Distance to destination"
                          secondary={formatDistance(
                            prediction.distanceToDestination
                          )}
                        />
                      </ListItem>
                    </List>

                    {prediction.bus.emergencyStatus === "emergency" && (
                      <Alert severity="error" sx={{ mt: 2 }}>
                        <Warning sx={{ mr: 1 }} />
                        This bus has an active emergency alert
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        <Box mt={2}>
          {predictions.length > 0 && predictions[0].modelAccuracy && (
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Model Accuracy: {(predictions[0].modelAccuracy * 100).toFixed(1)}%
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            * Predictions are based on current bus location and speed. Actual
            arrival times may vary due to traffic conditions.
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ArrivalPrediction;
