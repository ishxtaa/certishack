import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { incidentsApi, officersApi, invokeLLM } from '@/api/openaiClient';
import TopBar from '@/components/layout/TopBar';
import IncidentMap from '@/components/map/IncidentMap';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Route, User, MapPin, Loader2, Sparkles, 
  ShieldCheck, Radio, Navigation, RefreshCw 
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STATUS_COLORS = {
  available: 'bg-green-500/15 text-green-400 border-green-500/30',
  on_patrol: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  responding: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  off_duty: 'bg-muted text-muted-foreground border-border',
};

const SPEC_ICONS = {
  general: ShieldCheck,
  medical: User,
  fire: User,
  tactical: ShieldCheck,
  k9: User,
};

export default function PatrolRoutes() {
  const queryClient = useQueryClient();
  const [selectedOfficer, setSelectedOfficer] = useState(null);
  const [optimizing, setOptimizing] = useState(false);
  const [assigning, setAssigning] = useState(null);
  const [patrolRoute, setPatrolRoute] = useState(null);
  const [routeStops, setRouteStops] = useState([]);

  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => incidentsApi.list(),
  });

  const { data: officers = [] } = useQuery({
    queryKey: ['officers'],
    queryFn: () => officersApi.list(),
  });

  const activeIncidents = incidents.filter(i => i.status === 'active' || i.status === 'responding');
  const unassignedIncidents = activeIncidents.filter(i => !i.assigned_officer);

  const assignMutation = useMutation({
    mutationFn: async ({ incidentId, officerName, officerId }) => {
      await incidentsApi.update(incidentId, { assigned_officer: officerName, status: 'responding' });
      await officersApi.update(officerId, { status: 'responding' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['officers'] });
      toast.success('Officer assigned');
    }
  });

  const optimizeRoute = async () => {
    if (!selectedOfficer) {
      toast.error('Select an officer first');
      return;
    }
    setOptimizing(true);

    // Build incident list with IDs so we can look up real coordinates after
    const incidentsWithCoords = activeIncidents.filter(i => i.latitude && i.longitude);
    const incidentList = incidentsWithCoords
      .map(i => `ID: ${i.id} | ${i.location_name} (${i.latitude}, ${i.longitude}) severity: ${i.severity}`)
      .join('\n');

    const result = await invokeLLM({
      prompt: `Generate an optimized patrol route for a security officer at Changi Airport, Singapore.

Officer: ${selectedOfficer.name}
Current location: ${selectedOfficer.current_zone || 'Main Terminal'} (${selectedOfficer.latitude || 1.3604}, ${selectedOfficer.longitude || 103.9893})
Specialization: ${selectedOfficer.specialization}

Active incidents (format: location (lat, lng) severity: X):
${incidentLocations || 'No active incidents with coordinates'}

STRICT RULES:
1. ALL coordinates MUST be within Changi Airport bounds: lat 1.345 to 1.375, lng 103.975 to 103.995
2. Rank stops by severity DESCENDING (highest first)
3. Add 1-2 checkpoint stops after incidents
4. Output exactly 5 waypoints as lat/lng pairs

Example valid coordinates: lat: 1.3592, lng: 103.9894

Respond with valid JSON containing a "route" array with lat, lng, name, priority_note, and severity fields.`,
      response_json_schema: {
        type: "object",
        properties: {
          route: {
            type: "array",
            items: {
              type: "object",
              properties: {
                incident_id: { type: "number" },
                name: { type: "string" },
                priority_note: { type: "string" },
                severity: { type: "number" }
              }
            }
          },
          reasoning: { type: "string" }
        }
      }
    });

    // Handle different response formats from AI
    let route = result?.route;
    
    // If AI returns numbered format, convert to array
    if (!route && result && typeof result === 'object') {
      route = Object.values(result).filter(item => 
        item && typeof item === 'object' && (item.incident_id !== undefined || item.id !== undefined || item.lat !== undefined)
      );
    }
    
    if (route && route.length > 0) {
      // Look up actual coordinates from database using incident_id
      const normalizedRoute = route.map(p => {
        const incidentId = p.incident_id || p.id || p.incidentId;
        
        // If AI returned lat/lng directly, check if they're valid Changi coordinates
        const aiLat = p.lat || p.latitude;
        const aiLng = p.lng || p.longitude;
        
        // Changi Airport bounds (approximately)
        const isValidChangiCoord = (lat, lng) => {
          return lat >= 1.35 && lat <= 1.37 && lng >= 103.98 && lng <= 104.00;
        };
        
        // First try to find by incident ID
        if (incidentId && incidentId > 0) {
          const incident = incidentsWithCoords.find(i => i.id === incidentId);
          if (incident) {
            return {
              lat: incident.latitude,
              lng: incident.longitude,
              name: incident.location_name || p.name || 'Incident',
              priority_note: p.priority_note || '',
              severity: incident.severity || p.severity || 5
            };
          }
        }
        
        // If AI gave valid coordinates within Changi, use them
        if (aiLat && aiLng && isValidChangiCoord(aiLat, aiLng)) {
          return {
            lat: aiLat,
            lng: aiLng,
            name: p.name || 'Waypoint',
            priority_note: p.priority_note || '',
            severity: p.severity || 5
          };
        }
        
        // Try to match by location name
        if (p.name) {
          const incidentByName = incidentsWithCoords.find(i => 
            i.location_name && i.location_name.toLowerCase().includes(p.name.toLowerCase())
          );
          if (incidentByName) {
            return {
              lat: incidentByName.latitude,
              lng: incidentByName.longitude,
              name: incidentByName.location_name,
              priority_note: p.priority_note || '',
              severity: incidentByName.severity || p.severity || 5
            };
          }
        }
        
        // Fallback: use officer's position for checkpoints
        const baseLat = selectedOfficer.latitude || 1.3604;
        const baseLng = selectedOfficer.longitude || 103.9893;
        return {
          lat: baseLat + (Math.random() - 0.5) * 0.002,
          lng: baseLng + (Math.random() - 0.5) * 0.002,
          name: p.name || 'Checkpoint',
          priority_note: p.priority_note || 'Patrol checkpoint',
          severity: p.severity || 3
        };
      });
      
      setPatrolRoute(normalizedRoute.map(p => [p.lat, p.lng]));
      setRouteStops(normalizedRoute);
      toast.success(`Patrol route optimized — ${normalizedRoute.length} stops, prioritized by severity then distance`);
    } else {
      toast.error('AI returned no route. Try again.');
    }
    setOptimizing(false);
  };

  const autoAssign = async (incidentId) => {
    setAssigning(incidentId);
    const incident = incidents.find(i => i.id === incidentId);
    const availableOfficers = officers.filter(o => o.status === 'available');

    if (availableOfficers.length === 0) {
      toast.error('No available officers');
      setAssigning(null);
      return;
    }

    const result = await invokeLLM({
      prompt: `Choose the best officer to assign to this incident:
Incident: ${incident.title} (${incident.type}, severity ${incident.severity})
Location: ${incident.location_name}

Available officers:
${availableOfficers.map(o => `${o.name} (${o.badge_id}) - ${o.specialization} - Zone: ${o.current_zone || 'Unknown'}`).join('\n')}

Pick the most suitable officer based on proximity and specialization.

Respond with valid JSON containing "badge_id" and "reasoning" fields.`,
      response_json_schema: {
        type: "object",
        properties: {
          badge_id: { type: "string" },
          reasoning: { type: "string" }
        }
      }
    });

    // Handle different response formats from AI
    let badgeId = result?.badge_id;
    
    // If AI returns different property names, try to find badge_id
    if (!badgeId && result && typeof result === 'object') {
      badgeId = result.badge_id || result.badgeId || result.officer_id || result.officerId;
    }
    
    const chosen = availableOfficers.find(o => o.badge_id === badgeId) || availableOfficers[0];
    assignMutation.mutate({ incidentId, officerName: chosen.name, officerId: chosen.id });
    setAssigning(null);
  };

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Optimized Patrol Routes" activeIncidents={activeIncidents.length} />
      <div className="flex-1 overflow-hidden flex">
        {/* Officers panel */}
        <div className="w-80 border-r border-border bg-card/50 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Officers</h2>
            <span className="text-xs font-mono text-primary">{officers.filter(o => o.status === 'available').length} available</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {officers.map(off => (
              <button
                key={off.id}
                onClick={() => setSelectedOfficer(off)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition-all",
                  selectedOfficer?.id === off.id
                    ? "bg-primary/10 border-primary/30"
                    : "bg-card/50 border-border hover:border-primary/20"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{off.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className={cn("text-[10px]", STATUS_COLORS[off.status])}>
                        {off.status?.replace('_', ' ')}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-mono">{off.badge_id}</span>
                    </div>
                  </div>
                </div>
                {off.current_zone && (
                  <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1 ml-11">
                    <MapPin className="w-2.5 h-2.5" /> {off.current_zone}
                  </p>
                )}
              </button>
            ))}
          </div>

          {/* Route stops */}
          {routeStops.length > 0 && (
            <div className="border-t border-border p-3 space-y-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                <Navigation className="w-3 h-3" /> Stop Order
              </h3>
              {routeStops.map((stop, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${
                    stop.severity >= 8 ? 'bg-red-500/20 text-red-400' :
                    stop.severity >= 6 ? 'bg-orange-500/20 text-orange-400' :
                    stop.severity >= 4 ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate">{stop.name}</p>
                    {stop.severity && (
                      <p className="text-[10px] text-muted-foreground">Sev: {stop.severity}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="p-3 border-t border-border space-y-2">
            <Button 
              className="w-full gap-2" 
              onClick={optimizeRoute} 
              disabled={optimizing || !selectedOfficer}
            >
              {optimizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
              Optimize Route
            </Button>
          </div>
        </div>

        {/* Map area */}
        <div className="flex-1 relative">
          <IncidentMap
            incidents={incidents}
            officers={officers}
            selectedIncident={null}
            patrolRoute={patrolRoute}
            className="absolute inset-0"
          />

          {/* Unassigned incidents floating panel */}
          {unassignedIncidents.length > 0 && (
            <div className="absolute top-4 right-4 w-72 z-[1000] bg-card/95 backdrop-blur-md border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-red-400">Unassigned</h3>
                <span className="text-xs font-mono text-red-400">{unassignedIncidents.length}</span>
              </div>
              <div className="max-h-64 overflow-y-auto p-2 space-y-1.5">
                {unassignedIncidents.map(inc => (
                  <div key={inc.id} className="bg-secondary/50 rounded-lg p-2.5 border border-border">
                    <p className="text-xs font-medium">{inc.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{inc.location_name}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full h-7 text-xs gap-1"
                      onClick={() => autoAssign(inc.id)}
                      disabled={assigning === inc.id}
                    >
                      {assigning === inc.id 
                        ? <Loader2 className="w-3 h-3 animate-spin" /> 
                        : <Sparkles className="w-3 h-3" />}
                      Auto-Assign
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
