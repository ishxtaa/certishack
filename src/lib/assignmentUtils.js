import { haversineDistance } from '@/lib/routeUtils';

function specializationMatch(incidentType, officerSpecialization) {
  const map = {
    medical: ['medical'],
    fire_alarm: ['fire'],
    intrusion: ['tactical', 'general'],
    access_violation: ['tactical', 'general'],
    suspicious_behavior: ['tactical', 'general'],
    panic: ['general', 'medical'],
    unattended_bag: ['general', 'tactical'],
  };

  const preferred = map[incidentType] || ['general'];

  if (preferred[0] === officerSpecialization) return 1;
  if (preferred.includes(officerSpecialization)) return 0.8;
  if (officerSpecialization === 'general') return 0.65;
  return 0.4;
}

function distanceScore(km) {
  if (km <= 0.3) return 1;
  if (km <= 0.8) return 0.85;
  if (km <= 1.5) return 0.7;
  if (km <= 3) return 0.5;
  return 0.25;
}

function workloadScore(status) {
  if (status === 'available') return 1;
  if (status === 'on_patrol') return 0.6;
  if (status === 'responding') return 0.2;
  return 0;
}

export function scoreOfficerForIncident(officer, incident) {
  const km = haversineDistance(
    officer.latitude ?? 1.3604,
    officer.longitude ?? 103.9893,
    incident.latitude ?? 1.3604,
    incident.longitude ?? 103.9893
  );

  const proximity = distanceScore(km);
  const specialization = specializationMatch(incident.type, officer.specialization);
  const workload = workloadScore(officer.status);

  const total = proximity * 0.55 + specialization * 0.3 + workload * 0.15;

  return {
    ...officer,
    distance_km: km,
    score: Number(total.toFixed(3)),
  };
}

export function rankOfficers(officers, incident) {
  return officers
    .filter((o) => o.status === 'available' || o.status === 'on_patrol')
    .map((o) => scoreOfficerForIncident(o, incident))
    .sort((a, b) => b.score - a.score);
}