import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authApi, incidentsApi, officersApi } from '@/api/openaiClient';
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
    queryFn: () => authApi.me(),
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => incidentsApi.list(),
  });

  const { data: officers = [] } = useQuery({
    queryKey: ['officers'],
    queryFn: () => officersApi.list(),
  });

  const activeIncidents = incidents.filter(i => i.status === 'active' || i.status === 'responding');

  const sortedIncidents = [...incidents].sort((a, b) => {
    // Priority: active > responding > contained > resolved/false_alarm
    const statusPriority = { active: 0, responding: 1, contained: 2, resolved: 3, false_alarm: 4 };
    const aPriority = statusPriority[a.status] ?? 5;
    const bPriority = statusPriority[b.status] ?? 5;
    
    // First sort by status priority
    if (aPriority !== bPriority) return aPriority - bPriority;
    
    // Then sort by severity (highest first)
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
          {/* Left: sidebar */}
          <div className="lg:col-span-2 space-y-2 overflow-y-auto">
            <div className="bg-card border border-border rounded-xl p-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 text-center">By Type</h3>
              <SeverityChart incidents={incidents} compact />
            </div>
          </div>

          {/* Center: map with overlay */}
          <div className="lg:col-span-10 relative rounded-xl overflow-hidden border border-border" style={{ minHeight: '500px' }}>
            <IncidentMap
              incidents={incidents}
              officers={officers}
              selectedIncident={selectedIncident}
              onIncidentClick={handleIncidentSelect}
              className="w-full h-full"
            />
            
            {/* Live Incident Feed - overlaid on map */}
            <div className="absolute top-4 left-4 w-72 max-h-[calc(100%-2rem)] bg-card/95 backdrop-blur-sm border border-border rounded-xl flex flex-col overflow-hidden z-[1000] shadow-xl">
              <div className="px-3 py-2 border-b border-border bg-card">
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