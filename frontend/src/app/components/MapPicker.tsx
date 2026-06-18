'use client';

import { useEffect, useMemo } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from 'react-leaflet';

// ─── Custom marker icon (avoids broken default icon paths in bundlers) ────────

const markerIcon = L.divIcon({
  className: 'wiz-map-marker',
  html: `
    <div style="
      position: relative;
      width: 28px;
      height: 36px;
      transform: translate(-50%, -100%);
    ">
      <div style="
        width: 28px;
        height: 28px;
        border-radius: 999px;
        background: #1d1d1f;
        box-shadow: 0 4px 12px rgba(0,0,0,0.35), inset 0 0 0 3px #ffffff;
        position: absolute;
        top: 0;
        left: 0;
      "></div>
      <div style="
        position: absolute;
        bottom: 0;
        left: 50%;
        width: 0;
        height: 0;
        transform: translateX(-50%);
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-top: 8px solid #1d1d1f;
        filter: drop-shadow(0 2px 1px rgba(0,0,0,0.2));
      "></div>
    </div>
  `,
  iconSize: [28, 36],
  iconAnchor: [14, 36],
});

// ─── Internal: keep marker draggable and clickable ────────────────────────────

function ClickHandler({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click: (e) => onPick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

function MapController({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    // Smoothly recenter when external lat/lon change (e.g. preset selection)
    map.flyTo([lat, lon], map.getZoom(), { duration: 0.6 });
  }, [lat, lon, map]);
  return null;
}

// ─── Public component ────────────────────────────────────────────────────────

interface MapPickerProps {
  lat: number;
  lon: number;
  onChange: (lat: number, lon: number) => void;
}

export default function MapPicker({ lat, lon, onChange }: MapPickerProps) {
  const validLat = Number.isFinite(lat) ? lat : 23.1136;
  const validLon = Number.isFinite(lon) ? lon : -82.3666;

  const center = useMemo<[number, number]>(() => [validLat, validLon], [validLat, validLon]);

  return (
    <MapContainer
      center={center}
      zoom={9}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={false}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap'
      />
      <Marker
        position={center}
        icon={markerIcon}
        draggable
        eventHandlers={{
          dragend: (e) => {
            const latlng = e.target.getLatLng();
            onChange(latlng.lat, latlng.lng);
          },
        }}
      />
      <ClickHandler onPick={onChange} />
      <MapController lat={validLat} lon={validLon} />
    </MapContainer>
  );
}
