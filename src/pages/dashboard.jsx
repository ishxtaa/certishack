import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/layout/TopBar';
import StatusCard from '@/components/dashboard/StatusCard';
import LiveFeed from '@/components/dashboard/LiveFeed';
import SeverityChart from '@/components/dashboard/SeverityChart';
import IncidentMap from '@/components/map/IncidentMap';
import SeverityRadarPanel from '@/components/dashboard/SeverityRadarPanel';
import { AlertTriangle, ShieldCheck, Users, Activity } from 'lucide-react';

export default function Dashboard() {
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [radarIncident, setRadarIncident] = useState(null);

  const { data: currentUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => base44.entities.Incident.list('-created_date', 50),
  });

  const { data: officers = [] } = useQuery({
    queryKey: ['officers'],
    queryFn: () => base44.entities.Officer.list(),
  });

  const activeIncidents = incidents.filter(i => i.status === 'active' || i.status === 'responding');

  const sortedIncidents = [...incidents].sort((a, b) => {
    const aResolved = a.status === 'resolved' || a.status === 'false_alarm' || a.status === 'contained';
    const bResolved = b.status === 'resolved' || b.status === 'false_alarm' || b.status === 'contained';
    if (aResolved !== bResolved) return aResolved ? 1 : -1;
    return (b.severity || 0) - (a.severity || 0);
  });
  const availableOfficers = officers.filter(o => o.status === 'available');
  const avgSeverity = incidents.length > 0
    ? (incidents.reduce((sum, i) => sum + (i.severity || 0), 0) / incidents.length).toFixed(1)
    : '0.0';

  const handleIncidentSelect = (inc) => {
    setSelectedIncident(inc);
    if (inc.status === 'active' || inc.status === 'responding') {
      setRadarIncident(inc);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Command Center" activeIncidents={activeIncidents.length} />
      <div className="flex-1 overflow-hidden p-4 space-y-2">
        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatusCard
            label="Active Incidents"
            value={activeIncidents.length}
            icon={AlertTriangle}
            color="red"
            trend={activeIncidents.length > 3 ? 15 : -8}
          />
          <StatusCard
            label="Total Today"
            value={incidents.length}
            icon={Activity}
            color="orange"
          />
          <StatusCard
            label="Officers Online"
            value={`${availableOfficers.length}/${officers.length}`}
            icon={Users}
            color="primary"
          />
          <StatusCard
            label="Avg Severity"
            value={avgSeverity}
            icon={ShieldCheck}
            color={Number(avgSeverity) > 6 ? "red" : Number(avgSeverity) > 4 ? "orange" : "green"}
          />
        </div>

        {/* Main content */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-2 min-h-0" style={{ height: 'calc(100% - 110px)' }}>
          {/* Left: incident feed */}
          <div className="lg:col-span-2 bg-card border border-border rounded-xl flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live Incident Feed</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <LiveFeed
                incidents={sortedIncidents}
                selectedId={selectedIncident?.id}
                onSelect={handleIncidentSelect}
              />
            </div>
          </div>

          {/* Center: map (larger) */}
          <div className="lg:col-span-8 rounded-xl overflow-hidden border border-border" style={{ minHeight: '500px' }}>
            <IncidentMap
              incidents={incidents}
              officers={officers}
              selectedIncident={selectedIncident}
              onIncidentClick={handleIncidentSelect}
              className="w-full h-full"
            />
          </div>

          {/* Right: analytics */}
          <div className="lg:col-span-2 space-y-2 overflow-y-auto">
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Incidents by Type</h3>
              <SeverityChart incidents={incidents} />
            </div>

            {selectedIncident && (
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Selected Incident</h3>
                <p className="text-sm font-semibold">{selectedIncident.title}</p>
                <p className="text-xs text-muted-foreground">{selectedIncident.description}</p>
                {selectedIncident.narrative && (
                  <div className="bg-secondary/50 rounded-lg p-3 border border-border">
                    <p className="text-[10px] uppercase tracking-wider text-primary mb-1 font-semibold">AI Narrative</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{selectedIncident.narrative}</p>
                  </div>
                )}
                {selectedIncident.assigned_officer && (
                  <p className="text-xs text-muted-foreground">
                    <span className="text-foreground font-medium">Assigned:</span> {selectedIncident.assigned_officer}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {radarIncident && (
        <SeverityRadarPanel
          incident={radarIncident}
          allIncidents={incidents}
          onClose={() => setRadarIncident(null)}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}