import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, getDoc, setDoc, where } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { BookOpen, Headphones, MessageCircle, PenTool, Download, List, Clipboard, Star, User, Sparkles, Activity, Clock, Zap, Send, Calendar } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const firebaseConfig = {
  apiKey: "AIzaSyAMvD6g3pTmneNad4-h8ZT_rzfZfn3T2YM",
  authDomain: "my-english-log-app.firebaseapp.com",
  projectId: "my-english-log-app",
  storageBucket: "my-english-log-app.firebasestorage.app",
  messagingSenderId: "693893816448",
  appId: "1:693893816448:web:3c6bfac6dc4dffaa8a0665"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const CATEGORIES = [
  { id: 'Reading', label: '読む', icon: <BookOpen size={16}/>, color: '#3b82f6' },
  { id: 'Listening', label: '聞く', icon: <Headphones size={16}/>, color: '#10b981' },
  { id: 'Speaking', label: '話す', icon: <MessageCircle size={16}/>, color: '#f43f5e' },
  { id: 'Writing', label: '書く', icon: <PenTool size={16}/>, color: '#f59e0b' },
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
  const [minutes, setMinutes] = useState(30);
  const [selectedCats, setSelectedCats] = useState([]);
  const [speakingType, setSpeakingType] = useState(''); 
  const [content, setContent] = useState('');
  const [reflection, setReflection] = useState('');
  const [quality, setQuality] = useState(80);
  const [date, setDate] = useState(getLocalDateString(new Date()));
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);

  const [showPraise, setShowPraise] = useState(false);
  const [praiseText, setPraiseText] = useState("");

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    onAuthStateChanged(auth, async (u) => { if (!u) await signInAnonymously(auth); else setUser(u); });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'logs'), where('uid', '==', user.uid), orderBy('timestamp', 'desc'));
    onSnapshot(q, (s) => setLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    getDoc(doc(db, 'profile', user.uid)).then(async d => {
      let currentProfile = d.exists() ? d.data() : {};
      const todayStr = getLocalDateString(new Date());
      
      if (!currentProfile.eikenDate || currentProfile.eikenDate < todayStr) {
        const nextDate = await fetchNextEikenDate();
        if (nextDate) {
          currentProfile.eikenDate = nextDate;
          setDoc(doc(db, 'profile', user.uid), currentProfile, { merge: true });
        }
      }
      setProfile(p => ({...p, ...currentProfile}));
    });
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

  const handleProfileUpdate = (field, value) => {
    const newProfile = { ...profile, [field]: value };
    setProfile(newProfile);
    if (user) setDoc(doc(db, 'profile', user.uid), newProfile);
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!auth.currentUser || !minutes || selectedCats.length === 0) return;
    
    const logData = { 
      uid: auth.currentUser.uid, 
      date, 
      minutes: Number(minutes), 
      categories: selectedCats, 
      content, 
      reflection, 
      quality: Number(quality), 
      timestamp: Date.now() 
    };
    
    if (selectedCats.includes('Speaking') && speakingType) {
      logData.speakingType = speakingType;
    }
    
    await addDoc(collection(db, 'logs'), logData);
    
    setMinutes(30); setSelectedCats([]); setSpeakingType(''); setContent(''); setReflection(''); setQuality(80); 
    
    setPraiseText(PRAISE_MESSAGES[Math.floor(Math.random() * PRAISE_MESSAGES.length)]);
    setShowPraise(true);
    setTimeout(() => {
      setShowPraise(false);
    }, 2500);
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

  // --- アップデート箇所：学習時間と集中度を分析するAIフィードバック ---
  const aiFeedbackMessage = useMemo(() => {
    if (!logs || logs.length === 0) return '学習データを蓄積すると分析が表示されます。';

    // 直近7日間のデータを取得して分析
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

    // 時間と集中度のバランスに基づくフィードバック
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
  const todayYear = todayDate.getFullYear();
  const todayMonthDay = todayDate.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' });

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

      <header style={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row', 
        justifyContent: 'flex-start', 
        alignItems: isMobile ? 'flex-start' : 'center', 
        gap: isMobile ? '20px' : '30px', 
        marginBottom: '40px' 
      }}>
        <div style={{ borderLeft: '5px solid #4f46e5', paddingLeft: '20px', flexShrink: 0 }}>
          <h1 style={{ fontSize: '32px', fontWeight: '900', color: '#1e293b', margin: 0 }}>ENGLISH LEARNING<br /><span style={{ color: '#4f46e5' }}>PORTFOLIO</span></h1>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '10px', flex: 1, width: '100%' }}>
          <div style={{ background: 'white', padding: '10px', borderRadius: '18px', border: '1px solid #4f46e522', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '10px', fontWeight: '900', color: '#4f46e5', marginBottom: '4px' }}>TODAY</div>
            <div style={{ fontSize: '10px', fontWeight: '900', color: '#1e293b', opacity: 0.6 }}>{todayYear}</div>
            <div style={{ fontSize: '12px', fontWeight: '900', color: '#4f46e5' }}>{todayMonthDay}</div>
          </div>

          {['eiken', 'other', 'other2'].map(k => {
            const color = k === 'eiken' ? '#ef4444' : k === 'other' ? '#f59e0b' : '#3b82f6';
            const days = profile[`${k}Date`] ? Math.ceil((new Date(profile[`${k}Date`]) - new Date().setHours(0,0,0,0)) / 86400000) : null;
            return (
              <div key={k} style={{ background: 'white', padding: '10px', borderRadius: '18px', border: `1px solid ${color}22`, textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                <div style={{ fontSize: '10px', fontWeight: '900', color }}>
                  {k === 'eiken' ? '英検' : (
                    <input style={{ border: 'none', background: 'transparent', width: '100%', fontSize: '10px', fontWeight: '900', color, textAlign: 'center', outline: 'none' }} value={profile[`${k}Name`] || ''} onChange={e => handleProfileUpdate(`${k}Name`, e.target.value)} placeholder="OTHER" />
                  )}
                </div>
                <input type="date" style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', fontSize: '10px', margin: '4px 0' }} value={profile[`${k}Date`] || ''} onChange={e => handleProfileUpdate(`${k}Date`, e.target.value)} />
                {days !== null ? (
                  <div style={{ fontSize: '16px', fontWeight: '900', color: '#1e293b' }}>
                    <span style={{ fontSize: '10px' }}>あと</span>{days}<span style={{ fontSize: '10px' }}>日</span>
                  </div>
                ) : (
                  <div style={{ fontSize: '10px', color: '#cbd5e1', fontWeight: '900' }}>未設定</div>
                )}
              </div>
            );
          })}
        </div>
      </header>

      <section style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '30px' }}>
          <h2 style={{ ...headerStyle, margin: 0 }}><User size={18} color="#4f46e5" /> 学習者情報・目標</h2>
          
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto' }}>
            <input style={{ ...inputStyle, width: '60px', padding: '8px 10px', fontSize: '12px' }} value={profile.grade || ''} onChange={e => handleProfileUpdate('grade', e.target.value)} placeholder="学年" />
            <span style={{ fontSize: '12px', fontWeight: '900', color: '#94a3b8' }}>年</span>
            <input style={{ ...inputStyle, width: '60px', padding: '8px 10px', fontSize: '12px' }} value={profile.classNum || ''} onChange={e => handleProfileUpdate('classNum', e.target.value)} placeholder="組" />
            <span style={{ fontSize: '12px', fontWeight: '900', color: '#94a3b8' }}>組</span>
            <input style={{ ...inputStyle, width: '60px', padding: '8px 10px', fontSize: '12px' }} value={profile.studentNum || ''} onChange={e => handleProfileUpdate('studentNum', e.target.value)} placeholder="番号" />
            <span style={{ fontSize: '12px', fontWeight: '900', color: '#94a3b8' }}>番</span>
            <input style={{ ...inputStyle, width: '120px', padding: '8px 10px', fontSize: '12px' }} value={profile.name || ''} onChange={e => handleProfileUpdate('name', e.target.value)} placeholder="名前" />
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', width: '100%' }}>
          <label style={{ ...labelStyle, marginBottom: 0, whiteSpace: 'nowrap' }}>目標</label>
          <input style={{ ...inputStyle, flex: 1 }} value={profile.goal || ''} onChange={e => handleProfileUpdate('goal', e.target.value)} placeholder="達成したい目標を入力" />
        </div>
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
              {CATEGORIES.map(cat => (
                <button key={cat.id} type="button" onClick={() => {
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

          <button onClick={handleSave} style={{ alignSelf: isMobile ? 'flex-end' : 'auto', padding: '8px 16px', background: '#4f46e5', color: 'white', borderRadius: '10px', fontWeight: '900', border: 'none', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <Send size={14} /> 登録
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            
            <div>
              <label style={{ ...labelStyle, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                  <Clock size={12} color="#94a3b8" /> 学習時間
                </span>
                <span style={{ fontWeight: 'bold', color: '#cbd5e1', marginLeft: '4px' }}>
                  ※ポモドーロを活用すると効果的です
                </span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ fontSize: '24px', fontWeight: '900', whiteSpace: 'nowrap', minWidth: '70px' }}>
                  {minutes}<span style={unitSmallStyle}>分</span>
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
                  ※学習において集中力は非常に大切です
                </span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ fontSize: '24px', fontWeight: '900', whiteSpace: 'nowrap', minWidth: '70px' }}>
                  {quality}<span style={unitSmallStyle}>%</span>
                </div>
                <input type="range" min="0" max="100" style={{ width: '100%', accentColor: getSliderColor(quality, 100), cursor: 'pointer' }} value={quality} onChange={e => setQuality(e.target.value)} />
              </div>
            </div>

          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '4fr 6fr', gap: '15px' }}>
            <div>
              <label style={{ ...labelStyle, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                  学習内容
                </span>
                <span style={{ fontWeight: 'bold', color: '#cbd5e1', marginLeft: '4px' }}>
                  ※具体的に書くことで振り返りの質が高まります
                </span>
              </label>
              <textarea style={{ ...inputStyle, height: '100px' }} value={content} onChange={e => setContent(e.target.value)} placeholder="例：&#10;・英検長文問題演習" />
            </div>
            
            <div>
              <label style={{ ...labelStyle, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                  内省
                </span>
                <span style={{ fontWeight: 'bold', color: '#cbd5e1', marginLeft: '4px' }}>
                  ※自分の課題や成長に気づく重要なステップです
                </span>
              </label>
              <textarea style={{ ...inputStyle, height: '100px' }} value={reflection} onChange={e => setReflection(e.target.value)} placeholder="例：&#10;・語彙不足を実感" />
            </div>
          </div>
        </form>
      </section>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '15px', justifyContent: 'center' }}>
        {['day', 'week', 'month', 'year'].map(r => (<button key={r} onClick={() => setSelectedRange(r)} style={tabStyle(r)}>{r.toUpperCase()}</button>))}
      </div>

      <section style={cardStyle}>
        <h2 style={{ ...headerStyle, marginBottom: '20px' }}><Zap size={18} color="#4f46e5" /> 学習状況</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '40px' }}>
            <div style={{ textAlign: 'center' }}>
              <h2 style={labelStyle}><Clock size={12} style={{marginRight:4}}/>学習時間</h2>
              <div style={{ fontSize: '42px', fontWeight: '900', color: '#000' }}>
                {formatMinutes(stats.total)}<span style={{ fontSize: '16px' }}>{getUnit(stats.total)}</span>
              </div>
            </div>
            <div style={{ textAlign: 'center', borderLeft: '1px solid #f1f5f9', paddingLeft: '40px' }}>
              <h2 style={labelStyle}><Zap size={12} style={{marginRight:4}}/>継続</h2>
              <div style={{ fontSize: '42px', fontWeight: '900', color: '#000' }}>
                {stats.streak}<span style={{ fontSize: '16px' }}>日</span>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, paddingLeft: '40px', borderLeft: '1px solid #f1f5f9', minHeight: '60px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '900', color: '#4f46e5', marginBottom: '8px' }}>AIフィードバック</h2>
            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6, fontWeight: 'bold' }}>
              <Sparkles size={14} color="#4f46e5" style={{display:'inline', marginRight:6, verticalAlign:'text-bottom'}} />
              {aiFeedbackMessage}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '25px', paddingTop: '20px', borderTop: '1px dashed #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '28px' }}>🏔️</span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '900', color: '#1e293b' }}>
                  立山登頂チャレンジ <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>(標高3,015m)</span>
                  {Math.floor(stats.total / 60) >= 3015 && <span style={{ color: '#ef4444', marginLeft: '6px' }}>🎉 登頂達成！</span>}
                </div>
                <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#94a3b8', marginTop: '2px' }}>1時間の学習で1歩（1m）進む！</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '24px', fontWeight: '900', color: '#10b981' }}>{Math.floor(stats.total / 60)}</span>
              <span style={{ fontSize: '12px', fontWeight: '900', color: '#94a3b8' }}> / 3,015歩</span>
            </div>
          </div>
          
          <div style={{ position: 'relative', width: '100%' }}>
            <div style={{ position: 'absolute', right: '-4px', top: '-18px', fontSize: '18px', zIndex: 1, opacity: 0.8 }}>🗻</div>
            
            <div style={{ 
              position: 'absolute', 
              left: `calc(${Math.min((stats.total / 60 / 3015) * 100, 100)}% - 8px)`, 
              top: '-16px', 
              fontSize: '16px', 
              transition: 'left 1s ease-out', 
              zIndex: 2,
              filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.2))'
            }}>
              {Math.floor(stats.total / 60) >= 3015 ? '🚩' : '🧗'}
            </div>

            <div style={{ width: '100%', height: '14px', backgroundColor: '#f1f5f9', borderRadius: '7px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min((stats.total / 60 / 3015) * 100, 100)}%`, height: '100%', backgroundColor: '#10b981', transition: 'width 1s ease-out', borderRadius: '7px' }}></div>
            </div>
          </div>
        </div>
      </section>

      <section style={cardStyle} key={selectedRange}>
        <h2 style={{ ...headerStyle, marginBottom: '20px' }}><Activity size={18} color="#4f46e5" /> 学習傾向の分析</h2>
        
        <div style={{ height: selectedRange === 'day' && isMobile ? 'auto' : '280px', minHeight: '280px', width: '100%' }}>
          {selectedRange === 'day' ? (
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', width: '100%', height: '100%', alignItems: 'center' }}>
              
              <div style={{ flex: 1, width: '100%', height: isMobile ? '280px' : '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={isDayEmpty ? 0 : 5} dataKey="value" stroke="none">
                      {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    {!isDayEmpty && <Tooltip formatter={(value) => `${formatMinutes(value)}${getUnit(value)}`} />}
                    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 24, fontWeight: 900, fill: '#1e293b' }}>
                      {formatMinutes(stats.total)}<tspan dx="2" style={unitSmallStyle}>{getUnit(stats.total)}</tspan>
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div style={{ 
                flex: 1, 
                width: '100%', 
                padding: isMobile ? '10px 0 0 0' : '0 0 0 20px', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center', 
                gap: '10px' 
              }}>
                <div style={{ fontSize: '12px', fontWeight: '900', color: '#1e293b', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={14} color="#4f46e5" /> スキル別 AIアドバイス
                </div>
                {/* --- アップデート箇所：各技能に特化した学習法略のAIフィードバック --- */}
                {CATEGORIES.map(cat => {
                  const t = stats.skillMap[cat.id] || 0;
                  let msg = '本日は未実施です。少しでも触れてみましょう！';

                  if (t > 0) {
                    if (cat.id === 'Reading') msg = '【読解のコツ】時間を計って読む「速読」と、文構造を意識する「精読」をバランス良く取り入れましょう📖';
                    else if (cat.id === 'Listening') msg = '【聴解のコツ】聞き流しだけでなく、聞こえた音を書き取るディクテーションやシャドーイングが効果的です🎧';
                    else if (cat.id === 'Speaking') msg = '【発話のコツ】学んだ表現を使って独り言を言ったり、実際の会話で積極的にアウトプットしましょう🗣️';
                    else if (cat.id === 'Writing') msg = '【記述のコツ】まずは短い英語日記から。知っている単語を駆使して、毎日書く習慣をつけるのが鍵です✍️';
                  }
                  
                  return (
                    <div key={cat.id} style={{ backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '12px', borderLeft: `4px solid ${cat.color}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '900', color: cat.color }}>{cat.label}</div>
                        <div style={{ fontSize: '11px', fontWeight: '900', color: '#1e293b' }}>
                          {formatMinutes(t)}<span style={{ fontSize: '9px', marginLeft: '1px' }}>{getUnit(t)}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', lineHeight: 1.4 }}>
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
              backgroundImage: 'linear-gradient(90deg, transparent 16px, #fda4af 16px, #fda4af 17px, transparent 17px), repeating-linear-gradient(transparent, transparent 27px, #e2e8f0 27px, #e2e8f0 28px)',
              backgroundSize: '100% 100%, 100% 28px',
              backgroundPosition: '0 0, 0 8px',
              borderRadius: '16px', 
              border: '1px solid #f1f5f9' 
            }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '900', marginBottom: '8px' }}>{log.date}</div>
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          
          <div style={{ animation: 'popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards', background: 'white', padding: '30px 50px', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', textAlign: 'center', border: '4px solid #4f46e5' }}>
            <div style={{ fontSize: '48px', marginBottom: '8px' }}>🌟</div>
            <div style={{ fontSize: '28px', fontWeight: '900', color: '#4f46e5' }}>{praiseText}</div>
            <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 'bold', marginTop: '10px' }}>保存完了！学習記録が追加されました</div>
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
    </div>
  );
}