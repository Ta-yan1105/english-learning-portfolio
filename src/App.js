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

export default function App() {
  const [user, setUser] = useState(null);
  const [logs, setLogs] = useState([]);
  const [profile, setProfile] = useState({ name: '', goal: '', toeicDate: '', eikenDate: '', otherDate: '', otherName: '' });
  const [selectedRange, setSelectedRange] = useState('day');
  const [minutes, setMinutes] = useState(30);
  const [selectedCats, setSelectedCats] = useState([]);
  const [content, setContent] = useState('');
  const [reflection, setReflection] = useState('');
  const [quality, setQuality] = useState(80);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);

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
    getDoc(doc(db, 'profile', user.uid)).then(d => d.exists() && setProfile(p => ({...p, ...d.data()})));
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
        const dayTotal = logs.filter(l => l.date === d.toISOString().split('T')[0]).reduce((acc, curr) => acc + (Number(curr.minutes) || 0), 0);
        return { name: label, value: dayTotal };
      });
    }
    if (selectedRange === 'month') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const targetYear = new Date(date + "T00:00:00").getFullYear();
      return months.map((label, i) => {
        const monthTotal = logs.filter(l => { const d = new Date(l.date + "T00:00:00"); return d.getFullYear() === targetYear && d.getMonth() === i; }).reduce((acc, curr) => acc + (Number(curr.minutes) || 0), 0);
        return { name: label, value: monthTotal };
      });
    }
    if (selectedRange === 'year') {
      const years = [2026, 2027, 2028, 2029, 2030, 2031];
      return years.map(y => {
        const yearTotal = logs.filter(l => new Date(l.date + "T00:00:00").getFullYear() === y).reduce((acc, curr) => acc + (Number(curr.minutes) || 0), 0);
        return { name: y.toString(), value: yearTotal };
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
    await addDoc(collection(db, 'logs'), { uid: auth.currentUser.uid, date, minutes: Number(minutes), categories: selectedCats, content, reflection, quality: Number(quality), timestamp: Date.now() });
    setMinutes(30); setSelectedCats([]); setContent(''); setReflection(''); setQuality(80); alert("保存完了！");
  };

  const handleExport = (format) => {
    const header = "Date,Skill,Content,Reflection,Duration,Quality\n";
    const csvContent = filteredLogs.map(log => `${log.date},${(log.categories || []).join("/")},"${(log.content || "").replace(/"/g, '""')}","${(log.reflection || "").replace(/"/g, '""')}",${log.minutes},${log.quality}%`).join("\n");
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), header, csvContent], { type: "text/csv" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `learning_log_${format}.csv`; link.click();
  };

  const cardStyle = { background: 'white', borderRadius: '24px', padding: '25px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' };
  const inputStyle = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #f1f5f9', background: '#f8fafc', fontWeight: 'bold', boxSizing: 'border-box', outline: 'none' };
  const labelStyle = { fontSize: '11px', fontWeight: '900', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' };
  const tabStyle = (r) => ({ padding: '8px 16px', borderRadius: '10px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', border: 'none', backgroundColor: selectedRange === r ? '#4f46e5' : '#f1f5f9', color: selectedRange === r ? 'white' : '#94a3b8' });

  const topSkillId = Object.entries(stats.skillMap).sort((a,b)=>b[1]-a[1])[0]?.[0] || '';
  const topSkillLabel = CATEGORIES.find(c => c.id === topSkillId)?.label || 'なし';

  const headerStyle = { fontSize: '16px', fontWeight: '900', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' };
  const unitSmallStyle = { fontSize: '14px', fontWeight: '900' };

  // 本日の日付取得用（西暦と月日を分ける）
  const todayDate = new Date();
  const todayYear = todayDate.getFullYear();
  const todayMonthDay = todayDate.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' });

  return (
    <div style={{ maxWidth: '950px', margin: '0 auto', padding: '30px 20px', backgroundColor: '#f4f7fa', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <header style={{ borderLeft: '5px solid #4f46e5', paddingLeft: '20px', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '900', color: '#1e293b', margin: 0 }}>ENGLISH LEARNING<br /><span style={{ color: '#4f46e5' }}>PORTFOLIO</span></h1>
      </header>

      {/* 学習者情報 */}
      <section style={cardStyle}>
        <h2 style={{ ...headerStyle, marginBottom: '20px' }}><User size={18} color="#4f46e5" /> 学習者情報・目標・試験日設定</h2>
        <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', flexWrap: 'wrap' }}>
          <div style={{ flex: '0 0 200px', minWidth: '150px' }}>
            <label style={labelStyle}>あなたの名前</label>
            <input style={inputStyle} value={profile.name} onChange={e => handleProfileUpdate('name', e.target.value)} placeholder="名前" />
          </div>
          <div style={{ flex: '1', minWidth: '250px' }}>
            <label style={labelStyle}>目標</label>
            <input style={inputStyle} value={profile.goal} onChange={e => handleProfileUpdate('goal', e.target.value)} placeholder="達成したい目標を入力" />
          </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '10px' }}>
          {/* 本日の日付：背景色を試験カードと統一 */}
          <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '18px', border: '1px solid #4f46e522', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '10px', fontWeight: '900', color: '#4f46e5', marginBottom: '4px' }}>TODAY</div>
            <div style={{ fontSize: '10px', fontWeight: '900', color: '#1e293b', opacity: 0.6 }}>{todayYear}</div>
            <div style={{ fontSize: '12px', fontWeight: '900', color: '#4f46e5' }}>{todayMonthDay}</div>
          </div>

          {['toeic', 'eiken', 'other'].map(k => {
            const color = k === 'toeic' ? '#3b82f6' : k === 'eiken' ? '#ef4444' : '#f59e0b';
            const days = profile[`${k}Date`] ? Math.ceil((new Date(profile[`${k}Date`]) - new Date().setHours(0,0,0,0)) / 86400000) : null;
            return (
              <div key={k} style={{ background: '#f8fafc', padding: '10px', borderRadius: '18px', border: `1px solid ${color}22`, textAlign: 'center' }}>
                <div style={{ fontSize: '10px', fontWeight: '900', color }}>{k === 'eiken' ? '英検' : k === 'other' ? (<input style={{ border: 'none', background: 'transparent', width: '100%', fontSize: '10px', fontWeight: '900', color, textAlign: 'center', outline: 'none' }} value={profile.otherName} onChange={e => handleProfileUpdate('otherName', e.target.value)} placeholder="OTHER" />) : k.toUpperCase()}</div>
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
      </section>

      {/* 登録セクション */}
      <section style={{ ...cardStyle, border: '2px solid #4f46e5' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={headerStyle}><Clipboard size={18} color="#4f46e5" /> 学習内容を内省する</h2>
          <button onClick={handleSave} style={{ padding: '8px 16px', background: '#4f46e5', color: 'white', borderRadius: '10px', fontWeight: '900', border: 'none', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Send size={14} /> 登録
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => (
            <button key={cat.id} type="button" onClick={() => setSelectedCats(prev => prev.includes(cat.id) ? prev.filter(c => c !== cat.id) : [...prev, cat.id])}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '10px', border: 'none', backgroundColor: selectedCats.includes(cat.id) ? cat.color : '#f1f5f9', color: selectedCats.includes(cat.id) ? 'white' : '#64748b', fontSize: '12px', fontWeight: '900', cursor: 'pointer', transition: 'all 0.2s' }}>
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label style={labelStyle}><Clock size={12} color="#94a3b8" /> 学習時間</label>
              <div style={{ fontSize: '24px', fontWeight: '900', marginBottom: '8px' }}>
                {minutes}<span style={unitSmallStyle}>分</span>
              </div>
              <input type="range" min="1" max="120" style={{ width: '100%' }} value={minutes} onChange={e => setMinutes(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}><Zap size={12} color="#94a3b8" /> 集中度</label>
              <div style={{ fontSize: '24px', fontWeight: '900', marginBottom: '8px' }}>
                {quality}<span style={unitSmallStyle}>%</span>
              </div>
              <input type="range" min="0" max="100" style={{ width: '100%' }} value={quality} onChange={e => setQuality(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '4fr 6fr', gap: '15px' }}>
            <div>
              <label style={labelStyle}>勉強内容</label>
              <textarea style={{ ...inputStyle, height: '100px' }} value={content} onChange={e => setContent(e.target.value)} placeholder="例：&#10;・英検長文問題演習" />
            </div>
            <div>
              <label style={labelStyle}>内省</label>
              <textarea style={{ ...inputStyle, height: '100px' }} value={reflection} onChange={e => setReflection(e.target.value)} placeholder="例：&#10;・語彙不足を実感" />
            </div>
          </div>
        </form>
      </section>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '15px', justifyContent: 'center' }}>
        {['day', 'week', 'month', 'year'].map(r => (<button key={r} onClick={() => setSelectedRange(r)} style={tabStyle(r)}>{r.toUpperCase()}</button>))}
      </div>

      {/* 学習状況 */}
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
              {topSkillLabel !== 'なし' ? `${topSkillLabel}に重点を置いて学習できています.` : '学習データを蓄積すると分析が表示されます。'}
            </div>
          </div>
        </div>
      </section>

      {/* 学習傾向の分析 */}
      <section style={cardStyle} key={selectedRange}>
        <h2 style={{ ...headerStyle, marginBottom: '20px' }}><Activity size={18} color="#4f46e5" /> 学習傾向の分析</h2>
        <div style={{ height: '280px', width: '100%' }}>
          {dashboardChartData.length > 0 && dashboardChartData.some(d => d.value > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              {selectedRange === 'day' ? (
                <PieChart>
                  <Pie data={dashboardChartData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value">
                    {dashboardChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(value) => `${formatMinutes(value)}${getUnit(value)}`} />
                  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 24, fontWeight: 900, fill: '#1e293b' }}>
                    {formatMinutes(stats.total)}<tspan dx="2" style={unitSmallStyle}>{getUnit(stats.total)}</tspan>
                  </text>
                </PieChart>
              ) : (
                <BarChart data={dashboardChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontWeight: 'bold' }} formatter={(value) => [`${formatMinutes(value)}${getUnit(value)}`, '学習時間']} />
                  <Bar dataKey="value" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={isMobile ? 20 : 30} />
                </BarChart>
              )}
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px', fontWeight: 'bold' }}>
              データが蓄積されると分析が表示されます
            </div>
          )}
        </div>
      </section>

      {/* 学習ログ一覧 */}
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
            <div key={log.id} style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '900', marginBottom: '8px' }}>{log.date}</div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div style={{ backgroundColor: '#e0e7ff', color: '#4f46e5', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '900', whiteSpace: 'nowrap' }}>{(log.categories || []).join("/")}</div>
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
    </div>
  );
}