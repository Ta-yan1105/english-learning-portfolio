import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  onAuthStateChanged, signInWithPopup, linkWithPopup, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { Activity, BookOpen, User, LogOut, Star, CalendarDays } from 'lucide-react';

import { auth, db, provider } from './firebase';
import { getLocalDateString, PRAISE_MESSAGES } from './constants';
import { useLogs } from './hooks/useLogs';

import Timer      from './components/Timer';
import LogForm    from './components/LogForm';
import Dashboard  from './components/Dashboard';
import LogList    from './components/LogList';
import AdminPanel from './components/AdminPanel';
import './App.css';

const fetchNextEikenDate = async () => {
  const schedule = ['2026-06-07', '2026-10-04', '2027-01-24', '2027-06-06'];
  const today    = getLocalDateString(new Date());
  return schedule.find(d => d >= today) || '';
};

export default function App() {
  const [user,           setUser]           = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [showAdminPanel, setShowAdminPanel] = useState(true);
  const [profile,        setProfile]        = useState({ name: '', eikenDate: '', otherDate: '', otherName: '', weeklyGoal: '' });
  const [selectedRange,  setSelectedRange]  = useState('day');
  const [date,           setDate]           = useState(getLocalDateString(new Date()));
  const [isMobile,       setIsMobile]       = useState(window.innerWidth <= 768);

  const [authMode,    setAuthMode]    = useState('login'); // 'login' | 'signup'
  const [authEmail,   setAuthEmail]   = useState('');
  const [authPass,    setAuthPass]    = useState('');
  const [authError,   setAuthError]   = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [resetSent,   setResetSent]   = useState(false);

  const [formDate,     setFormDate]     = useState(getLocalDateString(new Date()));
  const [minutes,      setMinutes]      = useState(25);
  const [selectedCats, setSelectedCats] = useState([]);
  const [speakingType, setSpeakingType] = useState('');
  const [vocabCount,   setVocabCount]   = useState(0);
  const [reflection,   setReflection]   = useState('');
  const [quality,      setQuality]      = useState(80);
  const [editingLogId, setEditingLogId] = useState(null);

  const [showPraise,    setShowPraise]    = useState(false);
  const [praiseText,    setPraiseText]    = useState('');
  const [praiseSubText, setPraiseSubText] = useState('');

  const formRef = useRef(null);

  const { logs, getFilteredLogs, getTimeStats, streak, saveLog, deleteLog, exportLogs } = useLogs(user);
  const filteredLogs = useMemo(() => getFilteredLogs(date, selectedRange), [getFilteredLogs, date, selectedRange]);
  const timeStats    = useMemo(() => getTimeStats(date), [getTimeStats, date]);

  const handleRangeChange = useCallback((range) => {
    setSelectedRange(range);
    if (range === 'day') setDate(getLocalDateString(new Date()));
  }, []);

  const showPraiseMsg = useCallback((sub) => {
    setPraiseText(PRAISE_MESSAGES[Math.floor(Math.random() * PRAISE_MESSAGES.length)]);
    setPraiseSubText(sub);
    setShowPraise(true);
    setTimeout(() => setShowPraise(false), 2500);
  }, []);

  const handleTimerComplete = useCallback((completedMinutes) => {
    setMinutes(completedMinutes);
    showPraiseMsg('タイマー完了！学習時間を反映しました');
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 600);
  }, [showPraiseMsg]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u || null);
      setIsAuthChecking(false);
    });
    return () => { window.removeEventListener('resize', onResize); unsub(); };
  }, []);

  useEffect(() => {
    if (!user || user.isAnonymous) return;
    getDoc(doc(db, 'profile', user.uid)).then(async snap => {
      let p = snap.exists() ? snap.data() : {};

      // メールをプロフィールに保存
      if (user.email && !p.email) {
        p.email = user.email;
        try { await setDoc(doc(db, 'profile', user.uid), { email: user.email }, { merge: true }); } catch {}
      }

      // 教員からの招待（未ログイン時に予約された分）を適用
      if (user.email && !p.groupId) {
        try {
          const invQ = query(collection(db, 'groupInvites'), where('email', '==', user.email));
          const invSnap = await getDocs(invQ);
          if (!invSnap.empty) {
            const invite = invSnap.docs[0];
            const { groupId } = invite.data();
            p.groupId = groupId;
            await setDoc(doc(db, 'profile', user.uid), { groupId }, { merge: true });
            await deleteDoc(doc(db, 'groupInvites', invite.id));
          }
        } catch {}
      }

      const today = getLocalDateString(new Date());
      if (!p.eikenDate || p.eikenDate < today) {
        const next = await fetchNextEikenDate();
        if (next) { p.eikenDate = next; try { await setDoc(doc(db, 'profile', user.uid), p, { merge: true }); } catch {} }
      }
      setProfile(prev => ({ ...prev, ...p }));
    });
  }, [user]);

  const handleProfileUpdate = useCallback(async (field, value) => {
    setProfile(prev => {
      const next = { ...prev, [field]: value };
      if (user && !user.isAnonymous) {
        setDoc(doc(db, 'profile', user.uid), next).catch(() => {});
      }
      return next;
    });
  }, [user]);

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

  const EMAIL_ERRORS = {
    'auth/invalid-email':       'メールアドレスの形式が正しくありません',
    'auth/user-not-found':      'アカウントが見つかりません',
    'auth/wrong-password':      'パスワードが間違っています',
    'auth/email-already-in-use':'このメールアドレスは既に使用されています',
    'auth/weak-password':       'パスワードは6文字以上にしてください',
    'auth/too-many-requests':   'しばらく時間をおいてから再試行してください',
    'auth/invalid-credential':  'メールアドレスまたはパスワードが正しくありません',
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      if (authMode === 'signup') {
        await createUserWithEmailAndPassword(auth, authEmail, authPass);
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPass);
      }
    } catch (err) {
      setAuthError(EMAIL_ERRORS[err.code] || 'エラーが発生しました。再度お試しください。');
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!authEmail) { setAuthError('メールアドレスを入力してください'); return; }
    try {
      await sendPasswordResetEmail(auth, authEmail);
      setAuthError('');
      setResetSent(true);
    } catch (err) {
      setAuthError(EMAIL_ERRORS[err.code] || 'エラーが発生しました');
    }
  };

  const handleLogout = () => signOut(auth);

  const resetForm = useCallback(() => {
    setEditingLogId(null); setFormDate(getLocalDateString(new Date())); setMinutes(25); setSelectedCats([]);
    setSpeakingType(''); setVocabCount(0); setReflection(''); setQuality(80);
  }, []);

  const handleSave = useCallback(async () => {
    if (!auth.currentUser || !minutes || selectedCats.length === 0) return;
    const logData = {
      date: formDate, minutes: Number(minutes), categories: selectedCats,
      reflection, quality: Number(quality),
      speakingType: selectedCats.includes('Speaking') && speakingType ? speakingType : null,
      vocabCount: selectedCats.includes('Vocabulary') ? Number(vocabCount) : null,
    };
    try {
      await saveLog(auth.currentUser.uid, logData, editingLogId);
      resetForm();
      showPraiseMsg('保存完了！学習記録が追加されました');
    } catch {
      alert('学習記録の保存に失敗しました。通信環境を確認してください。');
    }
  }, [formDate, minutes, selectedCats, reflection, quality, speakingType, vocabCount, editingLogId, saveLog, resetForm, showPraiseMsg]);

  const handleEdit = useCallback((log) => {
    setEditingLogId(log.id); setFormDate(log.date); setMinutes(log.minutes);
    setSelectedCats(log.categories || []); setSpeakingType(log.speakingType || '');
    setVocabCount(log.vocabCount || 0);
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
    setFormDate(getLocalDateString(new Date()));
    setMinutes(l.minutes || 25); setSelectedCats(l.categories || []);
    setSpeakingType(l.speakingType || ''); setVocabCount(l.vocabCount || 0);
    setReflection(l.reflection || l.content || '');
    setQuality(l.quality || 80);
  }, [logs]);

  const today = new Date();
  const todayStr = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;

  const daysLeft = profile.otherDate
    ? Math.round((new Date(profile.otherDate + 'T00:00:00').getTime() - new Date().setHours(0,0,0,0)) / 86400000)
    : null;

  const ADMIN_EMAILS = ['tadashi.nishide@gmail.com', 'nishide.tadashi@as.u-toyama.ac.jp'];
  const isTeacher = user &&
    user.providerData.some(p => p.providerId === 'google.com') &&
    ADMIN_EMAILS.includes(user.email);

  if (isAuthChecking) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f4f7fa' }}>
      <div style={{ color: '#4f46e5', fontWeight: 'bold', fontSize: '20px' }}>Loading...</div>
    </div>
  );

  if (isTeacher && showAdminPanel) return (
    <AdminPanel user={user} onLogout={handleLogout} onGoToApp={() => setShowAdminPanel(false)} isMobile={isMobile}/>
  );

  if (!user || user.isAnonymous) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'linear-gradient(135deg,#f0f4ff 0%,#faf5ff 100%)', fontFamily: 'sans-serif', padding: '20px', boxSizing: 'border-box' }}>
      <div style={{ background: 'white', padding: '40px 36px', borderRadius: '28px', boxShadow: '0 20px 60px rgba(79,70,229,0.12)', textAlign: 'center', maxWidth: '400px', width: '100%' }}>

        {/* ロゴ */}
        <div style={{ background: 'linear-gradient(135deg,#4f46e5,#0ea5e9)', width: '64px', height: '64px', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 8px 24px rgba(79,70,229,0.3)' }}>
          <BookOpen size={32} color="white"/>
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#1e293b', margin: '0 0 4px', letterSpacing: '-0.03em' }}>BLUEPRINT LOG</h1>
        <p style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', letterSpacing: '0.15em', marginBottom: '28px' }}>STRATEGIC LEARNING PLATFORM</p>

        {/* メール/パスワードフォーム */}
        <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="email" value={authEmail} onChange={e => { setAuthEmail(e.target.value); setResetSent(false); }}
            placeholder="メールアドレス" required
            style={{ padding: '13px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '14px', fontWeight: '600', outline: 'none', boxSizing: 'border-box', width: '100%' }}
          />
          {authMode !== 'reset' && (
            <input
              type="password" value={authPass} onChange={e => setAuthPass(e.target.value)}
              placeholder="パスワード（6文字以上）" required
              style={{ padding: '13px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '14px', fontWeight: '600', outline: 'none', boxSizing: 'border-box', width: '100%' }}
            />
          )}

          {/* 成功メッセージ */}
          {resetSent && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', padding: '10px 14px', fontSize: '12px', fontWeight: '700', color: '#16a34a', textAlign: 'left' }}>
              ✅ パスワードリセットメールを送信しました。メールをご確認ください。
            </div>
          )}

          {/* エラーメッセージ */}
          {authError && (
            <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '10px', padding: '10px 14px', fontSize: '12px', fontWeight: '700', color: '#ef4444', textAlign: 'left' }}>
              {authError}
            </div>
          )}

          <button type={authMode === 'reset' ? 'button' : 'submit'}
            onClick={authMode === 'reset' ? handlePasswordReset : undefined}
            disabled={authLoading}
            className="action-btn"
            style={{ padding: '14px', borderRadius: '12px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: 'white', fontWeight: '900', border: 'none', cursor: authLoading ? 'not-allowed' : 'pointer', fontSize: '15px', opacity: authLoading ? 0.7 : 1 }}>
            {authLoading ? '処理中...' : authMode === 'login' ? 'ログイン' : authMode === 'signup' ? 'アカウント作成' : 'リセットメールを送信'}
          </button>
        </form>

        {/* テキストリンク */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '16px', marginBottom: '20px' }}>
          {authMode === 'login' && (
            <>
              <button onClick={() => { setAuthMode('signup'); setAuthError(''); setResetSent(false); }}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '12px', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline' }}>
                新規登録はこちら
              </button>
              <button onClick={() => { setAuthMode('reset'); setAuthError(''); setResetSent(false); }}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '12px', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline' }}>
                パスワードを忘れた方
              </button>
            </>
          )}
          {authMode === 'signup' && (
            <button onClick={() => { setAuthMode('login'); setAuthError(''); setResetSent(false); }}
              style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '12px', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline' }}>
              ログインはこちら
            </button>
          )}
          {authMode === 'reset' && (
            <button onClick={() => { setAuthMode('login'); setAuthError(''); setResetSent(false); }}
              style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '12px', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline' }}>
              ログインに戻る
            </button>
          )}
        </div>

        {/* 区切り */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}/>
          <span style={{ fontSize: '11px', fontWeight: '700', color: '#cbd5e1' }}>または</span>
          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}/>
        </div>

        {/* Google ログイン（先生用） */}
        <button onClick={handleGoogleLogin} className="action-btn"
          style={{ width: '100%', padding: '13px', borderRadius: '12px', background: 'white', color: '#4f46e5', fontWeight: '900', border: '1.5px solid #e0e7ff', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 2px 8px rgba(79,70,229,0.08)' }}>
          <User size={16}/> Googleでログイン（先生用）
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: '950px', margin: '0 auto', padding: isMobile ? '16px 10px' : '24px 20px', backgroundColor: '#f4f7fa', minHeight: '100vh', fontFamily: 'sans-serif', boxSizing: 'border-box', overflowX: 'hidden' }}>

      <style>{`
        @keyframes popIn {
          0%   { transform: scale(0.8); opacity: 0; }
          70%  { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes badgePulse {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.04); }
        }
      `}</style>

      {/* ===== ヘッダー ===== */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '16px', flexWrap: 'wrap', gap: '12px',
      }}>
        {/* ロゴ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '52px', height: '52px',
            background: 'linear-gradient(135deg,#4f46e5,#0ea5e9)',
            borderRadius: '16px',
            boxShadow: '0 6px 20px rgba(79,70,229,0.4)',
            flexShrink: 0,
          }}>
            <Activity size={26} color="white"/>
          </div>
          <div>
            <div style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: isMobile ? '26px' : '32px',
              fontWeight: 900,
              letterSpacing: '-0.05em',
              background: 'linear-gradient(90deg,#4f46e5 0%,#0ea5e9 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: 1.1,
            }}>BLUEPRINT LOG</div>
            {!isMobile && (
              <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.2em', marginTop: '2px' }}>
                STRATEGIC LEARNING PLATFORM
              </div>
            )}
          </div>
        </div>

        {/* ナビ */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="action-btn" onClick={() => window.open('https://english-t24.com/%e5%8d%98%e8%aa%9e%e5%ad%a6%e7%bf%92%e3%82%a2%e3%83%97%e3%83%aa/', '_blank')}
            style={{ padding: isMobile ? '8px 10px' : '8px 14px', background: 'white', color: '#4f46e5', border: '1.5px solid #e0e7ff', borderRadius: '12px', fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', boxShadow: '0 2px 8px rgba(79,70,229,0.08)' }}>
            <BookOpen size={14}/> {isMobile ? '単語' : '単語アプリへ'}
          </button>
          {isTeacher && (
            <button className="action-btn" onClick={() => setShowAdminPanel(true)}
              style={{ padding: isMobile ? '8px 10px' : '8px 14px', background: 'white', color: '#4f46e5', border: '1.5px solid #e0e7ff', borderRadius: '12px', fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Activity size={14}/> {isMobile ? '管理' : '管理画面へ'}
            </button>
          )}
          <button className="action-btn" onClick={handleLogout}
            style={{ padding: isMobile ? '8px 10px' : '8px 14px', background: 'white', color: '#ef4444', border: '1.5px solid #fee2e2', borderRadius: '12px', fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <LogOut size={14}/> {isMobile ? '' : 'ログアウト'}
          </button>
        </div>
      </header>

      {/* ===== プロフィールバー ===== */}
      <div style={{
        background: 'white', borderRadius: '16px',
        padding: isMobile ? '12px 16px' : '14px 20px',
        marginBottom: '20px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        display: 'flex', alignItems: 'center',
        gap: isMobile ? '10px' : '0',
        flexWrap: 'wrap',
        border: '1px solid #f1f5f9',
      }}>
        {/* 日付 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '13px', fontWeight: '700', flexShrink: 0 }}>
          <CalendarDays size={15} color="#94a3b8"/>
          <span>{todayStr}</span>
        </div>

        <div style={{ width: '1px', height: '18px', background: '#e2e8f0', margin: '0 14px', flexShrink: 0, display: isMobile ? 'none' : 'block' }}/>

        {/* 氏名 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <User size={15} color="#94a3b8"/>
          <input
            value={profile.name || ''}
            onChange={e => handleProfileUpdate('name', e.target.value)}
            placeholder="氏名"
            style={{ border: 'none', outline: 'none', fontSize: '13px', fontWeight: '700', color: '#1e293b', background: 'transparent', width: '80px' }}
          />
        </div>

        <div style={{ width: '1px', height: '18px', background: '#e2e8f0', margin: '0 14px', flexShrink: 0, display: isMobile ? 'none' : 'block' }}/>

        {/* 試験情報 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, flexWrap: 'wrap' }}>
          <Star size={15} color="#f59e0b" style={{ flexShrink: 0 }}/>
          <input
            value={profile.otherName || ''}
            onChange={e => handleProfileUpdate('otherName', e.target.value)}
            placeholder="試験名"
            style={{ border: 'none', outline: 'none', fontSize: '13px', fontWeight: '700', color: '#1e293b', background: 'transparent', minWidth: '80px', flex: 1 }}
          />
          <input
            type="date"
            value={profile.otherDate || ''}
            onChange={e => handleProfileUpdate('otherDate', e.target.value)}
            style={{ border: '1px solid #e2e8f0', outline: 'none', fontSize: '12px', fontWeight: '600', color: '#64748b', background: '#f8fafc', borderRadius: '8px', padding: '4px 8px', flexShrink: 0 }}
          />
          {daysLeft !== null && (
            <div style={{
              background: daysLeft <= 7
                ? 'linear-gradient(135deg,#ef4444,#f97316)'
                : daysLeft <= 30
                ? 'linear-gradient(135deg,#f59e0b,#fbbf24)'
                : 'linear-gradient(135deg,#4f46e5,#7c3aed)',
              color: 'white', borderRadius: '12px', padding: '6px 16px',
              flexShrink: 0,
              boxShadow: daysLeft <= 7
                ? '0 4px 14px rgba(239,68,68,0.45)'
                : daysLeft <= 30
                ? '0 4px 14px rgba(245,158,11,0.45)'
                : '0 4px 14px rgba(79,70,229,0.45)',
              display: 'flex', alignItems: 'center', gap: '4px',
              border: '2px solid rgba(255,255,255,0.25)',
              animation: 'badgePulse 2.5s ease-in-out infinite',
            }}>
              <span style={{ fontSize: '11px', opacity: 0.9, fontWeight: '700' }}>あと</span>
              <span className="timer-text" style={{ fontSize: '24px', fontWeight: '900', lineHeight: 1 }}>{daysLeft}</span>
              <span style={{ fontSize: '11px', opacity: 0.9, fontWeight: '700' }}>日</span>
            </div>
          )}
        </div>
      </div>

      {/* ===== コンポーネント群 ===== */}
      <Timer isMobile={isMobile} onTimerComplete={handleTimerComplete}/>

      <LogForm
        isMobile={isMobile}
        logs={logs}
        date={formDate}         setDate={setFormDate}
        minutes={minutes}       setMinutes={setMinutes}
        selectedCats={selectedCats} setSelectedCats={setSelectedCats}
        speakingType={speakingType} setSpeakingType={setSpeakingType}
        vocabCount={vocabCount}     setVocabCount={setVocabCount}
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
        selectedRange={selectedRange} setSelectedRange={handleRangeChange}
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

      <footer style={{ textAlign: 'center', padding: '40px 0 20px', color: '#cbd5e1', fontSize: '10px', fontWeight: '700', fontFamily: 'Syne, sans-serif', letterSpacing: '0.12em' }}>
        BLUEPRINT LOG © 2026
      </footer>

      {/* ===== Praiseオーバーレイ ===== */}
      {showPraise && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <div style={{ animation: 'popIn 0.5s cubic-bezier(0.175,0.885,0.32,1.275) forwards', background: 'white', padding: '30px 50px', borderRadius: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', textAlign: 'center', border: '3px solid #4f46e5' }}>
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
                width: '10px', height: '10px',
                backgroundColor: colors[Math.floor(Math.random() * colors.length)],
                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                animation: `confettiFall ${1.5 + Math.random() * 2}s linear ${Math.random() * 0.5}s forwards`,
              }}/>
            );
          })}
        </div>
      )}
    </div>
  );
}