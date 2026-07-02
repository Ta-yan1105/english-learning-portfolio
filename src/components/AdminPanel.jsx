import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection, addDoc, onSnapshot, query, where, setDoc, doc, deleteDoc, getDocs, updateDoc,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut as fbSignOut } from 'firebase/auth';
import {
  Users, Plus, Upload, LogOut, ChevronDown, ChevronRight,
  Activity, Clock, BookOpen, Trash2, CheckCircle, AlertCircle, UserPlus, Pencil, BookMarked, Download, Globe, ShieldCheck, Ban, ShieldOff, MessageSquare, Send,
} from 'lucide-react';
import { db, secondaryAuth } from '../firebase';
import { CATEGORIES, formatMinutes, getUnit, getLocalDateString } from '../constants';
import i18n from '../i18n';

const today = () => getLocalDateString(new Date());
const weekStart = () => {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const day = d.getDay() || 7;
  if (day !== 1) d.setDate(d.getDate() - day + 1);
  return d;
};
const monthStart = () => {
  const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
};

function calcStats(logs) {
  const t = today(), ws = weekStart(), ms = monthStart();
  let day = 0, week = 0, month = 0, total = 0;
  let vocabDay = 0, vocabWeek = 0, vocabMonth = 0, vocabTotal = 0;
  logs.forEach(l => {
    const m = Number(l.minutes) || 0;
    const v = Number(l.vocabCount) || 0;
    total += m; vocabTotal += v;
    if (l.date === t) { day += m; vocabDay += v; }
    const ld = new Date(l.date + 'T00:00:00');
    if (ld >= ws) { week += m; vocabWeek += v; }
    if (ld >= ms) { month += m; vocabMonth += v; }
  });
  return { day, week, month, total, count: logs.length, vocabDay, vocabWeek, vocabMonth, vocabTotal };
}

export default function AdminPanel({ user, onLogout, onGoToApp, isMobile, lang = 'ja', toggleLang, isSuperAdmin = false }) {
  const T = i18n[lang];
  const [tab, setTab]                 = useState('overview');
  const [groups, setGroups]           = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [students, setStudents]       = useState([]);
  const [allLogs, setAllLogs]         = useState([]);
  const [expandedUid, setExpandedUid] = useState(null);
  const [exportUid, setExportUid]     = useState(null);
  const [exportMonth, setExportMonth] = useState('all');
  const [studentSort, setStudentSort] = useState('recent');
  const [editingStudentUid,  setEditingStudentUid]  = useState(null);
  const [editingStudentName, setEditingStudentName] = useState('');
  const [editingStudentId,   setEditingStudentId]   = useState('');
  const [msgStudentUid, setMsgStudentUid] = useState(null);
  const [msgText,       setMsgText]       = useState('');

  const [newGroupName, setNewGroupName] = useState('');
  const [creating, setCreating]         = useState(false);
  const [editingGroupId, setEditingGroupId]     = useState(null);
  const [editingGroupName, setEditingGroupName] = useState('');

  const [csvText, setCsvText]         = useState('');
  const [csvGroup, setCsvGroup]       = useState('');
  const [importing, setImporting]     = useState(false);
  const [importResult, setImportResult] = useState(null);

  const [addEmail, setAddEmail]       = useState('');
  const [addGroup, setAddGroup]       = useState('');
  const [addStatus, setAddStatus]     = useState(null);
  const [addLoading, setAddLoading]   = useState(false);

  const [addCsvText, setAddCsvText]   = useState('');
  const [addCsvResult, setAddCsvResult] = useState(null);
  const [addCsvLoading, setAddCsvLoading] = useState(false);

  /* 管理者管理 */
  const [teachers, setTeachers]           = useState([]);
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [newTeacherName,  setNewTeacherName]  = useState('');
  const [teacherAdding,   setTeacherAdding]   = useState(false);
  const [teacherMsg,      setTeacherMsg]      = useState(null);

  /* ── グループ一覧 ── */
  useEffect(() => {
    const q = query(collection(db, 'groups'), where('teacherUid', '==', user.uid));
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
      setGroups(list);
      if (!selectedGroup && list.length) setSelectedGroup(list[0]);
    });
  }, [user.uid]);

  /* ── 選択グループの生徒 ── */
  useEffect(() => {
    if (!selectedGroup) { setStudents([]); return; }
    const q = query(collection(db, 'profile'), where('groupId', '==', selectedGroup.id));
    return onSnapshot(q, snap =>
      setStudents(snap.docs.map(d => ({ uid: d.id, ...d.data() })))
    );
  }, [selectedGroup]);

  /* ── 生徒のログ（30件ずつ取得）── */
  useEffect(() => {
    if (!students.length) { setAllLogs([]); return; }
    const uids = students.map(s => s.uid);
    const chunks = [];
    for (let i = 0; i < uids.length; i += 30) chunks.push(uids.slice(i, i + 30));
    const logsMap = {};
    const unsubs = chunks.map(chunk => {
      const q = query(collection(db, 'logs'), where('uid', 'in', chunk));
      return onSnapshot(q, snap => {
        snap.docs.forEach(d => { logsMap[d.id] = { id: d.id, ...d.data() }; });
        setAllLogs(Object.values(logsMap));
      });
    });
    return () => unsubs.forEach(u => u());
  }, [students]);

  /* ── 管理者一覧（スーパー管理者のみ） ── */
  useEffect(() => {
    if (!isSuperAdmin) return;
    return onSnapshot(collection(db, 'teachers'), snap =>
      setTeachers(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.email || '').localeCompare(b.email || '')))
    );
  }, [isSuperAdmin]);

  const handleAddTeacher = async () => {
    if (!newTeacherEmail.trim()) return;
    setTeacherAdding(true); setTeacherMsg(null);
    try {
      await addDoc(collection(db, 'teachers'), {
        email: newTeacherEmail.trim().toLowerCase(),
        name: newTeacherName.trim(),
        addedBy: user.email,
        addedAt: Date.now(),
        disabled: false,
      });
      setNewTeacherEmail(''); setNewTeacherName('');
      setTeacherMsg({ ok: true, text: lang === 'en' ? 'Teacher added.' : '追加しました。' });
    } catch {
      setTeacherMsg({ ok: false, text: lang === 'en' ? 'Failed to add.' : '追加に失敗しました。' });
    }
    setTeacherAdding(false);
  };

  const handleToggleTeacher = async (t) => {
    await updateDoc(doc(db, 'teachers', t.id), { disabled: !t.disabled });
  };

  const handleDeleteTeacher = async (t) => {
    if (!window.confirm(lang === 'en' ? `Remove ${t.email}?` : `${t.email} を削除しますか？`)) return;
    await deleteDoc(doc(db, 'teachers', t.id));
  };

  /* ── 管理者→生徒メッセージ送信 ── */
  const handleSendMessage = async (student) => {
    if (!msgText.trim()) return;
    await addDoc(collection(db, 'messages'), {
      toUid: student.uid,
      toName: student.name || student.email,
      fromEmail: user.email,
      text: msgText.trim(),
      createdAt: Date.now(),
      read: false,
    });
    setMsgText('');
    setMsgStudentUid(null);
  };

  /* ── 生徒情報編集 ── */
  const handleStartEditStudent = (e, s) => {
    e.stopPropagation();
    setEditingStudentUid(s.uid);
    setEditingStudentName(s.name || '');
    setEditingStudentId(s.studentId || '');
  };
  const handleSaveStudent = async (e, s) => {
    e.stopPropagation();
    await updateDoc(doc(db, 'profile', s.uid), {
      name: editingStudentName.trim(),
      studentId: editingStudentId.trim(),
    });
    setEditingStudentUid(null);
  };
  const handleCancelEditStudent = (e) => { e.stopPropagation(); setEditingStudentUid(null); };

  /* ── 生徒アカウント操作（スーパー管理者のみ） ── */
  const handleToggleStudent = async (s) => {
    const msg = s.disabled
      ? (lang === 'en' ? `Re-enable ${s.name || s.email}?` : `${s.name || s.email} を有効化しますか？`)
      : (lang === 'en' ? `Disable ${s.name || s.email}?` : `${s.name || s.email} を無効化しますか？`);
    if (!window.confirm(msg)) return;
    await updateDoc(doc(db, 'profile', s.uid), { disabled: !s.disabled });
  };

  const handleDeleteStudent = async (s) => {
    if (!window.confirm(lang === 'en'
      ? `Delete ${s.name || s.email}'s profile? (Auth account remains)`
      : `${s.name || s.email} のデータを削除しますか？（認証アカウントは残ります）`)) return;
    await deleteDoc(doc(db, 'profile', s.uid));
  };

  /* ── グループ作成 ── */
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setCreating(true);
    await addDoc(collection(db, 'groups'), {
      name: newGroupName.trim(), teacherUid: user.uid, createdAt: Date.now(),
    });
    setNewGroupName(''); setCreating(false);
  };

  /* ── グループ名編集 ── */
  const handleStartEdit = (e, g) => {
    e.stopPropagation();
    setEditingGroupId(g.id);
    setEditingGroupName(g.name);
  };
  const handleSaveGroupName = async (e, groupId) => {
    e.stopPropagation();
    const name = editingGroupName.trim();
    if (!name) return;
    await updateDoc(doc(db, 'groups', groupId), { name });
    if (selectedGroup?.id === groupId) setSelectedGroup(prev => ({ ...prev, name }));
    setEditingGroupId(null);
  };
  const handleCancelEdit = (e) => {
    e.stopPropagation();
    setEditingGroupId(null);
  };

  /* ── グループ削除 ── */
  const handleDeleteGroup = async (g) => {
    if (!window.confirm(`「${g.name}」を削除しますか？\n生徒アカウントは残ります。`)) return;
    await deleteDoc(doc(db, 'groups', g.id));
    if (selectedGroup?.id === g.id) setSelectedGroup(null);
  };

  /* ── 既存ユーザーをグループへ追加（未ログインは招待予約） ── */
  const handleAddExisting = useCallback(async () => {
    if (!addEmail.trim() || !addGroup) return;
    setAddLoading(true); setAddStatus(null);
    try {
      const email = addEmail.trim();
      const profQ = query(collection(db, 'profile'), where('email', '==', email));
      const profSnap = await getDocs(profQ);
      if (!profSnap.empty) {
        const target = profSnap.docs[0];
        await updateDoc(doc(db, 'profile', target.id), { groupId: addGroup });
        setAddStatus({ ok: true, msg: `「${target.data().name || email}」をグループに追加しました。` });
      } else {
        await addDoc(collection(db, 'groupInvites'), { email, groupId: addGroup, createdAt: Date.now() });
        setAddStatus({ ok: true, msg: `「${email}」を予約しました。次回ログイン時に自動でグループへ追加されます。`, pending: true });
      }
      setAddEmail('');
    } catch {
      setAddStatus({ ok: false, msg: 'エラーが発生しました。再度お試しください。' });
    }
    setAddLoading(false);
  }, [addEmail, addGroup]);

  /* ── 新規登録用テンプレートDL ── */
  const handleDownloadNewTemplate = () => {
    const content = '氏名,学籍番号,メールアドレス,パスワード\n山田太郎,2024001,yamada@example.com,pass1234\n鈴木花子,2024002,suzuki@example.com,pass5678';
    const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'new_students_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  /* ── CSVファイル読み込み共通 ── */
  const handleFileRead = (file, setter) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => setter(e.target.result.replace(/^﻿/, '')); // BOM除去
    reader.readAsText(file, 'UTF-8');
  };

  /* ── 既存ユーザー追加用テンプレートDL ── */
  const handleDownloadTemplate = () => {
    const header = 'メールアドレス,グループ名\n';
    const rows = groups.map(g => `,${g.name}`).join('\n') || 'student@example.com,1年A組';
    const blob = new Blob(['﻿' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'existing_users_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  /* ── 既存ユーザー CSV 一括追加 ── */
  const handleAddCsv = useCallback(async () => {
    if (!addCsvText.trim()) return;
    setAddCsvLoading(true); setAddCsvResult(null);

    const lines = addCsvText.trim().split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('メールアドレス'));

    const ok = [], ng = [];

    for (const line of lines) {
      const [email = '', groupName = ''] = line.split(',').map(s => s.trim());
      if (!email) { ng.push(`(空行): スキップ`); continue; }

      const group = groups.find(g => g.name === groupName.trim());
      if (!group) { ng.push(`${email}: グループ「${groupName}」が見つかりません`); continue; }

      try {
        const profQ = query(collection(db, 'profile'), where('email', '==', email));
        const profSnap = await getDocs(profQ);
        if (!profSnap.empty) {
          const target = profSnap.docs[0];
          await updateDoc(doc(db, 'profile', target.id), { groupId: group.id });
          ok.push(`${target.data().name || email} → ${group.name}`);
        } else {
          await addDoc(collection(db, 'groupInvites'), { email, groupId: group.id, createdAt: Date.now() });
          ok.push(`${email} → ${group.name}（予約済み・次回ログイン時に反映）`);
        }
      } catch {
        ng.push(`${email}: エラーが発生しました`);
      }
    }

    setAddCsvResult({ ok, ng });
    if (ok.length) setAddCsvText('');
    setAddCsvLoading(false);
  }, [addCsvText, groups]);

  /* ── CSV 一括登録 ── */
  const handleImport = useCallback(async () => {
    if (!csvGroup || !csvText.trim()) return;
    setImporting(true); setImportResult(null);
    const lines = csvText.trim().split('\n').map(l => l.trim())
      .filter(l => l && !l.startsWith('氏名'));
    const ok = [], ng = [];

    for (const line of lines) {
      const parts = line.split(',').map(s => s.trim());
      let name, studentId, email, password;
      if (parts.length >= 4) {
        [name = '', studentId = '', email = '', password = ''] = parts;
      } else {
        [name = '', email = '', password = ''] = parts;
        studentId = '';
      }
      if (!email || !password) { ng.push(`${email || '(空)'}: データ不足`); continue; }
      try {
        const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        await setDoc(doc(db, 'profile', cred.user.uid), {
          name, ...(studentId && { studentId }), email, groupId: csvGroup, role: 'student', createdAt: Date.now(),
        });
        await fbSignOut(secondaryAuth);
        ok.push(name || email);
      } catch (err) {
        const msg = {
          'auth/email-already-in-use': '既に登録済み',
          'auth/weak-password':        'パスワードが短すぎます',
          'auth/invalid-email':        'メール形式エラー',
        }[err.code] || err.message;
        ng.push(`${email}: ${msg}`);
      }
    }
    setImportResult({ ok, ng });
    if (ok.length) setCsvText('');
    setImporting(false);
  }, [csvText, csvGroup]);

  /* ── 生徒ログCSVエクスポート ── */
  const handleExportStudent = useCallback((student, logs, month) => {
    const filtered = month === 'all' ? logs : logs.filter(l => l.date && l.date.startsWith(month));
    if (!filtered.length) { alert(lang === 'en' ? 'No records for this period' : '該当期間の記録がありません'); return; }
    const catCols = CATEGORIES.map(c => lang === 'en' ? c.label_en : c.label);
    const header = lang === 'en'
      ? `Date,${catCols.join(',')},Study Time(min),Focus(%),Vocab,Reflection\n`
      : `日付,${catCols.join(',')},学習時間(分),集中度(%),単語数,振り返り\n`;
    const rows = [...filtered].sort((a, b) => b.timestamp - a.timestamp).map(l => {
      const flags = CATEGORIES.map(c => (l.categories || []).includes(c.id) ? '○' : '');
      const reflection = (l.reflection || '').replace(/"/g, '""');
      return `${l.date},${flags.join(',')},${l.minutes || 0},${l.quality || 0},${l.vocabCount || 0},"${reflection}"`;
    }).join('\n');
    const blob = new Blob(['﻿' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const suffix = month === 'all' ? (lang === 'en' ? 'all' : '全期間') : month;
    link.download = `${student.name || student.email}_学習ログ_${suffix}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }, [lang]);

  /* ── スタイル定数 ── */
  const card = { background: 'white', borderRadius: '16px', padding: isMobile ? '16px' : '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' };
  const tabBtn = (t) => ({
    padding: '7px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
    fontSize: '12px', fontWeight: '900',
    background: tab === t ? '#4f46e5' : 'transparent',
    color: tab === t ? 'white' : '#64748b',
  });

  /* ── グループ全体の集計 ── */
  const groupStats = calcStats(allLogs);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: isMobile ? '14px 10px' : '24px 20px', backgroundColor: '#f4f7fa', minHeight: '100vh', fontFamily: 'sans-serif', boxSizing: 'border-box' }}>

      {/* ヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'linear-gradient(135deg,#4f46e5,#0ea5e9)', width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(79,70,229,0.35)' }}>
            <Activity size={22} color="white"/>
          </div>
          <div>
            <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '900', color: '#1e293b', letterSpacing: '-0.03em' }}>BLUEPRINT LOG</div>
            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', letterSpacing: '0.15em' }}>{T.adminConsole}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {toggleLang && (
            <button onClick={toggleLang} style={{ padding: '8px 10px', background: 'white', border: '1.5px solid #e0e7ff', borderRadius: '10px', color: '#4f46e5', fontWeight: '900', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Globe size={13}/> {lang === 'ja' ? 'EN' : 'JA'}
            </button>
          )}
          <button onClick={onGoToApp} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'white', border: '1.5px solid #e0e7ff', borderRadius: '10px', color: '#4f46e5', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
            <BookMarked size={14}/> {T.studyApp}
          </button>
          <button onClick={onLogout} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'white', border: '1.5px solid #fee2e2', borderRadius: '10px', color: '#ef4444', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
            <LogOut size={14}/> {T.logout}
          </button>
        </div>
      </div>

      {/* タブ */}
      <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '10px', marginBottom: '20px', width: 'fit-content' }}>
        {[
          ['overview', T.tabOverview],
          ['add', T.tabAdd],
          ['import', T.tabImport],
          ['words', lang === 'en' ? 'Word Game' : '単語ゲーム管理'],
          ...(isSuperAdmin ? [['admins', lang === 'en' ? 'Admin Mgmt' : '管理者管理']] : []),
        ].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} style={tabBtn(t)}>{l}</button>
        ))}
      </div>

      {/* ===== グループ一覧タブ ===== */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '260px 1fr', gap: '16px', alignItems: 'start' }}>

          {/* 左：グループリスト */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {groups.map(g => (
              <div key={g.id} onClick={() => editingGroupId !== g.id && setSelectedGroup(g)}
                style={{ ...card, cursor: 'pointer', border: selectedGroup?.id === g.id ? '2px solid #4f46e5' : '1px solid #f1f5f9' }}>
                {editingGroupId === g.id ? (
                  /* 編集モード */
                  <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                    <input
                      autoFocus
                      value={editingGroupName}
                      onChange={e => setEditingGroupName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveGroupName(e, g.id); if (e.key === 'Escape') handleCancelEdit(e); }}
                      style={{ flex: 1, padding: '4px 8px', borderRadius: '6px', border: '1.5px solid #4f46e5', fontSize: '13px', fontWeight: '700', outline: 'none' }}
                    />
                    <button onClick={e => handleSaveGroupName(e, g.id)}
                      style={{ padding: '4px 10px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '900', fontSize: '12px', cursor: 'pointer' }}>
                      {T.save}
                    </button>
                    <button onClick={handleCancelEdit}
                      style={{ padding: '4px 8px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '6px', fontWeight: '900', fontSize: '12px', cursor: 'pointer' }}>
                      ✕
                    </button>
                  </div>
                ) : (
                  /* 通常モード */
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      {selectedGroup?.id === g.id ? <ChevronDown size={14} color="#4f46e5"/> : <ChevronRight size={14} color="#94a3b8"/>}
                      <span style={{ fontSize: '14px', fontWeight: '900', color: selectedGroup?.id === g.id ? '#4f46e5' : '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <button onClick={e => handleStartEdit(e, g)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px', color: '#94a3b8' }}>
                        <Pencil size={13}/>
                      </button>
                      <button onClick={e => { e.stopPropagation(); handleDeleteGroup(g); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px', color: '#cbd5e1' }}>
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* 新規グループ作成 */}
            <div style={card}>
              <div style={{ fontSize: '11px', fontWeight: '900', color: '#94a3b8', marginBottom: '8px' }}>{T.newGroup}</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateGroup()}
                  placeholder={T.groupPlaceholder}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '13px', outline: 'none' }}/>
                <button onClick={handleCreateGroup} disabled={creating}
                  style={{ padding: '8px 12px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <Plus size={14}/>
                </button>
              </div>
            </div>
          </div>

          {/* 右：グループ詳細 */}
          <div>
            {!selectedGroup ? (
              <div style={{ ...card, textAlign: 'center', padding: '40px', color: '#94a3b8', fontWeight: '700' }}>
                {T.selectGroup}
              </div>
            ) : (
              <>
                {/* グループ集計 */}
                <div style={{ ...card, marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Users size={16} color="#4f46e5"/> {selectedGroup.name}
                      <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700' }}>{students.length}名</span>
                    </h2>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {[
                      { label: T.statToday,     value: groupStats.day,   vocab: groupStats.vocabDay },
                      { label: T.statThisWeek,  value: groupStats.week,  vocab: groupStats.vocabWeek },
                      { label: T.statThisMonth, value: groupStats.month, vocab: groupStats.vocabMonth },
                      { label: T.statTotal,     value: groupStats.total, vocab: groupStats.vocabTotal },
                    ].map(({ label, value, vocab }) => (
                      <div key={label} style={{ flex: '1 1 80px', background: '#f8fafc', borderRadius: '10px', padding: '10px 12px', textAlign: 'center', border: '1px solid #f1f5f9' }}>
                        <div style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', marginBottom: '3px' }}>{label}</div>
                        <div style={{ fontSize: '18px', fontWeight: '900', color: '#4f46e5' }}>
                          {formatMinutes(value)}<span style={{ fontSize: '11px' }}>{getUnit(value)}</span>
                        </div>
                        {vocab > 0 && (
                          <div style={{ fontSize: '10px', fontWeight: '700', color: '#c084fc', marginTop: '2px' }}>
                            {vocab}語
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 生徒一覧 */}
                <div style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '900', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <BookOpen size={14} color="#94a3b8"/> {T.studentStats}
                    </div>
                    <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
                      {[['recent', lang === 'en' ? 'Newest' : '最新順'], ['name', lang === 'en' ? 'Name' : '名前順']].map(([val, label]) => (
                        <button key={val} onClick={() => setStudentSort(val)}
                          style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', fontSize: '11px', fontWeight: '900', cursor: 'pointer', background: studentSort === val ? 'white' : 'transparent', color: studentSort === val ? '#4f46e5' : '#94a3b8', boxShadow: studentSort === val ? '0 1px 4px rgba(0,0,0,0.06)' : 'none' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {students.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px', fontWeight: '700' }}>
                      {T.noStudents}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {/* ヘッダー行 */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 70px 70px 55px 55px 80px', gap: '8px', padding: '6px 10px', background: '#f8fafc', borderRadius: '8px', fontSize: '10px', fontWeight: '900', color: '#94a3b8' }}>
                        <span>{T.colName}</span>
                        <span style={{ textAlign: 'center' }}>{T.colToday}</span>
                        <span style={{ textAlign: 'center' }}>{T.colWeek}</span>
                        <span style={{ textAlign: 'center' }}>{T.colMonth}</span>
                        <span style={{ textAlign: 'center' }}>{T.colVocab}</span>
                        <span style={{ textAlign: 'center' }}>{T.colCount}</span>
                        <span style={{ textAlign: 'center' }}>{lang === 'en' ? 'Action' : '操作'}</span>
                      </div>

                      {[...students].sort((a, b) => {
                        if (studentSort === 'recent') return (b.createdAt || 0) - (a.createdAt || 0);
                        return (a.name || '').localeCompare(b.name || '', 'ja');
                      }).map(s => {
                        const logs = allLogs.filter(l => l.uid === s.uid);
                        const st = calcStats(logs);
                        const isExp = expandedUid === s.uid;
                        const isEditing = editingStudentUid === s.uid;
                        return (
                          <div key={s.uid}>
                            {isEditing ? (
                              /* 編集モード */
                              <div onClick={e => e.stopPropagation()} style={{ padding: '10px', background: '#f0f4ff', borderRadius: '10px', border: '1.5px solid #c7d2fe', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <input autoFocus value={editingStudentName} onChange={e => setEditingStudentName(e.target.value)}
                                  placeholder={lang === 'en' ? 'Name' : '氏名'}
                                  style={{ flex: '1 1 100px', padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #c7d2fe', fontSize: '13px', fontWeight: '700', outline: 'none' }}/>
                                <input value={editingStudentId} onChange={e => setEditingStudentId(e.target.value)}
                                  placeholder={lang === 'en' ? 'Student ID' : '学籍番号'}
                                  style={{ flex: '1 1 80px', padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #c7d2fe', fontSize: '13px', fontWeight: '700', outline: 'none' }}/>
                                <button onClick={e => handleSaveStudent(e, s)}
                                  style={{ padding: '6px 14px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '900', fontSize: '12px', cursor: 'pointer' }}>
                                  {lang === 'en' ? 'Save' : '保存'}
                                </button>
                                <button onClick={handleCancelEditStudent}
                                  style={{ padding: '6px 10px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '8px', fontWeight: '900', fontSize: '12px', cursor: 'pointer' }}>
                                  ✕
                                </button>
                              </div>
                            ) : (<>
                            <div onClick={() => setExpandedUid(isExp ? null : s.uid)}
                              style={{ display: 'grid', gridTemplateColumns: '1fr 60px 70px 70px 55px 55px 80px', gap: '8px', padding: '10px', background: s.disabled ? '#fff5f5' : isExp ? '#f0f4ff' : 'white', borderRadius: '10px', border: `1px solid ${s.disabled ? '#fecaca' : isExp ? '#c7d2fe' : '#f1f5f9'}`, cursor: 'pointer', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                {isExp ? <ChevronDown size={12} color="#4f46e5"/> : <ChevronRight size={12} color="#94a3b8"/>}
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: '13px', fontWeight: '700', color: s.disabled ? '#ef4444' : '#1e293b', textDecoration: s.disabled ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name || s.email || '（未設定）'}</div>
                                  {s.studentId && <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600' }}>{s.studentId}</div>}
                                </div>
                                {s.disabled && <span style={{ fontSize: '9px', background: '#fee2e2', color: '#ef4444', borderRadius: '4px', padding: '1px 5px', fontWeight: '900', flexShrink: 0 }}>{lang === 'en' ? 'OFF' : '無効'}</span>}
                              </div>
                              {[st.day, st.week, st.month].map((v, i) => (
                                <div key={i} style={{ textAlign: 'center', fontSize: '13px', fontWeight: '900', color: v > 0 ? '#4f46e5' : '#cbd5e1' }}>
                                  {formatMinutes(v)}<span style={{ fontSize: '9px' }}>{getUnit(v)}</span>
                                </div>
                              ))}
                              <div style={{ textAlign: 'center', fontSize: '12px', fontWeight: '900', color: st.vocabTotal > 0 ? '#c084fc' : '#cbd5e1' }}>
                                {st.vocabTotal > 0 ? `${st.vocabTotal}語` : '-'}
                              </div>
                              <div style={{ textAlign: 'center', fontSize: '12px', fontWeight: '900', color: '#64748b' }}>{st.count}</div>
                              {/* 操作ボタン（全管理者） */}
                              <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '2px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                <button onClick={e => handleStartEditStudent(e, s)} title={lang === 'en' ? 'Edit' : '編集'}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px', color: '#94a3b8' }}>
                                  <Pencil size={13}/>
                                </button>
                                <button onClick={() => { setMsgStudentUid(msgStudentUid === s.uid ? null : s.uid); setMsgText(''); }} title={lang === 'en' ? 'Send message' : 'メッセージ送信'}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px', color: msgStudentUid === s.uid ? '#4f46e5' : '#94a3b8' }}>
                                  <MessageSquare size={13}/>
                                </button>
                                {isSuperAdmin && <>
                                  <button onClick={() => handleToggleStudent(s)} title={s.disabled ? (lang === 'en' ? 'Enable' : '有効化') : (lang === 'en' ? 'Disable' : '無効化')}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px', color: s.disabled ? '#22c55e' : '#f59e0b' }}>
                                    {s.disabled ? <ShieldCheck size={13}/> : <ShieldOff size={13}/>}
                                  </button>
                                  <button onClick={() => handleDeleteStudent(s)} title={lang === 'en' ? 'Delete' : '削除'}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px', color: '#ef4444' }}>
                                    <Trash2 size={13}/>
                                  </button>
                                </>}
                              </div>
                            </div>
                            {/* メッセージ入力エリア */}
                            {msgStudentUid === s.uid && (
                              <div onClick={e => e.stopPropagation()} style={{ margin: '4px 0 4px 20px', background: '#fffbeb', borderRadius: '10px', padding: '10px 12px', border: '1.5px solid #fde68a' }}>
                                <div style={{ fontSize: '11px', fontWeight: '900', color: '#92400e', marginBottom: '6px' }}>
                                  💬 {lang === 'en' ? `Message to ${s.name || s.email}` : `${s.name || s.email} へメッセージ`}
                                </div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <input
                                    autoFocus
                                    value={msgText}
                                    onChange={e => setMsgText(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleSendMessage(s); if (e.key === 'Escape') setMsgStudentUid(null); }}
                                    placeholder={lang === 'en' ? 'e.g. Keep it up! You can do it!' : '例：頑張ってください！応援しています！'}
                                    style={{ flex: 1, padding: '7px 10px', borderRadius: '8px', border: '1.5px solid #fcd34d', fontSize: '13px', outline: 'none', background: 'white' }}
                                  />
                                  <button onClick={() => handleSendMessage(s)} disabled={!msgText.trim()}
                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 12px', background: msgText.trim() ? '#f59e0b' : '#e5e7eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '900', fontSize: '12px', cursor: msgText.trim() ? 'pointer' : 'not-allowed' }}>
                                    <Send size={12}/> {lang === 'en' ? 'Send' : '送信'}
                                  </button>
                                  <button onClick={() => setMsgStudentUid(null)}
                                    style={{ padding: '7px 10px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '8px', fontWeight: '900', fontSize: '12px', cursor: 'pointer' }}>
                                    ✕
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* 展開：最近のログ */}
                            {isExp && (
                              <div style={{ margin: '4px 0 4px 20px', background: '#f8fafc', borderRadius: '10px', padding: '10px', border: '1px solid #e0e7ff' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                                  <div style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8' }}>{T.recentLogs}</div>
                                  <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <select
                                      value={exportUid === s.uid ? exportMonth : 'all'}
                                      onChange={e => { setExportUid(s.uid); setExportMonth(e.target.value); }}
                                      style={{ padding: '4px 8px', borderRadius: '7px', border: '1.5px solid #c7d2fe', fontSize: '11px', fontWeight: '700', background: 'white', color: '#4f46e5', outline: 'none', cursor: 'pointer' }}>
                                      <option value="all">{T.allTime}</option>
                                      {[...new Set(logs.map(l => l.date?.slice(0, 7)).filter(Boolean))].sort((a, b) => b.localeCompare(a)).map(m => (
                                        <option key={m} value={m}>{m}</option>
                                      ))}
                                    </select>
                                    <button onClick={() => handleExportStudent(s, logs, exportUid === s.uid ? exportMonth : 'all')}
                                      style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '7px', fontSize: '11px', fontWeight: '900', cursor: 'pointer' }}>
                                      <Download size={11}/> {T.exportCsv}
                                    </button>
                                  </div>
                                </div>
                                {logs.length === 0 ? (
                                  <div style={{ color: '#94a3b8', fontSize: '12px' }}>{T.noLogs2}</div>
                                ) : (
                                  [...logs].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10).map(log => (
                                    <div key={log.id} style={{ padding: '8px 0', borderBottom: '1px dashed #e2e8f0' }}>
                                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', flexShrink: 0 }}>{log.date}</span>
                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                          {(log.categories || []).map(cid => {
                                            const cat = CATEGORIES.find(c => c.id === cid);
                                            return cat ? (
                                              <span key={cid} style={{ background: cat.color, color: 'white', fontSize: '10px', fontWeight: '900', padding: '1px 7px', borderRadius: '5px' }}>
                                                {lang === 'en' ? cat.label_en : cat.label}
                                              </span>
                                            ) : null;
                                          })}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginLeft: 'auto' }}>
                                          <Clock size={11} color="#94a3b8"/>
                                          <span style={{ fontSize: '12px', fontWeight: '900', color: '#4f46e5' }}>
                                            {formatMinutes(log.minutes)}{getUnit(log.minutes)}
                                          </span>
                                        </div>
                                      </div>
                                      {log.reflection && (
                                        <div style={{ marginTop: '4px', marginLeft: '2px', fontSize: '11px', color: '#475569', background: '#f0f4ff', borderRadius: '6px', padding: '5px 8px', borderLeft: '3px solid #a5b4fc', lineHeight: 1.5 }}>
                                          {log.reflection}
                                        </div>
                                      )}
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                            </>)}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== 既存ユーザー追加タブ ===== */}
      {tab === 'add' && (
        <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ── CSV一括追加 ── */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={16} color="#4f46e5"/> {lang === 'en' ? 'Bulk Add via CSV' : 'CSV一括追加'}
              </h2>
              <button onClick={handleDownloadTemplate}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: '#f1f5f9', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '900', color: '#4f46e5', cursor: 'pointer' }}>
                ⬇ {lang === 'en' ? 'Template DL' : 'テンプレートDL'}
              </button>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>
              {lang === 'en'
                ? 'Download the template, fill in emails and group names, then paste below.'
                : 'テンプレートをダウンロードしてメールアドレスとグループ名を記入し、貼り付けてください。'}
            </p>

            <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '10px 12px', marginBottom: '14px', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', marginBottom: '4px' }}>
                {lang === 'en' ? 'CSV format (header row optional)' : 'CSVフォーマット（1行目はヘッダー、不要なら省略可）'}
              </div>
              <code style={{ fontSize: '12px', color: '#4f46e5', fontWeight: '700' }}>
                {lang === 'en' ? 'email, group' : 'メールアドレス, グループ名'}
              </code>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                {lang === 'en' ? 'e.g. yamada@example.com, Class 1A' : '例：yamada@example.com, 1年A組'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#e0e7ff', color: '#4f46e5', borderRadius: '8px', fontSize: '12px', fontWeight: '900', cursor: 'pointer', flexShrink: 0 }}>
                📂 {lang === 'en' ? 'Select File' : 'ファイルを選択'}
                <input type="file" accept=".csv,text/csv" style={{ display: 'none' }}
                  onChange={e => { handleFileRead(e.target.files[0], setAddCsvText); e.target.value = ''; }}
                />
              </label>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>
                {lang === 'en' ? 'or paste CSV directly' : 'またはCSVの内容を直接貼り付け'}
              </span>
            </div>

            <textarea
              value={addCsvText} onChange={e => { setAddCsvText(e.target.value); setAddCsvResult(null); }}
              placeholder={lang === 'en' ? 'yamada@example.com, Class 1A\nsuzuki@example.com, Class 1B' : 'yamada@example.com, 1年A組\nsuzuki@example.com, 1年B組'}
              style={{ width: '100%', height: '140px', padding: '12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '13px', fontFamily: 'monospace', outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: '12px' }}
            />

            <button onClick={handleAddCsv} disabled={addCsvLoading || !addCsvText.trim()}
              style={{ width: '100%', padding: '13px', background: addCsvLoading ? '#e0e7ff' : 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: addCsvLoading ? '#94a3b8' : 'white', border: 'none', borderRadius: '10px', fontWeight: '900', fontSize: '14px', cursor: addCsvLoading ? 'not-allowed' : 'pointer' }}>
              {addCsvLoading ? '...' : (lang === 'en' ? 'Add to Groups' : 'グループに一括追加する')}
            </button>

            {addCsvResult && (
              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {addCsvResult.ok.length > 0 && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <CheckCircle size={14} color="#16a34a"/>
                      <span style={{ fontSize: '12px', fontWeight: '900', color: '#16a34a' }}>
                        {lang === 'en' ? `Added ${addCsvResult.ok.length}` : `追加成功 ${addCsvResult.ok.length}名`}
                      </span>
                    </div>
                    {addCsvResult.ok.map((n, i) => <div key={i} style={{ fontSize: '12px', color: '#15803d', paddingLeft: '20px' }}>✓ {n}</div>)}
                  </div>
                )}
                {addCsvResult.ng.length > 0 && (
                  <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <AlertCircle size={14} color="#ef4444"/>
                      <span style={{ fontSize: '12px', fontWeight: '900', color: '#ef4444' }}>
                        {lang === 'en' ? `Error: ${addCsvResult.ng.length}` : `エラー ${addCsvResult.ng.length}件`}
                      </span>
                    </div>
                    {addCsvResult.ng.map((e, i) => <div key={i} style={{ fontSize: '12px', color: '#dc2626', paddingLeft: '20px' }}>✗ {e}</div>)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── 1件ずつ追加 ── */}
          <div style={card}>
            <h2 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserPlus size={16} color="#4f46e5"/> {lang === 'en' ? 'Add One by One' : '1件ずつ追加'}
            </h2>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', display: 'block', marginBottom: '6px' }}>
                {lang === 'en' ? 'Target Group' : '追加先グループ'}
              </label>
              <select value={addGroup} onChange={e => { setAddGroup(e.target.value); setAddStatus(null); }}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '14px', outline: 'none', background: 'white' }}>
                <option value="">{lang === 'en' ? 'Select group...' : 'グループを選択...'}</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input type="email" value={addEmail}
                onChange={e => { setAddEmail(e.target.value); setAddStatus(null); }}
                onKeyDown={e => e.key === 'Enter' && handleAddExisting()}
                placeholder="student@example.com"
                style={{ flex: 1, padding: '11px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '14px', outline: 'none' }}
              />
              <button onClick={handleAddExisting} disabled={addLoading || !addEmail || !addGroup}
                style={{ padding: '11px 18px', background: addLoading ? '#e0e7ff' : '#4f46e5', color: addLoading ? '#94a3b8' : 'white', border: 'none', borderRadius: '10px', fontWeight: '900', fontSize: '13px', cursor: addLoading ? 'not-allowed' : 'pointer' }}>
                {addLoading ? '...' : (lang === 'en' ? 'Add' : '追加')}
              </button>
            </div>
            {addStatus && (
              <div style={{
                background: addStatus.pending ? '#fffbeb' : addStatus.ok ? '#f0fdf4' : '#fff1f2',
                border: `1px solid ${addStatus.pending ? '#fde68a' : addStatus.ok ? '#86efac' : '#fecdd3'}`,
                borderRadius: '10px', padding: '10px 14px', display: 'flex', gap: '8px', alignItems: 'flex-start',
              }}>
                {addStatus.pending
                  ? <span style={{ fontSize: '14px', flexShrink: 0 }}>⏳</span>
                  : addStatus.ok
                  ? <CheckCircle size={14} color="#16a34a" style={{ flexShrink: 0, marginTop: '1px' }}/>
                  : <AlertCircle size={14} color="#ef4444" style={{ flexShrink: 0, marginTop: '1px' }}/>}
                <span style={{ fontSize: '12px', fontWeight: '700', color: addStatus.pending ? '#92400e' : addStatus.ok ? '#16a34a' : '#ef4444' }}>
                  {addStatus.msg}
                </span>
              </div>
            )}
          </div>

          <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: '10px', padding: '12px 14px', fontSize: '12px', color: '#92400e', fontWeight: '600', lineHeight: 1.6 }}>
            {lang === 'en'
              ? '⚠ Students who have never logged in cannot be found here. Use the "Bulk Register" tab to create new accounts.'
              : '⚠ 生徒が一度もログインしていない場合は検索できません。その場合は「生徒一括登録」タブから新規登録してください。'}
          </div>
        </div>
      )}

      {/* ===== 生徒一括登録タブ ===== */}
      {tab === 'import' && (
        <div style={{ maxWidth: '600px' }}>
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={16} color="#4f46e5"/> {lang === 'en' ? 'Bulk Register Students (CSV)' : '生徒一括登録（CSV）'}
              </h2>
              <button onClick={handleDownloadNewTemplate}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: '#f1f5f9', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '900', color: '#4f46e5', cursor: 'pointer' }}>
                ⬇ {lang === 'en' ? 'Template DL' : 'テンプレートDL'}
              </button>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', display: 'block', marginBottom: '6px' }}>
                {lang === 'en' ? 'Target Group' : '登録先グループ'}
              </label>
              <select value={csvGroup} onChange={e => setCsvGroup(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '14px', outline: 'none', background: 'white' }}>
                <option value="">{lang === 'en' ? 'Select group...' : 'グループを選択...'}</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>

            <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px', marginBottom: '14px', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', marginBottom: '4px' }}>
                {lang === 'en' ? 'CSV format (header row optional)' : 'CSVフォーマット（1行目はヘッダー、不要なら省略可）'}
              </div>
              <code style={{ fontSize: '12px', color: '#4f46e5', fontWeight: '700' }}>
                {lang === 'en' ? 'name, student ID, email, password' : '氏名, 学籍番号, メールアドレス, パスワード'}
              </code>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                {lang === 'en' ? 'e.g. John, 2024001, john@example.com, pass1234' : '例：山田太郎, 2024001, yamada@example.com, pass1234'}
              </div>
              <div style={{ fontSize: '11px', color: '#b0bec5', marginTop: '2px' }}>
                {lang === 'en' ? '* Student ID is optional (3-column format also accepted)' : '※ 学籍番号は省略可（3列形式にも対応）'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#e0e7ff', color: '#4f46e5', borderRadius: '8px', fontSize: '12px', fontWeight: '900', cursor: 'pointer', flexShrink: 0 }}>
                📂 {lang === 'en' ? 'Select File' : 'ファイルを選択'}
                <input type="file" accept=".csv,text/csv" style={{ display: 'none' }}
                  onChange={e => { handleFileRead(e.target.files[0], setCsvText); e.target.value = ''; }}
                />
              </label>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>
                {lang === 'en' ? 'or paste CSV directly' : 'またはCSVの内容を直接貼り付け'}
              </span>
            </div>

            <textarea
              value={csvText} onChange={e => { setCsvText(e.target.value); setImportResult(null); }}
              placeholder={lang === 'en'
                ? 'John, john@example.com, pass1234\nJane, jane@example.com, pass5678'
                : '山田太郎, yamada@example.com, pass1234\n鈴木花子, suzuki@example.com, pass5678'}
              style={{ width: '100%', height: '160px', padding: '12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '13px', fontFamily: 'monospace', outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: '12px' }}
            />

            <button onClick={handleImport} disabled={importing || !csvGroup || !csvText.trim()}
              style={{ width: '100%', padding: '13px', background: importing ? '#e0e7ff' : 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: importing ? '#94a3b8' : 'white', border: 'none', borderRadius: '10px', fontWeight: '900', fontSize: '14px', cursor: importing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Upload size={15}/> {importing ? '...' : (lang === 'en' ? 'Register All' : '一括登録する')}
            </button>

            {importResult && (
              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {importResult.ok.length > 0 && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <CheckCircle size={14} color="#16a34a"/>
                      <span style={{ fontSize: '12px', fontWeight: '900', color: '#16a34a' }}>
                        {lang === 'en' ? `Registered ${importResult.ok.length}` : `登録成功 ${importResult.ok.length}名`}
                      </span>
                    </div>
                    {importResult.ok.map((n, i) => <div key={i} style={{ fontSize: '12px', color: '#15803d', paddingLeft: '20px' }}>✓ {n}</div>)}
                  </div>
                )}
                {importResult.ng.length > 0 && (
                  <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <AlertCircle size={14} color="#ef4444"/>
                      <span style={{ fontSize: '12px', fontWeight: '900', color: '#ef4444' }}>
                        {lang === 'en' ? `Error: ${importResult.ng.length}` : `エラー ${importResult.ng.length}件`}
                      </span>
                    </div>
                    {importResult.ng.map((e, i) => <div key={i} style={{ fontSize: '12px', color: '#dc2626', paddingLeft: '20px' }}>✗ {e}</div>)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== 管理者管理タブ（スーパー管理者のみ） ===== */}
      {tab === 'admins' && isSuperAdmin && (
        <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* 新規追加 */}
          <div style={card}>
            <h2 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} color="#4f46e5"/> {lang === 'en' ? 'Add Teacher Account' : '管理者アカウントを追加'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input type="text" value={newTeacherName} onChange={e => setNewTeacherName(e.target.value)}
                placeholder={lang === 'en' ? 'Name (optional)' : '氏名（任意）'}
                style={{ padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '13px', outline: 'none' }}/>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="email" value={newTeacherEmail} onChange={e => setNewTeacherEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddTeacher()}
                  placeholder={lang === 'en' ? 'Google email address' : 'Googleメールアドレス'}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '13px', outline: 'none' }}/>
                <button onClick={handleAddTeacher} disabled={teacherAdding || !newTeacherEmail.trim()}
                  style={{ padding: '10px 18px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '900', fontSize: '13px', cursor: 'pointer' }}>
                  <Plus size={14}/>
                </button>
              </div>
              {teacherMsg && (
                <div style={{ fontSize: '12px', fontWeight: '700', color: teacherMsg.ok ? '#16a34a' : '#ef4444', background: teacherMsg.ok ? '#f0fdf4' : '#fff1f2', padding: '8px 12px', borderRadius: '8px' }}>
                  {teacherMsg.text}
                </div>
              )}
              <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>
                {lang === 'en'
                  ? '⚠ The teacher must log in with this Google account. Super admins cannot be added here.'
                  : '⚠ 登録したGoogleアカウントでログインすると管理画面にアクセスできます。スーパー管理者はここでは追加できません。'}
              </p>
            </div>
          </div>

          {/* 管理者一覧 */}
          <div style={card}>
            <h2 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={16} color="#4f46e5"/> {lang === 'en' ? 'Teacher List' : '管理者一覧'} <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700' }}>{teachers.length}{lang === 'en' ? ' accounts' : '件'}</span>
            </h2>
            {teachers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '13px' }}>
                {lang === 'en' ? 'No teachers registered.' : '登録された管理者はいません。'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {teachers.map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: t.disabled ? '#fff5f5' : '#f8fafc', borderRadius: '10px', border: `1px solid ${t.disabled ? '#fecaca' : '#f1f5f9'}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: t.disabled ? '#ef4444' : '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.name || t.email}
                      </div>
                      {t.name && <div style={{ fontSize: '11px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.email}</div>}
                    </div>
                    {t.disabled && (
                      <span style={{ fontSize: '10px', background: '#fee2e2', color: '#ef4444', borderRadius: '6px', padding: '2px 8px', fontWeight: '900', flexShrink: 0 }}>
                        {lang === 'en' ? 'DISABLED' : '無効'}
                      </span>
                    )}
                    <button onClick={() => handleToggleTeacher(t)}
                      title={t.disabled ? (lang === 'en' ? 'Enable' : '有効化') : (lang === 'en' ? 'Disable' : '無効化')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: t.disabled ? '#22c55e' : '#f59e0b', flexShrink: 0 }}>
                      {t.disabled ? <ShieldCheck size={16}/> : <ShieldOff size={16}/>}
                    </button>
                    <button onClick={() => handleDeleteTeacher(t)}
                      title={lang === 'en' ? 'Delete' : '削除'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#ef4444', flexShrink: 0 }}>
                      <Trash2 size={16}/>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 注記 */}
          <div style={{ ...card, background: '#fffbeb', border: '1px solid #fde68a' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <Ban size={16} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }}/>
              <div style={{ fontSize: '12px', color: '#92400e', fontWeight: '600', lineHeight: 1.6 }}>
                {lang === 'en'
                  ? 'Disabling a teacher prevents them from accessing the admin panel on next login. Deleting removes them from this list but does not delete their Google account.'
                  : '無効化すると次回ログイン時から管理画面にアクセスできなくなります。削除はこのリストから削除するのみで、Googleアカウント自体は削除されません。'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== 単語ゲーム管理タブ ===== */}
      {tab === 'words' && <WordsTab selectedGroup={selectedGroup} lang={lang} db={db}/>}
    </div>
  );
}

function WordsTab({ selectedGroup, lang, db }) {
  const isEn = lang === 'en';
  const [words, setWords] = useState([]);
  const [newJa, setNewJa] = useState('');
  const [newEn, setNewEn] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const BANK_DOC = 'global';   // クラス関係なく全員共通の単語バンク

  useEffect(() => {
    return onSnapshot(doc(db, 'wordBanks', BANK_DOC), d => {
      setWords(d.exists() ? (d.data().words || []) : []);
    });
  }, []);

  const save = async (next) => {
    setSaving(true);
    await setDoc(doc(db, 'wordBanks', BANK_DOC), { words: next, updatedAt: Date.now() });
    setSaving(false);
  };

  const addWord = () => {
    if (!newJa.trim() || !newEn.trim()) return;
    const next = [...words, { ja: newJa.trim(), en: newEn.trim() }];
    setWords(next); save(next);
    setNewJa(''); setNewEn('');
  };

  const deleteWord = (i) => {
    const next = words.filter((_, idx) => idx !== i);
    setWords(next); save(next);
  };

  const parseCsvText = (text) => {
    // BOM除去
    const clean = text.replace(/^﻿/, '');
    const lines = clean.split(/\r?\n/).filter(Boolean);
    return lines.flatMap(l => {
      const [ja, en] = l.split(',').map(s => s.trim());
      return ja && en ? [{ ja, en }] : [];
    });
  };

  const handleCsv = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const buf = ev.target.result;
      // UTF-8(strict)で失敗したらShift-JIS(Excel日本語)でデコード
      let text = '';
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
      catch { text = new TextDecoder('shift-jis').decode(buf); }
      const parsed = parseCsvText(text);
      if (!parsed.length) return;
      const next = [...words, ...parsed];
      setWords(next); save(next);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const makeBlob = (content) =>
    new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' });

  const downloadTemplate = () => {
    const csv = isEn ? 'Japanese,English\n犬,dog\n猫,cat' : '日本語,英語\n犬,dog\n猫,cat';
    const url = URL.createObjectURL(makeBlob(csv));
    const a = document.createElement('a'); a.href = url; a.download = 'wordbank_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadWords = () => {
    const csv = (isEn ? 'Japanese,English\n' : '日本語,英語\n') + words.map(w => `${w.ja},${w.en}`).join('\n');
    const url = URL.createObjectURL(makeBlob(csv));
    const a = document.createElement('a'); a.href = url; a.download = `wordbank_${selectedGroup?.name || 'group'}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    if (!window.confirm(isEn ? `Delete all ${words.length} words?` : `${words.length}語すべて削除しますか？`)) return;
    setWords([]); save([]);
  };

  const inputSt = { padding:'8px 12px', borderRadius:'10px', border:'1px solid #e2e8f0', fontSize:'14px', fontWeight:'bold', color:'#1e293b', outline:'none' };
  const btnSt = (c) => ({ padding:'8px 18px', borderRadius:'10px', border:'none', background:c, color:'white', fontWeight:'900', fontSize:'12px', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px' });

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
      <div style={{ background:'white', borderRadius:'16px', padding:'20px', boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px', flexWrap:'wrap', gap:'10px' }}>
          <h3 style={{ margin:0, fontSize:'15px', fontWeight:'900', color:'#1e293b' }}>
            🎯 {isEn ? `Global Word Bank (${words.length} words)` : `共通単語バンク（${words.length}語）— クラス関係なく全員が対象`}
          </h3>
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
            <button onClick={downloadTemplate} style={btnSt('#64748b')}>
              <Download size={13}/> {isEn ? 'Template' : 'テンプレートDL'}
            </button>
            <button onClick={() => fileRef.current?.click()} style={btnSt('#f59e0b')}>
              <Upload size={13}/> {isEn ? 'Import CSV' : 'CSV読込'}
            </button>
            {words.length > 0 && <button onClick={downloadWords} style={btnSt('#10b981')}>
              <Download size={13}/> {isEn ? 'Export' : '書き出し'}
            </button>}
            {words.length > 0 && <button onClick={clearAll} style={btnSt('#ef4444')}>
              <Trash2 size={13}/> {isEn ? 'Clear All' : '全削除'}
            </button>}
          </div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleCsv} style={{ display:'none' }}/>
        </div>

        {/* Add form */}
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'16px' }}>
          <input value={newJa} onChange={e=>setNewJa(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addWord()}
            placeholder={isEn ? 'Japanese (e.g. 犬)' : '日本語（例：犬）'} style={{ ...inputSt, flex:'1 1 140px' }}/>
          <input value={newEn} onChange={e=>setNewEn(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addWord()}
            placeholder={isEn ? 'English (e.g. dog)' : '英語（例：dog）'} style={{ ...inputSt, flex:'1 1 140px' }}/>
          <button onClick={addWord} disabled={!newJa.trim()||!newEn.trim()||saving}
            style={{ ...btnSt('#4f46e5'), opacity:(!newJa.trim()||!newEn.trim()||saving)?0.5:1 }}>
            <Plus size={14}/> {isEn ? 'Add' : '追加'}
          </button>
        </div>

        {/* Word list */}
        {words.length === 0 ? (
          <div style={{ textAlign:'center', padding:'24px', color:'#94a3b8', fontWeight:'bold', fontSize:'13px' }}>
            {isEn ? 'No words yet. Add some or import a CSV.' : '単語がありません。追加またはCSVで読み込んでください。'}
          </div>
        ) : (
          <div style={{ maxHeight:'400px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'6px' }}>
            {words.map((w, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'8px 12px', background:'#f8fafc', borderRadius:'10px', border:'1px solid #f1f5f9' }}>
                <span style={{ flex:1, fontWeight:'900', color:'#1e293b', fontSize:'14px' }}>{w.ja}</span>
                <span style={{ color:'#94a3b8', fontSize:'12px' }}>→</span>
                <span style={{ flex:1, fontWeight:'bold', color:'#4f46e5', fontSize:'14px' }}>{w.en}</span>
                <button onClick={() => deleteWord(i)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', padding:'4px', flexShrink:0 }}>
                  <Trash2 size={14}/>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
