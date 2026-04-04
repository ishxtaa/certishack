import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Brain, FileText, Clock,
  Route, Shield, ChevronLeft, ChevronRight } from
'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const NAV_ITEMS = [
{ path: '/', icon: LayoutDashboard, label: 'Command Center' },
{ path: '/recommendations', icon: Brain, label: 'AI Recommendations' },
{ path: '/timeline', icon: Clock, label: 'Incident Timeline' },
{ path: '/patrol', icon: Route, label: 'Patrol Routes' },
{ path: '/analysis', icon: FileText, label: 'Post-Incident' }];


export default function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();

  return (
    <motion.aside
      className="h-screen bg-card border-r border-border flex flex-col z-50 relative"
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}>
      
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-border gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
          <Shield className="w-4 h-4 text-primary" />
        </div>
        <AnimatePresence>
          {!collapsed &&
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="overflow-hidden whitespace-nowrap">
            
              <span className="text-sm font-bold tracking-wide">SENTINEL</span>
              
            </motion.div>
          }
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150",
                isActive ?
                "bg-primary/15 text-primary font-medium" :
                "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}>
              
              <item.icon className={cn("w-4 h-4 flex-shrink-0", isActive && "text-primary")} />
              <AnimatePresence>
                {!collapsed &&
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="whitespace-nowrap overflow-hidden">
                  
                    {item.label}
                  </motion.span>
                }
              </AnimatePresence>
            </Link>);

        })}
      </nav>

      {/* Toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 bg-card border border-border rounded-full flex items-center justify-center hover:bg-secondary transition-colors">
        
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      {/* Status bar */}
      <div className="px-4 py-3 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          {!collapsed &&
          <span className="text-[10px] text-muted-foreground font-mono">SYSTEM ONLINE</span>
          }
        </div>
      </div>
    </motion.aside>);

}