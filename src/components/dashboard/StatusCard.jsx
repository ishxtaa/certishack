import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function StatusCard({ label, value, icon: Icon, trend, color = "primary", className }) {
  const colorMap = {
    primary: "text-primary bg-primary/10 border-primary/20",
    red: "text-red-400 bg-red-500/10 border-red-500/20",
    orange: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    green: "text-green-400 bg-green-500/10 border-green-500/20",
    yellow: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-card border border-border rounded-xl p-4 relative overflow-hidden",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
          <p className="text-2xl font-bold mt-1 font-mono">{value}</p>
          {trend && (
            <p className={cn("text-xs mt-1", trend > 0 ? "text-red-400" : "text-green-400")}>
              {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}% vs last hour
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center border", colorMap[color])}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      {/* Scan line effect */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent animate-scan-line" />
    </motion.div>
  );
}