import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { invokeLLM } from '@/api/openaiClient';
import TopBar from '@/components/layout/TopBar';
import { SeverityBadge, StatusBadge } from '@/components/dashboard/IncidentBadge';
import { Button } from '@/components/ui/button';
import { INCIDENT_TYPES } from '@/lib/securityUtils';
import { 
  Clock, MapPin, Loader2, Sparkles, ChevronDown, ChevronUp,
  AlertTriangle, Flame, Heart, ShieldAlert, Package, Eye, Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import moment from 'moment';
import { toast } from 'sonner';

const ICON_MAP = {
  fire_alarm: Flame,
  medical: Heart,
  intrusion: ShieldAlert,
  unattended_bag: Package,
  suspicious_behavior: Eye,
  access_violation: Lock,
};

function TimelineItem({ incident, index }) {
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [narrative, setNarrative] = useState(incident.narrative || null);

  const IconComp = ICON_MAP[incident.type] || AlertTriangle;
  const typeConfig = INCIDENT_TYPES[incident.type] || INCIDENT_TYPES.other;

  const generateNarrative = async () => {
    setGenerating(true);
    const alertsSummary = incident.alerts?.map(a => `[${a.source}] ${a.message}`).join('\n') || 'No raw alerts available';
    
    const result = await invokeLLM({
      prompt: `You are a security operations analyst. Convert these alerts into a clear, concise incident narrative for security officers. Explain WHY this is happening and WHAT the situation is in simple language. Keep it under 100 words.

Incident: ${incident.title}
Type: ${incident.type}
Severity: ${incident.severity}/10
Location: ${incident.location_name}
Description: ${incident.description || 'N/A'}
Raw Alerts:
${alertsSummary}`,
      response_json_schema: {
        type: "object",
        properties: {
          narrative: { type: "string" }
        }
      }
    });

    if (result.narrative) {
      setNarrative(result.narrative);
      await base44.entities.Incident.update(incident.id, { narrative: result.narrative });
      toast.success('Narrative generated');
    }
    setGenerating(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08 }}
      className="flex gap-4"
    >
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0",
          incident.status === 'active' 
            ? 'bg-red-500/15 border-red-500/30' 
            : 'bg-secondary border-border'
        )}>
          <IconComp className={cn("w-4 h-4", incident.status === 'active' ? 'text-red-400' : 'text-muted-foreground')} />
        </div>
        <div className="w-px flex-1 bg-border mt-2" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-8">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <SeverityBadge score={incident.severity} />
                <StatusBadge status={incident.status} />
                <span className="text-[10px] text-muted-foreground font-mono">
                  {typeConfig.label}
                </span>
              </div>
              <h3 className="text-sm font-semibold">{incident.title}</h3>
              <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {incident.location_name}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {moment(incident.timestamp || incident.created_date).format('HH:mm:ss — MMM D')}
                </span>
              </div>
            </div>
            <button 
              onClick={() => setExpanded(!expanded)}
              className="p-1 rounded hover:bg-secondary"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-4 space-y-3 overflow-hidden"
              >
                {incident.description && (
                  <p className="text-xs text-muted-foreground">{incident.description}</p>
                )}

                {/* Raw alerts */}
                {incident.alerts?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Raw Alerts</p>
                    {incident.alerts.map((alert, i) => (
                      <div key={i} className="bg-secondary/50 rounded-md p-2 text-xs font-mono flex items-start gap-2">
                        <span className="text-primary flex-shrink-0">[{alert.source}]</span>
                        <span className="text-muted-foreground">{alert.message}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Timeline summary */}
                {incident.alerts?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Timeline</p>
                    <div className="bg-secondary/30 rounded-lg p-3 border border-border space-y-1.5">
                      {incident.alerts.map((alert, i) => {
                        const baseTime = incident.timestamp || incident.created_date;
                        const offsetSec = i * 3 + Math.round(i * 1.7);
                        const t = new Date(new Date(baseTime).getTime() + offsetSec * 1000);
                        const hms = t.toTimeString().slice(0, 8);
                        return (
                          <div key={i} className="flex items-start gap-2 text-xs font-mono">
                            <span className="text-primary flex-shrink-0">{hms}</span>
                            <span className="text-muted-foreground">—</span>
                            <span className="text-foreground/80">{alert.message}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* AI Narrative */}
                <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-primary" />
                      <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">Incident Explanation</span>
                    </div>
                    {!narrative && (
                      <Button size="sm" variant="ghost" onClick={generateNarrative} disabled={generating} className="h-6 text-xs">
                        {generating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />}
                        Generate
                      </Button>
                    )}
                  </div>
                  {narrative ? (
                    <p className="text-xs text-foreground/80 leading-relaxed">{narrative}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Click generate to create AI incident explanation</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

export default function Timeline() {
  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => base44.entities.Incident.list('-created_date', 50),
  });

  const activeIncidents = incidents.filter(i => i.status === 'active' || i.status === 'responding');

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Incident Timeline" activeIncidents={activeIncidents.length} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Incident Timeline</h2>
              <p className="text-xs text-muted-foreground">Alerts translated into clear incident narratives</p>
            </div>
          </div>

          <div className="space-y-0">
            {incidents.map((inc, i) => (
              <TimelineItem key={inc.id} incident={inc} index={i} />
            ))}
          </div>

          {incidents.length === 0 && (
            <div className="text-center py-20 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No incidents recorded</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}