import { useState, useEffect, useRef, useCallback } from 'react';

export const useStopwatch = () => {
  const [swElapsed, setSwElapsed]     = useState(0); // ms
  const [isSwRunning, setIsSwRunning] = useState(false);
  const [wordCount, setWordCount]     = useState('');
  const [materialName, setMaterialName] = useState('');
  const [readingRecords, setReadingRecords] = useState([]);

  const startTimeRef   = useRef(null);
  const baseElapsedRef = useRef(0);

  const toggleStopwatch = useCallback(() => {
    setIsSwRunning(prev => {
      const next = !prev;
      if (next) startTimeRef.current = Date.now();
      else      baseElapsedRef.current += Date.now() - startTimeRef.current;
      return next;
    });
  }, []);

  const resetStopwatch = useCallback(() => {
    setIsSwRunning(false);
    setSwElapsed(0);
    baseElapsedRef.current = 0;
    startTimeRef.current = null;
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

  const recordReading = useCallback(() => {
    setReadingRecords(prev => [...prev, { wordCount: words, elapsedMs: swElapsed, wpm }]);
    resetStopwatch();
  }, [words, swElapsed, wpm, resetStopwatch]);

  const clearReadingRecords = useCallback(() => setReadingRecords([]), []);

  return {
    swElapsed,
    isSwRunning,
    wordCount, setWordCount,
    materialName, setMaterialName,
    toggleStopwatch,
    resetStopwatch,
    formatStopwatch,
    wpm,
    readingRecords,
    recordReading,
    clearReadingRecords,
  };
};
