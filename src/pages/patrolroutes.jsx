import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { invokeLLM } from '@/api/openaiClient';
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
    queryFn: () => base44.entities.Incident.list('-created_date', 50),
  });

  const { data: officers = [] } = useQuery({
    queryKey: ['officers'],
    queryFn: () => base44.entities.Officer.list(),
  });

  const activeIncidents = incidents.filter(i => i.status === 'active' || i.status === 'responding');
  const unassignedIncidents = activeIncidents.filter(i => !i.assigned_officer);

  const assignMutation = useMutation({
    mutationFn: async ({ incidentId, officerName, officerId }) => {
      await base44.entities.Incident.update(incidentId, { assigned_officer: officerName, status: 'responding' });
      await base44.entities.Officer.update(officerId, { status: 'responding' });
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

    const incidentLocations = activeIncidents
      .filter(i => i.latitude && i.longitude)
      .map(i => `${i.location_name} (${i.latitude}, ${i.longitude}) severity: ${i.severity}`)
      .join('\n');

    const result = await invokeLLM({
      prompt: `Generate an optimized patrol route for a security officer at an airport.

Officer: ${selectedOfficer.name}
Current location: ${selectedOfficer.current_zone || 'Main Terminal'} (${selectedOfficer.latitude || 1.3604}, ${selectedOfficer.longitude || 103.9893})
Specialization: ${selectedOfficer.specialization}

Active incidents (format: location (lat, lng) severity: X):
${incidentLocations || 'No active incidents with coordinates'}

STRICT PRIORITIZATION RULES:
1. PRIMARY: Rank stops by severity score DESCENDING (highest severity = first stop). Incidents with severity >= 8 must be visited before any severity < 8.
2. SECONDARY: Among incidents with equal severity (within ±1.0 of each other), choose the closest to the officer's current position first to minimize travel time.
3. TERTIARY: After all active incidents, add 1-2 high-risk area checkpoints to cover blind spots.
4. Output exactly 5-8 waypoints as lat/lng pairs in strict priority order.
5. Include a "priority_note" per waypoint explaining the severity/distance reasoning.`,
      response_json_schema: {
        type: "object",
        properties: {
          route: {
            type: "array",
            items: {
              type: "object",
              properties: {
                lat: { type: "number" },
                lng: { type: "number" },
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

    if (result.route) {
      setPatrolRoute(result.route.map(p => [p.lat, p.lng]));
      setRouteStops(result.route);
      toast.success(`Patrol route optimized — ${result.route.length} stops, prioritized by severity then distance`);
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

Pick the most suitable officer based on proximity and specialization. Return their badge_id.`,
      response_json_schema: {
        type: "object",
        properties: {
          badge_id: { type: "string" },
          reasoning: { type: "string" }
        }
      }
    });

    const chosen = availableOfficers.find(o => o.badge_id === result.badge_id) || availableOfficers[0];
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