import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, MapPin, Clock, X } from 'lucide-react';
import moment from 'moment';
import { SeverityBadge, StatusBadge } from '@/components/dashboard/IncidentBadge';

export default function NotificationsPopup({ incidents, onClose }) {
  const active = incidents.filter(i => i.status === 'active' || i.status === 'responding');

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="absolute right-0 top-10 w-80 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Active Incidents ({active.length})
        </span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="max-h-80 overflow-y-auto divide-y divide-border">
        {active.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-8">No active incidents</p>
        )}
        {active.map(inc => (
          <div key={inc.id} className="px-4 py-3 hover:bg-secondary/30 transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <SeverityBadge score={inc.severity} />
              <StatusBadge status={inc.status} />
            </div>
            <p className="text-sm font-medium truncate">{inc.title}</p>
            <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {inc.location_name}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {moment(inc.timestamp || inc.created_date).fromNow()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}