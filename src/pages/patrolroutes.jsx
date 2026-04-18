import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { generateAssignmentReasoningAI, generateRouteReasoningAI } from '@/api/aiClient';
import { buildPatrolRoute } from '@/lib/routeUtils';
import { rankOfficers } from '@/lib/assignmentUtils';
import TopBar from '@/components/layout/TopBar';
import IncidentMap from '@/components/map/IncidentMap';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  User, MapPin, Loader2, Sparkles,
  ShieldCheck, Navigation
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STATUS_COLORS = {
  available: 'bg-green-500/15 text-green-400 border-green-500/30',
  on_patrol: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  responding: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  off_duty: 'bg-muted text-muted-foreground border-border',
};

export default function PatrolRoutes() {
  const queryClient = useQueryClient();
  const [selectedOfficer, setSelectedOfficer] = useState(null);
  const [optimizing, setOptimizing] = useState(false);
  const [assigning, setAssigning] = useState(null);
  const [patrolRoute, setPatrolRoute] = useState(null);
  const [routeStops, setRouteStops] = useState([]);
  const [routeReasoning, setRouteReasoning] = useState('');
  const [assignmentReasoning, setAssignmentReasoning] = useState('');

  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => base44.entities.Incident.list('-created_date', 50),
  });

  const { data: officers = [] } = useQuery({
    queryKey: ['officers'],
    queryFn: () => base44.entities.Officer.list(),
  });

  const activeIncidents = incidents.filter((i) => i.status === 'active' || i.status === 'responding');
  const unassignedIncidents = activeIncidents.filter((i) => !i.assigned_officer);

  const assignMutation = useMutation({
    mutationFn: async ({ incidentId, officerName, officerId, nextOfficerStatus = 'responding' }) => {
      await base44.entities.Incident.update(incidentId, {
        assigned_officer: officerName,
        status: 'responding',
      });
      await base44.entities.Officer.update(officerId, {
        status: nextOfficerStatus,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['officers'] });
      toast.success('Officer assigned');
    },
    onError: (err) => {
      toast.error(err.message || 'Assignment failed');
    },
  });

  const optimizeRoute = async () => {
    if (!selectedOfficer) {
      toast.error('Select an officer first');
      return;
    }

    try {
      setOptimizing(true);
      const stops = buildPatrolRoute(selectedOfficer, activeIncidents);
      setRouteStops(stops);
      setPatrolRoute(stops.map((p) => [p.lat, p.lng]));

      const ai = await generateRouteReasoningAI(selectedOfficer, stops);
      setRouteReasoning(ai?.reasoning || '');

      toast.success(`Route optimized with ${stops.length} stops`);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to optimize route');
    } finally {
      setOptimizing(false);
    }
  };

  const autoAssign = async (incidentId) => {
    try {
      setAssigning(incidentId);
      const incident = incidents.find((i) => i.id === incidentId);

      if (!incident) {
        toast.error('Incident not found');
        return;
      }

      const ranked = rankOfficers(officers, incident);

      if (ranked.length === 0) {
        toast.error('No available officers');
        return;
      }

      const chosen = ranked[0];

      assignMutation.mutate({
        incidentId,
        officerName: chosen.name,
        officerId: chosen.id,
        nextOfficerStatus: 'responding',
      });

      const ai = await generateAssignmentReasoningAI(incident, ranked);
      setAssignmentReasoning(ai?.reasoning || `Assigned ${chosen.name} based on proximity and specialization.`);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Auto-assignment failed');
    } finally {
      setAssigning(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Optimized Patrol Routes" activeIncidents={activeIncidents.length} />

      <div className="flex-1 overflow-hidden flex">
        <div className="w-80 border-r border-border bg-card/50 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Officers</h2>
            <span className="text-xs font-mono text-primary">
              {officers.filter((o) => o.status === 'available').length} available
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {officers.map((off) => (
              <button
                key={off.id}
                onClick={() => setSelectedOfficer(off)}
                className={cn(
                  'w-full text-left p-3 rounded-lg border transition-all',
                  selectedOfficer?.id === off.id
                    ? 'bg-primary/10 border-primary/30'
                    : 'bg-card/50 border-border hover:border-primary/20'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{off.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className={cn('text-[10px]', STATUS_COLORS[off.status])}>
                        {off.status?.replace('_', ' ')}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-mono">{off.badge_id}</span>
                    </div>
                  </div>
                </div>

                {off.current_zone && (
                  <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1 ml-11">
                    <MapPin className="w-2.5 h-2.5" />
                    {off.current_zone}
                  </p>
                )}
              </button>
            ))}
          </div>

          {routeStops.length > 0 && (
            <div className="border-t border-border p-3 space-y-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                <Navigation className="w-3 h-3" />
                Stop Order
              </h3>

              {routeStops.map((stop, i) => (
                <div key={`${stop.name}-${i}`} className="flex items-start gap-2.5">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${
                      (stop.severity ?? 0) >= 8
                        ? 'bg-red-500/20 text-red-400'
                        : (stop.severity ?? 0) >= 6
                        ? 'bg-orange-500/20 text-orange-400'
                        : (stop.severity ?? 0) >= 4
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-green-500/20 text-green-400'
                    }`}
                  >
                    {i + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate">{stop.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Sev: {stop.severity ?? 'checkpoint'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{stop.priority_note}</p>
                  </div>
                </div>
              ))}

              {routeReasoning && (
                <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-1">
                    AI Route Rationale
                  </p>
                  <p className="text-[11px] text-muted-foreground">{routeReasoning}</p>
                </div>
              )}
            </div>
          )}

          <div className="p-3 border-t border-border space-y-2">
            <Button className="w-full gap-2" onClick={optimizeRoute} disabled={optimizing || !selectedOfficer}>
              {optimizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
              Optimize Route
            </Button>
          </div>
        </div>

        <div className="flex-1 relative">
          <IncidentMap
            incidents={incidents}
            officers={officers}
            selectedIncident={null}
            patrolRoute={patrolRoute}
            className="absolute inset-0"
          />

          {unassignedIncidents.length > 0 && (
            <div className="absolute top-4 right-4 w-80 z-[1000] bg-card/95 backdrop-blur-md border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-red-400">Unassigned</h3>
                <span className="text-xs font-mono text-red-400">{unassignedIncidents.length}</span>
              </div>

              <div className="max-h-72 overflow-y-auto p-2 space-y-1.5">
                {unassignedIncidents.map((inc) => (
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
                      {assigning === inc.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      Auto-Assign
                    </Button>
                  </div>
                ))}
              </div>

              {assignmentReasoning && (
                <div className="border-t border-border p-3">
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-1">
                      AI Assignment Rationale
                    </p>
                    <p className="text-[11px] text-muted-foreground">{assignmentReasoning}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}