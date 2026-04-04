import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import TopBar from '@/components/layout/TopBar';
import { SeverityBadge, StatusBadge } from '@/components/dashboard/IncidentBadge';
import { AIRPORT_ZONES, INCIDENT_TYPES, getSeverityLevel, getSeverityColor } from '@/lib/securityUtils';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { MapPin, Clock, Thermometer, ChevronRight, Loader2, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import moment from 'moment';
import { toast } from 'sonner';

function ZoneCard({ zone, incidents, onSelect, selected }) {
  const zoneIncidents = incidents.filter(i => i.location_name === zone.name);
  const avgSeverity = zoneIncidents.length > 0
    ? zoneIncidents.reduce((s, i) => s + (i.severity || 0), 0) / zoneIncidents.length
    : 0;
  const level = getSeverityLevel(avgSeverity || 0);
  const activeCount = zoneIncidents.filter(i => i.status === 'active' || i.status === 'responding').length;

  const barWidth = Math.min(100, (avgSeverity / 10) * 100);
  const barColorMap = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-green-500',
  };

  return (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={() => onSelect(zone.name)}
      className={cn(
        "w-full text-left p-4 rounded-xl border transition-all",
        selected === zone.name
          ? "bg-primary/10 border-primary/30"
          : "bg-card border-border hover:border-primary/20"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">{zone.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <span className="text-[10px] text-red-400 font-mono">{activeCount} active</span>
          )}
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", barColorMap[level])}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <span className="text-xs font-mono text-muted-foreground w-8 text-right">
          {avgSeverity > 0 ? avgSeverity.toFixed(1) : '—'}
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1.5">{zoneIncidents.length} total incidents</p>
    </motion.button>
  );
}

export default function Heatmap() {
  const [selectedZone, setSelectedZone] = useState(null);
  const [computingSeverity, setComputingSeverity] = useState(null);

  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => base44.entities.Incident.list('-created_date', 200),
  });

  const activeIncidents = incidents.filter(i => i.status === 'active' || i.status === 'responding');
  const zoneIncidents = selectedZone ? incidents.filter(i => i.location_name === selectedZone) : [];

  // Sort zones by avg severity descending
  const sortedZones = useMemo(() => {
    return [...AIRPORT_ZONES].sort((a, b) => {
      const aInc = incidents.filter(i => i.location_name === a.name);
      const bInc = incidents.filter(i => i.location_name === b.name);
      const aAvg = aInc.length > 0 ? aInc.reduce((s, i) => s + (i.severity || 0), 0) / aInc.length : 0;
      const bAvg = bInc.length > 0 ? bInc.reduce((s, i) => s + (i.severity || 0), 0) / bInc.length : 0;
      return bAvg - aAvg;
    });
  }, [incidents]);

  const computeAISeverity = async (incidentId) => {
    setComputingSeverity(incidentId);
    const incident = incidents.find(i => i.id === incidentId);
    const pastSimilar = incidents
      .filter(i => i.type === incident.type && i.id !== incident.id)
      .slice(0, 5)
      .map(i => `Type: ${i.type}, Severity: ${i.severity}, Location: ${i.location_name}`)
      .join('\n');

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `As a security AI, compute a severity score (1-10) for this incident based on these factors:
- Type: ${incident.type} (danger to life > danger to property; fire/panic/medical = highest)
- Location: ${incident.location_name} (high-traffic areas = more severe)
- Current time: ${new Date().toISOString()}
- Description: ${incident.description || 'N/A'}

Past similar incidents for reference:
${pastSimilar || 'None'}

Scoring guide: 9-10 = immediate life threat, 7-8 = high risk, 5-6 = moderate, 3-4 = low, 1-2 = minimal.
Return the score and a brief justification.`,
      response_json_schema: {
        type: "object",
        properties: {
          severity: { type: "number" },
          justification: { type: "string" }
        }
      }
    });

    if (result.severity) {
      await base44.entities.Incident.update(incidentId, { severity: result.severity });
      toast.success(`Severity updated to ${result.severity.toFixed(1)}: ${result.justification}`);
    }
    setComputingSeverity(null);
  };

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Severity Heatmap" activeIncidents={activeIncidents.length} />
      <div className="flex-1 overflow-hidden flex">
        {/* Zone list */}
        <div className="w-80 border-r border-border bg-card/50 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-primary" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Zone Severity</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {sortedZones.map(zone => (
              <ZoneCard
                key={zone.name}
                zone={zone}
                incidents={incidents}
                onSelect={setSelectedZone}
                selected={selectedZone}
              />
            ))}
          </div>
        </div>

        {/* Zone detail / incidents */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedZone ? (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{selectedZone}</h2>
                  <p className="text-xs text-muted-foreground">{zoneIncidents.length} incidents recorded</p>
                </div>
              </div>

              <div className="space-y-3 max-w-2xl">
                {zoneIncidents.map((inc, i) => (
                  <motion.div
                    key={inc.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-card border border-border rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <SeverityBadge score={inc.severity} />
                          <StatusBadge status={inc.status} />
                        </div>
                        <p className="text-sm font-medium">{inc.title}</p>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {moment(inc.timestamp || inc.created_date).format('HH:mm — MMM D, YYYY')}
                        </p>
                        {inc.description && (
                          <p className="text-xs text-muted-foreground mt-2">{inc.description}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => computeAISeverity(inc.id)}
                        disabled={computingSeverity === inc.id}
                        className="flex-shrink-0"
                      >
                        {computingSeverity === inc.id 
                          ? <Loader2 className="w-3 h-3 animate-spin" /> 
                          : <Sparkles className="w-3 h-3 mr-1" />}
                        Rescore
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Thermometer className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-sm">Select a zone to view incident severity history</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}