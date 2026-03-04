import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, getDoc, setDoc, where, updateDoc, deleteDoc } from 'firebase/firestore';
import { initializeAuth, browserLocalPersistence, inMemoryPersistence, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { BookOpen, Headphones, MessageCircle, PenTool, Download, List, Clipboard, Star, User, Sparkles, Activity, Clock, Zap, Send, Calendar, Trash2, Edit, Timer, Play, Pause, RefreshCw, Maximize, Minimize, Book, Mic, Volume2, VolumeX } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

import DailyQuote from './DailyQuote';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

const auth = initializeAuth(app, {
  persistence: [browserLocalPersistence, inMemoryPersistence]
});

const db = getFirestore(app);

const CATEGORIES = [
  { id: 'Reading', label: '読む', icon: <BookOpen size={16}/>, color: '#3b82f6' },
  { id: 'Listening', label: '聞く', icon: <Headphones size={16}/>, color: '#10b981' },
  { id: 'Speaking', label: '話す', icon: <MessageCircle size={16}/>, color: '#f43f5e' },
  { id: 'Writing', label: '書く', icon: <PenTool size={16}/>, color: '#f59e0b' },
  { id: 'Vocabulary', label: '単語', icon: <Book size={16}/>, color: '#8b5cf6' },
  { id: 'ReadingAloud', label: '音読', icon: <Mic size={16}/>, color: '#0ea5e9' },
];

const calculateStreak = (allLogs) => {
  if (!allLogs || allLogs.length === 0) return 0;
  const uniqueDates = [...new Set(allLogs.map(l => l.date))].sort((a, b) => new Date(b) - new Date(a));
  let streak = 0;
  const today = new Date(); today.setHours(0,0,0,0);
  const lastDate = new Date(uniqueDates[0]); lastDate.setHours(0,0,0,0);
  if ((today - lastDate) / (1000 * 60 * 60 * 24) > 1) return 0;
  for (let i = 0; i < uniqueDates.length; i++) {
    const d = new Date(uniqueDates[i]); d.setHours(0,0,0,0);
    const expected = new Date(lastDate); expected.setDate(lastDate.getDate() - i);
    if (d.getTime() === expected.getTime()) streak++; else break;
  }
  return streak;
};

const formatMinutes = m => m >= 60 ? (m/60).toFixed(1) : m;
const getUnit = m => m >= 60 ? 'h' : 'm';

const getLocalDateString = (dateObj) => {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const fetchNextEikenDate = async () => {
  const eikenSchedule = ['2026-06-07', '2026-10-04', '2027-01-24', '2027-06-06'];
  const todayStr = getLocalDateString(new Date());
  return eikenSchedule.find(date => date >= todayStr) || '';
};

const PRAISE_MESSAGES = ["Great job!", "Keep it up!", "Awesome!", "Fantastic!", "Excellent!"];

const getSliderColor = (val, max) => {
  const ratio = Number(val) / max;
  if (ratio < 0.25) return '#3b82f6'; 
  if (ratio < 0.60) return '#10b981'; 
  if (ratio < 0.85) return '#f59e0b'; 
  return '#ef4444'; 
};

export default function App() {
  const [user, setUser] = useState(null);
  const [logs, setLogs] = useState([]);
  const [profile, setProfile] = useState({ grade: '', classNum: '', studentNum: '', name: '', goal: '', toeicDate: '', eikenDate: '', otherDate: '', otherName: '', other2Date: '', other2Name: '' });
  const [selectedRange, setSelectedRange] = useState('day');
  
  const [minutes, setMinutes] = useState(25);
  const [selectedCats, setSelectedCats] = useState([]);
  const [speakingType, setSpeakingType] = useState(''); 
  const [content, setContent] = useState('');
  const [reflection, setReflection] = useState('');
  const [quality, setQuality] = useState(80);
  const [date, setDate] = useState(getLocalDateString(new Date()));
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);

  const [showPraise, setShowPraise] = useState(false);
  const [praiseText, setPraiseText] = useState("");
  const [praiseSubText, setPraiseSubText] = useState("保存完了！学習記録が追加されました");
  const [editingLogId, setEditingLogId] = useState(null);

  const [timerInputMinutes, setTimerInputMinutes] = useState(25);
  const [timerTimeLeft, setTimerTimeLeft] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [laps, setLaps] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [recordingField, setRecordingField] = useState(null);

  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const isSoundEnabledRef = useRef(true);

  const wakeLockRef = useRef(null);
  const originalTitleRef = useRef(typeof document !== 'undefined' ? document.title : 'English Learning Portfolio');
  
  const expectedEndTimeRef = useRef(null);
  const timerTimeLeftRef = useRef(timerTimeLeft);

  useEffect(() => {
    timerTimeLeftRef.current = timerTimeLeft;
  }, [timerTimeLeft]);

  const toggleSound = useCallback(() => {
    setIsSoundEnabled(prev => {
      const next = !prev;
      isSoundEnabledRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    if (isTimerRunning) {
      const m = Math.floor(timerTimeLeft / 60).toString().padStart(2, '0');
      const s = (timerTimeLeft % 60).toString().padStart(2, '0');
      document.title = `(${m}:${s}) ${originalTitleRef.current}`;
    } else {
      document.title = originalTitleRef.current;
    }
  }, [isTimerRunning, timerTimeLeft]);

  useEffect(() => {
    const manageWakeLock = async () => {
      if (isTimerRunning) {
        if ('wakeLock' in navigator) {
          try {
            wakeLockRef.current = await navigator.wakeLock.request('screen');
          } catch (err) {
            console.error('WakeLock Error:', err);
          }
        }
      } else {
        if (wakeLockRef.current !== null) {
          try {
            await wakeLockRef.current.release();
            wakeLockRef.current = null;
          } catch (err) {
            console.error('WakeLock Release Error:', err);
          }
        }
      }
    };
    manageWakeLock();
    
    return () => {
      if (wakeLockRef.current !== null) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [isTimerRunning]);

  const playAlarmSound = () => {
    if (!isSoundEnabledRef.current) return; 
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    try {
      const ctx = new AudioContext();
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, ctx.currentTime);
      gain1.gain.setValueAtTime(0, ctx.currentTime);
      gain1.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
      gain1.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.15);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.1);
      gain2.gain.setValueAtTime(0, ctx.currentTime + 0.1);
      gain2.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc2.start(ctx.currentTime + 0.1);
      osc2.stop(ctx.currentTime + 0.6);
    } catch (e) {
      console.error("Audio play error", e);
    }
  };

  const toggleTimer = useCallback(() => {
    setIsTimerRunning(prev => {
      if (!prev) {
        expectedEndTimeRef.current = Date.now() + timerTimeLeftRef.current * 1000;
      }
      return !prev;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const tagName = document.activeElement?.tagName?.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return;

      if (e.code === 'Space') {
        e.preventDefault(); 
        toggleTimer();
      }
      if (e.code === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleTimer, isFullscreen]);

  useEffect(() => {
    let interval = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        const remaining = Math.round((expectedEndTimeRef.current - Date.now()) / 1000);
        
        if (remaining <= 0) {
          setTimerTimeLeft(0);
          setIsTimerRunning(false);
          setMinutes(timerInputMinutes); 
          setPraiseSubText("タイマー完了！学習時間を反映しました");
          setPraiseText(PRAISE_MESSAGES[Math.floor(Math.random() * PRAISE_MESSAGES.length)]);
          setShowPraise(true);
          playAlarmSound();
          setTimeout(() => {
            setShowPraise(false);
          }, 2500);
          clearInterval(interval);
        } else {
          setTimerTimeLeft(remaining); 
        }
      }, 250); 
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerInputMinutes]);

  const formatTimerDisplay = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleTimerAdjust = (amount) => {
    if (isTimerRunning) return;
    const newMins = Math.max(1, timerInputMinutes + amount);
    setTimerInputMinutes(newMins);
    setTimerTimeLeft(newMins * 60);
    setLaps([]);
  };

  const resetTimer = () => {
    setIsTimerRunning(false);
    setTimerTimeLeft(timerInputMinutes * 60);
    setLaps([]);
  };

  const recordLap = () => {
    const elapsedSeconds = (timerInputMinutes * 60) - timerTimeLeft;
    setLaps(prev => [
      ...prev, 
      {
        elapsed: formatTimerDisplay(elapsedSeconds),
        remaining: formatTimerDisplay(timerTimeLeft)
      }
    ]);
  };

  const handleCopyRecent = () => {
    if (logs && logs.length > 0) {
      const lastLog = logs[0]; 
      setMinutes(lastLog.minutes || 25);
      setSelectedCats(lastLog.categories || []);
      setSpeakingType(lastLog.speakingType || '');
      setContent(lastLog.content || '');
      setReflection(lastLog.reflection || '');
      setQuality(lastLog.quality || 80);
    }
  };

  const handleVoiceInput = (setter, fieldName) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('お使いのブラウザは音声入力に対応していません。(Chrome、Safari、Edgeなどの最新版をご利用ください)');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ja-JP';
      recognition.interimResults = false;
      recognition.continuous = false; 

      recognition.onstart = () => {
        setRecordingField(fieldName);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setter(prev => prev ? prev + ' ' + transcript : transcript);
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        if (event.error === 'not-allowed') {
          alert('マイクの使用が許可されていません。お使いの端末・ブラウザの設定からマイクへのアクセスを許可してください。');
        }
        setRecordingField(null);
      };

      recognition.onend = () => {
        setRecordingField(null);
      };

      recognition.start();
    } catch (error) {
      console.error("Speech recognition start error", error);
      setRecordingField(null);
    }
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    onAuthStateChanged(auth, async (u) => { if (!u) await signInAnonymously(auth); else setUser(u); });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'logs'), where('uid', '==', user.uid), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, 
      (s) => setLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))),
      (error) => console.error("ログ取得エラー:", error)
    );
    
    getDoc(doc(db, 'profile', user.uid)).then(async d => {
      let currentProfile = d.exists() ? d.data() : {};
      const todayStr = getLocalDateString(new Date());
      
      if (!currentProfile.eikenDate || currentProfile.eikenDate < todayStr) {
        const nextDate = await fetchNextEikenDate();
        if (nextDate) {
          currentProfile.eikenDate = nextDate;
          try {
            await setDoc(doc(db, 'profile', user.uid), currentProfile, { merge: true });
          } catch (e) {
            console.error("プロファイル保存エラー", e);
          }
        }
      }
      setProfile(p => ({...p, ...currentProfile}));
    }).catch(e => console.error("プロファイル取得エラー", e));

    return () => unsubscribe();
  }, [user]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (!log.date) return false;
      const logDate = new Date(log.date + "T00:00:00");
      const targetDate = new Date(date + "T00:00:00");
      if (selectedRange === 'day') return logDate.getTime() === targetDate.getTime();
      if (selectedRange === 'week') {
        const d = new Date(date + "T00:00:00");
        const day = d.getDay() || 7;
        const start = new Date(d); if (day !== 1) start.setDate(d.getDate() - day + 1);
        const end = new Date(start); end.setDate(start.getDate() + 6);
        return logDate >= start && logDate <= end;
      }
      if (selectedRange === 'month') return logDate.getMonth() === targetDate.getMonth() && logDate.getFullYear() === targetDate.getFullYear();
      if (selectedRange === 'year') return logDate.getFullYear() === targetDate.getFullYear();
      return true;
    });
  }, [logs, date, selectedRange]);

  const stats = useMemo(() => {
    const total = filteredLogs.reduce((acc, curr) => acc + (Number(curr.minutes) || 0), 0);
    const skillMap = {};
    filteredLogs.forEach(l => (l.categories || []).forEach(cat => skillMap[cat] = (skillMap[cat] || 0) + (Number(l.minutes) || 0)));
    return { total, skillMap, streak: calculateStreak(logs) };
  }, [filteredLogs, logs]);

  const dashboardChartData = useMemo(() => {
    if (selectedRange === 'day') {
      return CATEGORIES.map(cat => ({ name: cat.label, value: stats.skillMap[cat.id] || 0, color: cat.color })).filter(d => d.value > 0);
    }
    if (selectedRange === 'week') {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const d_base = new Date(date + "T00:00:00");
      const day_idx = d_base.getDay() || 7;
      const start = new Date(d_base); if (day_idx !== 1) start.setDate(d_base.getDate() - day_idx + 1);
      return days.map((label, i) => {
        const d = new Date(start); d.setDate(start.getDate() + i);
        const dateStr = getLocalDateString(d);
        const dayLogs = logs.filter(l => l.date === dateStr);
        const dayTotal = dayLogs.reduce((acc, curr) => acc + (Number(curr.minutes) || 0), 0);
        
        const breakdown = {};
        CATEGORIES.forEach(cat => breakdown[cat.id] = 0);
        dayLogs.forEach(l => {
          const cats = l.categories || [];
          if (cats.length > 0) {
            const splitVal = Number(l.minutes) / cats.length;
            cats.forEach(c => breakdown[c] = (breakdown[c] || 0) + splitVal);
          }
        });
        
        return { name: label, value: dayTotal, fullDate: dateStr, ...breakdown };
      });
    }
    if (selectedRange === 'month') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const targetYear = new Date(date + "T00:00:00").getFullYear();
      return months.map((label, i) => {
        const monthLogs = logs.filter(l => { const d = new Date(l.date + "T00:00:00"); return d.getFullYear() === targetYear && d.getMonth() === i; });
        const monthTotal = monthLogs.reduce((acc, curr) => acc + (Number(curr.minutes) || 0), 0);
        
        const breakdown = {};
        CATEGORIES.forEach(cat => breakdown[cat.id] = 0);
        monthLogs.forEach(l => {
          const cats = l.categories || [];
          if (cats.length > 0) {
            const splitVal = Number(l.minutes) / cats.length;
            cats.forEach(c => breakdown[c] = (breakdown[c] || 0) + splitVal);
          }
        });
        
        return { name: label, value: monthTotal, ...breakdown };
      });
    }
    if (selectedRange === 'year') {
      const years = [2026, 2027, 2028, 2029, 2030, 2031];
      return years.map(y => {
        const yearLogs = logs.filter(l => new Date(l.date + "T00:00:00").getFullYear() === y);
        const yearTotal = yearLogs.reduce((acc, curr) => acc + (Number(curr.minutes) || 0), 0);
        
        const breakdown = {};
        CATEGORIES.forEach(cat => breakdown[cat.id] = 0);
        yearLogs.forEach(l => {
          const cats = l.categories || [];
          if (cats.length > 0) {
            const splitVal = Number(l.minutes) / cats.length;
            cats.forEach(c => breakdown[c] = (breakdown[c] || 0) + splitVal);
          }
        });
        
        return { name: y.toString(), value: yearTotal, ...breakdown };
      });
    }
    return [];
  }, [selectedRange, logs, stats.skillMap, date]);

  const handleProfileUpdate = async (field, value) => {
    const newProfile = { ...profile, [field]: value };
    setProfile(newProfile);
    if (user) {
      try {
        await setDoc(doc(db, 'profile', user.uid), newProfile);
      } catch (error) {
        console.error("プロファイル更新エラー:", error);
      }
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!auth.currentUser || !minutes || selectedCats.length === 0) return;
    
    const logData = { 
      date, 
      minutes: Number(minutes), 
      categories: selectedCats, 
      content, 
      reflection, 
      quality: Number(quality)
    };
    
    if (selectedCats.includes('Speaking') && speakingType) {
      logData.speakingType = speakingType;
    } else {
      logData.speakingType = null;
    }

    try {
      if (editingLogId) {
        await updateDoc(doc(db, 'logs', editingLogId), logData);
        setEditingLogId(null);
      } else {
        logData.uid = auth.currentUser.uid;
        logData.timestamp = Date.now();
        await addDoc(collection(db, 'logs'), logData);
      }
      
      setMinutes(25); setSelectedCats([]); setSpeakingType(''); setContent(''); setReflection(''); setQuality(80); 
      
      setPraiseSubText("保存完了！学習記録が追加されました");
      setPraiseText(PRAISE_MESSAGES[Math.floor(Math.random() * PRAISE_MESSAGES.length)]);
      setShowPraise(true);
      setTimeout(() => {
        setShowPraise(false);
      }, 2500);
    } catch (error) {
      console.error("保存エラー:", error);
      alert("学習記録の保存に失敗しました。通信環境を確認してください。");
    }
  };

  const handleEdit = (log) => {
    setEditingLogId(log.id);
    setDate(log.date);
    setMinutes(log.minutes);
    setSelectedCats(log.categories || []);
    setSpeakingType(log.speakingType || '');
    setContent(log.content || '');
    setReflection(log.reflection || '');
    setQuality(log.quality || 80);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (logId) => {
    if (window.confirm('この学習記録を削除してもよろしいですか？')) {
      try {
        await deleteDoc(doc(db, 'logs', logId));
        if (editingLogId === logId) {
          setEditingLogId(null);
          setMinutes(25); setSelectedCats([]); setSpeakingType(''); setContent(''); setReflection(''); setQuality(80);
        }
      } catch (error) {
        console.error("削除エラー:", error);
        alert("削除に失敗しました。");
      }
    }
  };

  const handleExport = (format) => {
    const header = "Date,Skill,Content,Reflection,Duration,Quality\n";
    const csvContent = filteredLogs.map(log => {
      const catsStr = (log.categories || []).map(c => c === 'Speaking' && log.speakingType ? `${c}(${log.speakingType})` : c).join("/");
      return `${log.date},${catsStr},"${(log.content || "").replace(/"/g, '""')}","${(log.reflection || "").replace(/"/g, '""')}",${log.minutes},${log.quality}%`;
    }).join("\n");
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), header, csvContent], { type: "text/csv" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `learning_log_${format}.csv`; link.click();
  };

  const cardStyle = { background: 'white', borderRadius: '24px', padding: '25px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' };
  const inputStyle = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #f1f5f9', background: '#f8fafc', fontWeight: 'bold', boxSizing: 'border-box', outline: 'none' };
  const labelStyle = { fontSize: '11px', fontWeight: '900', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' };
  const tabStyle = (r) => ({ padding: '8px 16px', borderRadius: '10px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', border: 'none', backgroundColor: selectedRange === r ? '#4f46e5' : '#f1f5f9', color: selectedRange === r ? 'white' : '#94a3b8' });

  const topSkillId = Object.entries(stats.skillMap).sort((a,b)=>b[1]-a[1])[0]?.[0] || '';
  const topSkillLabel = CATEGORIES.find(c => c.id === topSkillId)?.label || 'なし';

  const aiFeedbackMessage = useMemo(() => {
    if (!logs || logs.length === 0) return '学習データを蓄積すると分析が表示されます。';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - 7);

    const recentLogs = logs.filter(l => new Date(l.date + "T00:00:00") >= thisWeekStart);

    if (recentLogs.length === 0) {
      return '最近の学習記録がありません。まずは1日15分から再開してみましょう🚀';
    }

    const recentTotalMinutes = recentLogs.reduce((sum, l) => sum + Number(l.minutes), 0);
    const recentAvgQuality = Math.round(recentLogs.reduce((sum, l) => sum + Number(l.quality), 0) / recentLogs.length);

    if (recentTotalMinutes >= 120 && recentAvgQuality >= 80) {
      return `直近7日間で${formatMinutes(recentTotalMinutes)}${getUnit(recentTotalMinutes)}学習し、集中度も${recentAvgQuality}%と非常に高く維持できています！最高の状態です🔥`;
    } else if (recentTotalMinutes < 120 && recentAvgQuality >= 80) {
      return `時間は短めですが、平均集中度${recentAvgQuality}%と質の高い学習ができています！この集中力を継続しましょう✨`;
    } else if (recentTotalMinutes >= 120 && recentAvgQuality < 80) {
      return `学習時間は${formatMinutes(recentTotalMinutes)}${getUnit(recentTotalMinutes)}と確保できていますが、集中度が${recentAvgQuality}%と少し疲れ気味かも？適度に休憩を挟みましょう☕`;
    } else {
      return `現在の平均集中度は${recentAvgQuality}%です。まずは短い時間で集中して取り組むサイクル（ポモドーロ等）を作りましょう📈`;
    }
  }, [logs]);

  const headerStyle = { fontSize: '16px', fontWeight: '900', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' };
  const unitSmallStyle = { fontSize: '14px', fontWeight: '900' };

  const todayDate = new Date();
  const todayStringJP = `${todayDate.getFullYear()}/${todayDate.getMonth() + 1}/${todayDate.getDate()}`;

  const isDayEmpty = selectedRange === 'day' && stats.total === 0;
  const pieData = isDayEmpty ? [{ name: 'Empty', value: 1, color: '#f1f5f9' }] : dashboardChartData;

  return (
    <div style={{ maxWidth: '950px', margin: '0 auto', padding: '30px 20px', backgroundColor: '#f4f7fa', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      <style>{`
        @keyframes popIn {
          0% { transform: scale(0.8); opacity: 0; }
          40% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes confettiFall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>

      {/* 統合・簡略化されたヘッダーセクション（日付・氏名・目標・試験） */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        
        <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#64748b', whiteSpace: 'nowrap' }}>{todayStringJP}</span>
        
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* 変更箇所：氏名のラベルを削除 */}
          <input style={{ ...inputStyle, width: '120px', padding: '8px 10px', fontSize: '12px', textAlign: 'center' }} value={profile.name || ''} onChange={e => handleProfileUpdate('name', e.target.value)} placeholder="氏名" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 200px' }}>
          {/* 変更箇所：目標の文字色を赤（#ef4444）に変更 */}
          <span style={{ fontSize: '12px', fontWeight: '900', color: '#ef4444', whiteSpace: 'nowrap' }}>目標</span>
          <input style={{ ...inputStyle, padding: '8px 10px', fontSize: '12px', width: '100%' }} value={profile.goal || ''} onChange={e => handleProfileUpdate('goal', e.target.value)} placeholder="達成したい目標を入力" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <input style={{ ...inputStyle, width: '90px', padding: '8px 6px', fontSize: '12px' }} value={profile.otherName || ''} onChange={e => handleProfileUpdate('otherName', e.target.value)} placeholder="試験名" />
          <input type="date" style={{ ...inputStyle, width: '115px', padding: '8px 4px', fontSize: '12px' }} value={profile.otherDate || ''} onChange={e => handleProfileUpdate('otherDate', e.target.value)} />
          {profile.otherDate && (
            <span style={{ display: 'flex', alignItems: 'baseline', color: '#4f46e5', fontWeight: '900', whiteSpace: 'nowrap', marginLeft: '4px' }}>
              <span style={{ fontSize: '11px', marginRight: '2px' }}>あと</span>
              <span style={{ fontSize: '20px', lineHeight: 1 }}>{Math.ceil((new Date(profile.otherDate) - new Date().setHours(0,0,0,0)) / 86400000)}</span>
              <span style={{ fontSize: '11px', marginLeft: '2px' }}>日</span>
            </span>
          )}
        </div>

      </div>

      <DailyQuote />

      <section style={{ ...cardStyle, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '15px', position: 'relative' }}>
          <button onClick={toggleSound} style={{ position: 'absolute', left: 0, background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: isSoundEnabled ? '#4f46e5' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={isSoundEnabled ? "アラーム音：オン" : "アラーム音：オフ"}>
            {isSoundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <Timer size={24} color="#4f46e5" style={{ marginRight: '8px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b', margin: 0 }}>学習タイマー</h2>
          <button onClick={() => setIsFullscreen(true)} style={{ position: 'absolute', right: 0, background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="全画面表示">
            <Maximize size={20} />
          </button>
        </div>

        <div style={{
          fontSize: isMobile ? '80px' : '120px',
          fontWeight: '900',
          color: timerTimeLeft === 0 ? '#10b981' : '#4f46e5',
          lineHeight: '1',
          margin: '20px 0',
          fontVariantNumeric: 'tabular-nums',
          fontFamily: "'Helvetica Neue', Arial, sans-serif",
          letterSpacing: '-0.02em',
          wordBreak: 'keep-all',
          whiteSpace: 'nowrap'
        }}>
          {formatTimerDisplay(timerTimeLeft)}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '25px', flexWrap: 'wrap' }}>
          <button onClick={() => handleTimerAdjust(-1)} disabled={isTimerRunning} style={{ padding: '8px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', background: 'white', color: '#64748b', fontWeight: 'bold', cursor: isTimerRunning ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
            - 1分
          </button>
          <button onClick={() => handleTimerAdjust(1)} disabled={isTimerRunning} style={{ padding: '8px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', background: 'white', color: '#64748b', fontWeight: 'bold', cursor: isTimerRunning ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
            + 1分
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <button onClick={toggleTimer} style={{ padding: '15px 40px', borderRadius: '50px', border: 'none', background: isTimerRunning ? '#f59e0b' : '#4f46e5', color: 'white', fontWeight: '900', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
            {isTimerRunning ? <><Pause size={20} /> 一時停止</> : <><Play size={20} /> スタート</>}
          </button>
          <button onClick={resetTimer} style={{ padding: '15px 25px', borderRadius: '50px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: '900', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={18} /> リセット
          </button>
          {!isTimerRunning && timerTimeLeft !== timerInputMinutes * 60 && (
            <button onClick={recordLap} style={{ padding: '15px 25px', borderRadius: '50px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: '900', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <List size={18} /> ラップ記録
            </button>
          )}
        </div>

        {laps.length > 0 && (
          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', maxWidth: '300px', backgroundColor: '#f8fafc', borderRadius: '12px', padding: '15px', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '12px', fontWeight: '900', color: '#94a3b8', marginBottom: '10px', textAlign: 'left' }}>ラップ記録</div>
              {laps.map((lap, index) => (
                <div key={index} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', color: '#1e293b', padding: '6px 0', borderBottom: index !== laps.length - 1 ? '1px dashed #e2e8f0' : 'none' }}>
                  <span>ラップ {index + 1}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: "'Helvetica Neue', Arial, sans-serif", fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ color: '#4f46e5' }}>{lap.elapsed}</span>
                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>(残り {lap.remaining})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section style={{ ...cardStyle, border: '2px solid #4f46e5' }}>
        <div style={{ 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row', 
          alignItems: isMobile ? 'flex-start' : 'center', 
          justifyContent: 'space-between', 
          marginBottom: '20px', 
          gap: '15px' 
        }}>
          <h2 style={{ ...headerStyle, flexShrink: 0, margin: 0 }}><Clipboard size={18} color="#4f46e5" /> 学習内容を内省する</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, width: isMobile ? '100%' : 'auto', alignItems: isMobile ? 'flex-start' : 'center' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: isMobile ? 'flex-start' : 'center' }}>
              {CATEGORIES.map((cat, index) => (
                <React.Fragment key={cat.id}>
                  <button type="button" onClick={() => {
                    if (selectedCats.includes(cat.id)) {
                      setSelectedCats(prev => prev.filter(c => c !== cat.id));
                    } else {
                      if (cat.id === 'Speaking' && !speakingType) setSpeakingType('やり取り');
                      setSelectedCats(prev => [...prev, cat.id]);
                    }
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '10px', border: 'none', backgroundColor: selectedCats.includes(cat.id) ? cat.color : '#f1f5f9', color: selectedCats.includes(cat.id) ? 'white' : '#64748b', fontSize: '12px', fontWeight: '900', cursor: 'pointer', transition: 'all 0.2s' }}>
                    {cat.icon} {cat.label}
                  </button>
                  {index === 3 && (
                    <div style={{ height: '24px', borderRight: '2px dashed #cbd5e1', margin: '0 2px', alignSelf: 'center' }}></div>
                  )}
                </React.Fragment>
              ))}
            </div>
            
            {selectedCats.includes('Speaking') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '4px', animation: 'popIn 0.3s ease-out' }}>
                <span style={{ fontSize: '11px', fontWeight: '900', color: '#f43f5e' }}>↳ 話す内容:</span>
                {['発表', 'やり取り'].map(type => (
                  <button key={type} type="button" onClick={() => setSpeakingType(type)}
                    style={{ padding: '4px 12px', borderRadius: '8px', border: speakingType === type ? 'none' : '1px solid #fda4af', backgroundColor: speakingType === type ? '#f43f5e' : '#fff1f2', color: speakingType === type ? 'white' : '#f43f5e', fontSize: '11px', fontWeight: '900', cursor: 'pointer', transition: 'all 0.2s' }}>
                    {type}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignSelf: isMobile ? 'flex-end' : 'auto', flexShrink: 0 }}>
            {!editingLogId && logs.length > 0 && (
              <button type="button" onClick={handleCopyRecent} style={{ padding: '8px 16px', background: '#e0e7ff', color: '#4f46e5', borderRadius: '10px', fontWeight: '900', border: 'none', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RefreshCw size={14} /> 前回をコピー
              </button>
            )}
            {editingLogId && (
              <button type="button" onClick={() => {
                setEditingLogId(null);
                setMinutes(25); setSelectedCats([]); setSpeakingType(''); setContent(''); setReflection(''); setQuality(80); setDate(getLocalDateString(new Date()));
              }} style={{ padding: '8px 16px', background: '#f1f5f9', color: '#64748b', borderRadius: '10px', fontWeight: '900', border: 'none', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center' }}>
                キャンセル
              </button>
            )}
            <button onClick={handleSave} style={{ padding: '8px 16px', background: '#4f46e5', color: 'white', borderRadius: '10px', fontWeight: '900', border: 'none', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Send size={14} /> {editingLogId ? '更新' : '登録'}
            </button>
          </div>
        </div>

        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            
            <div>
              <label style={{ ...labelStyle, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                  <Clock size={12} color="#94a3b8" /> 学習時間
                </span>
                <span style={{ fontWeight: 'bold', color: '#cbd5e1', marginLeft: '4px' }}>
                  ※ポモドーロ（25分学習＋5分休憩）を活用すると効果的です
                </span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ fontSize: '42px', fontWeight: '900', color: '#4f46e5', whiteSpace: 'nowrap', minWidth: '95px', lineHeight: 1 }}>
                  {minutes}<span style={{...unitSmallStyle, color: '#4f46e5'}}>分</span>
                </div>
                <input type="range" min="1" max="120" style={{ width: '100%', accentColor: getSliderColor(minutes, 120), cursor: 'pointer' }} value={minutes} onChange={e => setMinutes(e.target.value)} />
              </div>
            </div>

            <div>
              <label style={{ ...labelStyle, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                  <Zap size={12} color="#94a3b8" /> 集中度
                </span>
                <span style={{ fontWeight: 'bold', color: '#cbd5e1', marginLeft: '4px' }}>
                  ※集中できたかをメタ認知することが学習の質を高めます
                </span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ fontSize: '42px', fontWeight: '900', color: '#4f46e5', whiteSpace: 'nowrap', minWidth: '95px', lineHeight: 1 }}>
                  {quality}<span style={{...unitSmallStyle, color: '#4f46e5'}}>%</span>
                </div>
                <input type="range" min="0" max="100" style={{ width: '100%', accentColor: getSliderColor(quality, 100), cursor: 'pointer' }} value={quality} onChange={e => setQuality(e.target.value)} />
              </div>
            </div>

          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '4fr 6fr', gap: '15px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <label style={{ ...labelStyle, flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                    学習内容
                  </span>
                  <span style={{ fontWeight: 'bold', color: '#cbd5e1', marginLeft: '4px' }}>
                    ※具体的に書くことで振り返りの質が高まります
                  </span>
                </label>
                <button type="button" onClick={() => handleVoiceInput(setContent, 'content')} style={{ background: recordingField === 'content' ? '#f43f5e' : '#f1f5f9', color: recordingField === 'content' ? 'white' : '#64748b', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginLeft: '8px', transition: 'all 0.2s' }} title="音声で入力">
                  <Mic size={12} />
                </button>
              </div>
              <textarea style={{ ...inputStyle, height: '100px' }} value={content} onChange={e => setContent(e.target.value)} placeholder="例：&#10;・英検長文問題演習" />
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {["教科書", "単語学習", "英検参考書", "TOEIC", "音読"].map(tag => (
                  <button key={tag} type="button" onClick={() => setContent(prev => prev ? prev + ' / ' + tag : tag)} style={{ padding: '4px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}>
                    + {tag}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <label style={{ ...labelStyle, flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                    内省
                  </span>
                  <span style={{ fontWeight: 'bold', color: '#cbd5e1', marginLeft: '4px' }}>
                    ※自分の課題や成長に気づく重要なステップです
                  </span>
                </label>
                <button type="button" onClick={() => handleVoiceInput(setReflection, 'reflection')} style={{ background: recordingField === 'reflection' ? '#f43f5e' : '#f1f5f9', color: recordingField === 'reflection' ? 'white' : '#64748b', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginLeft: '8px', transition: 'all 0.2s' }} title="音声で入力">
                  <Mic size={12} />
                </button>
              </div>
              <textarea style={{ ...inputStyle, height: '100px' }} value={reflection} onChange={e => setReflection(e.target.value)} placeholder="例：&#10;・語彙不足を実感" />
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {["単語が難しかった", "眠かった", "新しい表現を覚えた", "楽しくできた"].map(tag => (
                  <button key={tag} type="button" onClick={() => setReflection(prev => prev ? prev + ' / ' + tag : tag)} style={{ padding: '4px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}>
                    + {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </form>
      </section>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '15px', justifyContent: 'center' }}>
        {['day', 'week', 'month', 'year'].map(r => (<button key={r} onClick={() => setSelectedRange(r)} style={tabStyle(r)}>{r.toUpperCase()}</button>))}
      </div>

      <section style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
          <h2 style={{ ...headerStyle, margin: 0 }}><Zap size={18} color="#4f46e5" /> 学習状況</h2>
          <div style={{ fontSize: '14px', fontWeight: '900', color: '#1e293b' }}>
            学習時間合計: {formatMinutes(stats.total)}<span style={{ fontSize: '12px', marginLeft: '2px' }}>{getUnit(stats.total)}</span>
          </div>
        </div>

        <div style={{ marginBottom: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '20px' }}>🏔️</span>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span>立山登頂チャレンジ <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>(標高3,015m)</span></span>
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#94a3b8' }}>1時間の学習で1歩（1m）進む！</span>
                {Math.floor(stats.total / 60) >= 3015 && <span style={{ color: '#ef4444' }}>🎉 登頂達成！</span>}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '48px', fontWeight: '900', color: '#10b981', lineHeight: 1 }}>{Math.floor(stats.total / 60)}</span>
              <span style={{ fontSize: '12px', fontWeight: '900', color: '#94a3b8' }}> / 3,015歩</span>
            </div>
          </div>
          
          <div style={{ position: 'relative', width: '100%', height: '50px', marginTop: '10px' }}>
            <div style={{ position: 'absolute', right: '-4px', top: '-15px', fontSize: '20px', zIndex: 1, opacity: 0.8 }}>🗻</div>
            
            <div style={{ 
              position: 'absolute', 
              left: `calc(${Math.min((stats.total / 60 / 3015) * 100, 100)}% - 10px)`, 
              bottom: `calc(${Math.min((stats.total / 60 / 3015) * 100, 100)}% - 4px)`, 
              fontSize: '18px', 
              transition: 'all 1s ease-out', 
              zIndex: 3,
              filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.3))'
            }}>
              {Math.floor(stats.total / 60) >= 3015 ? '🚩' : '🧗'}
            </div>

            <div style={{ width: '100%', height: '100%', backgroundColor: '#f1f5f9', clipPath: 'polygon(0 100%, 100% 0, 100% 100%)', borderRadius: '4px' }}>
              <div style={{ width: `${Math.min((stats.total / 60 / 3015) * 100, 100)}%`, height: '100%', backgroundColor: '#10b981', transition: 'width 1s ease-out' }}></div>
            </div>
          </div>
        </div>

        <div style={{ paddingTop: '20px', borderTop: '1px dashed #e2e8f0', width: '100%' }}>
          <h2 style={labelStyle}><Sparkles size={12} color="#94a3b8" />AIフィードバック</h2>
          <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6, fontWeight: 'bold', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
            {aiFeedbackMessage}
          </div>
        </div>
      </section>

      <section style={cardStyle} key={selectedRange}>
        <h2 style={{ ...headerStyle, marginBottom: '20px' }}><Activity size={18} color="#4f46e5" /> 学習傾向の分析</h2>
        
        <div style={{ height: selectedRange === 'day' && isMobile ? 'auto' : '280px', minHeight: '280px', width: '100%' }}>
          {selectedRange === 'day' ? (
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', width: '100%', height: '100%', alignItems: 'center' }}>
              
              <div style={{ flex: 1, minWidth: 0, width: '100%', height: isMobile ? '280px' : '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={isDayEmpty ? 0 : 5} dataKey="value" stroke="none">
                      {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    {!isDayEmpty && <Tooltip formatter={(value) => `${formatMinutes(value)}${getUnit(value)}`} />}
                    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 24, fontWeight: 900, fill: '#1e293b' }}>
                      {formatMinutes(stats.total)}<tspan dx="2" style={{ fontSize: '14px', fontWeight: '900' }}>{getUnit(stats.total)}</tspan>
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div style={{ 
                flex: 1, 
                minWidth: 0, 
                alignSelf: 'stretch',
                overflowY: 'auto',
                width: '100%', 
                padding: isMobile ? '10px 0 0 0' : '0 5px 0 20px', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'flex-start', 
                gap: '8px' 
              }}>
                <div style={{ fontSize: '12px', fontWeight: '900', color: '#1e293b', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={14} color="#4f46e5" /> スキル別 AIアドバイス
                </div>
                {CATEGORIES.map(cat => {
                  const t = stats.skillMap[cat.id] || 0;
                  let msg = '本日は未実施です。少しでも触れてみましょう！';

                  if (t > 0) {
                    if (cat.id === 'Reading') msg = '【読解のコツ】時間を計って読む「速読」と、文構造を意識する「精読」をバランス良く取り入れましょう📖';
                    else if (cat.id === 'Listening') msg = '【聴解のコツ】聞き流しだけでなく、聞こえた音を書き取るディクテーションやシャドーイングが効果的です🎧';
                    else if (cat.id === 'Speaking') msg = '【発話のコツ】学んだ表現を使って独り言を言ったり、実際の会話で積極的にアウトプットしましょう🗣️';
                    else if (cat.id === 'Writing') msg = '【記述のコツ】まずは短い英語日記から。知っている単語を駆使して、毎日書く習慣をつけるのが鍵です✍️';
                    else if (cat.id === 'Vocabulary') msg = '【単語のコツ】反復学習が定着の鍵です。スキマ時間を活用して何度も復習しましょう📝';
                    else if (cat.id === 'ReadingAloud') msg = '【音読のコツ】英語の語順のまま理解する力を養えます。声に出してリズムと発音を意識しましょう🗣️';
                  }
                  
                  return (
                    <div key={cat.id} style={{ backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: '12px', borderLeft: `4px solid ${cat.color}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '900', color: cat.color }}>{cat.label}</div>
                        <div style={{ fontSize: '11px', fontWeight: '900', color: '#1e293b' }}>
                          {formatMinutes(t)}<span style={{ fontSize: '9px', marginLeft: '1px' }}>{getUnit(t)}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', lineHeight: 1.3, wordBreak: 'break-word' }}>
                        {msg}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={dashboardChartData} 
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                onClick={(e) => {
                  if (e && e.activePayload && e.activePayload.length > 0) {
                    const payloadDate = e.activePayload[0].payload.fullDate;
                    if (payloadDate) {
                      setDate(payloadDate);
                      setSelectedRange('day');
                    }
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} />
                
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }} 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const total = payload[0].payload.value;
                      return (
                        <div style={{ backgroundColor: 'white', padding: '10px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '11px', fontWeight: 'bold' }}>
                          <div style={{ color: '#94a3b8', marginBottom: '6px' }}>{label}</div>
                          {payload.map(entry => {
                            const cat = CATEGORIES.find(c => c.id === entry.dataKey);
                            if (!cat || entry.value === 0) return null;
                            return (
                              <div key={entry.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', color: cat.color, marginBottom: '4px' }}>
                                <span>{cat.label}</span>
                                <span>{formatMinutes(entry.value)}{getUnit(entry.value)}</span>
                              </div>
                            );
                          })}
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', color: '#1e293b', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                            <span>合計</span>
                            <span>{formatMinutes(total)}{getUnit(total)}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {CATEGORIES.map((cat, index) => (
                  <Bar 
                    key={cat.id} 
                    dataKey={cat.id} 
                    stackId="a" 
                    fill={cat.color} 
                    radius={index === CATEGORIES.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]} 
                    barSize={isMobile ? 20 : 30} 
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <h2 style={headerStyle}><List size={18} color="#4f46e5" /> 学習ログ一覧</h2>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['excel', 'gsheet', 'csv'].map(f => (
              <button key={f} onClick={() => handleExport(f)} style={{ padding: '6px 10px', background: f==='excel'?'#1d6f42':f==='gsheet'?'#34a853':'#10b981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold' }}>{f.toUpperCase()}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {logs.map((log) => (
            <div key={log.id} style={{ 
              padding: '16px', 
              backgroundColor: '#f8fafc', 
              borderRadius: '16px', 
              border: '1px solid #f1f5f9' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '900' }}>{log.date}</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleEdit(log)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', color: '#64748b' }}>
                    <Edit size={14} />
                  </button>
                  <button onClick={() => handleDelete(log.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', color: '#ef4444' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div style={{ backgroundColor: '#e0e7ff', color: '#4f46e5', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '900', whiteSpace: 'nowrap' }}>
                  {(log.categories || []).map(c => c === 'Speaking' && log.speakingType ? `${c}(${log.speakingType})` : c).join("/")}
                </div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', flex: 1 }}>{log.content}</div>
              </div>
              <div style={{ display: 'flex', gap: '20px', paddingTop: '10px', borderTop: '1px dashed #e2e8f0', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={14} color="#64748b" />
                  <span style={{ fontSize: '14px', fontWeight: '900' }}>{formatMinutes(log.minutes)}<span style={{ fontSize: '10px' }}>{getUnit(log.minutes)}</span></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Zap size={14} color="#f59e0b" />
                  <span style={{ fontSize: '14px', fontWeight: '900' }}>{log.quality}<span style={{ fontSize: '10px' }}>%</span></span>
                </div>
              </div>
              {log.reflection && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#64748b', backgroundColor: 'white', padding: '8px', borderRadius: '8px', fontStyle: 'italic', borderLeft: '3px solid #f1f5f9' }}>{log.reflection}</div>
              )}
            </div>
          ))}
        </div>
      </section>
      
      <footer style={{ textAlign: 'center', padding: '40px 0', color: '#cbd5e1', fontSize: '10px', fontWeight: 'bold' }}>PORTFOLIO © 2026</footer>

      {showPraise && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          
          <div style={{ animation: 'popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards', background: 'white', padding: '30px 50px', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', textAlign: 'center', border: '4px solid #4f46e5' }}>
            <div style={{ fontSize: '48px', marginBottom: '8px' }}>🌟</div>
            <div style={{ fontSize: '28px', fontWeight: '900', color: '#4f46e5' }}>{praiseText}</div>
            <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 'bold', marginTop: '10px' }}>{praiseSubText}</div>
          </div>

          {[...Array(40)].map((_, i) => {
            const left = Math.random() * 100;
            const animationDuration = 1.5 + Math.random() * 2;
            const animationDelay = Math.random() * 0.5;
            const colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            const isCircle = Math.random() > 0.5;
            
            return (
              <div 
                key={i} 
                style={{ 
                  position: 'absolute', 
                  top: '-20px', 
                  left: `${left}%`, 
                  width: '12px', 
                  height: '12px', 
                  backgroundColor: color, 
                  borderRadius: isCircle ? '50%' : '0', 
                  animation: `confettiFall ${animationDuration}s linear ${animationDelay}s forwards` 
                }} 
              />
            );
          })}
        </div>
      )}

      {isFullscreen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#f4f7fa', zIndex: 10000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
          <button onClick={toggleSound} style={{ position: 'absolute', top: '20px', right: '70px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: isSoundEnabled ? '#4f46e5' : '#94a3b8', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }} title={isSoundEnabled ? "アラーム音：オン" : "アラーム音：オフ"}>
            {isSoundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <button onClick={() => setIsFullscreen(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
            <Minimize size={20} />
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
            <Timer size={32} color="#4f46e5" style={{ marginRight: '10px' }} />
            <h2 style={{ fontSize: '24px', fontWeight: '900', color: '#1e293b', margin: 0 }}>学習タイマー</h2>
          </div>

          <div style={{
            fontSize: isMobile ? '140px' : '260px',
            fontWeight: '900',
            color: timerTimeLeft === 0 ? '#10b981' : '#4f46e5',
            lineHeight: '1',
            margin: '30px 0',
            fontVariantNumeric: 'tabular-nums',
            fontFamily: "'Helvetica Neue', Arial, sans-serif",
            letterSpacing: '-0.02em',
            wordBreak: 'keep-all',
            whiteSpace: 'nowrap'
          }}>
            {formatTimerDisplay(timerTimeLeft)}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '30px', flexWrap: 'wrap' }}>
            <button onClick={() => handleTimerAdjust(-1)} disabled={isTimerRunning} style={{ padding: '10px 20px', borderRadius: '12px', border: '1px solid #cbd5e1', background: 'white', color: '#64748b', fontWeight: 'bold', cursor: isTimerRunning ? 'not-allowed' : 'pointer', fontSize: '16px' }}>
              - 1分
            </button>
            <button onClick={() => handleTimerAdjust(1)} disabled={isTimerRunning} style={{ padding: '10px 20px', borderRadius: '12px', border: '1px solid #cbd5e1', background: 'white', color: '#64748b', fontWeight: 'bold', cursor: isTimerRunning ? 'not-allowed' : 'pointer', fontSize: '16px' }}>
              + 1分
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <button onClick={toggleTimer} style={{ padding: '18px 45px', borderRadius: '50px', border: 'none', background: isTimerRunning ? '#f59e0b' : '#4f46e5', color: 'white', fontWeight: '900', cursor: 'pointer', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
              {isTimerRunning ? <><Pause size={24} /> 一時停止</> : <><Play size={24} /> スタート</>}
            </button>
            <button onClick={resetTimer} style={{ padding: '18px 30px', borderRadius: '50px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: '900', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={20} /> リセット
            </button>
            {!isTimerRunning && timerTimeLeft !== timerInputMinutes * 60 && (
              <button onClick={recordLap} style={{ padding: '18px 30px', borderRadius: '50px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: '900', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <List size={20} /> ラップ記録
              </button>
            )}
          </div>

          {/* 変更箇所：全画面モードのラップ表示部。経過時間と残り時間を並べて表示 */}
          {laps.length > 0 && (
            <div style={{ marginTop: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              <div style={{ width: '100%', maxWidth: '350px', backgroundColor: 'white', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', maxHeight: '25vh', overflowY: 'auto' }}>
                <div style={{ fontSize: '14px', fontWeight: '900', color: '#94a3b8', marginBottom: '15px', textAlign: 'left' }}>ラップ記録</div>
                {laps.map((lap, index) => (
                  <div key={index} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold', color: '#1e293b', padding: '8px 0', borderBottom: index !== laps.length - 1 ? '1px dashed #e2e8f0' : 'none' }}>
                    <span>ラップ {index + 1}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: "'Helvetica Neue', Arial, sans-serif", fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ color: '#4f46e5' }}>{lap.elapsed}</span>
                      <span style={{ color: '#94a3b8', fontSize: '14px' }}>(残り {lap.remaining})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}