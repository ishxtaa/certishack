import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { invokeLLM } from '@/api/openaiClient';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ResponsiveContainer, Tooltip
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, ShieldAlert, MapPin, Clock, Zap } from 'lucide-react';
import { SeverityBadge, StatusBadge } from './IncidentBadge';
import OfficerFeedback from './OfficerFeedback';
import moment from 'moment';

const HIGH_RISK_ZONES = ['Terminal 1 - Departure', 'Terminal 2 - Departure', 'Terminal 3 - Departure', 'Jewel', 'Runway 1', 'Runway 2', 'Control Tower'];

function computeRadarData(incident, pastIncidents) {
  // Timestamp risk: higher at night (22:00–06:00) and peak travel (06:00–09:00, 17:00–20:00)
  const hour = new Date(incident.timestamp || incident.created_date).getHours();
  const isNight = hour >= 22 || hour < 6;
  const isPeak = (hour >= 6 && hour < 9) || (hour >= 17 && hour < 20);
  const timestampScore = isNight ? 9 : isPeak ? 7 : 5;

  // Location sensitivity
  const isHighRisk = HIGH_RISK_ZONES.includes(incident.location_name);
  const locationScore = isHighRisk ? 9 : 6;

  // Behaviour abnormality: based on type
  const typeScoreMap = {
    fire_alarm: 10, medical: 9, panic: 9, intrusion: 8,
    unattended_bag: 7, theft: 6, vandalism: 5,
    suspicious_behavior: 7, access_violation: 6, other: 4,
  };
  const behaviourScore = typeScoreMap[incident.type] || 5;

  // Signal type strength: based on alerts count
  const alertCount = (incident.alerts || []).length;
  const signalScore = Math.min(10, 3 + alertCount * 1.5);

  // Historical pattern: avg severity of similar past incidents
  const similar = pastIncidents.filter(i => i.type === incident.type && i.id !== incident.id);
  const historicalScore = similar.length > 0
    ? similar.reduce((s, i) => s + (i.severity || 5), 0) / similar.length
    : 5;

  return [
    { factor: 'Timestamp Risk', score: timestampScore, fullMark: 10 },
    { factor: 'Location Sensitivity', score: locationScore, fullMark: 10 },
    { factor: 'Behaviour Abnormality', score: behaviourScore, fullMark: 10 },
    { factor: 'Signal Strength', score: Math.round(signalScore * 10) / 10, fullMark: 10 },
    { factor: 'Historical Pattern', score: Math.round(historicalScore * 10) / 10, fullMark: 10 },
  ];
}

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
        <p className="font-semibold text-foreground">{payload[0].payload.factor}</p>
        <p className="text-primary font-mono">{payload[0].value} / 10</p>
      </div>
    );
  }
  return null;
};
CustomTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array
};

export default function SeverityRadarPanel({ incident, allIncidents, onClose, currentUser }) {
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const radarData = computeRadarData(incident, allIncidents);
  const compositeScore = (radarData.reduce((s, d) => s + d.score, 0) / radarData.length).toFixed(1);

  useEffect(() => {
    const fetchAnalysis = async () => {
      setLoading(true);
      const past = allIncidents
        .filter(i => i.type === incident.type && i.id !== incident.id)
        .slice(0, 5)
        .map(i => `Severity ${i.severity} at ${i.location_name} — ${i.status}`)
        .join('\n') || 'No past incidents of this type.';

      const result = await invokeLLM({
        prompt: `Analyze this security incident and provide a brief severity assessment (2-3 sentences max):
Incident: ${incident.title}
Type: ${incident.type}
Location: ${incident.location_name}
Current Status: ${incident.status}
Severity Score: ${incident.severity}/10
Timestamp: ${incident.timestamp || incident.created_date}
Radar Factors: ${radarData.map(d => `${d.factor}: ${d.score}/10`).join(', ')}

Past similar incidents:
${past}

Focus on: what makes this incident at this severity, key risk factors, and recommended urgency.`,
      });
      setAiAnalysis(typeof result === 'string' ? result : null);
      setLoading(false);
    };
    fetchAnalysis();
  }, [incident.id]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <SeverityBadge score={incident.severity} />
                <StatusBadge status={incident.status} />
              </div>
              <h2 className="text-base font-semibold">{incident.title}</h2>
              <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{incident.location_name}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{moment(incident.timestamp || incident.created_date).fromNow()}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-secondary transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left: Radar chart */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-primary" /> Severity Radar
                </h3>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">Composite</span>
                  <span className={`text-sm font-bold font-mono ${
                    Number(compositeScore) >= 8 ? 'text-red-400' :
                    Number(compositeScore) >= 6 ? 'text-orange-400' :
                    Number(compositeScore) >= 4 ? 'text-yellow-400' : 'text-green-400'
                  }`}>{compositeScore}</span>
                </div>
              </div>

              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis
                      dataKey="factor"
                      tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}
                    />
                    <Radar
                      name="Score"
                      dataKey="score"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.25}
                      strokeWidth={2}
                      dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Factor scores */}
              <div className="space-y-2 mt-2">
                {radarData.map((d) => (
                  <div key={d.factor} className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-36 truncate">{d.factor}</span>
                    <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          d.score >= 8 ? 'bg-red-500' : d.score >= 6 ? 'bg-orange-500' :
                          d.score >= 4 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${(d.score / 10) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-foreground w-8 text-right">{d.score}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: AI analysis + feedback */}
            <div className="space-y-4">
              {/* AI insight */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
                  <Zap className="w-3.5 h-3.5 text-primary" /> AI Severity Assessment
                </h3>
                {loading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing…
                  </div>
                ) : aiAnalysis ? (
                  <div className="bg-primary/5 border border-primary/15 rounded-xl p-3">
                    <p className="text-xs text-foreground/85 leading-relaxed">{aiAnalysis}</p>
                  </div>
                ) : null}
              </div>

              {/* Description */}
              {incident.description && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">Description</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{incident.description}</p>
                </div>
              )}

              {/* Officer feedback */}
              <OfficerFeedback incident={incident} currentUser={currentUser} />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}