import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { ArrowLeft } from "lucide-react";

const MAP_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY;

const containerStyle = { width: "100%", height: "100%" };

const center = { lat: 39.8283, lng: -98.5795 };

const darkMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#0a0f1c" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a0f1c" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#4a5568" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#1a2332" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#06b6d4", weight: 1 }] },
  { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#1e3a5f" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#0f1a2e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1a2332" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#14253d" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#060a14" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#1e3a5f" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

const mapOptions = {
  styles: darkMapStyles,
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  minZoom: 4,
  maxZoom: 18,
  restriction: {
    latLngBounds: { north: 50, south: 24, west: -130, east: -65 },
    strictBounds: false,
  },
};

export default function MapPage({ user }) {
  const navigate = useNavigate();
  const [map, setMap] = useState(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: MAP_KEY,
  });

  const onLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#060a14] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="font-orbitron text-red-400 text-sm mb-2">MAP LOAD ERROR</div>
          <div className="text-slate-500 text-xs">{loadError.message}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#060a14] text-white flex flex-col" data-testid="map-page">
      {/* Top bar */}
      <div className="border-b border-cyan-500/15 px-6 py-3 flex items-center justify-between bg-[rgba(6,10,20,0.95)] flex-shrink-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/hub")} className="text-slate-500 hover:text-cyan-400 transition-colors" data-testid="back-to-hub">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="font-orbitron text-sm tracking-wider text-cyan-400">SUBSCRIBER MAP</div>
            <div className="text-[9px] text-slate-500 font-orbitron tracking-wider">AED LOCATION MONITORING</div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {!isLoaded ? (
          <div className="flex items-center justify-center h-full">
            <div className="font-orbitron text-cyan-400 text-xs animate-pulse">LOADING MAP...</div>
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={center}
            zoom={5}
            options={mapOptions}
            onLoad={onLoad}
            onUnmount={onUnmount}
          />
        )}
      </div>
    </div>
  );
}
