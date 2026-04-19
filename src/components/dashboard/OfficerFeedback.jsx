import React, { useState, useRef } from 'react';
import { recommendationsApi, invokeLLM } from '@/api/openaiClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Mic, MicOff, Send, Loader2, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import moment from 'moment';
import { toast } from 'sonner';

export default function OfficerFeedback({ recommendation, currentUser }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  // Get feedback list from recommendation's officer_notes (parsed as array)
  const feedbackList = recommendation?.officer_notes ? 
    JSON.parse(recommendation.officer_notes) : [];

  const saveMutation = useMutation({
    mutationFn: async (/** @type {{ officer_name: string; text: string; timestamp: string; type: string }} */ entry) => {
      const existing = recommendation?.officer_notes ? 
        JSON.parse(recommendation.officer_notes) : [];
      const updatedFeedback = [...existing, entry];
      await recommendationsApi.update(recommendation.id, {
        officer_notes: JSON.stringify(updatedFeedback)
      });
      return entry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      setText('');
      toast.success('Feedback submitted');
    }
  });

  const handleTextSubmit = () => {
    if (!text.trim()) return;
    saveMutation.mutate({
      officer_name: currentUser?.full_name || 'Officer',
      text: text.trim(),
      timestamp: new Date().toISOString(),
      type: 'text'
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data);
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
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    const file = new File([blob], 'voice_feedback.webm', { type: 'audio/webm' });
    
    try {
      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('model', 'whisper-large-v3');
      formData.append('response_format', 'json');
      formData.append('language', 'en');
      
      // Call Groq API for transcription
      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`
          // Note: Don't set Content-Type for FormData, browser sets it with boundary
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Groq API error:', errorData);
        throw new Error(errorData.error?.message || 'Transcription failed');
      }

      const result = await response.json();
      const transcription = result.text || '[No transcription available]';
      
      saveMutation.mutate({
        officer_name: currentUser?.full_name || 'Officer',
        text: transcription,
        timestamp: new Date().toISOString(),
        type: 'voice_transcribed'
      });
    } catch (err) {
      console.error('Transcription error:', err);
      toast.error('Voice transcription failed. Please try again or type your feedback.');
      // Fallback: save with placeholder but allow user to edit
      saveMutation.mutate({
        officer_name: currentUser?.full_name || 'Officer',
        text: '[Voice note - transcription unavailable]',
        timestamp: new Date().toISOString(),
        type: 'voice_transcribed'
      });
    } finally {
      setTranscribing(false);
    }
  };

  // Text-to-speech function to read feedback aloud
  const speakFeedback = (text) => {
    if (!window.speechSynthesis) {
      toast.error('Text-to-speech not supported in this browser');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="space-y-3">
      {/* Previous feedback */}
      {feedbackList.length > 0 &&
      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
          <AnimatePresence>
            {feedbackList.map((fb, i) =>
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-secondary/40 rounded-lg p-2.5 border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-semibold text-primary">{fb.officer_name}</span>
                  {fb.type === 'voice_transcribed' &&
              <span className="text-[9px] bg-blue-500/15 text-blue-400 border border-blue-500/20 rounded px-1">Voice</span>
              }
                  <span className="text-[10px] text-muted-foreground ml-auto">{moment(fb.timestamp).fromNow()}</span>
                  <button
                    onClick={() => speakFeedback(fb.text)}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    title="Listen to feedback"
                  >
                    <Volume2 className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-[11px] text-foreground/80 leading-relaxed">{fb.text}</p>
              </motion.div>
          )}
          </AnimatePresence>
        </div>
      }

      {/* Input area */}
      <div className="space-y-2">
        <Textarea
          placeholder="Add officer observations, scene updates, or tactical notes..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-[84px] bg-secondary/40 border-border text-xs"
          disabled={saveMutation.isPending}
        />

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="gap-2"
            onClick={handleTextSubmit}
            disabled={saveMutation.isPending || !text.trim()}
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
            disabled={saveMutation.isPending}
          >
            {recording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            {recording ? 'Stop' : 'Voice Note'}
          </Button>
        </div>
      </div>
    </div>);

}
