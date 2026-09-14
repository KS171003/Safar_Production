import React, { useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Box,
  Button,
  Divider,
  Alert,
} from "@mui/material";
import {
  DirectionsBus,
  LocationOn,
  Speed,
  Schedule,
  Visibility,
} from "@mui/icons-material";

const BusList = ({ buses, route }) => {
  const [selectedBus, setSelectedBus] = useState(null);

  const getBusStatus = (bus) => {
    if (bus.emergencyStatus === "emergency")
      return { label: "Emergency", color: "error" };
    if (bus.isActive && bus.isOnRoute)
      return { label: "Active", color: "success" };
    if (bus.isActive) return { label: "Starting", color: "warning" };
    return { label: "Inactive", color: "default" };
  };

  const getNextStop = (bus) => {
    if (!bus.routeId || !bus.currentStopIndex) return "Unknown";

    const currentStopIndex = bus.currentStopIndex || 0;
    const nextStop = bus.routeId.stops[currentStopIndex + 1];

    return nextStop ? nextStop.name : "End of Route";
  };

  const getEstimatedArrival = (bus) => {
    if (!bus.estimatedArrivalTime) return "Unknown";

    const now = new Date();
    const arrival = new Date(bus.estimatedArrivalTime);
    const diffMinutes = Math.round((arrival - now) / (1000 * 60));

    if (diffMinutes <= 0) return "Arriving now";
    if (diffMinutes < 60) return `${diffMinutes} min`;

    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

  if (buses.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Available Buses
          </Typography>
          <Alert severity="info">No buses currently active on this route</Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Available Buses ({buses.length})
        </Typography>

        <List>
          {buses.map((bus, index) => {
            const status = getBusStatus(bus);
            const isSelected = selectedBus?._id === bus._id;

            return (
              <React.Fragment key={bus._id}>
                <ListItem
                  sx={{
                    borderRadius: 1,
                    mb: 1,
                    bgcolor: isSelected ? "primary.50" : "transparent",
                    border: isSelected ? "2px solid" : "1px solid",
                    borderColor: isSelected ? "primary.main" : "grey.300",
                    cursor: "pointer",
                  }}
                  onClick={() => setSelectedBus(bus)}
                >
                  <ListItemIcon>
                    <DirectionsBus
                      color={
                        bus.emergencyStatus === "emergency"
                          ? "error"
                          : "primary"
                      }
                    />
                  </ListItemIcon>

                  <ListItemText
                    primary={
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Typography variant="subtitle1" fontWeight="medium">
                          Bus {bus.busNumber}
                        </Typography>
                        <Chip
                          label={status.label}
                          color={status.color}
                          size="small"
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Box display="flex" alignItems="center" mb={0.5}>
                          <LocationOn sx={{ fontSize: 16, mr: 0.5 }} />
                          <Typography variant="body2" color="text.secondary">
                            Next: {getNextStop(bus)}
                          </Typography>
                        </Box>

                        <Box display="flex" alignItems="center" mb={0.5}>
                          <Speed sx={{ fontSize: 16, mr: 0.5 }} />
                          <Typography variant="body2" color="text.secondary">
                            {bus.speed || 0} km/h
                          </Typography>
                        </Box>

                        <Box display="flex" alignItems="center">
                          <Schedule sx={{ fontSize: 16, mr: 0.5 }} />
                          <Typography variant="body2" color="text.secondary">
                            ETA: {getEstimatedArrival(bus)}
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>

                {isSelected && (
                  <Box sx={{ ml: 4, mb: 2 }}>
                    <Button
                      variant="outlined"
                      startIcon={<Visibility />}
                      size="small"
                      fullWidth
                    >
                      Track This Bus
                    </Button>
                  </Box>
                )}

                {index < buses.length - 1 && <Divider />}
              </React.Fragment>
            );
          })}
        </List>
      </CardContent>
    </Card>
  );
};

export default BusList;
