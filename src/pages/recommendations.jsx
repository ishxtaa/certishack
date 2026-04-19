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
  TrendingUp, Loader2, Sparkles, RefreshCw, Volume2
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

function speakText(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

// ─── Recommendation Card ───────────────────────────────────────────────────
function RecommendationCard({ rec, incident, currentUser, onFeedback }) {
  const handleAction = (action) => {
    onFeedback(rec.id, action, '');
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
          </div>
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
           rec.feedback === 'rejected' ? 'Action Rejected' : 'Pending'}
        </div>
      )}

      {incident && (
        <div className="border-t border-border pt-4">
          <OfficerFeedback recommendation={rec} currentUser={currentUser} />
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

      const result = await invokeLLM({
        prompt: `You are a security operations AI for an airport. Generate 3 tactical recommendations for this incident.

Incident: ${incident.title}
Type: ${incident.type}
Severity: ${incident.severity}/10
Location: ${incident.location_name}
Description: ${incident.description || 'N/A'}

Past officer feedback on recommendations:
${pastFeedback || 'No prior feedback'}

For each recommendation provide:
- action_text: specific tactical action (2-3 sentences)
- predicted_outcome: what will happen if they take this action
- confidence: a number 1-100
- priority: critical/high/medium/low`,
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
                  priority: { type: 'string' }
                }
              }
            }
          }
        }
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
        toast.success('New recommendations generated');
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
              Generate Recommendations
            </Button>
          </div>

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
              <p className="text-xs mt-1 opacity-60">AI will generate tactical recommendations based on incident details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
