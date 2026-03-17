import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection, addDoc, onSnapshot, query, orderBy,
  where, updateDoc, deleteDoc, doc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { CATEGORIES, getLocalDateString, calculateStreak } from '../constants';

export const useLogs = (user) => {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (!user || user.isAnonymous) return;
    const q = query(
      collection(db, 'logs'),
      where('uid', '==', user.uid),
      orderBy('timestamp', 'desc')
    );
    const unsub = onSnapshot(q, (s) =>
      setLogs(s.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, [user]);

  /* ----- filter helper ----- */
  const getFilteredLogs = useCallback((date, selectedRange) => {
    return logs.filter(log => {
      if (!log.date) return false;
      const logDate    = new Date(log.date + 'T00:00:00');
      const targetDate = new Date(date    + 'T00:00:00');

      if (selectedRange === 'day')
        return logDate.getTime() === targetDate.getTime();

      if (selectedRange === 'week') {
        const day   = targetDate.getDay() || 7;
        const start = new Date(targetDate);
        if (day !== 1) start.setDate(targetDate.getDate() - day + 1);
        const end = new Date(start); end.setDate(start.getDate() + 6);
        return logDate >= start && logDate <= end;
      }
      if (selectedRange === 'month')
        return logDate.getMonth() === targetDate.getMonth() &&
               logDate.getFullYear() === targetDate.getFullYear();
      if (selectedRange === 'year')
        return logDate.getFullYear() === targetDate.getFullYear();
      return true;
    });
  }, [logs]);

  /* ----- time stats ----- */
  const getTimeStats = useCallback((date) => {
    let dayTotal = 0, weekTotal = 0, monthTotal = 0, yearTotal = 0, allTotal = 0;
    const targetDate  = new Date(date + 'T00:00:00');
    const targetYear  = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth();
    const targetDay   = targetDate.getTime();

    const day = targetDate.getDay() || 7;
    const weekStart = new Date(targetDate);
    if (day !== 1) weekStart.setDate(targetDate.getDate() - day + 1);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6); weekEnd.setHours(23, 59, 59, 999);

    logs.forEach(l => {
      if (!l.date) return;
      const m = Number(l.minutes) || 0;
      allTotal += m;
      const ld = new Date(l.date + 'T00:00:00');
      if (ld.getFullYear() === targetYear) {
        yearTotal += m;
        if (ld.getMonth() === targetMonth) monthTotal += m;
      }
      if (ld.getTime() === targetDay) dayTotal += m;
      if (ld >= weekStart && ld <= weekEnd) weekTotal += m;
    });

    return { dayTotal, weekTotal, monthTotal, yearTotal, allTotal };
  }, [logs]);

  const streak = useMemo(() => calculateStreak(logs), [logs]);

  /* ----- CRUD ----- */
  const saveLog = useCallback(async (uid, logData, editingLogId) => {
    if (editingLogId) {
      await updateDoc(doc(db, 'logs', editingLogId), logData);
    } else {
      await addDoc(collection(db, 'logs'), { ...logData, uid, timestamp: Date.now() });
    }
  }, []);

  const deleteLog = useCallback(async (logId) => {
    await deleteDoc(doc(db, 'logs', logId));
  }, []);

  /* ----- export ----- */
  const exportLogs = useCallback((filteredLogs, format) => {
    const header = 'Date,Skill,Reflection,Duration,Quality\n';
    const rows = filteredLogs.map(log => {
      const text    = log.reflection || log.content || '';
      const catsStr = (log.categories || [])
        .map(c => c === 'Speaking' && log.speakingType ? `${c}(${log.speakingType})` : c)
        .join('/');
      return `${log.date},${catsStr},"${text.replace(/"/g, '""')}",${log.minutes},${log.quality}%`;
    }).join('\n');
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), header, rows], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `learning_log_${format}.csv`;
    link.click();
  }, []);

  return { logs, getFilteredLogs, getTimeStats, streak, saveLog, deleteLog, exportLogs };
};