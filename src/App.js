import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, getDoc, setDoc, where, updateDoc, deleteDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, linkWithPopup, signOut } from 'firebase/auth';
import { BookOpen, Headphones, MessageCircle, PenTool, List, Clipboard, Star, User, Activity, Clock, Zap, Send, Calendar, Trash2, Edit, Timer, Play, Pause, RefreshCw, Maximize, Minimize, Book, Volume2, VolumeX, Mic, Sun, CalendarDays, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LabelList } from 'recharts';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

const CATEGORIES = [
  { id: 'Reading', label: '読む', icon: <BookOpen size={16}/>, color: '#38bdf8' },
  { id: 'Listening', label: '聞く', icon: <Headphones size={16}/>, color: '#4ade80' },
  { id: 'Speaking', label: '話す', icon: <MessageCircle size={16}/>, color: '#fb7185' },
  { id: 'Writing', label: '書く', icon: <PenTool size={16}/>, color: '#fbbf24' },
  { id: 'Vocabulary', label: '単語', icon: <Book size={16}/>, color: '#c084fc' },
  { id: 'ReadingAloud', label: '音読', icon: <Mic size={16}/>, color: '#22d3ee' }
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

const formatMinutes = m => {
  const val = Number(m) || 0;
  return val >= 60 ? (val / 60).toFixed(1) : Math.round(val);
};
const getUnit = m => Number(m) >= 60 ? 'h' : 'm';

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

export default function App() {
  const [user, setUser] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [logs, setLogs] = useState([]);
  const [profile, setProfile] = useState({ name: '', goal: '', eikenDate: '', otherDate: '', otherName: '' });
  const [selectedRange, setSelectedRange] = useState('day');
  
  const [minutes, setMinutes] = useState(25);
  const [selectedCats, setSelectedCats] = useState([]);
  const [speakingType, setSpeakingType] = useState('');
  const [reflection, setReflection] = useState('');
  const [quality, setQuality] = useState(80);
  const [date, setDate] = useState(getLocalDateString(new Date()));
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);

  const [showPraise, setShowPraise] = useState(false);
  const [praiseText, setPraiseText] = useState("");
  const [praiseSubText, setPraiseSubText] = useState("保存完了！学習記録が追加されました");
  const [editingLogId, setEditingLogId] = useState(null);

  const [timerInputTime, setTimerInputTime] = useState(25 * 60);
  const [timerTimeLeft, setTimerTimeLeft] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [laps, setLaps] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const isSoundEnabledRef = useRef(true);

  const wakeLockRef = useRef(null);
  const originalTitleRef = useRef(typeof document !== 'undefined' ? document.title : 'English Learning Portfolio');
  
  const expectedEndTimeRef = useRef(null);
  const timerTimeLeftRef = useRef(timerTimeLeft);

  const dragStartY = useRef(null);
  const dragStartValue = useRef(null);
  const dragTarget = useRef(null);

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
          try { wakeLockRef.current = await navigator.wakeLock.request('screen'); } catch (err) {}
        }
      } else {
        if (wakeLockRef.current !== null) {
          try { await wakeLockRef.current.release(); wakeLockRef.current = null; } catch (err) {}
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
      const osc1 = ctx.createOscillator(); const gain1 = ctx.createGain();
      osc1.connect(gain1); gain1.connect(ctx.destination);
      osc1.type = 'sine'; osc1.frequency.setValueAtTime(880, ctx.currentTime);
      gain1.gain.setValueAtTime(0, ctx.currentTime);
      gain1.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
      gain1.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
      osc1.start(ctx.currentTime); osc1.stop(ctx.currentTime + 0.15);

      const osc2 = ctx.createOscillator(); const gain2 = ctx.createGain();
      osc2.connect(gain2); gain2.connect(ctx.destination);
      osc2.type = 'sine'; osc2.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.1);
      gain2.gain.setValueAtTime(0, ctx.currentTime + 0.1);
      gain2.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc2.start(ctx.currentTime + 0.1); osc2.stop(ctx.currentTime + 0.6);
    } catch (e) {}
  };

  const toggleTimer = useCallback(() => {
    setIsTimerRunning(prev => {
      if (!prev) expectedEndTimeRef.current = Date.now() + timerTimeLeftRef.current * 1000;
      return !prev;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const tagName = document.activeElement?.tagName?.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return;
      if (e.code === 'Space') { e.preventDefault(); toggleTimer(); }
      if (e.code === 'Escape' && isFullscreen) setIsFullscreen(false);
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
          setMinutes(Math.max(1, Math.ceil(timerInputTime / 60))); 
          setPraiseSubText("タイマー完了！学習時間を反映しました");
          setPraiseText(PRAISE_MESSAGES[Math.floor(Math.random() * PRAISE_MESSAGES.length)]);
          setShowPraise(true);
          playAlarmSound();
          setTimeout(() => setShowPraise(false), 2500);
          clearInterval(interval);
        } else {
          setTimerTimeLeft(remaining); 
        }
      }, 250); 
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerInputTime]);

  const formatTimerDisplay = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return { m, s };
  };

  const handlePointerDown = (e, target) => {
    if (isTimerRunning && (target === 'timer_min' || target === 'timer_sec')) return;
    dragStartY.current = e.touches ? e.touches[0].clientY : e.clientY;
    
    if (target === 'timer_min' || target === 'timer_sec') {
      dragStartValue.current = timerInputTime;
    } else if (target === 'log_min') {
      dragStartValue.current = Number(minutes);
    } else if (target === 'log_quality') {
      dragStartValue.current = Number(quality);
    }
    dragTarget.current = target;
  };

  const handlePointerMove = (e) => {
    if (dragStartY.current === null) return;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const diffY = dragStartY.current - clientY; 
    
    if (dragTarget.current === 'timer_min') {
      const minChange = Math.floor(diffY / 10); 
      let newTime = dragStartValue.current + minChange * 60;
      newTime = Math.max(1, Math.min(newTime, 5999)); 
      if (newTime !== timerInputTime) {
        setTimerInputTime(newTime); setTimerTimeLeft(newTime); setLaps([]);
      }
    } else if (dragTarget.current === 'timer_sec') {
      const secChange = Math.floor(diffY / 5); 
      let newTime = dragStartValue.current + secChange;
      newTime = Math.max(1, Math.min(newTime, 5999));
      if (newTime !== timerInputTime) {
        setTimerInputTime(newTime); setTimerTimeLeft(newTime); setLaps([]);
      }
    } else if (dragTarget.current === 'log_min') {
      const change = Math.floor(diffY / 6);
      let newVal = dragStartValue.current + change;
      newVal = Math.max(1, Math.min(newVal, 300)); 
      setMinutes(newVal);
    } else if (dragTarget.current === 'log_quality') {
      const change = Math.floor(diffY / 2);
      let newVal = dragStartValue.current + change;
      newVal = Math.max(0, Math.min(newVal, 100));
      setQuality(newVal);
    }
  };

  const handlePointerUp = () => {
    dragStartY.current = null;
    dragStartValue.current = null;
    dragTarget.current = null;
  };

  const resetTimer = () => {
    setIsTimerRunning(false);
    setTimerTimeLeft(timerInputTime);
    setLaps([]);
  };

  const recordLap = () => {
    const elapsedSeconds = timerInputTime - timerTimeLeft;
    const elapsedStr = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:${String(elapsedSeconds % 60).padStart(2, '0')}`;
    const remainingStr = `${String(Math.floor(timerTimeLeft / 60)).padStart(2, '0')}:${String(timerTimeLeft % 60).padStart(2, '0')}`;
    setLaps(prev => [...prev, { elapsed: elapsedStr, remaining: remainingStr }]);
  };

  const handleCopyRecent = () => {
    if (logs && logs.length > 0) {
      const lastLog = logs[0]; 
      setMinutes(lastLog.minutes || 25);
      setSelectedCats(lastLog.categories || []);
      setSpeakingType(lastLog.speakingType || '');
      setReflection(lastLog.reflection || lastLog.content || ''); 
      setQuality(lastLog.quality || 80);
    }
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) setUser(u); else setUser(null);
      setIsAuthChecking(false);
    });
    
    return () => { window.removeEventListener('resize', handleResize); unsubscribe(); };
  }, []);

  const handleGoogleLogin = async () => {
    try {
      if (auth.currentUser && auth.currentUser.isAnonymous) {
        await linkWithPopup(auth.currentUser, provider);
      } else {
        await signInWithPopup(auth, provider);
      }
      window.location.reload();
    } catch (error) {
      if (error.code === 'auth/credential-already-in-use' || error.code === 'auth/email-already-in-use') {
         try {
           await signInWithPopup(auth, provider);
           window.location.reload();
         } catch (signInError) { alert("ログインに失敗しました。"); }
      } 
    }
  };

  const handleLogout = () => signOut(auth);

  useEffect(() => {
    if (!user || user.isAnonymous) return;

    const q = query(collection(db, 'logs'), where('uid', '==', user.uid), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, 
      (s) => setLogs(s.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    
    getDoc(doc(db, 'profile', user.uid)).then(async d => {
      let currentProfile = d.exists() ? d.data() : {};
      const todayStr = getLocalDateString(new Date());
      if (!currentProfile.eikenDate || currentProfile.eikenDate < todayStr) {
        const nextDate = await fetchNextEikenDate();
        if (nextDate) {
          currentProfile.eikenDate = nextDate;
          try { await setDoc(doc(db, 'profile', user.uid), currentProfile, { merge: true }); } catch (e) {}
        }
      }
      setProfile(p => ({...p, ...currentProfile}));
    });

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
      return CATEGORIES.map(cat => ({ name: cat.label, value: stats.skillMap[cat.id] || 0, color: cat.color }));
    }
    
    const getBreakdown = (logsArr) => {
        const bd = {};
        CATEGORIES.forEach(c => bd[c.id] = 0);
        logsArr.forEach(l => {
            const cats = l.categories || [];
            if(cats.length > 0) {
                const val = Number(l.minutes) / cats.length;
                cats.forEach(c => bd[c] = (bd[c] || 0) + val);
            }
        });
        return bd;
    };

    if (selectedRange === 'week') {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const d_base = new Date(date + "T00:00:00");
      const day_idx = d_base.getDay() || 7;
      const start = new Date(d_base); if (day_idx !== 1) start.setDate(d_base.getDate() - day_idx + 1);
      return days.map((label, i) => {
        const d = new Date(start); d.setDate(start.getDate() + i);
        const dateStr = getLocalDateString(d);
        const dayLogs = logs.filter(l => l.date === dateStr);
        const dayTotal = dayLogs.reduce((a, c) => a + (Number(c.minutes) || 0), 0);
        return { name: label, value: dayTotal, fullDate: dateStr, ...getBreakdown(dayLogs) };
      });
    }
    if (selectedRange === 'month') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const targetYear = new Date(date + "T00:00:00").getFullYear();
      return months.map((label, i) => {
        const monthLogs = logs.filter(l => { const d = new Date(l.date + "T00:00:00"); return d.getFullYear() === targetYear && d.getMonth() === i; });
        const monthTotal = monthLogs.reduce((a, c) => a + (Number(c.minutes) || 0), 0);
        return { name: label, value: monthTotal, ...getBreakdown(monthLogs) };
      });
    }
    if (selectedRange === 'year') {
      const years = [2026, 2027, 2028, 2029, 2030, 2031];
      return years.map(y => {
        const yearLogs = logs.filter(l => new Date(l.date + "T00:00:00").getFullYear() === y);
        const yearTotal = yearLogs.reduce((a, c) => a + (Number(c.minutes) || 0), 0);
        return { name: y.toString(), value: yearTotal, ...getBreakdown(yearLogs) };
      });
    }
    return [];
  }, [selectedRange, logs, stats.skillMap, date]);

  const handleProfileUpdate = async (field, value) => {
    const newProfile = { ...profile, [field]: value };
    setProfile(newProfile);
    if (user && !user.isAnonymous) {
      try { await setDoc(doc(db, 'profile', user.uid), newProfile); } catch (error) {}
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!auth.currentUser || !minutes || selectedCats.length === 0) return;
    
    const logData = { 
      date, 
      minutes: Number(minutes), 
      categories: selectedCats, 
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
      
      setMinutes(25); setSelectedCats([]); setSpeakingType(''); setReflection(''); setQuality(80); 
      
      setPraiseSubText("保存完了！学習記録が追加されました");
      setPraiseText(PRAISE_MESSAGES[Math.floor(Math.random() * PRAISE_MESSAGES.length)]);
      setShowPraise(true);
      setTimeout(() => setShowPraise(false), 2500);
    } catch (error) {
      alert("学習記録の保存に失敗しました。通信環境を確認してください。");
    }
  };

  const handleEdit = (log) => {
    setEditingLogId(log.id);
    setDate(log.date);
    setMinutes(log.minutes);
    setSelectedCats(log.categories || []);
    setSpeakingType(log.speakingType || '');
    setReflection(log.reflection || log.content || ''); 
    setQuality(log.quality || 80);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (logId) => {
    if (window.confirm('この学習記録を削除してもよろしいですか？')) {
      try {
        await deleteDoc(doc(db, 'logs', logId));
        if (editingLogId === logId) {
          setEditingLogId(null); setMinutes(25); setSelectedCats([]); setSpeakingType(''); setReflection(''); setQuality(80);
        }
      } catch (error) {}
    }
  };

  const handleExport = (format) => {
    const header = "Date,Skill,Reflection,Duration,Quality\n";
    const csvContent = filteredLogs.map(log => {
      const text = log.reflection || log.content || "";
      const catsStr = (log.categories || []).map(c => c === 'Speaking' && log.speakingType ? `${c}(${log.speakingType})` : c).join("/");
      return `${log.date},${catsStr},"${text.replace(/"/g, '""')}",${log.minutes},${log.quality}%`;
    }).join("\n");
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), header, csvContent], { type: "text/csv" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `learning_log_${format}.csv`; link.click();
  };

  const cardStyle = { background: 'white', borderRadius: '24px', padding: isMobile ? '20px 15px' : '25px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', boxSizing: 'border-box', width: '100%' };
  const inputStyle = { width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid #f1f5f9', background: '#f8fafc', fontWeight: 'bold', boxSizing: 'border-box', outline: 'none', fontSize: '14px' };
  
  const tabStyle = (r) => ({ 
    padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', border: 'none', 
    backgroundColor: selectedRange === r ? '#ffffff' : 'transparent', color: selectedRange === r ? '#4f46e5' : '#64748b',
    display: 'flex', alignItems: 'center', gap: '4px', boxShadow: selectedRange === r ? '0 2px 8px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s ease'
  });

  const headerStyle = { fontSize: '16px', fontWeight: '900', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' };

  const todayDate = new Date();
  const todayStringJP = `${todayDate.getFullYear()}/${todayDate.getMonth() + 1}/${todayDate.getDate()}`;

  const remainingRatio = timerInputTime > 0 ? timerTimeLeft / timerInputTime : 0;
  const consumedAngle = (1 - remainingRatio) * 360;
  const timeDisplay = formatTimerDisplay(timerTimeLeft);

  const timerNumStyle = {
    fontSize: isMobile ? '80px' : '120px',
    fontWeight: '900',
    color: timerTimeLeft === 0 ? '#10b981' : '#4f46e5',
    lineHeight: '1',
    letterSpacing: '-0.02em',
    textShadow: '0 4px 15px rgba(79, 70, 229, 0.15)',
    pointerEvents: 'none' 
  };
  const timerNumStyleFS = { ...timerNumStyle, fontSize: isMobile ? '120px' : '240px' };

  if (isAuthChecking) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f4f7fa' }}><div style={{ color: '#4f46e5', fontWeight: 'bold', fontSize: '20px' }}>Loading...</div></div>;

  if (!user || user.isAnonymous) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f4f7fa', fontFamily: 'sans-serif' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '400px', width: '90%' }}>
          <div style={{ background: '#e0e7ff', width: '60px', height: '60px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <BookOpen size={32} color="#4f46e5" />
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#1e293b', margin: '0 0 10px 0' }}>BLUEPRINT LOG</h1>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '30px', fontWeight: 'bold', lineHeight: '1.6' }}>
            英単語アプリと学習データを同期するため、<br/>Googleアカウントでログインしてください。
          </p>
          <button onClick={handleGoogleLogin} className="action-btn" style={{ width: '100%', padding: '16px', borderRadius: '12px', background: '#4f46e5', color: 'white', fontWeight: '900', border: 'none', cursor: 'pointer', fontSize: '16px', boxShadow: '0 4px 15px rgba(79, 70, 229, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <User size={20} /> Googleでログイン
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{ maxWidth: '950px', margin: '0 auto', padding: isMobile ? '20px 10px' : '30px 20px', backgroundColor: '#f4f7fa', minHeight: '100vh', fontFamily: 'sans-serif', boxSizing: 'border-box', overflowX: 'hidden' }}
    >
      
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=Noto+Sans+JP:wght@400;500;700;900&family=Syne:wght@700;800&display=swap');
        body { font-family: 'Noto Sans JP', sans-serif !important; }
        input, textarea, button, select { font-family: 'Noto Sans JP', sans-serif !important; box-sizing: border-box; }
        
        @keyframes popIn { 0% { transform: scale(0.8); opacity: 0; } 40% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes climbingWalk { 0% { transform: translateY(0) rotate(0deg); } 25% { transform: translateY(-3px) rotate(-10deg); } 50% { transform: translateY(0) rotate(0deg); } 75% { transform: translateY(-3px) rotate(10deg); } 100% { transform: translateY(0) rotate(0deg); } }
        
        .action-btn { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important; }
        .action-btn:hover { transform: translateY(-2px); filter: brightness(1.05); box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important; }
        .action-btn:active { transform: translateY(0); }
        .category-btn { transition: all 0.2s ease !important; }
        .category-btn:hover { transform: scale(1.05); }
        
        .profile-dashboard-bar {
          display: flex; align-items: center; flex-wrap: wrap; gap: 12px;
          background: white; padding: 12px 20px; border-radius: 20px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.03); border: 1px solid #f1f5f9; box-sizing: border-box; width: 100%;
        }
        .profile-item { display: flex; align-items: center; gap: 8px; color: #64748b; font-size: 13px; font-weight: bold; }
        
        .clean-input { border: none; background: transparent; font-weight: bold; color: #1e293b; outline: none; transition: all 0.2s; border-bottom: 2px solid transparent; }
        .clean-input:focus { border-bottom: 2px solid #ef4444; color: #000; }
        
        .exam-item-container {
          flex: 1; min-width: 0; background: #f8fafc; padding: 6px 12px; border-radius: 12px; border: 1px solid #f1f5f9;
          display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; box-sizing: border-box;
        }
        .exam-name-input { flex: 1; text-align: left; font-size: 14px; color: #1e293b; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; padding-left: 4px; min-width: 80px; }
        .exam-date { width: 105px; color: #64748b; font-size: 12px; cursor: pointer; font-family: 'Inter', sans-serif; flex-shrink: 0; }
        .exam-countdown {
          display: flex; align-items: baseline; background: #e0e7ff; color: #4f46e5; padding: 4px 10px; border-radius: 12px; font-weight: 900; margin-left: 4px; box-shadow: 0 2px 5px rgba(79,70,229,0.1); white-space: nowrap; flex-shrink: 0;
        }
        .countdown-number { font-size: 18px; line-height: 1; margin: 0 2px; }
        .small-text { font-size: 10px; }

        .modern-input { transition: all 0.3s ease !important; }
        .modern-input:focus { background: #ffffff !important; border-color: #4f46e5 !important; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15) !important; }
        
        .timer-text { font-variant-numeric: tabular-nums; font-family: 'Helvetica Neue', Arial, sans-serif; }
        .draggable-number { touch-action: none; user-select: none; -webkit-user-select: none; }

        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', background: 'linear-gradient(135deg, #4f46e5, #0ea5e9)', borderRadius: '12px', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' }}>
            <Activity size={24} color="white" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1 style={{ margin: 0, fontFamily: 'Syne, sans-serif', fontSize: '28px', fontWeight: 800, letterSpacing: '-0.06em', background: 'linear-gradient(90deg, #111827, #4f46e5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              BLUEPRINT LOG
            </h1>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '9px', color: '#64748b', fontWeight: 700, letterSpacing: '0.2em', marginTop: '-2px' }}>
              STRATEGIC LEARNING PLATFORM
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="action-btn" onClick={() => window.open('https://voca.english-t24.com', '_blank')} style={{ padding: '8px 12px', background: 'white', color: '#4f46e5', border: '1px solid #e0e7ff', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', boxShadow: '0 2px 5px rgba(79, 70, 229, 0.05)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <BookOpen size={14} /> 単語アプリへ
          </button>
          <button className="action-btn" onClick={() => window.open('https://english-t24.com', '_blank')} style={{ padding: '8px 12px', background: 'white', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0, 0, 0, 0.05)' }}>
            ブログへ
          </button>
          <div style={{ width: '1px', height: '20px', background: '#cbd5e1', margin: '0 2px' }}></div>
          <button className="action-btn" onClick={handleLogout} style={{ padding: '8px 12px', borderRadius: '10px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            ログアウト
          </button>
        </div>
      </div>

      <div className="profile-dashboard-bar" style={{ marginBottom: '25px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', gap: isMobile ? '10px' : '12px', justifyContent: isMobile ? 'center' : 'flex-start', padding: isMobile ? '12px' : '12px 20px' }}>
        <div style={{ display: 'flex', width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-start', alignItems: 'center' }}>
          <div className="profile-item" style={{ flexShrink: 0 }}>
            <Calendar size={16} /> <span style={{ fontFamily: 'Inter, sans-serif' }}>{todayStringJP}</span>
          </div>
          {!isMobile && <div style={{ width: '1px', height: '16px', background: '#e2e8f0', margin: '0 8px' }}></div>}
          <div className="profile-item" style={{ flexShrink: 0 }}>
            <User size={16} />
            <input className="clean-input" style={{ width: isMobile ? '70px' : '80px', textAlign: isMobile ? 'right' : 'left' }} value={profile.name || ''} onChange={e => handleProfileUpdate('name', e.target.value)} placeholder="氏名" />
          </div>
        </div>
        {isMobile && <div style={{ width: '100%', height: '1px', background: '#f1f5f9' }}></div>}
        {!isMobile && <div style={{ width: '1px', height: '16px', background: '#e2e8f0', margin: '0 4px' }}></div>}
        <div className="profile-item exam-item-container" style={{ width: isMobile ? '100%' : 'auto', padding: isMobile ? '8px' : '6px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: '1 1 auto', minWidth: '100px' }}>
            <Star size={16} color="#f59e0b" />
            <input className="clean-input exam-name-input modern-input" style={{ fontSize: isMobile ? '13px' : '14px' }} value={profile.otherName || ''} onChange={e => handleProfileUpdate('otherName', e.target.value)} placeholder="試験名を入力" title={profile.otherName || ''} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <input type="date" className="clean-input exam-date modern-input" value={profile.otherDate || ''} onChange={e => handleProfileUpdate('otherDate', e.target.value)} />
            {profile.otherDate && (
              <div className="exam-countdown" style={{ padding: '2px 8px' }}>
                <span className="small-text">あと</span>
                <span className="countdown-number" style={{ fontSize: isMobile ? '16px' : '18px' }}>{Math.ceil((new Date(profile.otherDate) - new Date().setHours(0,0,0,0)) / 86400000)}</span>
                <span className="small-text">日</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <section style={{ ...cardStyle, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '15px', position: 'relative' }}>
          <button className="action-btn" onClick={toggleSound} style={{ position: 'absolute', left: 0, background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: isSoundEnabled ? '#4f46e5' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={isSoundEnabled ? "アラーム音：オン" : "アラーム音：オフ"}>
            {isSoundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <Timer size={24} color="#4f46e5" style={{ marginRight: '8px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b', margin: 0 }}>学習タイマー</h2>
          <button className="action-btn" onClick={() => setIsFullscreen(true)} style={{ position: 'absolute', right: 0, background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="全画面表示">
            <Maximize size={20} />
          </button>
        </div>

        {/* ⭐️ エラー修正：タイマーの上下幅（パディング）を大幅に拡張し、数字と線の間に広々とした空間を確保 */}
        <div style={{
          background: timerTimeLeft === 0 ? '#10b981' : `conic-gradient(#e2e8f0 ${consumedAngle}deg, #4f46e5 ${consumedAngle}deg)`,
          borderRadius: '34px', padding: '4px', margin: '20px auto 30px', maxWidth: '500px', boxShadow: '0 15px 35px rgba(79, 70, 229, 0.1)',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(145deg, #ffffff, #f8fafc)',
            borderRadius: '30px', padding: isMobile ? '50px 10px' : '80px 30px', boxShadow: 'inset 0 2px 5px rgba(255, 255, 255, 1)'
          }}>
            <div className="draggable-number" onPointerDown={(e) => handlePointerDown(e, 'timer_min')} style={{ cursor: isTimerRunning ? 'default' : 'ns-resize', padding: '0 5px' }}>
              <div className="timer-text" style={timerNumStyle}>{timeDisplay.m}</div>
            </div>
            <div className="timer-text" style={{ ...timerNumStyle, paddingBottom: isMobile ? '10px' : '15px' }}>:</div>
            <div className="draggable-number" onPointerDown={(e) => handlePointerDown(e, 'timer_sec')} style={{ cursor: isTimerRunning ? 'default' : 'ns-resize', padding: '0 5px' }}>
              <div className="timer-text" style={timerNumStyle}>{timeDisplay.s}</div>
            </div>
          </div>
        </div>

        {!isTimerRunning && timerTimeLeft !== 0 && (
          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '25px', animation: 'popIn 0.5s ease' }}>
            👆 分・秒の数字を上下にスワイプして時間を調整
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <button className="action-btn" onClick={toggleTimer} style={{ padding: '15px 40px', borderRadius: '50px', border: 'none', background: isTimerRunning ? '#f59e0b' : '#4f46e5', color: 'white', fontWeight: '900', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
            {isTimerRunning ? <><Pause size={20} /> 一時停止</> : <><Play size={20} /> スタート</>}
          </button>
          <button className="action-btn" onClick={resetTimer} style={{ padding: '15px 25px', borderRadius: '50px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: '900', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={18} /> リセット
          </button>
          {!isTimerRunning && timerTimeLeft !== timerInputTime && (
            <button className="action-btn" onClick={recordLap} style={{ padding: '15px 25px', borderRadius: '50px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: '900', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                  <div className="timer-text" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
          <h2 style={{ ...headerStyle, margin: 0 }}><Clipboard size={18} color="#4f46e5" /> 学習を記録する</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!editingLogId && logs.length > 0 && (
              <button className="action-btn" type="button" onClick={handleCopyRecent} style={{ padding: '6px 12px', background: '#e0e7ff', color: '#4f46e5', borderRadius: '10px', fontWeight: '900', border: 'none', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <RefreshCw size={12} /> {isMobile ? 'コピー' : '前回をコピー'}
              </button>
            )}
            {editingLogId && (
              <button className="action-btn" type="button" onClick={() => { setEditingLogId(null); setMinutes(25); setSelectedCats([]); setSpeakingType(''); setReflection(''); setQuality(80); setDate(getLocalDateString(new Date())); }} style={{ padding: '6px 12px', background: '#f1f5f9', color: '#64748b', borderRadius: '10px', fontWeight: '900', border: 'none', cursor: 'pointer', fontSize: '11px' }}>
                キャンセル
              </button>
            )}
            <button className="action-btn" onClick={handleSave} style={{ padding: '6px 16px', background: '#4f46e5', color: 'white', borderRadius: '10px', fontWeight: '900', border: 'none', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Send size={12} /> {editingLogId ? '更新' : '登録'}
            </button>
          </div>
        </div>

        {/* ⭐️ エラー修正：技能ボタンを囲む要素にスマホ表示時のみ flexWrap: wrap を確実に適用し、綺麗に折り返される（並列表示される）ように修正。これで切れません。 */}
        <div style={{ display: 'flex', gap: '8px', overflowX: isMobile ? 'unset' : 'auto', flexWrap: isMobile ? 'wrap' : 'unset', paddingBottom: '5px', marginBottom: '15px', WebkitOverflowScrolling: 'touch' }}>
          {CATEGORIES.map((cat) => (
            <button key={cat.id} type="button" className="category-btn" onClick={() => selectedCats.includes(cat.id) ? setSelectedCats(prev => prev.filter(c => c !== cat.id)) : setSelectedCats(prev => [...prev, cat.id])}
              style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '12px', border: 'none', backgroundColor: selectedCats.includes(cat.id) ? cat.color : '#f1f5f9', color: selectedCats.includes(cat.id) ? 'white' : '#64748b', fontSize: '13px', fontWeight: '900', cursor: 'pointer', margin: isMobile ? '0 4px 8px 0' : '0' }}>
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
        
        {selectedCats.includes('Speaking') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '4px', animation: 'popIn 0.3s ease-out', marginBottom: '15px' }}>
            <span style={{ fontSize: '11px', fontWeight: '900', color: '#f43f5e' }}>↳ 話す内容:</span>
            {['発表', 'やり取り'].map(type => (
              <button key={type} type="button" className="action-btn" onClick={() => setSpeakingType(type)}
                style={{ padding: '4px 12px', borderRadius: '8px', border: speakingType === type ? 'none' : '1px solid #fda4af', backgroundColor: speakingType === type ? '#f43f5e' : '#fff1f2', color: speakingType === type ? 'white' : '#f43f5e', fontSize: '11px', fontWeight: '900', cursor: 'pointer' }}>
                {type}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isMobile ? '10px' : '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#f8fafc', padding: isMobile ? '15px 5px' : '20px', borderRadius: '16px', border: '1px solid #f1f5f9', minWidth: 0, boxSizing: 'border-box' }}>
              <label style={{ fontSize: '12px', fontWeight: '900', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '5px', whiteSpace: 'nowrap' }}>
                <Clock size={14} color="#94a3b8" /> 学習時間
              </label>
              <div className="draggable-number" onPointerDown={(e) => handlePointerDown(e, 'log_min')} style={{ display: 'flex', alignItems: 'baseline', gap: '2px', cursor: 'ns-resize' }}>
                <span className="timer-text" style={{ fontSize: isMobile ? 'clamp(36px, 10vw, 48px)' : '64px', fontWeight: '900', color: '#4f46e5', lineHeight: 1, letterSpacing: '-0.02em', textShadow: '0 4px 10px rgba(79, 70, 229, 0.1)', pointerEvents: 'none' }}>{minutes}</span>
                <span style={{ fontSize: isMobile ? '12px' : '18px', fontWeight: '900', color: '#4f46e5', pointerEvents: 'none' }}>分</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#f8fafc', padding: isMobile ? '15px 5px' : '20px', borderRadius: '16px', border: '1px solid #f1f5f9', minWidth: 0, boxSizing: 'border-box' }}>
              <label style={{ fontSize: '12px', fontWeight: '900', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '5px', whiteSpace: 'nowrap' }}>
                <Zap size={14} color="#94a3b8" /> 集中度
              </label>
              <div className="draggable-number" onPointerDown={(e) => handlePointerDown(e, 'log_quality')} style={{ display: 'flex', alignItems: 'baseline', gap: '2px', cursor: 'ns-resize' }}>
                <span className="timer-text" style={{ fontSize: isMobile ? 'clamp(36px, 10vw, 48px)' : '64px', fontWeight: '900', color: '#4f46e5', lineHeight: 1, letterSpacing: '-0.02em', textShadow: '0 4px 10px rgba(79, 70, 229, 0.1)', pointerEvents: 'none' }}>{quality}</span>
                <span style={{ fontSize: isMobile ? '12px' : '18px', fontWeight: '900', color: '#4f46e5', pointerEvents: 'none' }}>%</span>
              </div>
            </div>
          </div>
          
          <div>
            <textarea className="modern-input" style={{ ...inputStyle, height: '120px' }} value={reflection} onChange={e => setReflection(e.target.value)} placeholder="学習内容や気づきを入力..." />
          </div>
        </form>
      </section>

      <section style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <h2 style={{ ...headerStyle, margin: 0 }}><Zap size={18} color="#4f46e5" /> 学習状況</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '14px', fontWeight: '900', color: '#1e293b' }}>
              合計: <span className="timer-text" style={{ color: '#4f46e5' }}>{formatMinutes(stats.total)}</span><span style={{ fontSize: '12px', marginLeft: '2px' }}>{getUnit(stats.total)}</span>
            </span>
            <div style={{ background: '#fee2e2', padding: '4px 10px', borderRadius: '8px' }}>
              <span style={{ color: '#ef4444', fontSize: '13px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '4px' }}>🔥 連続 {stats.streak} 日</span>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '20px' }}>🏔️</span>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span>立山登頂チャレンジ <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>(標高3,015m)</span></span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="timer-text" style={{ fontSize: '48px', fontWeight: '900', color: '#10b981', lineHeight: 1 }}>{Math.floor(stats.total / 60)}</span>
              <span style={{ fontSize: '12px', fontWeight: '900', color: '#94a3b8' }}> / 3,015歩</span>
            </div>
          </div>
          
          <div style={{ position: 'relative', width: '100%', height: '50px', marginTop: '10px' }}>
            <div style={{ position: 'absolute', right: '-4px', top: '-15px', fontSize: '20px', zIndex: 1, opacity: 0.8 }}>🗻</div>
            <div style={{ position: 'absolute', left: `calc(${Math.min((stats.total / 60 / 3015) * 100, 100)}% - 10px)`, bottom: `calc(${Math.min((stats.total / 60 / 3015) * 100, 100)}%)`, fontSize: '18px', transition: 'left 1s ease-out, bottom 1s ease-out', zIndex: 3, filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.3))', transform: Math.floor(stats.total / 60) >= 3015 ? 'none' : 'scaleX(-1)' }}>
              <div style={{ animation: Math.floor(stats.total / 60) >= 3015 ? 'none' : 'climbingWalk 1.5s infinite ease-in-out' }}>{Math.floor(stats.total / 60) >= 3015 ? '🚩' : '🚶'}</div>
            </div>
            <div style={{ width: '100%', height: '100%', backgroundColor: '#f1f5f9', clipPath: 'polygon(0 100%, 100% 0, 100% 100%)', borderRadius: '4px' }}>
              <div style={{ width: `${Math.min((stats.total / 60 / 3015) * 100, 100)}%`, height: '100%', backgroundColor: '#10b981', transition: 'width 1s ease-out' }}></div>
            </div>
            <div style={{ position: 'absolute', left: `calc(${Math.min((stats.total / 60 / 3015) * 100, 100)}%)`, top: '52px', transform: 'translateX(-50%)', fontSize: '11px', fontWeight: '900', color: '#10b981', transition: 'left 1s ease-out', whiteSpace: 'nowrap', zIndex: 2 }}>
              ▲ {Math.floor(stats.total / 60)}歩
            </div>
          </div>
        </div>
      </section>

      <section style={cardStyle} key={selectedRange}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <h2 style={{ ...headerStyle, margin: 0 }}><Activity size={18} color="#4f46e5" /> 学習傾向の分析</h2>
          <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
            {[
              { id: 'day', label: 'DAY', icon: <Sun size={14} /> },
              { id: 'week', label: 'WEEK', icon: <Calendar size={14} /> },
              { id: 'month', label: 'MONTH', icon: <CalendarDays size={14} /> },
              { id: 'year', label: 'YEAR', icon: <TrendingUp size={14} /> }
            ].map(tab => (
              <button className="action-btn" key={tab.id} onClick={() => setSelectedRange(tab.id)} style={tabStyle(tab.id)}>
                {tab.icon} <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
        
        <div style={{ height: '280px', width: '100%', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '-5px', left: '10px', fontSize: '11px', fontWeight: '900', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', zIndex: 10 }}>
            <Clock size={12} color="#94a3b8" /> 
            {selectedRange === 'day' ? '本日の学習時間' : selectedRange === 'week' ? '今週の学習時間' : selectedRange === 'month' ? '今月の学習時間' : '今年の学習時間'}
          </div>

          {selectedRange === 'day' ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboardChartData} layout="vertical" margin={{ top: 25, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="#cbd5e1" opacity={0.6} />
                <XAxis type="number" orientation="top" axisLine={{ stroke: '#e2e8f0', strokeWidth: 1 }} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} tickFormatter={(val) => val > 0 ? `${formatMinutes(val)}${getUnit(val)}` : '0'} />
                <YAxis dataKey="name" type="category" axisLine={{ stroke: '#e2e8f0', strokeWidth: 1 }} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#1e293b' }} width={60} />
                <Tooltip cursor={{ fill: '#f8fafc' }} content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div style={{ backgroundColor: 'white', padding: '10px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '11px', fontWeight: 'bold' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', color: data.color }}>
                            <span>{data.name}</span><span>{formatMinutes(data.value)}{getUnit(data.value)}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={isMobile ? 20 : 30}>
                  {dashboardChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  <LabelList dataKey="value" position="insideRight" formatter={(val) => val > 0 ? `${formatMinutes(val)}${getUnit(val)}` : ''} fill="#1e293b" fontSize={10} fontWeight={900} offset={10} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboardChartData} margin={{ top: 25, right: 10, left: -20, bottom: 0 }} style={{ cursor: 'pointer' }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} />
                <Tooltip cursor={{ fill: '#f8fafc' }} content={({ active, payload, label }) => {
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
                                <span>{cat.label}</span><span>{formatMinutes(entry.value)}{getUnit(entry.value)}</span>
                              </div>
                            );
                          })}
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', color: '#1e293b', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                            <span>合計</span><span>{formatMinutes(total)}{getUnit(total)}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {CATEGORIES.map((cat, index) => <Bar key={cat.id} dataKey={cat.id} stackId="a" fill={cat.color} radius={index === CATEGORIES.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]} barSize={isMobile ? 20 : 30} />)}
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
              <button className="action-btn" key={f} onClick={() => handleExport(f)} style={{ padding: '6px 10px', background: f==='excel'?'#1d6f42':f==='gsheet'?'#34a853':'#10b981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>{f.toUpperCase()}</button>
            ))}
          </div>
        </div>

        <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '500px', overflowY: 'auto', paddingRight: '10px' }}>
          {logs.map((log) => {
            const hasReflection = log.reflection && log.reflection.trim() !== '';
            return (
              <div key={log.id} style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div className="timer-text" style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '900' }}>{log.date}</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="action-btn" onClick={() => handleEdit(log)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', color: '#64748b' }}><Edit size={14} /></button>
                    <button className="action-btn" onClick={() => handleDelete(log.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', color: '#ef4444' }}><Trash2 size={14} /></button>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {(log.categories || []).map(c => {
                      const catInfo = CATEGORIES.find(cat => cat.id === c);
                      return (
                      <span key={c} style={{ backgroundColor: catInfo ? catInfo.color : '#e0e7ff', color: 'white', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '900', whiteSpace: 'nowrap' }}>
                        {catInfo ? catInfo.label : c}{c === 'Speaking' && log.speakingType ? `(${log.speakingType})` : ''}
                      </span>
                    )})}
                  </div>
                </div>
                {hasReflection && (
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', lineHeight: 1.5, marginBottom: '10px' }}>
                    {log.reflection}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '20px', paddingTop: '10px', borderTop: '1px dashed #e2e8f0', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={14} color="#64748b" />
                    <span className="timer-text" style={{ fontSize: '14px', fontWeight: '900' }}>{formatMinutes(log.minutes)}<span style={{ fontSize: '10px' }}>{getUnit(log.minutes)}</span></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Zap size={14} color="#f59e0b" />
                    <span className="timer-text" style={{ fontSize: '14px', fontWeight: '900' }}>{log.quality}<span style={{ fontSize: '10px' }}>%</span></span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      
      <footer style={{ textAlign: 'center', padding: '40px 0', color: '#cbd5e1', fontSize: '10px', fontWeight: 'bold', fontFamily: 'Syne, sans-serif', letterSpacing: '0.1em' }}>BLUEPRINT LOG © 2026</footer>

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
              <div key={i} style={{ position: 'absolute', top: '-20px', left: `${left}%`, width: '12px', height: '12px', backgroundColor: color, borderRadius: isCircle ? '50%' : '0', animation: `confettiFall ${animationDuration}s linear ${animationDelay}s forwards` }} />
            );
          })}
        </div>
      )}

      {isFullscreen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#f4f7fa', zIndex: 10000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
          <button className="action-btn" onClick={toggleSound} style={{ position: 'absolute', top: '20px', right: '70px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: isSoundEnabled ? '#4f46e5' : '#94a3b8', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }} title={isSoundEnabled ? "アラーム音：オン" : "アラーム音：オフ"}>
            {isSoundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <button className="action-btn" onClick={() => setIsFullscreen(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
            <Minimize size={20} />
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
            <Timer size={32} color="#4f46e5" style={{ marginRight: '10px' }} />
            <h2 style={{ fontSize: '24px', fontWeight: '900', color: '#1e293b', margin: 0 }}>学習タイマー</h2>
          </div>

          <div style={{
            background: timerTimeLeft === 0 ? '#10b981' : `conic-gradient(#e2e8f0 ${consumedAngle}deg, #4f46e5 ${consumedAngle}deg)`,
            borderRadius: '40px', padding: '6px', margin: '30px 0', boxShadow: '0 20px 40px rgba(79, 70, 229, 0.15)',
          }}>
            <div style={{
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                background: 'linear-gradient(145deg, #ffffff, #f8fafc)', borderRadius: '34px',
                padding: isMobile ? '80px 30px' : '130px 80px', boxShadow: 'inset 0 2px 10px rgba(255, 255, 255, 1)'
            }}>
              <div className="draggable-number" onPointerDown={(e) => handlePointerDown(e, 'timer_min')} style={{ cursor: isTimerRunning ? 'default' : 'ns-resize', padding: '0 10px' }}>
                <div className="timer-text" style={timerNumStyleFS}>{timeDisplay.m}</div>
              </div>
              <div className="timer-text" style={{ ...timerNumStyleFS, paddingBottom: isMobile ? '10px' : '20px' }}>:</div>
              <div className="draggable-number" onPointerDown={(e) => handlePointerDown(e, 'timer_sec')} style={{ cursor: isTimerRunning ? 'default' : 'ns-resize', padding: '0 10px' }}>
                <div className="timer-text" style={timerNumStyleFS}>{timeDisplay.s}</div>
              </div>
            </div>
          </div>

          {!isTimerRunning && timerTimeLeft !== 0 && (
            <div style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '25px', animation: 'popIn 0.5s ease' }}>
              👆 分・秒の数字を上下にスワイプして時間を調整
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <button className="action-btn" onClick={toggleTimer} style={{ padding: '18px 45px', borderRadius: '50px', border: 'none', background: isTimerRunning ? '#f59e0b' : '#4f46e5', color: 'white', fontWeight: '900', cursor: 'pointer', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
              {isTimerRunning ? <><Pause size={24} /> 一時停止</> : <><Play size={24} /> スタート</>}
            </button>
            <button className="action-btn" onClick={resetTimer} style={{ padding: '18px 30px', borderRadius: '50px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: '900', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={20} /> リセット
            </button>
            {!isTimerRunning && timerTimeLeft !== timerInputTime && (
              <button className="action-btn" onClick={recordLap} style={{ padding: '18px 30px', borderRadius: '50px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: '900', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <List size={20} /> ラップ記録
              </button>
            )}
          </div>

          {laps.length > 0 && (
            <div style={{ marginTop: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              <div style={{ width: '100%', maxWidth: '350px', backgroundColor: 'white', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', maxHeight: '25vh', overflowY: 'auto' }}>
                <div style={{ fontSize: '14px', fontWeight: '900', color: '#94a3b8', marginBottom: '15px', textAlign: 'left' }}>ラップ記録</div>
                {laps.map((lap, index) => (
                  <div key={index} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold', color: '#1e293b', padding: '8px 0', borderBottom: index !== laps.length - 1 ? '1px dashed #e2e8f0' : 'none' }}>
                    <span>ラップ {index + 1}</span>
                    <div className="timer-text" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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