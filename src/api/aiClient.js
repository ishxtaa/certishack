import { invokeLLM } from '@/api/openaiClient';

export async function generateRecommendationsAI(incident, pastFeedbackText = '') {
  return invokeLLM({
    prompt: `You are a security operations AI for an airport. Generate 3 tactical recommendations for this incident.

Incident: ${incident.title}
Type: ${incident.type}
Severity: ${incident.severity}/10
Location: ${incident.location_name}
Description: ${incident.description || 'N/A'}

Past officer feedback:
${pastFeedbackText || 'No prior feedback'}

Return 3 recommendations. For each recommendation provide:
- action_text
- predicted_outcome
- confidence (1-100)
- priority (critical/high/medium/low)

Rules:
- If severity >= 8, at least one recommendation must involve immediate dispatch or urgent intervention.
- If type is medical, mention medical response.
- If type is access_violation or intrusion, mention verification/containment.`,
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
            },
          },
        },
      },
    },
  });
}

export async function generatePostAnalysisAI(incident, recsText = '') {
  return invokeLLM({
    prompt: `You are a security training analyst. Create a concise but actionable post-incident analysis report in markdown.

Incident: ${incident.title}
Type: ${incident.type}
Severity: ${incident.severity}/10
Location: ${incident.location_name}
Status: ${incident.status}
Description: ${incident.description || 'N/A'}
Narrative: ${incident.narrative || 'N/A'}

Recommendations & feedback:
${recsText || 'No recommendations recorded'}

Use these sections:
1. Incident Summary
2. Response Analysis
3. Key Learnings
4. Training Recommendations
5. Protocol Improvements`,
    response_json_schema: {
      type: 'object',
      properties: {
        analysis: { type: 'string' },
      },
    },
  });
}

export async function generateRouteReasoningAI(officer, routeStops) {
  return invokeLLM({
    prompt: `Explain this patrol route in 3 short sentences for an airport command dashboard.

Officer: ${officer.name}
Specialization: ${officer.specialization}

Stops:
${routeStops.map((s, i) => `${i + 1}. ${s.name} (severity ${s.severity ?? 'checkpoint'}) — ${s.priority_note}`).join('\n')}

Explain why this route order makes sense.`,
    response_json_schema: {
      type: 'object',
      properties: {
        reasoning: { type: 'string' },
      },
    },
  });
}

export async function generateAssignmentReasoningAI(incident, rankedOfficers) {
  return invokeLLM({
    prompt: `Explain why the top-ranked officer is the best fit for this incident in 2 short sentences.

Incident: ${incident.title}
Type: ${incident.type}
Location: ${incident.location_name}
Severity: ${incident.severity}

Candidate officers:
${rankedOfficers.slice(0, 3).map((o, i) => `${i + 1}. ${o.name}, specialization=${o.specialization}, distance=${o.distance_km.toFixed(2)} km, score=${o.score}`).join('\n')}`,
    response_json_schema: {
      type: 'object',
      properties: {
        reasoning: { type: 'string' },
      },
    },
  });
}