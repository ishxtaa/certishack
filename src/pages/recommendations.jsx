import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { generateRecommendationsAI } from '@/api/aiClient';
import TopBar from '@/components/layout/TopBar';
import { SeverityBadge } from '@/components/dashboard/IncidentBadge';
import OfficerFeedback from '@/components/dashboard/OfficerFeedback';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Brain, CheckCircle, XCircle, MessageSquare,
  TrendingUp, Loader2, Sparkles, RefreshCw, Volume2 } from
'lucide-react';
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
      className="bg-card border border-border rounded-xl p-5 space-y-4">
      
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
        <div className="flex flex-col gap-2 flex-shrink-0">
          

          
          <button
            onClick={() => speakText(`${rec.action_text}. Predicted outcome: ${rec.predicted_outcome}`)}
            className="w-10 h-10 rounded-lg bg-secondary/60 hover:bg-secondary flex items-center justify-center transition-colors"
            title="Listen to recommendation">
            
            <Volume2 className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Predicted outcome */}
      <div className="bg-secondary/50 rounded-lg p-3 border border-border">
        <div className="flex items-center gap-1.5 mb-1.5">
          <TrendingUp className="w-3 h-3 text-primary" />
          <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">Predicted Outcome</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{rec.predicted_outcome}</p>
      </div>

      {/* Accept/Reject */}
      {rec.feedback === 'pending' ?
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
            {showNotes &&
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                <Textarea
              placeholder="Add notes or custom action..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs bg-secondary/50 h-20" />
            
                <Button size="sm" className="mt-2 w-full" variant="outline" onClick={() => handleAction('custom_action')}>
                  Submit Custom Action
                </Button>
              </motion.div>
          }
          </AnimatePresence>
        </div> :

      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border",
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
      }

      {/* Officer Feedback — per recommendation / incident */}
      {incident &&
      <div className="border-t border-border pt-4">
          <OfficerFeedback incident={incident} currentUser={currentUser} />
        </div>
      }
    </motion.div>);

}

export default function Recommendations() {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);

  const { data: currentUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me()
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => base44.entities.Incident.list('-created_date', 30)
  });

  const { data: recommendations = [] } = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => base44.entities.Recommendation.list('-created_date', 50)
  });

  const activeIncidents = incidents.filter((i) => i.status === 'active' || i.status === 'responding');
  const selectedIncident = incidents.find((i) => i.id === selectedIncidentId) || null;

  const filteredRecs = (selectedIncidentId ?
  recommendations.filter((r) => r.incident_id === selectedIncidentId) :
  recommendations).slice().sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Recommendation.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recommendations'] })
  });

  const handleFeedback = (recId, feedback, notes) => {
    updateMutation.mutate({ id: recId, data: { feedback, officer_notes: notes || undefined } });
    toast.success(`Recommendation ${feedback}`);
  };

 const generateRecs = async () => {
  if (!selectedIncidentId) {
    toast.error('Select an incident first');
    return;
  }

  setGenerating(true);

  try {
    const incident = incidents.find((i) => i.id === selectedIncidentId);

    const pastFeedback = recommendations
      .filter((r) => r.feedback !== 'pending')
      .slice(0, 5)
      .map((r) => `Action: ${r.action_text} → Feedback: ${r.feedback}${r.officer_notes ? ` (${r.officer_notes})` : ''}`)
      .join('\n');

    const result = await generateRecommendationsAI(incident, pastFeedback);
    const recs = result?.recommendations || [];

    if (!Array.isArray(recs) || recs.length === 0) {
      toast.error('AI returned no recommendations. Try again.');
      return;
    }

    for (const rec of recs.slice(0, 3)) {
      await base44.entities.Recommendation.create({
        incident_id: selectedIncidentId,
        action_text: rec.action_text,
        predicted_outcome: rec.predicted_outcome,
        confidence: Math.max(1, Math.min(100, Number(rec.confidence) || 70)),
        priority: ['critical', 'high', 'medium', 'low'].includes(rec.priority) ? rec.priority : 'medium',
        feedback: 'pending',
      });
    }

    queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    toast.success('New recommendations generated');
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
            {activeIncidents.map((inc) =>
            <button
              key={inc.id}
              onClick={() => setSelectedIncidentId(inc.id)}
              className={cn(
                "w-full text-left p-3 rounded-lg border transition-all text-xs",
                selectedIncidentId === inc.id ?
                "bg-primary/10 border-primary/30" :
                "bg-card/50 border-border hover:border-primary/20"
              )}>
              
                <div className="flex items-center gap-2 mb-1">
                  <SeverityBadge score={inc.severity} />
                </div>
                <p className="font-medium text-sm">{inc.title}</p>
                <p className="text-muted-foreground mt-0.5">{inc.location_name}</p>
              </button>
            )}
            {activeIncidents.length === 0 &&
            <p className="text-center text-xs text-muted-foreground py-8">No active incidents</p>
            }
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

          {filteredRecs.length > 0 ?
          <div className="grid gap-4 max-w-3xl">
              {filteredRecs.map((rec) =>
            <RecommendationCard
              key={rec.id}
              rec={rec}
              incident={selectedIncident}
              currentUser={currentUser}
              onFeedback={handleFeedback} />

            )}
            </div> :

          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Brain className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-sm">Select an incident and generate recommendations</p>
            </div>
          }
        </div>
      </div>
    </div>);

}