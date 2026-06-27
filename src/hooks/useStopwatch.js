import { useState, useEffect, useRef, useCallback } from 'react';

export const useStopwatch = () => {
  const [swElapsed, setSwElapsed]     = useState(0); // ms
  const [isSwRunning, setIsSwRunning] = useState(false);
  const [wordCount, setWordCount]     = useState('');
  const [materialName, setMaterialName] = useState('');
  const [transcript, setTranscript] = useState('');
  const [readingRecords, setReadingRecords] = useState([]);
  const [recordVoice, setRecordVoice] = useState(false);
  const [micError, setMicError] = useState('');
  const speechSupported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const startTimeRef     = useRef(null);
  const baseElapsedRef    = useRef(0);
  const mediaRecorderRef  = useRef(null);
  const chunksRef         = useRef([]);
  const streamRef         = useRef(null);
  const recognitionRef    = useRef(null);
  const recordVoiceRef    = useRef(recordVoice);
  const isSwRunningRef    = useRef(isSwRunning);
  const swElapsedRef      = useRef(swElapsed);
  useEffect(() => { recordVoiceRef.current = recordVoice; }, [recordVoice]);
  useEffect(() => { isSwRunningRef.current = isSwRunning; }, [isSwRunning]);
  useEffect(() => { swElapsedRef.current = swElapsed; }, [swElapsed]);

  const startSpeechRecognition = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const recog = new SR();
    recog.lang = 'en-US';
    recog.continuous = true;
    recog.interimResults = false;
    recog.onresult = (e) => {
      let text = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) text += e.results[i][0].transcript;
      }
      if (text.trim()) setTranscript(prev => (prev ? `${prev} ${text.trim()}` : text.trim()));
    };
    recog.onerror = () => {};
    recog.onend = () => {
      if (isSwRunningRef.current && recordVoiceRef.current && recognitionRef.current === recog) {
        try { recog.start(); } catch {}
      }
    };
    try { recog.start(); recognitionRef.current = recog; } catch {}
  };

  const stopSpeechRecognition = () => {
    const recog = recognitionRef.current;
    if (!recog) return;
    recog.onend = null;
    try { recog.stop(); } catch {}
    recognitionRef.current = null;
  };

  const PREFERRED_MIME_TYPES = ['audio/mp4', 'audio/webm', 'audio/ogg', 'audio/wav'];
  const getSupportedMimeType = () => {
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return undefined;
    return PREFERRED_MIME_TYPES.find(t => MediaRecorder.isTypeSupported(t));
  };

  const startAudioRecording = async () => {
    if (typeof MediaRecorder === 'undefined') {
      setMicError('このブラウザは録音に対応していません');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = getSupportedMimeType();
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start();
      mediaRecorderRef.current = mr;
      setMicError('');
    } catch {
      mediaRecorderRef.current = null;
      setMicError('マイクを使用できませんでした（権限をご確認ください）');
    }
  };

  const stopAudioRecording = () => new Promise((resolve) => {
    const mr = mediaRecorderRef.current;
    if (!mr) { resolve(null); return; }
    const mimeType = mr.mimeType || 'audio/webm';
    mr.onstop = () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      mediaRecorderRef.current = null;
      resolve(chunksRef.current.length > 0 ? URL.createObjectURL(new Blob(chunksRef.current, { type: mimeType })) : null);
    };
    mr.stop();
  });

  const discardAudioRecording = () => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    mr.onstop = null;
    try { mr.stop(); } catch {}
    streamRef.current?.getTracks().forEach(t => t.stop());
    mediaRecorderRef.current = null;
  };

  const toggleStopwatch = useCallback(() => {
    setIsSwRunning(prev => {
      const next = !prev;
      if (next) {
        if (swElapsedRef.current === 0) setTranscript('');
        startTimeRef.current = Date.now();
        if (recordVoice) {
          if (mediaRecorderRef.current?.state === 'paused') mediaRecorderRef.current.resume();
          else startAudioRecording();
          startSpeechRecognition();
        }
      } else {
        baseElapsedRef.current += Date.now() - startTimeRef.current;
        if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.pause();
        stopSpeechRecognition();
      }
      return next;
    });
  }, [recordVoice]);

  const resetStopwatch = useCallback(() => {
    setIsSwRunning(false);
    setSwElapsed(0);
    baseElapsedRef.current = 0;
    startTimeRef.current = null;
    discardAudioRecording();
    stopSpeechRecognition();
  }, []);

  useEffect(() => {
    if (!isSwRunning) return;
    const id = setInterval(() => {
      setSwElapsed(baseElapsedRef.current + (Date.now() - startTimeRef.current));
    }, 100);
    return () => clearInterval(id);
  }, [isSwRunning]);

  const formatStopwatch = (ms) => {
    const totalCs = Math.floor(ms / 10); // centiseconds
    const m  = Math.floor(totalCs / 6000).toString().padStart(2, '0');
    const s  = Math.floor((totalCs % 6000) / 100).toString().padStart(2, '0');
    const cs = (totalCs % 100).toString().padStart(2, '0');
    return { m, s, cs };
  };

  const words = Number(wordCount) || 0;
  const wpm = words > 0 && swElapsed > 0 ? Math.round(words / (swElapsed / 60000)) : 0;

  const recordReading = useCallback(async () => {
    const audioUrl = recordVoice ? await stopAudioRecording() : null;
    setReadingRecords(prev => [...prev, { wordCount: words, elapsedMs: swElapsed, wpm, audioUrl }]);
    resetStopwatch();
  }, [words, swElapsed, wpm, recordVoice, resetStopwatch]);

  const clearReadingRecords = useCallback(() => setReadingRecords([]), []);

  return {
    swElapsed,
    isSwRunning,
    wordCount, setWordCount,
    materialName, setMaterialName,
    transcript, setTranscript,
    recordVoice, setRecordVoice,
    micError,
    speechSupported,
    toggleStopwatch,
    resetStopwatch,
    formatStopwatch,
    wpm,
    readingRecords,
    recordReading,
    clearReadingRecords,
  };
};
