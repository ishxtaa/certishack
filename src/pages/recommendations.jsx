import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi, incidentsApi, recommendationsApi, invokeLLM } from '@/api/openaiClient';
import TopBar from '@/components/layout/TopBar';
import { SeverityBadge } from '@/components/dashboard/IncidentBadge';
import OfficerFeedback from '@/components/dashboard/OfficerFeedback';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Brain, CheckCircle, XCircle, MessageSquare,
  TrendingUp, Loader2, Sparkles, RefreshCw, Volume2,
  Cpu, ChevronDown, ChevronUp, Upload, Trash2, Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const PRIORITY_COLORS = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  low: 'bg-green-500/15 text-green-400 border-green-500/30'
};

// Sensor field presets for common airport security sensors
const SENSOR_PRESETS = {
  'Crowd Density': {
    crowd_density_pct: '72',
    zone: 'Terminal B Gate 12',
    pedestrian_flow_per_min: '145',
    congestion_level: 'high'
  },
  'Environmental': {
    temperature_c: '28',
    humidity_pct: '65',
    smoke_detected: 'false',
    co2_ppm: '820',
    noise_db: '74'
  },
  'Perimeter': {
    fence_breach_detected: 'false',
    camera_coverage_pct: '94',
    motion_alerts_last_5min: '3',
    restricted_zone_intrusions: '1'
  },
  'Passenger Flow': {
    queue_length_security: '87',
    avg_wait_time_min: '22',
    throughput_per_hour: '340',
    anomalous_behavior_flags: '2'
  }
};

function speakText(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

// ─── Sensor Input Panel ────────────────────────────────────────────────────
function SensorPanel({ sensorData, onSensorDataChange }) {
  const [expanded, setExpanded] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const applyPreset = (presetName) => {
    onSensorDataChange({ ...sensorData, ...SENSOR_PRESETS[presetName] });
    toast.success(`Loaded "${presetName}" sensor preset`);
  };

  const addField = () => {
    if (!newKey.trim()) return;
    onSensorDataChange({ ...sensorData, [newKey.trim()]: newValue.trim() });
    setNewKey('');
    setNewValue('');
  };

  const removeField = (key) => {
    const updated = { ...sensorData };
    delete updated[key];
    onSensorDataChange(updated);
  };

  const updateField = (key, value) => {
    onSensorDataChange({ ...sensorData, [key]: value });
  };

  const importCsv = () => {
    try {
      const parsed = {};
      csvText.split('\n').forEach(line => {
        const [k, ...rest] = line.split(',');
        if (k && rest.length) parsed[k.trim()] = rest.join(',').trim();
      });
      if (Object.keys(parsed).length === 0) {
        toast.error('No valid key,value rows found in CSV');
        return;
      }
      onSensorDataChange({ ...sensorData, ...parsed });
      setCsvText('');
      toast.success(`Imported ${Object.keys(parsed).length} sensor readings`);
    } catch {
      toast.error('Failed to parse CSV. Use format: key,value per line');
    }
  };

  const hasData = Object.keys(sensorData).length > 0;

  return (
    <div className="border border-border rounded-xl bg-card/50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Sensor Dataset Input
          </span>
          {hasData && (
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
              {Object.keys(sensorData).length} readings active
            </Badge>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border"
          >
            <div className="p-4 space-y-4">
              {/* Presets */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Quick Presets</p>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(SENSOR_PRESETS).map(name => (
                    <button
                      key={name}
                      onClick={() => applyPreset(name)}
                      className="text-[11px] px-3 py-1.5 rounded-lg border border-border bg-secondary/40 hover:bg-secondary hover:border-primary/30 transition-all"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Current sensor readings table */}
              {hasData && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Active Readings</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {Object.entries(sensorData).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2 group">
                        <span className="text-[11px] font-mono text-muted-foreground w-40 truncate shrink-0">{key}</span>
                        <input
                          value={value}
                          onChange={e => updateField(key, e.target.value)}
                          className="flex-1 text-[11px] font-mono bg-secondary/50 border border-border rounded px-2 py-1 focus:outline-none focus:border-primary/40"
                        />
                        <button
                          onClick={() => removeField(key)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual add field */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Add Reading</p>
                <div className="flex gap-2">
                  <input
                    value={newKey}
                    onChange={e => setNewKey(e.target.value)}
                    placeholder="sensor_name"
                    className="flex-1 text-[11px] font-mono bg-secondary/50 border border-border rounded px-2 py-1.5 focus:outline-none focus:border-primary/40"
                    onKeyDown={e => e.key === 'Enter' && addField()}
                  />
                  <input
                    value={newValue}
                    onChange={e => setNewValue(e.target.value)}
                    placeholder="value"
                    className="flex-1 text-[11px] font-mono bg-secondary/50 border border-border rounded px-2 py-1.5 focus:outline-none focus:border-primary/40"
                    onKeyDown={e => e.key === 'Enter' && addField()}
                  />
                  <button
                    onClick={addField}
                    className="px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* CSV import */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">CSV Import (key,value per line)</p>
                <Textarea
                  value={csvText}
                  onChange={e => setCsvText(e.target.value)}
                  placeholder={"crowd_density_pct,72\ntemperature_c,28\nsmoke_detected,false"}
                  className="text-[11px] font-mono bg-secondary/50 h-20 mb-2"
                />
                <Button size="sm" variant="outline" onClick={importCsv} className="gap-1.5 text-xs">
                  <Upload className="w-3.5 h-3.5" /> Import CSV
                </Button>
              </div>

              {hasData && (
                <button
                  onClick={() => onSensorDataChange({})}
                  className="text-[11px] text-muted-foreground hover:text-red-400 transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Clear all sensor data
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Recommendation Card ───────────────────────────────────────────────────
function RecommendationCard({ rec, incident, currentUser, onFeedback }) {
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  const handleAction = (action) => {
    onFeedback(rec.id, action, notes);
    setShowNotes(false);
    setNotes('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-5 space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className={cn('text-[10px] uppercase', PRIORITY_COLORS[rec.priority])}>
              {rec.priority}
            </Badge>
            <span className="text-xs font-mono text-muted-foreground">
              Confidence: {rec.confidence}%
            </span>
          </div>
          <p className="text-sm font-medium leading-relaxed">{rec.action_text}</p>
        </div>
        <button
          onClick={() => speakText(`${rec.action_text}. Predicted outcome: ${rec.predicted_outcome}`)}
          className="w-10 h-10 rounded-lg bg-secondary/60 hover:bg-secondary flex items-center justify-center transition-colors flex-shrink-0"
          title="Listen to recommendation"
        >
          <Volume2 className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="bg-secondary/50 rounded-lg p-3 border border-border">
        <div className="flex items-center gap-1.5 mb-1.5">
          <TrendingUp className="w-3 h-3 text-primary" />
          <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">Predicted Outcome</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{rec.predicted_outcome}</p>
      </div>

      {rec.sensor_context && (
        <div className="bg-primary/5 rounded-lg p-3 border border-primary/15">
          <div className="flex items-center gap-1.5 mb-1">
            <Cpu className="w-3 h-3 text-primary/60" />
            <span className="text-[10px] uppercase tracking-wider text-primary/60 font-semibold">Based on Sensor Data</span>
          </div>
          <p className="text-[11px] text-muted-foreground font-mono leading-relaxed whitespace-pre-wrap">{rec.sensor_context}</p>
        </div>
      )}

      {rec.feedback === 'pending' ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleAction('accepted')}>
              <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Accept
            </Button>
            <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleAction('rejected')}>
              <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowNotes(!showNotes)}>
              <MessageSquare className="w-3.5 h-3.5" />
            </Button>
          </div>
          <AnimatePresence>
            {showNotes && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                <Textarea
                  placeholder="Add notes or custom action..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="text-xs bg-secondary/50 h-20"
                />
                <Button size="sm" className="mt-2 w-full" variant="outline" onClick={() => handleAction('custom_action')}>
                  Submit Custom Action
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border',
          rec.feedback === 'accepted' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
          rec.feedback === 'rejected' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
          'bg-blue-500/10 text-blue-400 border-blue-500/20'
        )}>
          {rec.feedback === 'accepted' ? <CheckCircle className="w-3.5 h-3.5" /> :
           rec.feedback === 'rejected' ? <XCircle className="w-3.5 h-3.5" /> :
           <MessageSquare className="w-3.5 h-3.5" />}
          {rec.feedback === 'accepted' ? 'Action Accepted' :
           rec.feedback === 'rejected' ? 'Action Rejected' : 'Custom Action Taken'}
          {rec.officer_notes && <span className="text-muted-foreground ml-2">— {rec.officer_notes}</span>}
        </div>
      )}

      {incident && (
        <div className="border-t border-border pt-4">
          <OfficerFeedback incident={incident} currentUser={currentUser} />
        </div>
      )}
    </motion.div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function Recommendations() {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const [sensorData, setSensorData] = useState({});

  const { data: currentUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.me()
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => incidentsApi.list()
  });

  const { data: recommendations = [] } = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => recommendationsApi.list()
  });

  const activeIncidents = incidents.filter(i => i.status === 'active' || i.status === 'responding');
  const selectedIncident = incidents.find(i => i.id === selectedIncidentId) || null;

  // Show ACCEPTED recommendations always, plus PENDING recommendations from latest generation
  const filteredRecs = selectedIncidentId
    ? recommendations
        .filter(r => String(r.incident_id) === String(selectedIncidentId) && (r.feedback === 'accepted' || r.feedback === 'pending'))
        .slice()
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    : [];

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => recommendationsApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recommendations'] })
  });

  const handleFeedback = (recId, feedback, notes) => {
    updateMutation.mutate({ id: recId, data: { feedback, officer_notes: notes || undefined } });
    toast.success(`Recommendation ${feedback}`);
  };

  const hasSensorData = Object.keys(sensorData).length > 0;
  const [lastRequestTime, setLastRequestTime] = useState(0);

  const generateRecs = async () => {
    if (!selectedIncidentId) {
      toast.error('Select an incident first');
      return;
    }
    
    // Check cooldown (3 seconds between requests)
    const now = Date.now();
    if (now - lastRequestTime < 3000) {
      toast.error('Please wait 3 seconds between AI requests');
      return;
    }
    setLastRequestTime(now);
    
    setGenerating(true);
    try {
      const incident = incidents.find(i => i.id === selectedIncidentId);
      const pastFeedback = recommendations
        .filter(r => r.feedback !== 'pending')
        .slice(0, 5)
        .map(r => `Action: ${r.action_text} → Feedback: ${r.feedback}`)
        .join('\n');

      const sensorSection = hasSensorData
        ? `\nLive Sensor Readings:\n${Object.entries(sensorData).map(([k, v]) => `  ${k}: ${v}`).join('\n')}`
        : '';

      const result = await invokeLLM({
        prompt: `You are a security operations AI for an airport. Generate 3 tactical recommendations for this incident.
${sensorSection ? 'Use the provided sensor readings to make your recommendations more specific and data-driven.' : ''}

Incident: ${incident.title}
Type: ${incident.type}
Severity: ${incident.severity}/10
Location: ${incident.location_name}
Description: ${incident.description || 'N/A'}

Past officer feedback on recommendations:
${pastFeedback || 'No prior feedback'}

For each recommendation provide:
- action_text: specific tactical action (2-3 sentences)${hasSensorData ? ', referencing relevant sensor values where applicable' : ''}
- predicted_outcome: what will happen if they take this action
- confidence: a number 1-100
- priority: critical/high/medium/low
- sensor_context: ${hasSensorData ? 'a brief note (1 sentence) on which sensor readings influenced this recommendation, or null if not applicable' : 'null'}`,
        response_json_schema: {
          type: 'object',
          properties: {
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  action_text: { type: 'string' },
                  predicted_outcome: { type: 'string' },
                  confidence: { type: 'number' },
                  priority: { type: 'string' },
                  sensor_context: { type: 'string' }
                }
              }
            }
          }
        },
        sensorData: hasSensorData ? sensorData : undefined
      });

      // Handle different response formats from AI
      console.log('[GenerateRecs] AI raw result:', result);
      console.log('[GenerateRecs] Object keys:', Object.keys(result || {}));
      console.log('[GenerateRecs] Is array?', Array.isArray(result));
      
      let recs = result?.recommendations || result?.tactical_recommendations || (Array.isArray(result) ? result : null);
      console.log('[GenerateRecs] Extracted recs from standard props:', recs);
      
      // If AI returns {recommendation1, recommendation2, ...} format, convert to array
      if (!recs && result && typeof result === 'object' && !Array.isArray(result)) {
        const keys = Object.keys(result);
        console.log('[GenerateRecs] All keys:', keys);
        
        // Filter keys that look like recommendation1, recommendation2, etc.
        const recKeys = keys.filter(k => /^recommendation\d+$/i.test(k));
        console.log('[GenerateRecs] Recommendation keys found:', recKeys);
        
        if (recKeys.length > 0) {
          recs = recKeys.map(k => result[k]);
          console.log('[GenerateRecs] Extracted recs by keys:', recs);
        }
      }
      
      if (recs && recs.length > 0) {
        console.log('[GenerateRecs] Saving', recs.length, 'recommendations...');
        for (let i = 0; i < recs.length; i++) {
          const rec = recs[i];
          console.log(`[GenerateRecs] Saving rec ${i+1}:`, rec);
          try {
            // Only send fields that the backend accepts
            const payload = {
              incident_id: String(selectedIncidentId),
              action_text: rec.action_text,
              predicted_outcome: rec.predicted_outcome,
              confidence: Number(rec.confidence),
              priority: rec.priority,
              feedback: 'pending',
              officer_notes: rec.sensor_context || undefined,
              outcome_actual: undefined
            };
            console.log(`[GenerateRecs] Payload ${i+1}:`, payload);
            const response = await recommendationsApi.create(payload);
            console.log(`[GenerateRecs] Saved rec ${i+1}, response:`, response);
          } catch (saveErr) {
            console.error(`[GenerateRecs] Failed to save rec ${i+1}:`, saveErr);
            throw saveErr;
          }
        }
        console.log('[GenerateRecs] All recommendations saved, invalidating cache...');
        queryClient.invalidateQueries({ queryKey: ['recommendations'] });
        toast.success('New recommendations generated' + (hasSensorData ? ' using sensor data' : ''));
      } else {
        toast.error('AI returned no recommendations. Try again.');
        console.error('AI result full:', JSON.stringify(result));
        console.error('AI result:', result);
      }
    } catch (err) {
      console.error('Generate recommendations error:', err);
      toast.error(`Failed: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <TopBar title="AI Recommendations — Predictive Impact Panel" activeIncidents={activeIncidents.length} />
      <div className="flex-1 overflow-hidden flex">
        {/* Incident selector */}
        <div className="w-72 border-r border-border bg-card/50 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Incidents</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {activeIncidents.map(inc => (
              <div key={inc.id}>
                <button
                  onClick={() => setSelectedIncidentId(inc.id)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg border transition-all text-xs',
                    selectedIncidentId === inc.id
                      ? 'bg-primary/10 border-primary/30'
                      : 'bg-card/50 border-border hover:border-primary/20'
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <SeverityBadge score={inc.severity} />
                  </div>
                  <p className="font-medium text-sm">{inc.title}</p>
                  <p className="text-muted-foreground mt-0.5">{inc.location_name}</p>
                </button>
                {selectedIncidentId === inc.id && (
                  <button
                    onClick={async () => {
                      try {
                        await incidentsApi.update(inc.id, { status: 'resolved' });
                        queryClient.invalidateQueries({ queryKey: ['incidents'] });
                        setSelectedIncidentId(null);
                        toast.success('Incident resolved');
                      } catch (err) {
                        toast.error('Failed to resolve incident');
                      }
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium hover:bg-green-500/20 transition-colors flex items-center gap-2 mt-1"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Resolve Incident
                  </button>
                )}
              </div>
            ))}
            {activeIncidents.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-8">No active incidents</p>
            )}
          </div>
        </div>

        {/* Recommendations panel */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Predictive Impact Panel</h2>
                <p className="text-xs text-muted-foreground">AI-generated tactical recommendations with predicted outcomes</p>
              </div>
            </div>
            <Button onClick={generateRecs} disabled={generating} className="gap-2">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Generate{hasSensorData ? ' with Sensors' : ''} Recommendations
            </Button>
          </div>

          {/* Sensor input panel */}
          <SensorPanel sensorData={sensorData} onSensorDataChange={setSensorData} />

          {filteredRecs.length > 0 ? (
            <div className="grid gap-4 max-w-3xl">
              {filteredRecs.map(rec => (
                <RecommendationCard
                  key={rec.id}
                  rec={rec}
                  incident={selectedIncident}
                  currentUser={currentUser}
                  onFeedback={handleFeedback}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Brain className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-sm">Select an incident and generate recommendations</p>
              <p className="text-xs mt-1 opacity-60">Optionally load sensor data above for context-aware AI analysis</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
