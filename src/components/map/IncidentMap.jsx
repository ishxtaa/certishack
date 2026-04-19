import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, Polyline, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AIRPORT_CENTER, getSeverityLevel } from '@/lib/securityUtils';

// Changi Airport bounds
const CHANGI_BOUNDS = [
[1.3300, 103.9500], // SW
[1.3750, 103.9950] // NE
];

// Type assertion helper for Leaflet coordinates
const toLatLng = (coords) => coords;
const toLatLngBounds = (bounds) => bounds;

const SEVERITY_MARKER_COLORS = {
  critical: '#dc2626',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e'
};

function createOfficerIcon(officer) {
  const initials = officer.name ?
  officer.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() :
  '??';
  const statusColor = {
    available: '#22c55e',
    on_patrol: '#3b82f6',
    responding: '#f97316',
    off_duty: '#6b7280'
  }[officer.status] || '#3b82f6';

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="36" viewBox="0 0 32 36">
      <circle cx="16" cy="15" r="14" fill="#0f1f3d" stroke="${statusColor}" stroke-width="2.5"/>
      <text x="16" y="20" text-anchor="middle" font-size="11" font-weight="700" font-family="Inter,sans-serif" fill="white">${initials}</text>
      <polygon points="10,28 22,28 16,36" fill="#0f1f3d" stroke="${statusColor}" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`;

  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [32, 36],
    iconAnchor: [16, 36],
    popupAnchor: [0, -36]
  });
}

function MapEvents({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 16, { duration: 0.8 });
    }
  }, [center, map]);
  return null;
}

export default function IncidentMap({
  incidents = [],
  officers = [],
  selectedIncident = null,
  onIncidentClick = null,
  patrolRoute = null,
  className = ""
}) {
  const focusCenter = selectedIncident?.latitude && selectedIncident?.longitude ?
  [selectedIncident.latitude, selectedIncident.longitude] :
  null;

  return (
    <div className="bg-transparent text-black opacity-100 rounded w-full h-full" style={{ background: '#0a0f1e' }}>
      <MapContainer
        center={toLatLng(AIRPORT_CENTER)}
        zoom={14}
        maxZoom={18}
        minZoom={12}

        className="w-full h-full rounded-xl"
        zoomControl={false}>
        
        {/* Navy-blue dark tiles */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>' 
          className="navy-map" />
        
        <MapEvents center={focusCenter} />

        {/* Incident markers */}
        {incidents.map((inc) => {
          if (!inc.latitude || !inc.longitude) return null;
          // Ensure severity is a number, default to 5 if undefined/null
          const severity = typeof inc.severity === 'number' ? inc.severity : 5;
          const level = getSeverityLevel(severity);
          const color = SEVERITY_MARKER_COLORS[level] || SEVERITY_MARKER_COLORS.medium;
          const isActive = inc.status === 'active' || inc.status === 'responding';
          return (
            <CircleMarker
              key={inc.id}
              center={[inc.latitude, inc.longitude]}
              radius={isActive ? 11 : 7}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: isActive ? 0.75 : 0.4,
                weight: selectedIncident?.id === inc.id ? 3 : 1.5
              }}
              eventHandlers={{ click: () => onIncidentClick?.(inc) }}>
              
              <Popup>
                <div className="text-xs space-y-1">
                  <p className="font-semibold">{inc.title}</p>
                  <p className="text-muted-foreground">{inc.location_name}</p>
                  <p>Severity: {severity}/10 ({level})</p>
                  <p style={{ color: color }}>● Marker Color</p>
                </div>
              </Popup>
            </CircleMarker>);

        })}

        {/* Officer avatar markers */}
        {officers.map((off) => {
          console.log('[IncidentMap] Officer:', off.name, 'lat:', off.latitude, 'lng:', off.longitude);
          if (!off.latitude || !off.longitude) return null;
          return (
            <Marker
              key={off.id}
              position={[off.latitude, off.longitude]}
              icon={createOfficerIcon(off)}>
              
              <Popup>
                <div className="text-xs">
                  <p className="font-semibold">{off.name}</p>
                  <p>{off.badge_id} · {off.status?.replace('_', ' ')}</p>
                  <p className="text-muted-foreground">{off.current_zone}</p>
                </div>
              </Popup>
            </Marker>);

        })}

        {/* Patrol route */}
        {patrolRoute && patrolRoute.length > 1 &&
        <Polyline
          positions={patrolRoute.map(p => [p[0], p[1]])}
          pathOptions={{ color: '#60a5fa', weight: 3, dashArray: '8, 8', opacity: 0.9 }} />

        }
      </MapContainer>
    </div>);

}