import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { INCIDENT_TYPES } from '@/lib/securityUtils';

const TYPE_COLORS = {
  fire_alarm: '#ef4444',
  medical: '#f87171',
  panic: '#fb923c',
  intrusion: '#f97316',
  unattended_bag: '#fbbf24',
  theft: '#eab308',
  vandalism: '#a3e635',
  suspicious_behavior: '#facc15',
  access_violation: '#3b82f6',
  other: '#6b7280',
};

export default function SeverityChart({ incidents }) {
  const data = Object.entries(INCIDENT_TYPES).map(([key, config]) => ({
    type: key,
    label: config.label,
    count: incidents.filter(i => i.type === key).length,
  })).filter(d => d.count > 0).sort((a, b) => b.count - a.count);

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis 
            type="category" 
            dataKey="label" 
            width={100} 
            tick={{ fontSize: 10, fill: 'hsl(215, 20%, 55%)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip 
            contentStyle={{ 
              background: 'hsl(222, 44%, 10%)', 
              border: '1px solid hsl(222, 30%, 16%)',
              borderRadius: 8,
              fontSize: 11,
              color: 'hsl(210, 40%, 96%)'
            }} 
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={14}>
            {data.map((entry) => (
              <Cell key={entry.type} fill={TYPE_COLORS[entry.type] || '#6b7280'} fillOpacity={0.7} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}