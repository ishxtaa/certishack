export const HIGH_RISK_CHECKPOINTS = [
  { name: 'Terminal 1 - Departure', lat: 1.3621, lng: 103.9882, severity: 4 },
  { name: 'Terminal 2 - Departure', lat: 1.3530, lng: 103.9893, severity: 4 },
  { name: 'Jewel', lat: 1.3604, lng: 103.9893, severity: 4 },
  { name: 'Cargo Complex', lat: 1.3500, lng: 103.9750, severity: 3 },
];

export function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

export function sortIncidentsBySeverityThenDistance(officer, incidents) {
  const baseLat = officer?.latitude ?? 1.3604;
  const baseLng = officer?.longitude ?? 103.9893;

  return [...incidents]
    .filter((i) => i.latitude && i.longitude)
    .map((i) => ({
      ...i,
      distance_km: haversineDistance(baseLat, baseLng, i.latitude, i.longitude),
    }))
    .sort((a, b) => {
      const sevDiff = (b.severity || 0) - (a.severity || 0);
      if (Math.abs(sevDiff) >= 1) return sevDiff;
      return a.distance_km - b.distance_km;
    });
}

export function appendHighRiskCheckpoints(routeStops, maxExtra = 2) {
  const existingNames = new Set(routeStops.map((s) => s.name));
  const extras = HIGH_RISK_CHECKPOINTS.filter((c) => !existingNames.has(c.name)).slice(0, maxExtra);

  return [
    ...routeStops,
    ...extras.map((c) => ({
      lat: c.lat,
      lng: c.lng,
      name: c.name,
      severity: c.severity,
      priority_note: 'Added as a preventive high-risk checkpoint after active incidents.',
      is_checkpoint: true,
    })),
  ];
}

export function buildPatrolRoute(officer, activeIncidents) {
  const sorted = sortIncidentsBySeverityThenDistance(officer, activeIncidents);

  const incidentStops = sorted.map((inc) => ({
    lat: inc.latitude,
    lng: inc.longitude,
    name: inc.location_name,
    severity: inc.severity,
    incident_id: inc.id,
    priority_note:
      inc.severity >= 8
        ? 'Critical incident prioritized first.'
        : `Prioritized by severity, then distance (${inc.distance_km.toFixed(2)} km).`,
  }));

  return appendHighRiskCheckpoints(incidentStops, 2);
}