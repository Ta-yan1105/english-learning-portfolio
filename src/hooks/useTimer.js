import { useState, useEffect, useRef, useCallback } from 'react';

export const useTimer = ({ onComplete } = {}) => {
  const [timerInputTime, setTimerInputTime] = useState(25 * 60);
  const [timerTimeLeft, setTimerTimeLeft]   = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [laps, setLaps]                     = useState([]);
  const [isFullscreen, setIsFullscreen]     = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);

  const isSoundEnabledRef   = useRef(true);
  const wakeLockRef         = useRef(null);
  const originalTitleRef    = useRef(document.title);
  const expectedEndTimeRef  = useRef(null);
  const timerTimeLeftRef    = useRef(timerTimeLeft);
  // onComplete を ref に保持 → interval 内で常に最新の関数を参照
  const onCompleteRef       = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { timerTimeLeftRef.current = timerTimeLeft; }, [timerTimeLeft]);

  /* ----- sound ----- */
  const toggleSound = useCallback(() => {
    setIsSoundEnabled(prev => { const next = !prev; isSoundEnabledRef.current = next; return next; });
  }, []);

  const playAlarmSound = useCallback(() => {
    if (!isSoundEnabledRef.current) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    try {
      const ctx = new AudioContext();
      const play = (freq, start, duration, vol = 0.2) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine'; osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(0, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + duration);
        osc.start(ctx.currentTime + start); osc.stop(ctx.currentTime + start + duration);
      };
      play(880, 0, 0.15);
      play(1318.51, 0.1, 0.5);
    } catch (e) {}
  }, []);

  /* ----- title ----- */
  useEffect(() => {
    if (isTimerRunning) {
      const m = Math.floor(timerTimeLeft / 60).toString().padStart(2, '0');
      const s = (timerTimeLeft % 60).toString().padStart(2, '0');
      document.title = `(${m}:${s}) ${originalTitleRef.current}`;
    } else {
      document.title = originalTitleRef.current;
    }
  }, [isTimerRunning, timerTimeLeft]);

  /* ----- wake lock ----- */
  useEffect(() => {
    const manage = async () => {
      if (isTimerRunning && 'wakeLock' in navigator) {
        try { wakeLockRef.current = await navigator.wakeLock.request('screen'); } catch {}
      } else if (!isTimerRunning && wakeLockRef.current) {
        try { await wakeLockRef.current.release(); } catch {} finally { wakeLockRef.current = null; }
      }
    };
    manage();
    return () => { if (wakeLockRef.current) { wakeLockRef.current.release().catch(() => {}); wakeLockRef.current = null; } };
  }, [isTimerRunning]);

  /* ----- timer interval ----- */
  const toggleTimer = useCallback(() => {
    setIsTimerRunning(prev => {
      if (!prev) expectedEndTimeRef.current = Date.now() + timerTimeLeftRef.current * 1000;
      return !prev;
    });
  }, []);

  useEffect(() => {
    if (!isTimerRunning) return;
    const id = setInterval(() => {
      const remaining = Math.round((expectedEndTimeRef.current - Date.now()) / 1000);
      if (remaining <= 0) {
        setTimerTimeLeft(0);
        setIsTimerRunning(false);
        playAlarmSound();
        if (onCompleteRef.current) onCompleteRef.current(Math.max(1, Math.ceil(timerInputTime / 60)));
        clearInterval(id);
      } else {
        setTimerTimeLeft(remaining);
      }
    }, 250);
    return () => clearInterval(id);
  }, [isTimerRunning, timerInputTime, playAlarmSound]);

  /* ----- controls ----- */
  const resetTimer = useCallback(() => {
    setIsTimerRunning(false);
    setTimerTimeLeft(timerInputTime);
    setLaps([]);
  }, [timerInputTime]);

  const recordLap = useCallback(() => {
    const currentElapsed = timerInputTime - timerTimeLeft;
    const remainingStr = `${String(Math.floor(timerTimeLeft / 60)).padStart(2,'0')}:${String(timerTimeLeft % 60).padStart(2,'0')}`;
    setLaps(prev => {
      const lapElapsed = prev.length > 0 ? currentElapsed - prev[prev.length - 1].totalElapsed : currentElapsed;
      const lapStr = `${String(Math.floor(lapElapsed / 60)).padStart(2,'0')}:${String(lapElapsed % 60).padStart(2,'0')}`;
      return [...prev, { elapsed: lapStr, remaining: remainingStr, totalElapsed: currentElapsed }];
    });
  }, [timerInputTime, timerTimeLeft]);

  /* ----- fullscreen ----- */
  const handleEnterFullscreen = useCallback(async () => {
    const el = document.documentElement;
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    } catch {}
    setIsFullscreen(true);
  }, []);

  const handleExitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
      }
    } catch {}
    setIsFullscreen(false);
  }, []);

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) setIsFullscreen(false);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => { document.removeEventListener('fullscreenchange', onChange); document.removeEventListener('webkitfullscreenchange', onChange); };
  }, []);

  /* ----- keyboard ----- */
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.code === 'Space') { e.preventDefault(); toggleTimer(); }
      if (e.code === 'Escape' && isFullscreen) handleExitFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleTimer, isFullscreen, handleExitFullscreen]);

  /* ----- format ----- */
  const formatTimerDisplay = (seconds) => ({
    m: Math.floor(seconds / 60).toString().padStart(2, '0'),
    s: (seconds % 60).toString().padStart(2, '0'),
  });

  return {
    timerInputTime, setTimerInputTime,
    timerTimeLeft,  setTimerTimeLeft,
    isTimerRunning,
    laps,
    isFullscreen,
    isSoundEnabled,
    toggleSound,
    toggleTimer,
    resetTimer,
    recordLap,
    handleEnterFullscreen,
    handleExitFullscreen,
    formatTimerDisplay,
  };
};