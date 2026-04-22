import { useState, useEffect, useCallback } from 'react';
import {
  collection, addDoc, onSnapshot, query, where, setDoc, doc, deleteDoc, getDocs, updateDoc,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut as fbSignOut } from 'firebase/auth';
import {
  Users, Plus, Upload, LogOut, ChevronDown, ChevronRight,
  Activity, Clock, BookOpen, Trash2, CheckCircle, AlertCircle, UserPlus, Pencil, BookMarked, Download, Globe,
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

export default function AdminPanel({ user, onLogout, onGoToApp, isMobile, lang = 'ja', toggleLang }) {
  const T = i18n[lang];
  const [tab, setTab]                 = useState('overview');
  const [groups, setGroups]           = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [students, setStudents]       = useState([]);
  const [allLogs, setAllLogs]         = useState([]);
  const [expandedUid, setExpandedUid] = useState(null);
  const [exportUid, setExportUid]     = useState(null);
  const [exportMonth, setExportMonth] = useState('all');

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
      setStudents(snap.docs.map(d => ({ uid: d.id, ...d.data() }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ja')))
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
    const content = '氏名,メールアドレス,パスワード\n山田太郎,yamada@example.com,pass1234\n鈴木花子,suzuki@example.com,pass5678';
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
      const [name = '', email = '', password = ''] = line.split(',').map(s => s.trim());
      if (!email || !password) { ng.push(`${email || '(空)'}: データ不足`); continue; }
      try {
        const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        await setDoc(doc(db, 'profile', cred.user.uid), {
          name, email, groupId: csvGroup, role: 'student',
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
        {[['overview', T.tabOverview], ['add', T.tabAdd], ['import', T.tabImport]].map(([t, l]) => (
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
                  <div style={{ fontSize: '13px', fontWeight: '900', color: '#64748b', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <BookOpen size={14} color="#94a3b8"/> {T.studentStats}
                  </div>

                  {students.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px', fontWeight: '700' }}>
                      {T.noStudents}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {/* ヘッダー行 */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 70px 70px 55px 55px', gap: '8px', padding: '6px 10px', background: '#f8fafc', borderRadius: '8px', fontSize: '10px', fontWeight: '900', color: '#94a3b8' }}>
                        <span>{T.colName}</span>
                        <span style={{ textAlign: 'center' }}>{T.colToday}</span>
                        <span style={{ textAlign: 'center' }}>{T.colWeek}</span>
                        <span style={{ textAlign: 'center' }}>{T.colMonth}</span>
                        <span style={{ textAlign: 'center' }}>{T.colVocab}</span>
                        <span style={{ textAlign: 'center' }}>{T.colCount}</span>
                      </div>

                      {students.map(s => {
                        const logs = allLogs.filter(l => l.uid === s.uid);
                        const st = calcStats(logs);
                        const isExp = expandedUid === s.uid;
                        return (
                          <div key={s.uid}>
                            <div onClick={() => setExpandedUid(isExp ? null : s.uid)}
                              style={{ display: 'grid', gridTemplateColumns: '1fr 60px 70px 70px 55px 55px', gap: '8px', padding: '10px', background: isExp ? '#f0f4ff' : 'white', borderRadius: '10px', border: `1px solid ${isExp ? '#c7d2fe' : '#f1f5f9'}`, cursor: 'pointer', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {isExp ? <ChevronDown size={12} color="#4f46e5"/> : <ChevronRight size={12} color="#94a3b8"/>}
                                <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>{s.name || s.email || '（未設定）'}</span>
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
                            </div>

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
                <Upload size={16} color="#4f46e5"/> CSV一括追加
              </h2>
              <button onClick={handleDownloadTemplate}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: '#f1f5f9', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '900', color: '#4f46e5', cursor: 'pointer' }}>
                ⬇ テンプレートDL
              </button>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>
              テンプレートをダウンロードしてメールアドレスとグループ名を記入し、貼り付けてください。
            </p>

            <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '10px 12px', marginBottom: '14px', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', marginBottom: '4px' }}>CSVフォーマット（1行目はヘッダー、不要なら省略可）</div>
              <code style={{ fontSize: '12px', color: '#4f46e5', fontWeight: '700' }}>メールアドレス, グループ名</code>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>例：yamada@example.com, 1年A組</div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#e0e7ff', color: '#4f46e5', borderRadius: '8px', fontSize: '12px', fontWeight: '900', cursor: 'pointer', flexShrink: 0 }}>
                📂 ファイルを選択
                <input type="file" accept=".csv,text/csv" style={{ display: 'none' }}
                  onChange={e => { handleFileRead(e.target.files[0], setAddCsvText); e.target.value = ''; }}
                />
              </label>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>またはCSVの内容を直接貼り付け</span>
            </div>

            <textarea
              value={addCsvText} onChange={e => { setAddCsvText(e.target.value); setAddCsvResult(null); }}
              placeholder={'yamada@example.com, 1年A組\nsuzuki@example.com, 1年B組'}
              style={{ width: '100%', height: '140px', padding: '12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '13px', fontFamily: 'monospace', outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: '12px' }}
            />

            <button onClick={handleAddCsv} disabled={addCsvLoading || !addCsvText.trim()}
              style={{ width: '100%', padding: '13px', background: addCsvLoading ? '#e0e7ff' : 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: addCsvLoading ? '#94a3b8' : 'white', border: 'none', borderRadius: '10px', fontWeight: '900', fontSize: '14px', cursor: addCsvLoading ? 'not-allowed' : 'pointer' }}>
              {addCsvLoading ? '処理中...' : 'グループに一括追加する'}
            </button>

            {addCsvResult && (
              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {addCsvResult.ok.length > 0 && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <CheckCircle size={14} color="#16a34a"/>
                      <span style={{ fontSize: '12px', fontWeight: '900', color: '#16a34a' }}>追加成功 {addCsvResult.ok.length}名</span>
                    </div>
                    {addCsvResult.ok.map((n, i) => <div key={i} style={{ fontSize: '12px', color: '#15803d', paddingLeft: '20px' }}>✓ {n}</div>)}
                  </div>
                )}
                {addCsvResult.ng.length > 0 && (
                  <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <AlertCircle size={14} color="#ef4444"/>
                      <span style={{ fontSize: '12px', fontWeight: '900', color: '#ef4444' }}>エラー {addCsvResult.ng.length}件</span>
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
              <UserPlus size={16} color="#4f46e5"/> 1件ずつ追加
            </h2>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', display: 'block', marginBottom: '6px' }}>追加先グループ</label>
              <select value={addGroup} onChange={e => { setAddGroup(e.target.value); setAddStatus(null); }}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '14px', outline: 'none', background: 'white' }}>
                <option value="">グループを選択...</option>
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
                {addLoading ? '...' : '追加'}
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
            ⚠ 生徒が一度もログインしていない場合は検索できません。その場合は「生徒一括登録」タブから新規登録してください。
          </div>
        </div>
      )}

      {/* ===== 生徒一括登録タブ ===== */}
      {tab === 'import' && (
        <div style={{ maxWidth: '600px' }}>
          <div style={card}>
            {/* ヘッダー */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={16} color="#4f46e5"/> 生徒一括登録（CSV）
              </h2>
              <button onClick={handleDownloadNewTemplate}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: '#f1f5f9', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '900', color: '#4f46e5', cursor: 'pointer' }}>
                ⬇ テンプレートDL
              </button>
            </div>

            {/* グループ選択 */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', display: 'block', marginBottom: '6px' }}>登録先グループ</label>
              <select value={csvGroup} onChange={e => setCsvGroup(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '14px', outline: 'none', background: 'white' }}>
                <option value="">グループを選択...</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>

            {/* CSVフォーマット説明 */}
            <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px', marginBottom: '14px', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '11px', fontWeight: '900', color: '#64748b', marginBottom: '4px' }}>CSVフォーマット（1行目はヘッダー、不要なら省略可）</div>
              <code style={{ fontSize: '12px', color: '#4f46e5', fontWeight: '700' }}>氏名, メールアドレス, パスワード</code>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>例：山田太郎, yamada@example.com, pass1234</div>
            </div>

            {/* ファイル選択 or テキスト貼り付け */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#e0e7ff', color: '#4f46e5', borderRadius: '8px', fontSize: '12px', fontWeight: '900', cursor: 'pointer', flexShrink: 0 }}>
                📂 ファイルを選択
                <input type="file" accept=".csv,text/csv" style={{ display: 'none' }}
                  onChange={e => { handleFileRead(e.target.files[0], setCsvText); e.target.value = ''; }}
                />
              </label>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>またはCSVの内容を直接貼り付け</span>
            </div>

            <textarea
              value={csvText} onChange={e => { setCsvText(e.target.value); setImportResult(null); }}
              placeholder={'山田太郎, yamada@example.com, pass1234\n鈴木花子, suzuki@example.com, pass5678'}
              style={{ width: '100%', height: '160px', padding: '12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '13px', fontFamily: 'monospace', outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: '12px' }}
            />

            <button onClick={handleImport} disabled={importing || !csvGroup || !csvText.trim()}
              style={{ width: '100%', padding: '13px', background: importing ? '#e0e7ff' : 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: importing ? '#94a3b8' : 'white', border: 'none', borderRadius: '10px', fontWeight: '900', fontSize: '14px', cursor: importing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Upload size={15}/> {importing ? '登録中...' : '一括登録する'}
            </button>

            {importResult && (
              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {importResult.ok.length > 0 && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <CheckCircle size={14} color="#16a34a"/>
                      <span style={{ fontSize: '12px', fontWeight: '900', color: '#16a34a' }}>登録成功 {importResult.ok.length}名</span>
                    </div>
                    {importResult.ok.map((n, i) => <div key={i} style={{ fontSize: '12px', color: '#15803d', paddingLeft: '20px' }}>✓ {n}</div>)}
                  </div>
                )}
                {importResult.ng.length > 0 && (
                  <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <AlertCircle size={14} color="#ef4444"/>
                      <span style={{ fontSize: '12px', fontWeight: '900', color: '#ef4444' }}>エラー {importResult.ng.length}件</span>
                    </div>
                    {importResult.ng.map((e, i) => <div key={i} style={{ fontSize: '12px', color: '#dc2626', paddingLeft: '20px' }}>✗ {e}</div>)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
