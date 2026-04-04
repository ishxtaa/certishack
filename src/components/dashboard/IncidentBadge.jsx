import React from 'react';
import { cn } from '@/lib/utils';
import { getSeverityColor, getSeverityLevel, STATUS_CONFIG } from '@/lib/securityUtils';

export function SeverityBadge({ score }) {
  const colors = getSeverityColor(score);
  const level = getSeverityLevel(score);
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-mono border", colors.bg, colors.text, colors.border)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", 
        level === 'critical' ? 'bg-red-500 animate-pulse' : 
        level === 'high' ? 'bg-orange-500' : 
        level === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
      )} />
      {score.toFixed(1)}
    </span>
  );
}

export function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.active;
  const colorMap = {
    red: "bg-red-500/15 text-red-400 border-red-500/30",
    orange: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    yellow: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    green: "bg-green-500/15 text-green-400 border-green-500/30",
    blue: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border", colorMap[config.color])}>
      {config.dot && <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse",
        config.color === 'red' ? 'bg-red-500' : 'bg-orange-500'
      )} />}
      {config.label}
    </span>
  );
}