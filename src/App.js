import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { onAuthStateChanged, signInWithPopup, linkWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Activity, BookOpen, User, Calendar, Star } from 'lucide-react';

import { auth, db, provider } from './firebase';
import { getLocalDateString, PRAISE_MESSAGES } from './constants';
import { useLogs } from './hooks/useLogs';

import Timer     from './components/Timer';
import LogForm   from './components/LogForm';
import Dashboard from './components/Dashboard';
import LogList   from './components/LogList';
import './App.css';

/* -------------------------------------------------------
   英検試験日取得
------------------------------------------------------- */
const fetchNextEikenDate = async () => {
  const schedule = ['2026-06-07', '2026-10-04', '2027-01-24', '2027-06-06'];
  const today    = getLocalDateString(new Date());
  return schedule.find(d => d >= today) || '';
};

/* -------------------------------------------------------
   App
------------------------------------------------------- */
export default function App() {
  const [user,           setUser]           = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [profile,        setProfile]        = useState({ name: '', eikenDate: '', otherDate: '', otherName: '', weeklyGoal: '' });
  const [selectedRange,  setSelectedRange]  = useState('day');
  const [date,           setDate]           = useState(getLocalDateString(new Date()));
  const [isMobile,       setIsMobile]       = useState(window.innerWidth <= 768);

  /* --- form state --- */
  const [minutes,      setMinutes]      = useState(25);
  const [selectedCats, setSelectedCats] = useState([]);
  const [speakingType, setSpeakingType] = useState('');
  const [reflection,   setReflection]   = useState('');
  const [quality,      setQuality]      = useState(80);
  const [editingLogId, setEditingLogId] = useState(null);

  /* --- praise state --- */
  const [showPraise,   setShowPraise]   = useState(false);
  const [praiseText,   setPraiseText]   = useState('');
  const [praiseSubText,setPraiseSubText]= useState('');

  const formRef = useRef(null);

  /* ----- ログフック ----- */
  const { logs, getFilteredLogs, getTimeStats, streak, saveLog, deleteLog, exportLogs } = useLogs(user);
  const filteredLogs = useMemo(() => getFilteredLogs(date, selectedRange), [getFilteredLogs, date, selectedRange]);
  const timeStats    = useMemo(() => getTimeStats(date), [getTimeStats, date]);

  /* ----- praise helper ----- */
  const showPraiseMsg = useCallback((sub) => {
    setPraiseText(PRAISE_MESSAGES[Math.floor(Math.random() * PRAISE_MESSAGES.length)]);
    setPraiseSubText(sub);
    setShowPraise(true);
    setTimeout(() => setShowPraise(false), 2500);
  }, []);

  /* ----- タイマー完了 → フォームに時間セット & スクロール ----- */
  const handleTimerComplete = useCallback((completedMinutes) => {
    setMinutes(completedMinutes);
    showPraiseMsg('タイマー完了！学習時間を反映しました');
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 600);
  }, [showPraiseMsg]);

  /* ----- resize / auth ----- */
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u || null);
      setIsAuthChecking(false);
    });
    return () => { window.removeEventListener('resize', onResize); unsub(); };
  }, []);

  /* ----- profile 読み込み ----- */
  useEffect(() => {
    if (!user || user.isAnonymous) return;
    getDoc(doc(db, 'profile', user.uid)).then(async snap => {
      let p = snap.exists() ? snap.data() : {};
      const today = getLocalDateString(new Date());
      if (!p.eikenDate || p.eikenDate < today) {
        const next = await fetchNextEikenDate();
        if (next) { p.eikenDate = next; try { await setDoc(doc(db, 'profile', user.uid), p, { merge: true }); } catch {} }
      }
      setProfile(prev => ({ ...prev, ...p }));
    });
  }, [user]);

  /* ----- profile 更新 ----- */
  const handleProfileUpdate = useCallback(async (field, value) => {
    setProfile(prev => {
      const next = { ...prev, [field]: value };
      if (user && !user.isAnonymous) {
        setDoc(doc(db, 'profile', user.uid), next).catch(() => {});
      }
      return next;
    });
  }, [user]);

  /* ----- auth ----- */
  const handleGoogleLogin = async () => {
    try {
      if (auth.currentUser?.isAnonymous) await linkWithPopup(auth.currentUser, provider);
      else                                await signInWithPopup(auth, provider);
      window.location.reload();
    } catch (err) {
      if (['auth/credential-already-in-use', 'auth/email-already-in-use'].includes(err.code)) {
        try { await signInWithPopup(auth, provider); window.location.reload(); } catch {}
      }
    }
  };
  const handleLogout = () => signOut(auth);

  /* ----- form ----- */
  const resetForm = useCallback(() => {
    setEditingLogId(null); setMinutes(25); setSelectedCats([]);
    setSpeakingType(''); setReflection(''); setQuality(80);
    setDate(getLocalDateString(new Date()));
  }, []);

  const handleSave = useCallback(async () => {
    if (!auth.currentUser || !minutes || selectedCats.length === 0) return;
    const logData = {
      date, minutes: Number(minutes), categories: selectedCats,
      reflection, quality: Number(quality),
      speakingType: selectedCats.includes('Speaking') && speakingType ? speakingType : null,
    };
    try {
      await saveLog(auth.currentUser.uid, logData, editingLogId);
      resetForm();
      showPraiseMsg('保存完了！学習記録が追加されました');
    } catch {
      alert('学習記録の保存に失敗しました。通信環境を確認してください。');
    }
  }, [date, minutes, selectedCats, reflection, quality, speakingType, editingLogId, saveLog, resetForm, showPraiseMsg]);

  const handleEdit = useCallback((log) => {
    setEditingLogId(log.id); setDate(log.date); setMinutes(log.minutes);
    setSelectedCats(log.categories || []); setSpeakingType(log.speakingType || '');
    setReflection(log.reflection || log.content || ''); setQuality(log.quality || 80);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleDelete = useCallback(async (logId) => {
    if (!window.confirm('この学習記録を削除してもよろしいですか？')) return;
    try {
      await deleteLog(logId);
      if (editingLogId === logId) resetForm();
    } catch {}
  }, [editingLogId, deleteLog, resetForm]);

  const handleCopyRecent = useCallback(() => {
    if (!logs.length) return;
    const l = logs[0];
    setMinutes(l.minutes || 25); setSelectedCats(l.categories || []);
    setSpeakingType(l.speakingType || ''); setReflection(l.reflection || l.content || '');
    setQuality(l.quality || 80);
  }, [logs]);

  /* ----- render guards ----- */
  const today = new Date();
  const todayJP = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;

  if (isAuthChecking) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f4f7fa' }}>
      <div style={{ color: '#4f46e5', fontWeight: 'bold', fontSize: '20px' }}>Loading...</div>
    </div>
  );

  if (!user || user.isAnonymous) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f4f7fa', fontFamily: 'sans-serif' }}>
      <div style={{ background: 'white', padding: '40px', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '400px', width: '90%' }}>
        <div style={{ background: '#e0e7ff', width: '60px', height: '60px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <BookOpen size={32} color="#4f46e5"/>
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#1e293b', margin: '0 0 10px 0' }}>BLUEPRINT LOG</h1>
        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '30px', fontWeight: 'bold', lineHeight: '1.6' }}>
          英単語アプリと学習データを同期するため、<br/>Googleアカウントでログインしてください。
        </p>
        <button onClick={handleGoogleLogin} className="action-btn"
          style={{ width: '100%', padding: '16px', borderRadius: '12px', background: '#4f46e5', color: 'white', fontWeight: '900', border: 'none', cursor: 'pointer', fontSize: '16px', boxShadow: '0 4px 15px rgba(79,70,229,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <User size={20}/> Googleでログイン
        </button>
      </div>
    </div>
  );

  /* ----- main render ----- */
  return (
    <div style={{ maxWidth: '950px', margin: '0 auto', padding: isMobile ? '20px 10px' : '30px 20px', backgroundColor: '#f4f7fa', minHeight: '100vh', fontFamily: 'sans-serif', boxSizing: 'border-box', overflowX: 'hidden' }}>

      {/* ===== ヘッダー ===== */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', background: 'linear-gradient(135deg,#4f46e5,#0ea5e9)', borderRadius: '12px', boxShadow: '0 4px 12px rgba(79,70,229,0.3)' }}>
            <Activity size={24} color="white"/>
          </div>
          <div>
            <h1 style={{ margin: 0, fontFamily: 'Syne,sans-serif', fontSize: '28px', fontWeight: 800, letterSpacing: '-0.06em', background: 'linear-gradient(90deg,#111827,#4f46e5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              BLUEPRINT LOG
            </h1>
            <div style={{ fontFamily: 'Syne,sans-serif', fontSize: '9px', color: '#64748b', fontWeight: 700, letterSpacing: '0.2em', marginTop: '-2px' }}>STRATEGIC LEARNING PLATFORM</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="action-btn" onClick={() => window.open('https://voca.english-t24.com', '_blank')}
            style={{ padding: '8px 12px', background: 'white', color: '#4f46e5', border: '1px solid #e0e7ff', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <BookOpen size={14}/> 単語アプリへ
          </button>
          <button className="action-btn" onClick={() => window.open('https://english-t24.com', '_blank')}
            style={{ padding: '8px 12px', background: 'white', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
            ブログへ
          </button>
          <div style={{ width: '1px', height: '20px', background: '#cbd5e1', margin: '0 2px' }}/>
          <button className="action-btn" onClick={handleLogout}
            style={{ padding: '8px 12px', borderRadius: '10px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
            ログアウト
          </button>
        </div>
      </div>

      {/* ===== プロフィールバー ===== */}
      <div className="profile-dashboard-bar" style={{ marginBottom: '25px', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', padding: isMobile ? '12px' : '12px 20px' }}>
        <div style={{ display: 'flex', width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-start', alignItems: 'center' }}>
          <div className="profile-item" style={{ flexShrink: 0 }}>
            <Calendar size={16}/> <span style={{ fontFamily: 'Inter,sans-serif' }}>{todayJP}</span>
          </div>
          {!isMobile && <div style={{ width: '1px', height: '16px', background: '#e2e8f0', margin: '0 8px' }}/>}
          <div className="profile-item" style={{ flexShrink: 0 }}>
            <User size={16}/>
            <input className="clean-input" value={profile.name || ''} onChange={e => handleProfileUpdate('name', e.target.value)}
              placeholder="氏名" style={{ width: isMobile ? '70px' : '80px', textAlign: isMobile ? 'right' : 'left' }}/>
          </div>
        </div>
        {isMobile && <div style={{ width: '100%', height: '1px', background: '#f1f5f9' }}/>}
        {!isMobile && <div style={{ width: '1px', height: '16px', background: '#e2e8f0', margin: '0 4px' }}/>}
        <div className="profile-item exam-item-container" style={{ width: isMobile ? '100%' : 'auto', padding: isMobile ? '8px' : '6px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: '1 1 auto', minWidth: '100px' }}>
            <Star size={16} color="#f59e0b"/>
            <input className="clean-input exam-name-input modern-input" value={profile.otherName || ''} onChange={e => handleProfileUpdate('otherName', e.target.value)}
              placeholder="試験名を入力" style={{ fontSize: isMobile ? '13px' : '14px' }}/>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <input type="date" className="clean-input exam-date modern-input" value={profile.otherDate || ''} onChange={e => handleProfileUpdate('otherDate', e.target.value)}/>
            {profile.otherDate && (
              <div className="exam-countdown" style={{ padding: '2px 8px' }}>
                <span className="small-text">あと</span>
                <span className="countdown-number" style={{ fontSize: isMobile ? '16px' : '18px' }}>
                  {Math.round((new Date(profile.otherDate + 'T00:00:00').getTime() - new Date().setHours(0,0,0,0)) / 86400000)}
                </span>
                <span className="small-text">日</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== コンポーネント群 ===== */}
      <Timer isMobile={isMobile} onTimerComplete={handleTimerComplete}/>

      <LogForm
        isMobile={isMobile}
        logs={logs}
        date={date}             setDate={setDate}
        minutes={minutes}       setMinutes={setMinutes}
        selectedCats={selectedCats} setSelectedCats={setSelectedCats}
        speakingType={speakingType} setSpeakingType={setSpeakingType}
        reflection={reflection} setReflection={setReflection}
        quality={quality}       setQuality={setQuality}
        editingLogId={editingLogId}
        onSave={handleSave}
        onCopyRecent={handleCopyRecent}
        onCancel={resetForm}
        formRef={formRef}
      />

      <Dashboard
        isMobile={isMobile}
        logs={logs}
        selectedRange={selectedRange} setSelectedRange={setSelectedRange}
        date={date}
        timeStats={timeStats}
        streak={streak}
        profile={profile}
        onProfileUpdate={handleProfileUpdate}
      />

      <LogList
        isMobile={isMobile}
        filteredLogs={filteredLogs}
        selectedRange={selectedRange}
        date={date} setDate={setDate}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onExport={exportLogs}
      />

      <footer style={{ textAlign: 'center', padding: '40px 0', color: '#cbd5e1', fontSize: '10px', fontWeight: 'bold', fontFamily: 'Syne,sans-serif', letterSpacing: '0.1em' }}>
        BLUEPRINT LOG © 2026
      </footer>

      {/* ===== Praiseオーバーレイ ===== */}
      {showPraise && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <div style={{ animation: 'popIn 0.5s cubic-bezier(0.175,0.885,0.32,1.275) forwards', background: 'white', padding: '30px 50px', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', textAlign: 'center', border: '4px solid #4f46e5' }}>
            <div style={{ fontSize: '48px', marginBottom: '8px' }}>🌟</div>
            <div style={{ fontSize: '28px', fontWeight: '900', color: '#4f46e5' }}>{praiseText}</div>
            <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 'bold', marginTop: '10px' }}>{praiseSubText}</div>
          </div>
          {[...Array(40)].map((_, i) => {
            const colors = ['#f43f5e','#3b82f6','#10b981','#f59e0b','#8b5cf6'];
            return (
              <div key={i} style={{
                position: 'absolute', top: '-20px',
                left: `${Math.random() * 100}%`,
                width: '12px', height: '12px',
                backgroundColor: colors[Math.floor(Math.random() * colors.length)],
                borderRadius: Math.random() > 0.5 ? '50%' : '0',
                animation: `confettiFall ${1.5 + Math.random() * 2}s linear ${Math.random() * 0.5}s forwards`,
              }}/>
            );
          })}
        </div>
      )}
    </div>
  );
}