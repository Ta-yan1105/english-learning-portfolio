import { useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Star, Plus, X,
  LayoutGrid, ListChecks, CheckSquare, Check, Trash2, CalendarDays, Flag, Tag,
} from 'lucide-react';
import { formatMinutes, getUnit, getLocalDateString } from '../constants';
import { hudPanelStyle, HudHeading, hud } from './hud';
import { holidayName } from '../utils/holidays';

/* 学習量の濃淡（単一色相・明度が単調に濃くなる4段階。検証済み） */
const LEVELS = [
  { min: 1,   max: 29,       color: '#93a2f7' },
  { min: 30,  max: 59,       color: '#6f7bef' },
  { min: 60,  max: 119,      color: '#4f46e5' },
  { min: 120, max: Infinity, color: '#332b96' },
];
const EMPTY         = '#eceefa'; // 平日・記録なし
const REST_EMPTY    = '#fdf3f0'; // 土日・記録なし
const HOLIDAY_EMPTY = '#fdeef2'; // 祝日・記録なし
const HOLIDAY_INK   = '#db2777';

/* 試験の色（先頭が英検。以降は登録順に割り当てる） */
const EXAM_COLORS = ['#eb6834', '#db2777', '#0e9aa7', '#15803d', '#4a3aa7', '#2a78d6'];

/* TODO の分類。色は検証済みパレット（隣り合う色が見分けられる並び） */
const TODO_COLORS = ['#2a78d6', '#4a3aa7', '#15803d', '#eb6834', '#db2777', '#0e9aa7', '#eda100'];
const DEFAULT_TODO_CATS = [
  { id: 'english', name: '英語学習',     color: TODO_COLORS[0], emoji: '📘' },
  { id: 'work',    name: '仕事',         color: TODO_COLORS[1], emoji: '💼' },
  { id: 'private', name: 'プライベート', color: TODO_COLORS[2], emoji: '🏠' },
];

/* 分類につけられる絵文字（自由入力もできる） */
const EMOJI_SETS = [
  { label: '学習', items: ['📘', '📚', '✏️', '📝', '🎧', '🗣️', '📖', '🔤', '🧠', '🖊️', '📒', '🎓'] },
  { label: '仕事', items: ['💼', '🏫', '👔', '📊', '📅', '📞', '💻', '📋', '🤝', '🗂️', '🖨️', '📌'] },
  { label: '生活', items: ['🏠', '🛒', '🍳', '🧺', '🚗', '💊', '🏃', '🛁', '😴', '🎵', '🐾', '🌿'] },
  { label: '印',   items: ['⭐', '🔥', '🎯', '✅', '⚠️', '❤️', '🎉', '🌱', '🏆', '🔖', '💡', '🚩'] },
];

/* 時間帯の予定に分類を持たせるための、予定キーと対になるキー */
const catKeyOf = (slotKey) => `${slotKey}@cat`;

/* 色は「並び順」ではなく「その試験」に紐づける（並べ替えても色が入れ替わらない） */
const examColor = (id) => {
  if (id === 'eiken') return EXAM_COLORS[0];
  if (id === 'toeic') return EXAM_COLORS[1];
  let h = 0;
  for (let i = 0; i < String(id).length; i++) h = (h * 31 + String(id).charCodeAt(i)) >>> 0;
  return EXAM_COLORS[2 + (h % (EXAM_COLORS.length - 2))];
};

const levelOf = (m) => LEVELS.find(l => m >= l.min && m <= l.max) || null;

/* バーティカル週間で表示する時間帯（手帳と同じく朝から深夜まで） */
const HOURS = Array.from({ length: 20 }, (_, i) => i + 4); // 4時〜23時

export default function StudyCalendar({
  isMobile, lang = 'ja', logs, date, setDate, onSelectDate,
  profile = {}, onProfileUpdate, plans = {}, onSavePlan,
  todos = [], onAddTodo, onUpdateTodo, onRemoveTodo, onClearDone,
}) {
  const isEn = lang === 'en';
  /* カレンダーは既定で畳んでおき、必要なときだけ開く（前回の状態を端末に覚える） */
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem('calendarOpen') === '1'; } catch { return false; }
  });
  const toggleOpen = () => setOpen(v => {
    try { localStorage.setItem('calendarOpen', v ? '0' : '1'); } catch {}
    return !v;
  });

  const [view, setView] = useState('month'); // 'month' | 'agenda'
  const [showExamForm, setShowExamForm] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const d = new Date(date + 'T00:00:00');
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const minutesByDate = useMemo(() => {
    const m = {};
    logs.forEach(l => { m[l.date] = (m[l.date] || 0) + (Number(l.minutes) || 0); });
    return m;
  }, [logs]);

  /* 月曜始まりのマス目（前後の月は空白で埋める） */
  const cells = useMemo(() => {
    const y = cursor.getFullYear();
    const mo = cursor.getMonth();
    const lead = (new Date(y, mo, 1).getDay() + 6) % 7;
    const days = new Date(y, mo + 1, 0).getDate();
    const out = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= days; d++) out.push(getLocalDateString(new Date(y, mo, d)));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [cursor]);

  const monthDays   = useMemo(() => cells.filter(Boolean), [cells]);
  /* 帯の長さを決める基準：その月で一番学習した日 */
  const maxDayMinutes = useMemo(
    () => Math.max(60, ...monthDays.map(d => minutesByDate[d] || 0)),
    [monthDays, minutesByDate]
  );

  const today = getLocalDateString(new Date());
  const shiftMonth = (n) => setCursor(c => new Date(c.getFullYear(), c.getMonth() + n, 1));

  /* バーティカル週間：表示中の週（月曜始まり） */
  const mondayOf = (dStr) => {
    const d = new Date(dStr + 'T00:00:00');
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  };
  const [weekStart, setWeekStart] = useState(() => mondayOf(date));
  const shiftWeek = (n) => setWeekStart(w => {
    const d = new Date(w); d.setDate(d.getDate() + n * 7); return d;
  });
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart); d.setDate(d.getDate() + i);
      return getLocalDateString(d);
    }),
    [weekStart]
  );

  /* 英検・TOEIC は固定枠。以前 TOEIC を自由登録側に入れていた場合はそちらから拾う */
  const rawCustom = useMemo(
    () => (Array.isArray(profile.customExams) ? profile.customExams : []),
    [profile.customExams]
  );
  const legacyToeic = useMemo(
    () => (/toeic/i.test(profile.otherName || '') ? (profile.otherDate || '') : ''),
    [profile.otherName, profile.otherDate]
  );
  const customToeic = useMemo(() => rawCustom.find(e => /toeic/i.test(e.name || '')), [rawCustom]);
  const toeicDate = profile.toeicDate || customToeic?.date || legacyToeic || '';

  /* 自由登録のテスト一覧（TOEIC は固定枠に移したので除く） */
  const customExams = useMemo(() => {
    const list = rawCustom.filter(e => e !== customToeic);
    if (list.length === 0 && !Array.isArray(profile.customExams) && profile.otherDate && !legacyToeic) {
      return [{ id: 'legacy', name: profile.otherName || (isEn ? 'Exam' : 'テスト'), date: profile.otherDate }];
    }
    return list;
  }, [rawCustom, customToeic, profile.customExams, profile.otherDate, profile.otherName, legacyToeic, isEn]);

  /* 保存は1回にまとめる（旧フィールドは読み込み時の取り込みだけに使う） */
  const updateCustomExams = (next) => onProfileUpdate?.('customExams', next);

  /* 試験の並び順はユーザーが決められる。未設定のうちは日付が近い順 */
  const examEntries = useMemo(() => {
    const base = [
      { id: 'eiken', name: isEn ? 'Eiken' : '英検', date: profile.eikenDate || '', dateKey: 'eikenDate', fixed: true },
      { id: 'toeic', name: 'TOEIC TEST',            date: toeicDate,              dateKey: 'toeicDate', fixed: true },
      ...customExams.map((e, i) => ({ id: e.id || `ex${i}`, name: e.name || '', date: e.date || '', fixed: false, index: i })),
    ].map(e => ({ ...e, color: examColor(e.id) }));

    const order = Array.isArray(profile.examOrder) ? profile.examOrder : [];
    const rank = (e) => {
      const i = order.indexOf(e.id);
      return i === -1 ? order.length + 1 : i;
    };
    return [...base].sort((a, b) => {
      const d = rank(a) - rank(b);
      if (d !== 0) return d;
      return (a.date || '9999-99-99').localeCompare(b.date || '9999-99-99');
    });
  }, [profile.eikenDate, profile.examOrder, toeicDate, customExams, isEn]);

  const exams = useMemo(() => {
    const base = new Date().setHours(0, 0, 0, 0);
    return examEntries
      .filter(e => e.date)
      .map(e => ({
        ...e,
        name: e.name || (isEn ? 'Exam' : 'テスト'),
        daysLeft: Math.round((new Date(e.date + 'T00:00:00').getTime() - base) / 86400000),
      }));
  }, [examEntries, isEn]);

  /* 並べ替え：表示順そのものを保存する */
  const moveExam = (id, dir) => {
    const ids = examEntries.map(e => e.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    onProfileUpdate?.('examOrder', ids);
  };

  const examByDate = useMemo(() => {
    const m = {};
    exams.forEach(e => { m[e.date] = e; });
    return m;
  }, [exams]);

  /* TODO の分類（ユーザーが追加・変更できる） */
  const [showCatEditor, setShowCatEditor] = useState(false);
  const todoCats = useMemo(
    () => (Array.isArray(profile.todoCats) && profile.todoCats.length > 0 ? profile.todoCats : DEFAULT_TODO_CATS),
    [profile.todoCats]
  );
  const catOf = (id) => todoCats.find(c => c.id === id) || todoCats[0];
  const updateCats = (next) => onProfileUpdate?.('todoCats', next);

  /* 絵文字を選ぶポップアップ */
  const [emojiPicker, setEmojiPicker] = useState(null); // { mode:'cat'|'slot', index|key, top, left }
  const openEmojiPicker = (target, el) => {
    const r = el.getBoundingClientRect();
    const W = 262;
    setEmojiPicker({
      ...target,
      top: Math.min(r.bottom + 6, window.innerHeight - 300),
      left: Math.max(8, Math.min(r.left, window.innerWidth - W - 8)),
      width: W,
    });
  };
  /* 絵文字を選んだとき：分類に設定するか、予定の文字に差し込むか */
  const applyEmoji = (em) => {
    if (!emojiPicker) return;
    if (emojiPicker.mode === 'slot') {
      onSavePlan?.(emojiPicker.key, `${plans[emojiPicker.key] || ''}${em}`);
    } else {
      updateCats(todoCats.map((x, j) => j === emojiPicker.index ? { ...x, emoji: em } : x));
      setEmojiPicker(null);
    }
  };

  /* 時間帯の予定を入れるポップアップ */
  const [slotEditor, setSlotEditor] = useState(null); // { key, top, left }
  const openSlot = (key, el) => {
    if (!onSavePlan) return;
    const r = el.getBoundingClientRect();
    const W = 260;
    setSlotEditor({
      key,
      top: Math.min(r.bottom + 6, window.innerHeight - 220),
      left: Math.max(8, Math.min(r.left, window.innerWidth - W - 8)),
      width: W,
    });
  };
  const closeSlot = () => setSlotEditor(null);

  /* 分類タブ。選んだタブに追加していく */
  const [todoTab, setTodoTab] = useState('all');
  const [expandedTodo, setExpandedTodo] = useState(null);
  const activeCatId = todoTab === 'all' ? (todoCats[0]?.id || 'english') : todoTab;
  const shownTodos = todoTab === 'all' ? todos : todos.filter(t => catOf(t.cat).id === todoTab);
  /* 分類チップを押すと次の分類へ移す（プルダウンの代わり） */
  const cycleCat = (t) => {
    const i = todoCats.findIndex(c => c.id === catOf(t.cat).id);
    onUpdateTodo?.(t.id, { cat: todoCats[(i + 1) % todoCats.length].id });
  };

  /* 日付ごとの TODO（実施日と期限をそれぞれ引けるようにする） */
  const todosByDate = useMemo(() => {
    const m = {};
    todos.forEach(t => {
      if (t.date) (m[t.date] ||= { on: [], due: [] }).on.push(t);
      if (t.due && t.due !== t.date) (m[t.due] ||= { on: [], due: [] }).due.push(t);
    });
    return m;
  }, [todos]);

  /* 入力済みタグの候補 */
  const allTags = useMemo(() => {
    const set = new Set();
    todos.forEach(t => (t.tags || []).forEach(x => set.add(x)));
    return [...set].sort();
  }, [todos]);

  const handlePick = (d) => { if (!d) return; setDate?.(d); onSelectDate?.(d); };

  /* 月表示でマスを選んだら、その日を含む週の時間割へ移動する */
  const openWeekOf = (d) => {
    if (!d) return;
    handlePick(d);
    setWeekStart(mondayOf(d));
    setView('agenda');
  };

  /* その日の時間割で最初に書かれている予定（月表示のマスに出す） */
  const firstSlotOf = (d) => {
    for (const h of HOURS) {
      const t = plans[`${d}T${String(h).padStart(2, '0')}`];
      if (t && t.trim()) return `${h}:00 ${t}`;
    }
    return '';
  };

  const weekLabels = isEn ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['月', '火', '水', '木', '金', '土', '日'];
  /* 土日は仕事・学校が休みの想定。列ごと色を変えて「休み」と分かるようにする */
  const isWeekendCol = (i) => i >= 5;                            // 月曜始まりなので 5=土, 6=日
  const weekendInk   = (i) => (i === 5 ? '#2a78d6' : '#db2777'); // 土=青 日=赤（日本のカレンダー慣習）

  const monthLabel = isEn
    ? cursor.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    : `${cursor.getFullYear()}年${cursor.getMonth() + 1}月`;

  const navBtn = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '32px', height: '32px', flexShrink: 0,
    borderRadius: '10px', cursor: 'pointer',
    border: `1px solid ${hud.chipIn}`, background: '#ffffff', color: '#6b74a0',
    boxShadow: '0 1px 3px rgba(30,27,75,0.05)', WebkitTapHighlightColor: 'transparent',
  };
  const orderBtn = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '20px', height: '14px', padding: 0, borderRadius: '4px',
    border: `1px solid ${hud.chipIn}`, background: '#ffffff', color: '#6b74a0',
  };
  const miniField = {
    boxSizing: 'border-box', padding: '3px 6px', borderRadius: '6px',
    border: `1px solid ${hud.line}`, background: '#fbfcff',
    fontSize: '10px', fontWeight: '700', color: '#334155',
    outline: 'none', fontFamily: 'inherit',
  };
  const fieldStyle = {
    flex: 1, minWidth: 0, boxSizing: 'border-box',
    padding: '6px 9px', borderRadius: '8px',
    border: `1px solid ${hud.chipIn}`, background: '#fbfcff',
    fontSize: '12px', fontWeight: '700', color: '#334155',
    outline: 'none', fontFamily: 'inherit',
  };

  return (
    <div style={{ width: '100%', marginBottom: '25px', boxSizing: 'border-box' }}>
      <div style={{
        ...hudPanelStyle(isMobile),
        borderRadius: 'clamp(16px, 4vw, 24px)',
        boxShadow: '0 22px 50px rgba(30, 27, 75, 0.18), 0 8px 16px rgba(30, 27, 75, 0.08), 0 0 0 1px rgba(79, 70, 229, 0.07)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: open ? (isMobile ? '14px' : '16px') : '0' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <span style={{
              width: '7px', height: '7px', borderRadius: '50%', background: '#818cf8',
              boxShadow: '0 0 7px #818cf8', animation: 'hudPulse 1.8s ease-in-out infinite',
            }}/>
            <span style={{ fontSize: '10px', fontWeight: '900', letterSpacing: '0.22em', color: hud.label }}>
              {isEn ? 'STUDY CALENDAR' : '学習カレンダー'}
            </span>
          </span>

          {/* 閉じているときは、直近の試験だけ小さく残す */}
          {!open && exams.filter(e => e.daysLeft >= 0).slice(0, 2).map(e => (
            <span key={e.date} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '900', color: hud.label }}>
              <Star size={10} color={e.color} fill={e.color} strokeWidth={0}/>
              <span style={{ color: '#334155' }}>{e.name}</span>
              <span style={{ color: e.color }}>{isEn ? `in ${e.daysLeft}d` : `あと${e.daysLeft}日`}</span>
            </span>
          ))}

          {onProfileUpdate && (
            <button type="button" className="action-btn" onClick={() => setShowExamForm(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px', marginLeft: 'auto',
                padding: '5px 12px', borderRadius: '50px', cursor: 'pointer',
                border: `1px solid ${hud.chipIn}`, background: '#ffffff', color: '#6b74a0',
                fontSize: '11px', fontWeight: '900',
              }}>
              <Star size={12} color={EXAM_COLORS[0]}/>
              {isEn ? (showExamForm ? 'Close' : 'Exam dates') : (showExamForm ? '閉じる' : '試験日の登録')}
              {showExamForm ? <ChevronUp size={13} strokeWidth={3}/> : <ChevronDown size={13} strokeWidth={3}/>}
            </button>
          )}

          <button type="button" className="action-btn" onClick={toggleOpen}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              marginLeft: onProfileUpdate ? 0 : 'auto',
              padding: '5px 12px', borderRadius: '50px', cursor: 'pointer',
              border: `1px solid ${hud.chipIn}`, background: '#ffffff', color: '#4f46e5',
              fontSize: '11px', fontWeight: '900',
            }}>
            {isEn ? (open ? 'Close' : 'Open') : (open ? '閉じる' : '開く')}
            {open ? <ChevronUp size={13} strokeWidth={3}/> : <ChevronDown size={13} strokeWidth={3}/>}
          </button>
        </div>

          {onProfileUpdate && showExamForm && (
            <div style={{
              flex: '1 1 100%', minWidth: 0,
              padding: '10px 12px', borderRadius: '12px', background: '#ffffff', border: `1px dashed ${hud.chipIn}`,
            }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: hud.label, marginBottom: '8px' }}>
                {isEn ? 'Use ↑↓ to change the order shown above.' : '↑↓ で、上の「あと◯日」の並び順を変えられます。'}
              </div>

              {examEntries.map((ex, i) => (
                <div key={ex.id} style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px' }}>
                  {/* 並べ替え */}
                  <span style={{ display: 'flex', flexDirection: 'column', gap: '1px', flexShrink: 0 }}>
                    <button type="button" className="hud-step" onClick={() => moveExam(ex.id, -1)}
                      disabled={i === 0} title={isEn ? 'Move up' : '上へ'}
                      style={{ ...orderBtn, opacity: i === 0 ? 0.3 : 1, cursor: i === 0 ? 'default' : 'pointer' }}>
                      <ChevronUp size={11} strokeWidth={3}/>
                    </button>
                    <button type="button" className="hud-step" onClick={() => moveExam(ex.id, 1)}
                      disabled={i === examEntries.length - 1} title={isEn ? 'Move down' : '下へ'}
                      style={{ ...orderBtn, opacity: i === examEntries.length - 1 ? 0.3 : 1, cursor: i === examEntries.length - 1 ? 'default' : 'pointer' }}>
                      <ChevronDown size={11} strokeWidth={3}/>
                    </button>
                  </span>

                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: ex.color, flexShrink: 0 }}/>

                  {/* 英検・TOEIC は名前固定、その他は自由入力 */}
                  {ex.fixed ? (
                    <span style={{ flex: '1 1 150px', minWidth: 0, fontSize: '12px', fontWeight: '900', color: '#334155' }}>
                      {ex.name}
                    </span>
                  ) : (
                    <input
                      value={ex.name}
                      onChange={e => updateCustomExams(customExams.map((x, j) => j === ex.index ? { ...x, name: e.target.value } : x))}
                      placeholder={isEn ? 'Test name' : 'テスト名（例：2学期中間テスト）'}
                      style={{ ...fieldStyle, flex: '1 1 150px', minWidth: 0 }}
                    />
                  )}

                  <input type="date" value={ex.date}
                    onChange={e => ex.fixed
                      ? onProfileUpdate(ex.dateKey, e.target.value)
                      : updateCustomExams(customExams.map((x, j) => j === ex.index ? { ...x, date: e.target.value } : x))}
                    style={{ ...fieldStyle, flex: '0 0 148px' }}/>

                  {ex.fixed ? (
                    <span style={{ width: '26px', flexShrink: 0 }}/>
                  ) : (
                    <button type="button" className="hud-step"
                      onClick={() => updateCustomExams(customExams.filter((_, j) => j !== ex.index))}
                      title={isEn ? 'Remove' : '削除'}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '26px', height: '26px', flexShrink: 0, borderRadius: '8px', cursor: 'pointer',
                        border: `1px solid ${hud.chipIn}`, background: '#ffffff', color: '#a8b1d1',
                      }}>
                      <X size={13} strokeWidth={3}/>
                    </button>
                  )}
                </div>
              ))}

                              <button type="button" className="action-btn"
                onClick={() => updateCustomExams([...customExams, { id: `ex${Date.now()}`, name: '', date: '' }])}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '5px 12px', borderRadius: '8px', cursor: 'pointer',
                  border: `1px dashed ${hud.chipIn}`, background: '#fbfcff', color: '#4f46e5',
                  fontSize: '11px', fontWeight: '900',
                }}>
                <Plus size={13} strokeWidth={3}/>{isEn ? 'Add a test' : 'テストを追加'}
              </button>
            </div>
          )}

        {open && (<>

        {/* タブ + 月の切り替え */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <div style={{ display: 'flex', gap: '4px', background: '#eef1fa', padding: '4px', borderRadius: '12px' }}>
            {[
              ['month',  isEn ? 'Month'    : '月',   <LayoutGrid size={14}/>],
              ['agenda', isEn ? 'Schedule' : '予定', <ListChecks size={14}/>],
              ['todo',   'TODO',                     <CheckSquare size={14}/>],
            ].map(([v, label, icon]) => (
              <button key={v} type="button" className="action-btn" onClick={() => setView(v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7px 15px', borderRadius: '9px', border: 'none', cursor: 'pointer',
                  background: view === v ? '#ffffff' : 'transparent',
                  color: view === v ? '#4f46e5' : '#7c86a8',
                  fontWeight: '900', fontSize: '12px',
                  boxShadow: view === v ? '0 2px 8px rgba(30,27,75,0.10)' : 'none',
                }}>
                {icon}{label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button type="button" className="hud-step" style={navBtn} onClick={() => shiftMonth(-1)}
              aria-label={isEn ? 'Previous month' : '前の月'}>
              <ChevronLeft size={17} strokeWidth={3}/>
            </button>
            <span style={{ fontSize: 'clamp(1rem, 3.2vw, 1.25rem)', fontWeight: '900', color: '#1e293b', minWidth: '120px', textAlign: 'center' }}>
              {monthLabel}
            </span>
            <button type="button" className="hud-step" style={navBtn} onClick={() => shiftMonth(1)}
              aria-label={isEn ? 'Next month' : '次の月'}>
              <ChevronRight size={17} strokeWidth={3}/>
            </button>
          </div>
        </div>

        {view === 'todo' ? (
          /* TODO：分類つきのチェックリスト */
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {/* 分類の凡例 */}
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {[{ id: 'all', name: isEn ? 'All' : 'すべて', color: '#6b74a0' }, ...todoCats].map(c => {
                  const on = todoTab === c.id;
                  const count = c.id === 'all' ? todos.length : todos.filter(t => catOf(t.cat).id === c.id).length;
                  return (
                    <button key={c.id} type="button" className="action-btn" onClick={() => setTodoTab(c.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '5px 12px', borderRadius: '50px', cursor: 'pointer',
                        border: on ? `1.5px solid ${c.color}` : `1px solid ${hud.line}`,
                        background: on ? c.color : '#ffffff',
                        color: on ? '#ffffff' : c.color,
                        fontSize: '11px', fontWeight: '900',
                        boxShadow: on ? `0 4px 10px ${c.color}44` : 'none',
                      }}>
                      {c.id !== 'all' && c.emoji ? `${c.emoji} ` : ''}{c.name}
                      <span style={{
                        fontSize: '9px', fontWeight: '900',
                        padding: '1px 6px', borderRadius: '50px',
                        background: on ? 'rgba(255,255,255,0.25)' : '#eef1fa',
                        color: on ? '#ffffff' : hud.label,
                      }}>{count}</span>
                    </button>
                  );
                })}
                {onProfileUpdate && (
                  <button type="button" className="action-btn" onClick={() => setShowCatEditor(v => !v)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      padding: '4px 10px', borderRadius: '50px', cursor: 'pointer',
                      border: `1px dashed ${hud.chipIn}`, background: '#ffffff', color: '#6b74a0',
                      fontSize: '10.5px', fontWeight: '900',
                    }}>
                    <Tag size={11}/>{isEn ? (showCatEditor ? 'Close' : 'Edit tags') : (showCatEditor ? '閉じる' : '分類を編集')}
                  </button>
                )}
              </span>

              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {todos.some(t => t.done) && onClearDone && (
                  <button type="button" className="action-btn" onClick={onClearDone}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      padding: '5px 11px', borderRadius: '8px', cursor: 'pointer',
                      border: `1px solid ${hud.chipIn}`, background: '#ffffff', color: '#7c86a8',
                      fontSize: '10px', fontWeight: '900',
                    }}>
                    <Trash2 size={12}/>{isEn ? 'Clear done' : '完了を消す'}
                  </button>
                )}
                {onAddTodo && (
                  <button type="button" className="action-btn" onClick={() => onAddTodo(activeCatId)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      padding: '6px 13px', borderRadius: '8px', cursor: 'pointer',
                      border: 'none', background: '#4f46e5', color: '#ffffff',
                      fontSize: '11px', fontWeight: '900', boxShadow: '0 4px 10px rgba(79,70,229,0.3)',
                    }}>
                    <Plus size={13} strokeWidth={3}/>{isEn ? 'Add' : 'TODOを追加'}
                  </button>
                )}
              </span>
            </div>

            {/* 分類の編集 */}
            {showCatEditor && onProfileUpdate && (
              <div style={{
                marginBottom: '10px', padding: '10px 12px', borderRadius: '12px',
                background: '#ffffff', border: `1px dashed ${hud.chipIn}`,
              }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: hud.label, marginBottom: '8px' }}>
                  {isEn ? 'Rename, recolor (tap the swatch) or add your own.' : '名前の変更、色の変更（四角をタップ）、追加ができます。'}
                </div>
                {todoCats.map((c, i) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px' }}>
                    <button type="button" className="hud-step"
                      onClick={() => {
                        const next = TODO_COLORS[(TODO_COLORS.indexOf(c.color) + 1) % TODO_COLORS.length];
                        updateCats(todoCats.map((x, j) => j === i ? { ...x, color: next } : x));
                      }}
                      title={isEn ? 'Change color' : '色を変える'}
                      style={{
                        width: '22px', height: '22px', flexShrink: 0, padding: 0, cursor: 'pointer',
                        borderRadius: '7px', border: `1px solid ${c.color}`, background: c.color,
                      }}/>
                    <button type="button" className="hud-step"
                      onClick={e => openEmojiPicker({ mode: 'cat', index: i }, e.currentTarget)}
                      title={isEn ? 'Pick an emoji' : '絵文字を選ぶ'}
                      style={{
                        ...fieldStyle, flex: '0 0 46px', textAlign: 'center', fontSize: '16px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        height: '30px', cursor: 'pointer', background: '#ffffff',
                      }}>
                      {c.emoji || '🙂'}
                    </button>
                    <input
                      value={c.name}
                      onChange={e => updateCats(todoCats.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                      placeholder={isEn ? 'Name' : '分類名'}
                      style={{ ...fieldStyle, flex: '1 1 140px', minWidth: 0 }}
                    />
                    {todoCats.length > 1 && (
                      <button type="button" className="hud-step"
                        onClick={() => updateCats(todoCats.filter((_, j) => j !== i))}
                        title={isEn ? 'Remove' : '削除'}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '26px', height: '26px', flexShrink: 0, borderRadius: '8px', cursor: 'pointer',
                          border: `1px solid ${hud.chipIn}`, background: '#ffffff', color: '#a8b1d1',
                        }}>
                        <X size={13} strokeWidth={3}/>
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" className="action-btn"
                  onClick={() => updateCats([...todoCats, {
                    id: `c${Date.now()}`, name: '', emoji: '🔖',
                    color: TODO_COLORS[todoCats.length % TODO_COLORS.length],
                  }])}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '5px 12px', borderRadius: '8px', cursor: 'pointer',
                    border: `1px dashed ${hud.chipIn}`, background: '#fbfcff', color: '#4f46e5',
                    fontSize: '11px', fontWeight: '900',
                  }}>
                  <Plus size={13} strokeWidth={3}/>{isEn ? 'Add a category' : '分類を追加'}
                </button>
              </div>
            )}

            {shownTodos.length === 0 ? (
              <div style={{ padding: '26px 10px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: hud.label }}>
                {isEn
                  ? 'No tasks here yet. Press Add to start.'
                  : `${todoTab === 'all' ? '' : `「${catOf(todoTab).name}」に`}まだTODOがありません。「TODOを追加」から入力できます。`}
              </div>
            ) : (
              <div className="custom-scrollbar" style={{ maxHeight: '420px', overflowY: 'auto', paddingRight: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {shownTodos.map(t => {
                  const cat = catOf(t.cat);
                  const overdue = t.due && !t.done && t.due < today;
                  const open = expandedTodo === t.id;
                  const md = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`;
                  return (
                    <div key={t.id} style={{
                      display: 'flex', flexDirection: 'column',
                      padding: '9px 11px', borderRadius: '11px',
                      background: t.done ? '#f6f7fc' : '#ffffff',
                      border: `1px solid ${overdue ? '#f3c7cf' : hud.line}`,
                    }}>
                      {/* 本体：やることだけを1行で */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                        <button type="button" className="hud-step"
                          onClick={() => onUpdateTodo?.(t.id, { done: !t.done })}
                          title={isEn ? 'Done' : '完了'}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '20px', height: '20px', flexShrink: 0, padding: 0,
                            borderRadius: '6px', cursor: 'pointer',
                            border: t.done ? `1px solid ${cat.color}` : `1.5px solid ${hud.chipIn}`,
                            background: t.done ? cat.color : '#ffffff', color: '#ffffff',
                          }}>
                          {t.done && <Check size={13} strokeWidth={4}/>}
                        </button>

                        <button type="button" className="action-btn" onClick={() => cycleCat(t)}
                          title={isEn ? 'Change category' : '分類を変える（押すと次へ）'}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0,
                            padding: '4px 9px', borderRadius: '50px', cursor: 'pointer',
                            border: `1px solid ${cat.color}55`, background: `${cat.color}14`,
                            color: cat.color, fontSize: '10px', fontWeight: '900',
                            maxWidth: isMobile ? '92px' : '120px',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                          {cat.emoji}{cat.name}
                        </button>

                        <input
                          value={t.text || ''}
                          onChange={e => onUpdateTodo?.(t.id, { text: e.target.value })}
                          placeholder={isEn ? 'What needs doing?' : 'やることを入力'}
                          style={{
                            ...fieldStyle, flex: 1, minWidth: 0,
                            border: '1px solid transparent', background: 'transparent',
                            fontSize: '12.5px',
                            color: t.done ? '#98a1c0' : '#334155',
                            textDecoration: t.done ? 'line-through' : 'none',
                          }}
                        />

                        {/* 設定済みの内容をひと目で（閉じている時だけ） */}
                        {!open && (t.date || t.due || (t.tags || []).length > 0) && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0, fontSize: '10px', fontWeight: '900' }}>
                            {t.date && <span style={{ color: hud.label }}>{md(t.date)}</span>}
                            {t.due && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: overdue ? '#be123c' : hud.label }}>
                                <Flag size={10}/>{md(t.due)}
                              </span>
                            )}
                            {(t.tags || []).slice(0, isMobile ? 1 : 2).map(tag => (
                              <span key={tag} style={{
                                padding: '2px 7px', borderRadius: '50px',
                                background: '#eef1fa', border: `1px solid ${hud.chipIn}`,
                                color: '#5b648c', fontSize: '9.5px',
                                maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>{tag}</span>
                            ))}
                          </span>
                        )}

                        <button type="button" className="hud-step"
                          onClick={() => setExpandedTodo(open ? null : t.id)}
                          title={isEn ? 'Details' : '日付・期限・タグ'}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '22px', height: '22px', flexShrink: 0, padding: 0,
                            borderRadius: '6px', cursor: 'pointer',
                            border: `1px solid ${open ? '#c9cfe8' : 'transparent'}`,
                            background: open ? '#eef1fa' : 'transparent', color: '#98a1c0',
                          }}>
                          {open ? <ChevronUp size={13} strokeWidth={3}/> : <ChevronDown size={13} strokeWidth={3}/>}
                        </button>

                        {onRemoveTodo && (
                          <button type="button" className="slot-clear" onClick={() => onRemoveTodo(t.id)}
                            title={isEn ? 'Delete' : '削除'}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '22px', height: '22px', flexShrink: 0, padding: 0,
                              borderRadius: '6px', border: 'none', background: 'transparent',
                              color: '#98a1c0', cursor: 'pointer',
                            }}>
                            <X size={13} strokeWidth={3}/>
                          </button>
                        )}
                      </div>

                      {/* 詳細：開いたときだけ */}
                      {open && (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
                          marginTop: '9px', paddingTop: '9px', borderTop: `1px solid ${hud.line}`,
                        }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <CalendarDays size={12} color={hud.label}/>
                            <span style={{ fontSize: '9px', fontWeight: '900', color: hud.label }}>{isEn ? 'On' : '日付'}</span>
                            <input type="date" value={t.date || ''}
                              onChange={e => onUpdateTodo?.(t.id, { date: e.target.value })}
                              style={{ ...miniField, borderColor: t.date ? hud.chipIn : hud.line }}/>
                          </span>

                          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Flag size={12} color={overdue ? '#db2777' : hud.label}/>
                            <span style={{ fontSize: '9px', fontWeight: '900', color: overdue ? '#db2777' : hud.label }}>{isEn ? 'Due' : '期限'}</span>
                            <input type="date" value={t.due || ''}
                              onChange={e => onUpdateTodo?.(t.id, { due: e.target.value })}
                              style={{
                                ...miniField,
                                borderColor: overdue ? '#f0a8b8' : t.due ? hud.chipIn : hud.line,
                                background: overdue ? '#fff5f7' : '#fbfcff',
                                color: overdue ? '#be123c' : '#334155',
                              }}/>
                          </span>

                          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: '1 1 180px', minWidth: 0 }}>
                            <Tag size={12} color={hud.label}/>
                            <input
                              list="todo-tag-list"
                              value={(t.tags || []).join(', ')}
                              onChange={e => onUpdateTodo?.(t.id, {
                                tags: e.target.value.split(',').map(x => x.trim()).filter(Boolean),
                              })}
                              placeholder={isEn ? 'tags (comma separated)' : 'タグ（カンマ区切り）'}
                              style={{ ...miniField, flex: 1, minWidth: 0 }}
                            />
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* 入力済みタグの候補 */}
                <datalist id="todo-tag-list">
                  {allTags.map(tag => <option key={tag} value={tag}/>)}
                </datalist>
              </div>
            )}
          </div>
        ) : view === 'month' ? (
          <>
            {/* 曜日 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px', marginBottom: '5px' }}>
              {weekLabels.map((w, i) => (
                <div key={i} style={{
                  textAlign: 'center', fontSize: '11px', fontWeight: '900',
                  padding: '5px 0', borderRadius: '7px',
                  color: isWeekendCol(i) ? weekendInk(i) : '#5b648c',
                  background: isWeekendCol(i) ? (i === 5 ? '#f2f7fd' : '#fdf2f6') : '#f3f5fd',
                }}>
                  {w}
                </div>
              ))}
            </div>

            {/* 日付のマス：中は白のまま。学習量は下の帯の長さで示す */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px' }}>
              {cells.map((d, i) => {
                if (!d) return <div key={`e${i}`}/>;
                const mins    = minutesByDate[d] || 0;
                const lv      = levelOf(mins);
                const col     = i % 7;
                const holiday = holidayName(d);
                const isRest  = isWeekendCol(col) || !!holiday;
                const exam    = examByDate[d];
                const plan    = plans[d] || firstSlotOf(d);
                const bucket  = todosByDate[d];
                const dayTodos = bucket
                  ? [...bucket.on.map(t => ({ kind: 'on', t })), ...bucket.due.map(t => ({ kind: 'due', t }))]
                  : [];
                const isToday = d === today;
                const isSel   = d === date;
                const numInk  = holiday ? HOLIDAY_INK : isWeekendCol(col) ? weekendInk(col) : '#334155';
                return (
                  <button
                    key={d}
                    type="button"
                    className="cal-cell"
                    onClick={() => openWeekOf(d)}
                    title={`${d}${holiday ? `（${holiday}）` : ''}　${mins > 0 ? `${formatMinutes(mins)}${getUnit(mins)}` : (isEn ? 'No record' : '記録なし')}${exam ? `　★${exam.name}` : ''}${plan ? `　📝${plan}` : ''}`}
                    style={{
                      position: 'relative',
                      minHeight: isMobile ? '70px' : '110px',
                      borderRadius: '10px',
                      border: isSel ? '2px solid #4f46e5' : `1px solid ${hud.line}`,
                      boxShadow: isSel ? '0 0 0 3px rgba(79,70,229,0.15)' : 'none',
                      /* 下地は白。土日祝だけごく淡く色をのせる */
                      background: holiday ? '#fff7f9' : isWeekendCol(col) ? '#fffaf7' : '#ffffff',
                      cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'stretch',
                      gap: '3px', padding: isMobile ? '5px 5px 14px' : '6px 7px 24px',
                      textAlign: 'left', overflow: 'hidden',
                      WebkitTapHighlightColor: 'transparent',
                    }}>
                    {/* 日付（今日は塗りつぶしの丸） */}
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                      <span className="timer-text" style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        minWidth: '22px', height: '22px', padding: '0 5px',
                        borderRadius: '50px',
                        background: isToday ? '#4f46e5' : 'transparent',
                        color: isToday ? '#ffffff' : numInk,
                        fontSize: isMobile ? '13px' : '15px', fontWeight: '900', lineHeight: 1,
                      }}>
                        {Number(d.slice(8))}
                      </span>
                      {exam && <Star size={11} color={exam.color} fill={exam.color} strokeWidth={0} style={{ flexShrink: 0 }}/>}
                    </span>

                    {/* 試験日 */}
                    {exam && !isMobile && (
                      <span style={{
                        fontSize: '9.5px', fontWeight: '900', lineHeight: 1.3,
                        color: '#ffffff', background: exam.color, borderRadius: '5px',
                        padding: '2px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {isEn ? `${exam.name} day` : `${exam.name} 当日`}
                      </span>
                    )}

                    {/* 予定 */}
                    {plan && (isMobile ? (
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', marginLeft: '1px', background: '#0e9aa7' }}/>
                    ) : (
                      <span style={{
                        fontSize: '9.5px', fontWeight: '800', lineHeight: 1.35,
                        color: '#334155', background: '#f2fbfc',
                        borderLeft: '2px solid #0e9aa7', borderRadius: '3px',
                        padding: '2px 4px', overflow: 'hidden',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      }}>
                        {plan}
                      </span>
                    ))}

                    {/* TODO と期限 */}
                    {!isMobile && dayTodos.slice(0, plan ? 1 : 2).map(item => (
                      <span key={`${item.kind}-${item.t.id}`} style={{
                        display: 'flex', alignItems: 'center', gap: '3px',
                        fontSize: '9px', fontWeight: '800', lineHeight: 1.3,
                        color: item.kind === 'due' ? '#be123c' : '#334155',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        textDecoration: item.t.done ? 'line-through' : 'none',
                        opacity: item.t.done ? 0.5 : 1,
                      }}>
                        {item.kind === 'due'
                          ? <Flag size={8} color="#be123c" style={{ flexShrink: 0 }}/>
                          : <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: catOf(item.t.cat).color, flexShrink: 0 }}/>}
                        {item.t.text || (isEn ? 'Task' : 'TODO')}
                      </span>
                    ))}
                    {dayTodos.length > 0 && (isMobile || dayTodos.length > (plan ? 1 : 2)) && (
                      <span style={{ fontSize: '8.5px', fontWeight: '900', color: '#7c86a8' }}>
                        {isMobile ? `TODO ${dayTodos.length}` : `+${dayTodos.length - (plan ? 1 : 2)}`}
                      </span>
                    )}

                    {/* 学習量：マスの下端に帯で示す（長さ＝その月で一番多い日との比） */}
                    {mins > 0 && (
                      <>
                        <span style={{
                          position: 'absolute', left: '7px', right: '7px', bottom: '6px', height: '5px',
                          borderRadius: '3px', background: hud.track,
                        }}/>
                        <span style={{
                          position: 'absolute', left: '7px', bottom: '6px', height: '5px',
                          width: `calc((100% - 14px) * ${Math.max(0.08, mins / maxDayMinutes)})`,
                          borderRadius: '3px', background: lv.color,
                          transition: 'width 0.3s ease',
                        }}/>
                        {!isMobile && (
                          <span className="timer-text" style={{
                            position: 'absolute', right: '7px', bottom: '14px',
                            fontSize: '9px', fontWeight: '900', color: '#7c86a8',
                          }}>
                            {formatMinutes(mins)}{getUnit(mins)}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          /* バーティカル週間（日を列・時間を行にした時間割） */
          <>
            {/* 週の切り替え */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '10px' }}>
              <button type="button" className="hud-step" style={navBtn} onClick={() => shiftWeek(-1)}
                aria-label={isEn ? 'Previous week' : '前の週'}>
                <ChevronLeft size={17} strokeWidth={3}/>
              </button>
              <span style={{ fontSize: '13px', fontWeight: '900', color: '#334155' }}>
                {`${Number(weekDates[0].slice(5, 7))}/${Number(weekDates[0].slice(8))}`}
                {' 〜 '}
                {`${Number(weekDates[6].slice(5, 7))}/${Number(weekDates[6].slice(8))}`}
              </span>
              <button type="button" className="hud-step" style={navBtn} onClick={() => shiftWeek(1)}
                aria-label={isEn ? 'Next week' : '次の週'}>
                <ChevronRight size={17} strokeWidth={3}/>
              </button>
            </div>

            <div className="custom-scrollbar" style={{ overflowX: 'auto', paddingBottom: '4px' }}>
              <div style={{ minWidth: isMobile ? '620px' : 'auto' }}>

                {/* 曜日・日付のヘッダー */}
                <div style={{ display: 'grid', gridTemplateColumns: `38px repeat(7, 1fr)`, gap: '3px', marginBottom: '3px' }}>
                  <div/>
                  {weekDates.map((d, i) => {
                    const holiday = holidayName(d);
                    const ink = holiday ? HOLIDAY_INK : isWeekendCol(i) ? weekendInk(i) : '#334155';
                    const isToday = d === today;
                    const mins = minutesByDate[d] || 0;
                    return (
                      <button key={d} type="button" onClick={() => handlePick(d)}
                        title={isEn ? 'Show this day' : 'この日の記録を見る'}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px',
                          padding: '5px 2px', borderRadius: '9px', cursor: 'pointer',
                          background: holiday ? HOLIDAY_EMPTY : isWeekendCol(i) ? REST_EMPTY : '#ffffff',
                          border: d === date ? '2px solid #1e1b4b' : isToday ? '2px solid #4f46e5' : `1px solid ${hud.line}`,
                        }}>
                        <span style={{ fontSize: '9px', fontWeight: '900', color: ink }}>{weekLabels[i]}</span>
                        <span className="timer-text" style={{ fontSize: '15px', fontWeight: '900', color: ink, lineHeight: 1 }}>
                          {Number(d.slice(8))}
                        </span>
                        {holiday && (
                          <span style={{ fontSize: '8px', fontWeight: '900', color: HOLIDAY_INK, lineHeight: 1.2, textAlign: 'center' }}>
                            {holiday}
                          </span>
                        )}
                        {examByDate[d] && (
                          <span style={{
                            display: 'flex', alignItems: 'center', gap: '3px', maxWidth: '100%',
                            padding: '1px 5px', borderRadius: '5px',
                            background: examByDate[d].color, color: '#ffffff',
                            fontSize: '8.5px', fontWeight: '900',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            <Star size={8} fill="currentColor" strokeWidth={0} style={{ flexShrink: 0 }}/>
                            {examByDate[d].name}
                          </span>
                        )}
                        {mins > 0 && (
                          <span className="timer-text" style={{ fontSize: '8.5px', fontWeight: '900', color: '#4f46e5' }}>
                            {formatMinutes(mins)}{getUnit(mins)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* 時間割：1時間ごとのマスに直接書き込める */}
                <div className="custom-scrollbar" style={{ maxHeight: '340px', overflowY: 'auto' }}>
                  {HOURS.map(h => (
                    <div key={h} style={{ display: 'grid', gridTemplateColumns: `38px repeat(7, 1fr)`, gap: '3px', marginBottom: '3px' }}>
                      <span className="timer-text" style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '5px',
                        fontSize: '10px', fontWeight: '900', color: hud.label,
                      }}>
                        {h}
                      </span>
                      {weekDates.map((d, i) => {
                        const slotKey = `${d}T${String(h).padStart(2, '0')}`;
                        const holiday = holidayName(d);
                        const rest = isWeekendCol(i) || !!holiday;
                        const text = plans[slotKey] || '';
                        const filled = !!text;
                        const slotCat = filled ? catOf(plans[catKeyOf(slotKey)]) : null;
                        return (
                          <button
                            key={slotKey}
                            type="button"
                            className="slot-cell"
                            disabled={!onSavePlan}
                            onClick={e => openSlot(slotKey, e.currentTarget)}
                            title={filled ? `${slotCat.emoji || ''} ${text}` : (isEn ? 'Add a plan' : '予定を入れる')}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '3px',
                              width: '100%', boxSizing: 'border-box', height: '26px',
                              padding: '0 6px', borderRadius: '6px', cursor: 'pointer',
                              border: `1px solid ${filled ? `${slotCat.color}66` : hud.line}`,
                              background: filled ? `${slotCat.color}14`
                                : holiday ? HOLIDAY_EMPTY
                                : rest ? REST_EMPTY
                                : '#ffffff',
                              fontSize: '11px', fontWeight: '700',
                              color: filled ? slotCat.color : '#c3cade',
                              overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                              textAlign: 'left',
                            }}>
                            {filled
                              ? <>{slotCat.emoji && <span style={{ flexShrink: 0 }}>{slotCat.emoji}</span>}<span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span></>
                              : <span style={{ opacity: 0.6 }}>＋</span>}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* その日の TODO・期限 */}
                {todos.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: `38px repeat(7, 1fr)`, gap: '3px', marginTop: '7px', paddingTop: '7px', borderTop: `1px solid ${hud.line}` }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '5px', fontSize: '9px', fontWeight: '900', color: hud.label }}>
                      TODO
                    </span>
                    {weekDates.map(d => {
                      const bucket = todosByDate[d];
                      const items = bucket
                        ? [...bucket.on.map(t => ({ kind: 'on', t })), ...bucket.due.map(t => ({ kind: 'due', t }))]
                        : [];
                      return (
                        <div key={`todo-${d}`} style={{ display: 'flex', flexDirection: 'column', gap: '3px', minHeight: '26px' }}>
                          {items.map(item => (
                            <span key={`${item.kind}-${item.t.id}`}
                              title={`${item.kind === 'due' ? (isEn ? 'Due: ' : '期限: ') : ''}${item.t.text}${(item.t.tags || []).length ? `　#${item.t.tags.join(' #')}` : ''}`}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '3px',
                                padding: '3px 5px', borderRadius: '6px',
                                fontSize: '9.5px', fontWeight: '800', lineHeight: 1.3,
                                color: item.kind === 'due' ? '#be123c' : '#334155',
                                background: item.kind === 'due' ? '#fff5f7' : `${catOf(item.t.cat).color}12`,
                                border: `1px solid ${item.kind === 'due' ? '#f0a8b8' : `${catOf(item.t.cat).color}44`}`,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                textDecoration: item.t.done ? 'line-through' : 'none',
                                opacity: item.t.done ? 0.55 : 1,
                              }}>
                              {item.kind === 'due'
                                ? <Flag size={8} color="#be123c" style={{ flexShrink: 0 }}/>
                                : <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: catOf(item.t.cat).color, flexShrink: 0 }}/>}
                              {item.t.text || (isEn ? 'Task' : 'TODO')}
                            </span>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* その日のメモ（手帳の DAILY REPORT にあたる行） */}
                <div style={{ display: 'grid', gridTemplateColumns: `38px repeat(7, 1fr)`, gap: '3px', marginTop: '7px', paddingTop: '7px', borderTop: `1px solid ${hud.line}` }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '5px', fontSize: '9px', fontWeight: '900', color: hud.label }}>
                    {isEn ? 'MEMO' : 'メモ'}
                  </span>
                  {weekDates.map(d => {
                    const filled = !!plans[d];
                    return (
                      <span key={`memo-${d}`} style={{ position: 'relative', display: 'block' }}>
                        <input
                          value={plans[d] || ''}
                          onChange={e => onSavePlan?.(d, e.target.value)}
                          disabled={!onSavePlan}
                          placeholder={isEn ? 'Memo' : 'メモ'}
                          style={{
                            width: '100%', boxSizing: 'border-box', height: '30px',
                            padding: filled ? '0 22px 0 6px' : '0 6px', borderRadius: '7px',
                            border: `1px solid ${filled ? '#c9cfe8' : hud.line}`,
                            background: filled ? '#ffffff' : '#fbfcff',
                            fontSize: '11px', fontWeight: '700', color: '#334155',
                            outline: 'none', fontFamily: 'inherit',
                          }}
                        />
                        {filled && onSavePlan && (
                          <button type="button" className="slot-clear"
                            onClick={() => onSavePlan(d, '')}
                            title={isEn ? 'Delete' : '削除'}
                            style={{
                              position: 'absolute', top: '50%', right: '3px', transform: 'translateY(-50%)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '17px', height: '17px', padding: 0,
                              borderRadius: '5px', border: 'none', background: 'transparent',
                              color: '#98a1c0', cursor: 'pointer',
                            }}>
                            <X size={11} strokeWidth={3}/>
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ===== 下段：まとめ・試験・凡例 ===== */}
        <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: `1px solid ${hud.line}` }}>
          {/* 試験までの残り日数（控えめに1行で） */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
            {exams.map(e => (
                <span key={e.date} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '900', color: hud.label }}>
                  <Star size={11} color={e.color} fill={e.color} strokeWidth={0}/>
                  <span style={{ color: '#334155' }}>{e.name}</span>
                  {e.daysLeft >= 0 ? (
                    <span style={{ color: e.color }}>
                      {isEn ? `in ${e.daysLeft} days` : `あと${e.daysLeft}日`}
                    </span>
                  ) : (
                    <span>{isEn ? 'done' : '終了'}</span>
                  )}
              </span>
            ))}

          </div>

          {/* 試験日の登録 + 凡例 */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginTop: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <span style={{ fontSize: '10px', fontWeight: '900', color: hud.label }}>{isEn ? 'Study time' : '学習量'}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                {LEVELS.map((l, i) => (
                  <span key={l.min} style={{ width: `${14 + i * 6}px`, height: '6px', borderRadius: '3px', background: l.color }}
                    title={l.max === Infinity ? `${l.min}${isEn ? 'min+' : '分以上'}` : `${l.min}〜${l.max}${isEn ? 'min' : '分'}`}/>
                ))}
              </span>
              <span style={{ fontSize: '10px', fontWeight: '900', color: hud.label }}>{isEn ? 'more' : '多い'}</span>
              <span style={{ width: '1px', height: '13px', background: hud.line, margin: '0 3px' }}/>
              <span style={{ fontSize: '10px', fontWeight: '900', color: '#2a78d6' }}>{isEn ? 'Sat' : '土'}</span>
              <span style={{ fontSize: '10px', fontWeight: '900', color: HOLIDAY_INK }}>{isEn ? 'Sun / Holiday' : '日・祝'}</span>
            </div>
          </div>
        </div>
        </>)}
      </div>

      {/* 絵文字を選ぶポップアップ */}
      {emojiPicker && (
        <>
          <div onClick={() => setEmojiPicker(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(30,27,75,0.12)' }}/>
          <div style={{
            position: 'fixed', zIndex: 51,
            top: `${emojiPicker.top}px`, left: `${emojiPicker.left}px`, width: `${emojiPicker.width}px`,
            padding: '12px', borderRadius: '14px',
            background: '#ffffff', border: `1px solid ${hud.chipIn}`,
            boxShadow: '0 20px 44px rgba(30,27,75,0.28)',
            maxHeight: '290px', overflowY: 'auto',
          }} className="custom-scrollbar">
            {EMOJI_SETS.map(set => (
              <div key={set.label} style={{ marginBottom: '9px' }}>
                <div style={{ fontSize: '9px', fontWeight: '900', letterSpacing: '0.1em', color: hud.label, marginBottom: '5px' }}>
                  {set.label}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px' }}>
                  {set.items.map(em => {
                    const on = emojiPicker.mode === 'cat' && todoCats[emojiPicker.index]?.emoji === em;
                    return (
                      <button key={em} type="button" className="hud-step"
                        onClick={() => applyEmoji(em)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          height: '32px', padding: 0, cursor: 'pointer', fontSize: '17px',
                          borderRadius: '8px',
                          border: `1px solid ${on ? '#4f46e5' : hud.line}`,
                          background: on ? '#eef1fa' : '#ffffff',
                        }}>
                        {em}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div style={{ paddingTop: '8px', borderTop: `1px solid ${hud.line}`, display: 'flex', gap: '7px', alignItems: 'center' }}>
              {emojiPicker.mode === 'cat' && (
                <input
                  value={todoCats[emojiPicker.index]?.emoji || ''}
                  onChange={e => updateCats(todoCats.map((x, j) => j === emojiPicker.index ? { ...x, emoji: e.target.value.slice(0, 2) } : x))}
                  onKeyDown={e => { if (e.key === 'Enter') setEmojiPicker(null); }}
                  placeholder={isEn ? 'custom' : '自分で入力'}
                  style={{ ...fieldStyle, flex: 1, textAlign: 'center', fontSize: '16px' }}
                />
              )}
              <button type="button" className="action-btn" onClick={() => setEmojiPicker(null)}
                style={{
                  marginLeft: 'auto', padding: '6px 16px', borderRadius: '9px', cursor: 'pointer',
                  border: 'none', background: '#4f46e5', color: '#ffffff',
                  fontSize: '11px', fontWeight: '900',
                }}>
                {isEn ? 'Done' : '完了'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* 時間帯の予定を入れるポップアップ */}
      {slotEditor && (
        <>
          <div onClick={closeSlot}
            style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(30,27,75,0.12)' }}/>
          <div style={{
            position: 'fixed', zIndex: 41,
            top: `${slotEditor.top}px`, left: `${slotEditor.left}px`, width: `${slotEditor.width}px`,
            padding: '12px', borderRadius: '14px',
            background: '#ffffff', border: `1px solid ${hud.chipIn}`,
            boxShadow: '0 20px 44px rgba(30,27,75,0.28)',
          }}>
            <div style={{ fontSize: '10px', fontWeight: '900', color: hud.label, marginBottom: '9px' }}>
              {(() => {
                const [d, h] = slotEditor.key.split('T');
                return isEn
                  ? `${d}  ${Number(h)}:00`
                  : `${Number(d.slice(5, 7))}/${Number(d.slice(8))}（${weekLabels[(new Date(d + 'T00:00:00').getDay() + 6) % 7]}） ${Number(h)}:00`;
              })()}
            </div>

            {/* 分類を選ぶ */}
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '9px' }}>
              {todoCats.map(c => {
                const on = catOf(plans[catKeyOf(slotEditor.key)]).id === c.id;
                return (
                  <button key={c.id} type="button" className="action-btn"
                    onClick={() => onSavePlan(catKeyOf(slotEditor.key), c.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      padding: '5px 10px', borderRadius: '50px', cursor: 'pointer',
                      border: `1px solid ${on ? c.color : hud.line}`,
                      background: on ? c.color : '#ffffff',
                      color: on ? '#ffffff' : c.color,
                      fontSize: '10.5px', fontWeight: '900',
                    }}>
                    {c.emoji}{c.name}
                  </button>
                );
              })}
            </div>

            {/* 内容（絵文字も入れられる） */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                autoFocus
                value={plans[slotEditor.key] || ''}
                onChange={e => onSavePlan(slotEditor.key, e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') closeSlot(); }}
                placeholder={isEn ? 'What will you do?' : '内容を入力（Enterで閉じる）'}
                style={{ ...fieldStyle, flex: 1, minWidth: 0, fontSize: '12.5px', padding: '8px 10px' }}
              />
              <button type="button" className="hud-step"
                onClick={e => openEmojiPicker({ mode: 'slot', key: slotEditor.key }, e.currentTarget)}
                title={isEn ? 'Insert emoji' : '絵文字を入れる'}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '36px', flexShrink: 0, borderRadius: '8px', cursor: 'pointer',
                  border: `1px solid ${hud.chipIn}`, background: '#ffffff', fontSize: '15px',
                }}>
                🙂
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              {plans[slotEditor.key] && (
                <button type="button" className="action-btn"
                  onClick={() => { onSavePlan(slotEditor.key, ''); onSavePlan(catKeyOf(slotEditor.key), ''); closeSlot(); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '6px 12px', borderRadius: '9px', cursor: 'pointer',
                    border: `1px solid ${hud.chipIn}`, background: '#ffffff', color: '#a8b1d1',
                    fontSize: '11px', fontWeight: '900',
                  }}>
                  <X size={12} strokeWidth={3}/>{isEn ? 'Delete' : '削除'}
                </button>
              )}
              <button type="button" className="action-btn" onClick={closeSlot}
                style={{
                  marginLeft: 'auto', padding: '6px 16px', borderRadius: '9px', cursor: 'pointer',
                  border: 'none', background: '#4f46e5', color: '#ffffff',
                  fontSize: '11px', fontWeight: '900',
                }}>
                {isEn ? 'Done' : '完了'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
