/* global google */
import React, { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Box,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Alert,
} from "@mui/material";
import { Map as MapIcon, Key as KeyIcon } from "@mui/icons-material";

const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 }; // Delhi

const MapComponent = ({ bus, route, buses, location, userLocation, onLocationUpdate }) => {
  const containerRef = useRef(null);
  
  // Stored / configured API key
  const [apiKey, setApiKey] = useState(() => {
    return (
      localStorage.getItem("safar_google_maps_key") ||
      (process.env.REACT_APP_GOOGLE_MAPS_API_KEY &&
      process.env.REACT_APP_GOOGLE_MAPS_API_KEY !== "your-google-maps-api-key-here" &&
      process.env.REACT_APP_GOOGLE_MAPS_API_KEY !== "your-api-key-here"
        ? process.env.REACT_APP_GOOGLE_MAPS_API_KEY
        : "")
    );
  });

  // Active engine: 'leaflet' (OpenStreetMap) or 'google'
  const [engine, setEngine] = useState(() => (apiKey ? "google" : "leaflet"));
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);
  const [googleLoadError, setGoogleLoadError] = useState("");

  // Leaflet map refs
  const leafletMapRef = useRef(null);
  const leafletLayersRef = useRef({ markers: [], polyline: null, busMarker: null });

  // Google map refs
  const googleMapRef = useRef(null);
  const googleLayersRef = useRef({ markers: [], busMarker: null, directionsRenderer: null });

  // Initialize and switch engines
  useEffect(() => {
    let isCancelled = false;

    // Teardown existing Leaflet instance if present
    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
    }
    googleMapRef.current = null;

    if (engine === "google" && apiKey) {
      const loader = new Loader({
        apiKey,
        version: "weekly",
        libraries: ["places", "geometry"],
      });

      loader
        .load()
        .then((googleInstance) => {
          if (isCancelled || !containerRef.current) return;
          try {
            const gMap = new googleInstance.maps.Map(containerRef.current, {
              center: DEFAULT_CENTER,
              zoom: 13,
              mapTypeId: googleInstance.maps.MapTypeId.ROADMAP,
              styles: [{ featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }],
            });
            googleMapRef.current = gMap;
            setGoogleLoadError("");
            renderGoogleMapData();
          } catch (e) {
            console.warn("Failed to initialize Google Map, falling back to Leaflet", e);
            setGoogleLoadError("Google Maps initialization failed. Switched to OpenStreetMap.");
            setEngine("leaflet");
          }
        })
        .catch((err) => {
          if (isCancelled) return;
          console.warn("Google Maps API Key invalid or blocked, falling back to Leaflet:", err.message);
          setGoogleLoadError("Invalid or restricted Google Maps API key. Switched to OpenStreetMap.");
          setEngine("leaflet");
        });
    } else {
      // Leaflet / OpenStreetMap initialization
      if (!containerRef.current) return;

      const lMap = L.map(containerRef.current, {
        center: [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
        zoom: 13,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(lMap);

      leafletMapRef.current = lMap;
      renderLeafletMapData();
    }

    return () => {
      isCancelled = true;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [engine, apiKey]);

  // Update whenever route, bus, location, or userLocation changes
  useEffect(() => {
    if (engine === "google" && googleMapRef.current) {
      renderGoogleMapData();
    } else if (engine === "leaflet" && leafletMapRef.current) {
      renderLeafletMapData();
    }
  }, [route, bus, buses, location, userLocation]);

  // Render on Leaflet
  const renderLeafletMapData = () => {
    const map = leafletMapRef.current;
    if (!map) return;

    // Clear previous layers
    leafletLayersRef.current.markers.forEach((m) => m.remove());
    leafletLayersRef.current.markers = [];
    if (leafletLayersRef.current.polyline) {
      leafletLayersRef.current.polyline.remove();
      leafletLayersRef.current.polyline = null;
    }
    if (leafletLayersRef.current.busMarker) {
      leafletLayersRef.current.busMarker.remove();
      leafletLayersRef.current.busMarker = null;
    }

    const bounds = [];

    // 1. Draw route and stops
    if (route && route.stops && route.stops.length > 0) {
      const latLngs = route.stops.map((s) => [s.location.latitude, s.location.longitude]);
      bounds.push(...latLngs);

      // Route line
      const polyline = L.polyline(latLngs, {
        color: "#1976d2",
        weight: 5,
        opacity: 0.85,
        smoothFactor: 1,
      }).addTo(map);
      leafletLayersRef.current.polyline = polyline;

      // Stop pins
      route.stops.forEach((stop, idx) => {
        const stopMarker = L.circleMarker([stop.location.latitude, stop.location.longitude], {
          radius: 9,
          fillColor: "#1976d2",
          color: "#ffffff",
          weight: 2,
          fillOpacity: 1,
        })
          .addTo(map)
          .bindPopup(`
            <div style="font-family: sans-serif; font-size: 13px;">
              <strong style="color: #1976d2;">Stop ${idx + 1}: ${stop.name}</strong><br/>
              <span>Estimated Offset: ${stop.estimatedTime} min</span>
            </div>
          `);
        leafletLayersRef.current.markers.push(stopMarker);
      });
    }

    // 2. Draw live bus marker
    const activeLoc = location || (bus && bus.currentLocation ? { lat: bus.currentLocation.latitude, lng: bus.currentLocation.longitude } : null);
    if (activeLoc && activeLoc.lat && activeLoc.lng) {
      bounds.push([activeLoc.lat, activeLoc.lng]);
      const isEmergency = bus?.emergencyStatus === "emergency";
      
      const busMarker = L.circleMarker([activeLoc.lat, activeLoc.lng], {
        radius: 13,
        fillColor: isEmergency ? "#d32f2f" : "#2e7d32",
        color: "#ffffff",
        weight: 3,
        fillOpacity: 1,
      })
        .addTo(map)
        .bindPopup(`
          <div style="font-family: sans-serif; font-size: 13px;">
            <strong style="color: ${isEmergency ? '#d32f2f' : '#2e7d32'};">🚌 Bus ${bus?.busNumber || "Active"}</strong><br/>
            <span>Speed: ${bus?.speed || 0} km/h</span><br/>
            <span>Status: ${isEmergency ? "EMERGENCY" : bus?.isActive ? "Active" : "On Route"}</span>
          </div>
        `);
      leafletLayersRef.current.busMarker = busMarker;
    }

    // 3. Draw passenger / user location if provided
    if (userLocation && userLocation.lat && userLocation.lng) {
      bounds.push([userLocation.lat, userLocation.lng]);
      const userMarker = L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 8,
        fillColor: "#ff9800",
        color: "#ffffff",
        weight: 2,
        fillOpacity: 1,
      })
        .addTo(map)
        .bindPopup("<strong>📍 Your Location</strong>");
      leafletLayersRef.current.markers.push(userMarker);
    }

    // Fit map to content
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    }
  };

  // Render on Google Maps
  const renderGoogleMapData = () => {
    const gMap = googleMapRef.current;
    if (!gMap || typeof google === "undefined" || !google.maps) return;

    // Clear old Google markers
    googleLayersRef.current.markers.forEach((m) => m.setMap(null));
    googleLayersRef.current.markers = [];
    if (googleLayersRef.current.busMarker) {
      googleLayersRef.current.busMarker.setMap(null);
      googleLayersRef.current.busMarker = null;
    }

    const bounds = new google.maps.LatLngBounds();

    if (route && route.stops && route.stops.length > 0) {
      route.stops.forEach((stop, idx) => {
        const pos = { lat: stop.location.latitude, lng: stop.location.longitude };
        bounds.extend(pos);

        const marker = new google.maps.Marker({
          position: pos,
          map: gMap,
          title: stop.name,
          label: { text: String(idx + 1), color: "white", fontWeight: "bold" },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: "#1976d2",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });
        googleLayersRef.current.markers.push(marker);
      });
      gMap.fitBounds(bounds);
    }

    const activeLoc = location || (bus && bus.currentLocation ? { lat: bus.currentLocation.latitude, lng: bus.currentLocation.longitude } : null);
    if (activeLoc && activeLoc.lat && activeLoc.lng) {
      const busMarker = new google.maps.Marker({
        position: { lat: activeLoc.lat, lng: activeLoc.lng },
        map: gMap,
        title: `Bus ${bus?.busNumber || ""}`,
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 7,
          fillColor: bus?.emergencyStatus === "emergency" ? "#d32f2f" : "#2e7d32",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
      googleLayersRef.current.busMarker = busMarker;
    }
  };

  const handleSaveKey = () => {
    const trimmed = tempKey.trim();
    localStorage.setItem("safar_google_maps_key", trimmed);
    setApiKey(trimmed);
    if (trimmed) {
      setEngine("google");
    } else {
      setEngine("leaflet");
    }
    setKeyDialogOpen(false);
  };

  return (
    <Box sx={{ position: "relative", width: "100%", height: 420, borderRadius: 2, overflow: "hidden", border: "1px solid #e0e0e0" }}>
      {/* Map Control Bar Overlay */}
      <Box
        sx={{
          position: "absolute",
          top: 10,
          right: 10,
          zIndex: 1000,
          display: "flex",
          gap: 1,
          alignItems: "center",
          backgroundColor: "rgba(255, 255, 255, 0.92)",
          padding: "4px 8px",
          borderRadius: 3,
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        }}
      >
        <Chip
          icon={<MapIcon fontSize="small" />}
          label={engine === "google" ? "Google Maps" : "OpenStreetMap (Free/Offline)"}
          color={engine === "google" ? "primary" : "success"}
          size="small"
          onClick={() => setEngine(engine === "google" ? "leaflet" : apiKey ? "google" : "leaflet")}
        />
        <Button
          size="small"
          variant="outlined"
          startIcon={<KeyIcon fontSize="small" />}
          onClick={() => setKeyDialogOpen(true)}
          sx={{ textTransform: "none", py: 0.2, px: 1, minHeight: 24, fontSize: "0.75rem" }}
        >
          API Key
        </Button>
      </Box>

      {/* Optional fallback notification banner */}
      {googleLoadError && (
        <Alert
          severity="info"
          onClose={() => setGoogleLoadError("")}
          sx={{
            position: "absolute",
            top: 50,
            left: 10,
            right: 10,
            zIndex: 1000,
            boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
          }}
        >
          {googleLoadError} (Using OpenStreetMap seamlessly with full live tracking).
        </Alert>
      )}

      {/* The Actual Map Container DOM element */}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* API Key Configuration Modal */}
      <Dialog open={keyDialogOpen} onClose={() => setKeyDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Map Engine & API Settings</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            SAFAR supports both <strong>OpenStreetMap</strong> (completely free, zero API key needed, offline-ready) and <strong>Google Maps</strong>.
          </Typography>
          <TextField
            fullWidth
            label="Google Maps API Key (Optional)"
            placeholder="AIzaSy..."
            value={tempKey}
            onChange={(e) => setTempKey(e.target.value)}
            helperText="Leave empty to use OpenStreetMap for free."
            margin="dense"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setTempKey(""); setApiKey(""); setEngine("leaflet"); localStorage.removeItem("safar_google_maps_key"); setKeyDialogOpen(false); }}>
            Use OpenStreetMap
          </Button>
          <Button variant="contained" onClick={handleSaveKey}>
            Save & Apply
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MapComponent;
