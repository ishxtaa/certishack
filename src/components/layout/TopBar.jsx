import React, { useState, useEffect } from 'react';
import { Bell, Radio, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { incidentsApi } from '@/api/openaiClient';
import NotificationsPopup from '@/components/layout/NotificationsPopUp';

export default function TopBar({ activeIncidents = 0, title = "Command Center" }) {
  const [time, setTime] = React.useState(new Date());
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => incidentsApi.list()
  });

  return (
    <header className="h-14 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between px-6 z-40">
      <div className="flex items-center gap-4">
        <h1 className="text-sm font-semibold tracking-wide uppercase">{title}</h1>
        {activeIncidents > 0 &&
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          className="flex items-center gap-1.5">
          
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse-glow" />
            <span className="text-xs font-mono text-red-400">{activeIncidents} ACTIVE</span>
          </motion.div>
        }
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          
          
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-xs font-mono">
            {time.toLocaleTimeString('en-US', { hour12: false })}
          </span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="relative">
          <button
            onClick={() => setShowNotifications((v) => !v)}
            className="relative p-1.5 rounded-md hover:bg-secondary transition-colors">
            
            <Bell className="w-4 h-4 text-muted-foreground" />
            {activeIncidents > 0 &&
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full text-[9px] font-bold flex items-center justify-center text-white">
                {activeIncidents}
              </span>
            }
          </button>
          <AnimatePresence>
            {showNotifications &&
            <NotificationsPopup
              incidents={incidents}
              onClose={() => setShowNotifications(false)} />

            }
          </AnimatePresence>
        </div>
      </div>
    </header>);

}
