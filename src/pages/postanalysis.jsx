import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { incidentsApi, recommendationsApi, invokeLLM } from '@/api/openaiClient';
import TopBar from '@/components/layout/TopBar';
import { SeverityBadge, StatusBadge } from '@/components/dashboard/IncidentBadge';
import { Button } from '@/components/ui/button';
import { 
  FileText, Loader2, Sparkles, Clock, MapPin, CheckCircle 
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import moment from 'moment';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

export default function PostAnalysis() {
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [analysis, setAnalysis] = useState(null);

  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => incidentsApi.list(),
  });

  const { data: recommendations = [] } = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => recommendationsApi.list(),
  });

  const resolvedIncidents = incidents.filter(i => i.status === 'resolved' || i.status === 'contained' || i.status === 'false_alarm');
  const activeIncidents = incidents.filter(i => i.status === 'active' || i.status === 'responding');

  const handleSelect = (inc) => {
    setSelectedIncident(inc);
    setAnalysis(inc.post_analysis || null);
  };

  const generateAnalysis = async () => {
    if (!selectedIncident) return;
    setGenerating(true);

    try {
      const incRecs = recommendations.filter(r => String(r.incident_id) === String(selectedIncident.id));
      const recsText = incRecs.map(r => 
        `- Action: ${r.action_text}\n  Outcome predicted: ${r.predicted_outcome}\n  Officer feedback: ${r.feedback}${r.officer_notes ? ` (${r.officer_notes})` : ''}`
      ).join('\n');

      const result = await invokeLLM({
        prompt: `You are a security training analyst. Create a comprehensive post-incident analysis report for training purposes.

Incident: ${selectedIncident.title}
Type: ${selectedIncident.type}
Severity: ${selectedIncident.severity}/10
Location: ${selectedIncident.location_name}
Status: ${selectedIncident.status}
Description: ${selectedIncident.description || 'N/A'}

AI Recommendations & Officer Feedback:
${recsText || 'No recommendations recorded'}

Generate a markdown report with these sections:
1. ## Incident Summary
2. ## Response Analysis
3. ## Key Learnings
4. ## Training Recommendations
5. ## Protocol Improvements

Return ONLY a JSON object with a single "analysis" key containing the full markdown as a string.`,
        response_json_schema: {
          type: "object",
          properties: {
            analysis: { type: "string" }
          }
        }
      });

      // Extract the markdown string from whatever format AI returned
      let analysisText = null;

      if (result && typeof result === 'object') {
        // Try common key names
        analysisText = result.analysis || result.markdown || result.report || result.content || result.response;
        
        // If AI returned section keys, merge them
        if (!analysisText) {
          const sectionKeys = ['Incident Summary', 'Response Analysis', 'Key Learnings', 'Training Recommendations', 'Protocol Improvements'];
          const hasSections = sectionKeys.some(k => result[k]);
          if (hasSections) {
            analysisText = sectionKeys.filter(k => result[k]).map(k => result[k]).join('\n\n');
          }
        }

        // If still nothing, stringify the whole object
        if (!analysisText) {
          analysisText = JSON.stringify(result, null, 2);
        }
      } else if (typeof result === 'string') {
        analysisText = result;
      }

      // If analysisText is still an object, stringify it
      if (analysisText && typeof analysisText === 'object') {
        analysisText = JSON.stringify(analysisText, null, 2);
      }

      if (analysisText) {
        setAnalysis(analysisText);
        await incidentsApi.update(selectedIncident.id, { post_analysis: analysisText });
        toast.success('Analysis generated');
      } else {
        toast.error('AI returned invalid format. Try again.');
      }
    } catch (err) {
      console.error('generateAnalysis error:', err);
      toast.error(`Failed: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Post-Incident Analysis" activeIncidents={activeIncidents.length} />
      <div className="flex-1 overflow-hidden flex">
        {/* Incident list */}
        <div className="w-80 border-r border-border bg-card/50 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resolved Incidents</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {resolvedIncidents.map(inc => (
              <button
                key={inc.id}
                onClick={() => handleSelect(inc)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition-all",
                  selectedIncident?.id === inc.id
                    ? "bg-primary/10 border-primary/30"
                    : "bg-card/50 border-border hover:border-primary/20"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <SeverityBadge score={inc.severity} />
                  <StatusBadge status={inc.status} />
                </div>
                <p className="text-sm font-medium">{inc.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {moment(inc.timestamp || inc.created_date).format('MMM D, HH:mm')}
                </p>
                {inc.post_analysis && (
                  <div className="flex items-center gap-1 mt-1">
                    <CheckCircle className="w-2.5 h-2.5 text-green-400" />
                    <span className="text-[10px] text-green-400">Report available</span>
                  </div>
                )}
              </button>
            ))}
            {resolvedIncidents.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-8">No resolved incidents yet</p>
            )}
          </div>
        </div>

        {/* Analysis content */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedIncident ? (
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">{selectedIncident.title}</h2>
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <MapPin className="w-3 h-3" /> {selectedIncident.location_name}
                      <span>•</span>
                      Severity {selectedIncident.severity}/10
                    </p>
                  </div>
                </div>
                <Button onClick={generateAnalysis} disabled={generating} className="gap-2">
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {analysis ? 'Regenerate' : 'Generate Analysis'}
                </Button>
              </div>

              {analysis ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card border border-border rounded-xl p-6"
                >
                  <ReactMarkdown className="prose prose-invert prose-sm max-w-none [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_h2]:text-primary [&_h1]:text-foreground [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_strong]:text-foreground [&_ul]:space-y-1 [&_ol]:space-y-1">
                    {analysis}
                  </ReactMarkdown>
                </motion.div>
              ) : (
                <div className="bg-card border border-border rounded-xl p-12 text-center">
                  <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">Click "Generate Analysis" to create a training report</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <FileText className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-sm">Select a resolved incident to view or generate analysis</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}