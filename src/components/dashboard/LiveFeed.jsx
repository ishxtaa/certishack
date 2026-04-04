import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { INCIDENT_TYPES } from '@/lib/securityUtils';
import { SeverityBadge, StatusBadge } from './IncidentBadge';
import { MapPin, Clock } from 'lucide-react';
import moment from 'moment';

export default function LiveFeed({ incidents, onSelect, selectedId }) {
  return (
    <div className="space-y-2 overflow-y-auto max-h-full pr-1">
      <AnimatePresence>
        {incidents.map((inc, i) => {
          const typeConfig = INCIDENT_TYPES[inc.type] || INCIDENT_TYPES.other;
          const isSelected = selectedId === inc.id;
          return (
            <motion.div
              key={inc.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => onSelect(inc)}
              className={`p-3 rounded-lg border cursor-pointer transition-all duration-150 ${
                isSelected 
                  ? 'bg-primary/10 border-primary/30' 
                  : 'bg-card/50 border-border hover:border-primary/20 hover:bg-card'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <SeverityBadge score={inc.severity} />
                    <StatusBadge status={inc.status} />
                  </div>
                  <p className="text-sm font-medium truncate">{inc.title}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
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
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
      {incidents.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No incidents to display
        </div>
      )}
    </div>
  );
}