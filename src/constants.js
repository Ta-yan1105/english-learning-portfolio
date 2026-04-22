import React from 'react';
import { BookOpen, Headphones, MessageCircle, PenTool, Book, Mic, GraduationCap } from 'lucide-react';

export const CATEGORIES = [
  { id: 'Reading',     label: '読む', label_en: 'Reading',    icon: <BookOpen size={16}/>,       color: '#38bdf8' },
  { id: 'Listening',   label: '聞く', label_en: 'Listening',  icon: <Headphones size={16}/>,     color: '#4ade80' },
  { id: 'Speaking',    label: '話す', label_en: 'Speaking',   icon: <MessageCircle size={16}/>,  color: '#fb7185' },
  { id: 'Writing',     label: '書く', label_en: 'Writing',    icon: <PenTool size={16}/>,        color: '#fbbf24' },
  { id: 'Vocabulary',  label: '単語', label_en: 'Vocab',      icon: <Book size={16}/>,           color: '#c084fc' },
  { id: 'ReadingAloud',label: '音読', label_en: 'Read Aloud', icon: <Mic size={16}/>,            color: '#22d3ee' },
  { id: 'Class',       label: '授業', label_en: 'Class',      icon: <GraduationCap size={16}/>,  color: '#f97316' },
];

export const PRAISE_MESSAGES = ["Great job!", "Keep it up!", "Awesome!", "Fantastic!", "Excellent!"];

export const getLocalDateString = (dateObj) => {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const formatMinutes = (m) => {
  const val = Number(m) || 0;
  return val >= 60 ? (val / 60).toFixed(1) : Math.round(val);
};

export const getUnit = (m) => Number(m) >= 60 ? 'h' : 'm';

export const calculateStreak = (allLogs) => {
  if (!allLogs || allLogs.length === 0) return 0;
  const uniqueDates = [...new Set(allLogs.map(l => l.date))].sort((a, b) => new Date(b) - new Date(a));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const lastDate = new Date(uniqueDates[0]); lastDate.setHours(0, 0, 0, 0);
  if ((today - lastDate) / (1000 * 60 * 60 * 24) > 1) return 0;
  let streak = 0;
  for (let i = 0; i < uniqueDates.length; i++) {
    const d = new Date(uniqueDates[i]); d.setHours(0, 0, 0, 0);
    const expected = new Date(lastDate); expected.setDate(lastDate.getDate() - i);
    if (d.getTime() === expected.getTime()) streak++; else break;
  }
  return streak;
};
