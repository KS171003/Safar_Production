import React, { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";

const MapComponent = ({ bus, route, location, onLocationUpdate }) => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [directionsService, setDirectionsService] = useState(null);
  const [directionsRenderer, setDirectionsRenderer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    initializeMap();
  }, []);

  useEffect(() => {
    if (map && route) {
      displayRoute();
    }
  }, [map, route]);

  useEffect(() => {
    if (map && location) {
      updateBusLocation();
    }
  }, [map, location]);

  const initializeMap = async () => {
    try {
      const loader = new Loader({
        apiKey:
          process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "your-api-key-here",
        version: "weekly",
        libraries: ["places", "geometry"],
      });

      const google = await loader.load();

      const mapInstance = new google.maps.Map(mapRef.current, {
        center: { lat: 28.6139, lng: 77.209 }, // Default to Delhi
        zoom: 12,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
        ],
      });

      const directionsServiceInstance = new google.maps.DirectionsService();
      const directionsRendererInstance = new google.maps.DirectionsRenderer({
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: "#1976d2",
          strokeWeight: 4,
          strokeOpacity: 0.8,
        },
      });

      directionsRendererInstance.setMap(mapInstance);

      setMap(mapInstance);
      setDirectionsService(directionsServiceInstance);
      setDirectionsRenderer(directionsRendererInstance);
      setLoading(false);
    } catch (err) {
      console.error("Error loading Google Maps:", err);
      setError("Failed to load map. Please check your Google Maps API key.");
      setLoading(false);
    }
  };

  const displayRoute = () => {
    if (!map || !route || !directionsService || !directionsRenderer) return;

    const waypoints = route.stops.slice(1, -1).map((stop) => ({
      location: { lat: stop.location.latitude, lng: stop.location.longitude },
      stopover: true,
    }));

    const request = {
      origin: {
        lat: route.stops[0].location.latitude,
        lng: route.stops[0].location.longitude,
      },
      destination: {
        lat: route.stops[route.stops.length - 1].location.latitude,
        lng: route.stops[route.stops.length - 1].location.longitude,
      },
      waypoints: waypoints,
      travelMode: google.maps.TravelMode.DRIVING,
      optimizeWaypoints: true,
    };

    directionsService.route(request, (result, status) => {
      if (status === "OK") {
        directionsRenderer.setDirections(result);

        // Add stop markers
        const stopMarkers = route.stops.map((stop, index) => {
          const marker = new google.maps.Marker({
            position: {
              lat: stop.location.latitude,
              lng: stop.location.longitude,
            },
            map: map,
            title: stop.name,
            label: {
              text: (index + 1).toString(),
              color: "white",
              fontWeight: "bold",
            },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 12,
              fillColor: "#1976d2",
              fillOpacity: 1,
              strokeColor: "white",
              strokeWeight: 2,
            },
          });

          const infoWindow = new google.maps.InfoWindow({
            content: `
              <div>
                <h4>${stop.name}</h4>
                <p>Stop ${index + 1}</p>
                <p>Estimated Time: ${stop.estimatedTime} minutes</p>
              </div>
            `,
          });

          marker.addListener("click", () => {
            infoWindow.open(map, marker);
          });

          return marker;
        });

        setMarkers((prev) => [...prev, ...stopMarkers]);
      }
    });
  };

  const updateBusLocation = () => {
    if (!map || !location) return;

    // Remove existing bus marker
    const existingBusMarker = markers.find((marker) => marker.busMarker);
    if (existingBusMarker) {
      existingBusMarker.setMap(null);
    }

    // Add new bus marker
    const busMarker = new google.maps.Marker({
      position: { lat: location.lat, lng: location.lng },
      map: map,
      title: `Bus ${bus?.busNumber}`,
      icon: {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 8,
        fillColor: bus?.emergencyStatus === "emergency" ? "#dc3545" : "#28a745",
        fillOpacity: 1,
        strokeColor: "white",
        strokeWeight: 2,
        rotation: 0,
      },
    });

    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div>
          <h4>Bus ${bus?.busNumber}</h4>
          <p>Status: ${bus?.isActive ? "Active" : "Inactive"}</p>
          <p>Speed: ${bus?.speed || 0} km/h</p>
          <p>Last Update: ${new Date().toLocaleTimeString()}</p>
        </div>
      `,
    });

    busMarker.addListener("click", () => {
      infoWindow.open(map, busMarker);
    });

    busMarker.busMarker = true;
    setMarkers((prev) => [...prev.filter((m) => !m.busMarker), busMarker]);

    // Center map on bus location
    map.setCenter({ lat: location.lat, lng: location.lng });
  };

  if (loading) {
    return (
      <div className="map-container">
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100%",
            backgroundColor: "#f5f5f5",
          }}
        >
          <div>Loading map...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="map-container">
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100%",
            backgroundColor: "#f5f5f5",
            color: "#dc3545",
            textAlign: "center",
            padding: "20px",
          }}
        >
          <div>
            <div style={{ fontSize: "18px", marginBottom: "10px" }}>⚠️</div>
            <div>{error}</div>
            <div style={{ fontSize: "14px", marginTop: "10px", color: "#666" }}>
              Please add your Google Maps API key to the environment variables
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="map-container">
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
};

export default MapComponent;
