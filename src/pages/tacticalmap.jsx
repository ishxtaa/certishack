import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { incidentsApi, officersApi } from '@/api/openaiClient';
import TopBar from '@/components/layout/TopBar';
import IncidentMap from '@/components/map/IncidentMap';
import LiveFeed from '@/components/dashboard/LiveFeed';
import { SeverityBadge, StatusBadge } from '@/components/dashboard/IncidentBadge';
import { ChevronRight, Layers, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TacticalMap() {
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [showPanel, setShowPanel] = useState(true);

  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => incidentsApi.list(),
  });

  const { data: officers = [] } = useQuery({
    queryKey: ['officers'],
    queryFn: () => officersApi.list(),
  });

  const activeIncidents = incidents.filter(i => i.status === 'active' || i.status === 'responding');

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Tactical Map" activeIncidents={activeIncidents.length} />
      <div className="flex-1 relative overflow-hidden">
        <IncidentMap
          incidents={incidents}
          officers={officers}
          selectedIncident={selectedIncident}
          onIncidentClick={setSelectedIncident}
          className="absolute inset-0"
        />

        {/* Floating panel toggle */}
        <button
          onClick={() => setShowPanel(!showPanel)}
          className="absolute top-4 left-4 z-[1000] bg-card/90 backdrop-blur-sm border border-border rounded-lg p-2 hover:bg-secondary transition-colors"
        >
          <Layers className="w-4 h-4" />
        </button>

        {/* Floating incidents panel */}
        {showPanel && (
          <div className="absolute top-4 right-4 bottom-4 w-80 z-[1000] bg-card/95 backdrop-blur-md border border-border rounded-xl flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Incidents</h2>
              <span className="text-xs font-mono text-primary">{activeIncidents.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <LiveFeed
                incidents={activeIncidents}
                selectedId={selectedIncident?.id}
                onSelect={setSelectedIncident}
              />
            </div>
          </div>
        )}

        {/* Selected incident detail */}
        {selectedIncident && (
          <div className="absolute bottom-4 left-4 right-[calc(340px)] z-[1000] bg-card/95 backdrop-blur-md border border-border rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <SeverityBadge score={selectedIncident.severity} />
                  <StatusBadge status={selectedIncident.status} />
                </div>
                <h3 className="text-sm font-semibold">{selectedIncident.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {selectedIncident.location_name}
                </p>
              </div>
              {selectedIncident.assigned_officer && (
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase">Assigned</p>
                  <p className="text-xs font-medium">{selectedIncident.assigned_officer}</p>
                </div>
              )}
            </div>
            {selectedIncident.narrative && (
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{selectedIncident.narrative}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}