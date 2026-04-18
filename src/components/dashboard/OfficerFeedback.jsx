import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Mic, MicOff, Send, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import moment from 'moment';
import { toast } from 'sonner';

export default function OfficerFeedback({ incident, currentUser }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const feedbackList = incident?.officer_feedback || [];

  const saveMutation = useMutation({
    mutationFn: async (entry) => {
      const existing = incident.officer_feedback || [];
      await base44.entities.Incident.update(incident.id, {
        officer_feedback: [...existing, entry],
      });
      return entry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      setText('');
      toast.success('Feedback submitted');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to save feedback');
    },
  });

  const handleTextSubmit = () => {
    if (!text.trim()) return;

    saveMutation.mutate({
      officer_name: currentUser?.full_name || 'Officer',
      text: text.trim(),
      timestamp: new Date().toISOString(),
      type: 'text',
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = handleRecordingStop;
      mediaRecorder.start();
      setRecording(true);
    } catch {
      toast.error('Microphone access denied');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    setRecording(false);
    setTranscribing(true);
  };

  const handleRecordingStop = async () => {
    try {
      // Demo placeholder until real STT is added
      const transcription = '[Demo voice note captured — real transcription not connected yet]';

      saveMutation.mutate({
        officer_name: currentUser?.full_name || 'Officer',
        text: transcription,
        timestamp: new Date().toISOString(),
        type: 'voice_transcribed',
      });
    } catch {
      toast.error('Transcription failed');
    } finally {
      setTranscribing(false);
    }
  };

  const busy = saveMutation.isPending || transcribing;

  return (
    <div className="space-y-3">
      {feedbackList.length > 0 && (
        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
          <AnimatePresence>
            {feedbackList.map((fb, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-secondary/40 rounded-lg p-2.5 border border-border"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-semibold text-primary">{fb.officer_name}</span>
                  {fb.type === 'voice_transcribed' && (
                    <span className="text-[9px] bg-blue-500/15 text-blue-400 border border-blue-500/20 rounded px-1">
                      Voice
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {moment(fb.timestamp).fromNow()}
                  </span>
                </div>
                <p className="text-[11px] text-foreground/80 leading-relaxed">{fb.text}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <div className="space-y-2">
        <Textarea
          placeholder="Add officer observations, scene updates, or tactical notes..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-[84px] bg-secondary/40 border-border text-xs"
          disabled={busy}
        />

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="gap-2"
            onClick={handleTextSubmit}
            disabled={busy || !text.trim()}
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            Submit
          </Button>

          <Button
            size="sm"
            variant={recording ? 'destructive' : 'outline'}
            className="gap-2"
            onClick={recording ? stopRecording : startRecording}
            disabled={busy}
          >
            {recording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            {recording ? 'Stop Recording' : 'Voice Note'}
          </Button>

          {transcribing && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Processing demo voice note...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}