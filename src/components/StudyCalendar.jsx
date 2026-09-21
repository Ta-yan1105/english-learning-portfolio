import { useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Star, Plus, X,
  LayoutGrid, ListChecks,
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
}) {
  const isEn = lang === 'en';
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
        <HudHeading text={isEn ? 'STUDY CALENDAR' : '学習カレンダー'} isMobile={isMobile}/>

        {/* タブ + 月の切り替え */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <div style={{ display: 'flex', gap: '4px', background: '#eef1fa', padding: '4px', borderRadius: '12px' }}>
            {[
              ['month',  isEn ? 'Month'    : '月',   <LayoutGrid size={14}/>],
              ['agenda', isEn ? 'Schedule' : '予定', <ListChecks size={14}/>],
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

        {view === 'month' ? (
          <>
            {/* 曜日 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px', marginBottom: '6px' }}>
              {weekLabels.map((w, i) => (
                <div key={i} style={{
                  textAlign: 'center', fontSize: '11px', fontWeight: '900',
                  color: isWeekendCol(i) ? weekendInk(i) : hud.label,
                }}>
                  {w}
                </div>
              ))}
            </div>

            {/* 日付のマス（予定も表示できる大きさ） */}
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
                const isToday = d === today;
                const isSel   = d === date;
                const deepFill = lv && mins >= 60; // 濃い下地は白文字にする
                return (
                  <button
                    key={d}
                    type="button"
                    className="cal-cell"
                    onClick={() => openWeekOf(d)}
                    title={`${d}${holiday ? `（${holiday}）` : ''}　${mins > 0 ? `${formatMinutes(mins)}${getUnit(mins)}` : (isEn ? 'No record' : '記録なし')}${exam ? `　★${exam.name}` : ''}${plan ? `　📝${plan}` : ''}`}
                    style={{
                      position: 'relative',
                      minHeight: isMobile ? '66px' : '104px',
                      borderRadius: '11px',
                      border: exam ? `2px solid ${exam.color}`
                        : isSel ? '2px solid #1e1b4b'
                        : isToday ? '2px solid #4f46e5'
                        : '1px solid rgba(30,27,75,0.06)',
                      background: lv ? lv.color : (holiday ? HOLIDAY_EMPTY : isRest ? REST_EMPTY : EMPTY),
                      cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'stretch',
                      gap: '3px', padding: isMobile ? '4px 5px' : '6px 7px',
                      textAlign: 'left', overflow: 'hidden',
                      WebkitTapHighlightColor: 'transparent',
                    }}>
                    {/* 日付と試験の印 */}
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                      <span className="timer-text" style={{
                        fontSize: isMobile ? '12px' : '13px', fontWeight: '900', lineHeight: 1,
                        color: deepFill ? '#ffffff'
                          : lv ? '#1e1b4b'
                          : holiday ? HOLIDAY_INK
                          : isRest ? weekendInk(col)
                          : '#98a1c0',
                      }}>
                        {Number(d.slice(8))}
                      </span>
                      {exam && <Star size={11} color={exam.color} fill={exam.color} strokeWidth={0}/>}
                    </span>

                    {/* 試験日は当日と分かるように名前を出す */}
                    {exam && !isMobile && (
                      <span style={{
                        fontSize: '9.5px', fontWeight: '900', lineHeight: 1.3,
                        color: '#ffffff', background: exam.color, borderRadius: '5px',
                        padding: '2px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {isEn ? `${exam.name} day` : `${exam.name} 当日`}
                      </span>
                    )}

                    {/* 予定：狭い画面は文字が切れて読めないので印だけにする */}
                    {plan && (isMobile ? (
                      <span style={{
                        width: '6px', height: '6px', borderRadius: '50%', marginLeft: '1px',
                        background: deepFill ? 'rgba(255,255,255,0.95)' : '#0e9aa7',
                      }}/>
                    ) : (
                      <span style={{
                        fontSize: '9.5px', fontWeight: '800', lineHeight: 1.35,
                        color: '#1e1b4b', background: 'rgba(255,255,255,0.88)',
                        border: '1px solid rgba(14,154,167,0.35)', borderRadius: '5px',
                        padding: '2px 4px', overflow: 'hidden',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      }}>
                        {plan}
                      </span>
                    ))}

                    {/* 学習時間 */}
                    {mins > 0 && (
                      <span className="timer-text" style={{
                        marginTop: 'auto', fontSize: isMobile ? '8.5px' : '9.5px', fontWeight: '900',
                        color: deepFill ? 'rgba(255,255,255,0.9)' : '#3730a3',
                      }}>
                        {formatMinutes(mins)}{getUnit(mins)}
                      </span>
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
                        const filled = !!plans[slotKey];
                        return (
                          <span key={slotKey} style={{ position: 'relative', display: 'block' }}>
                            <input
                              value={plans[slotKey] || ''}
                              onChange={e => onSavePlan?.(slotKey, e.target.value)}
                              disabled={!onSavePlan}
                              style={{
                                width: '100%', boxSizing: 'border-box', height: '26px',
                                padding: filled ? '0 22px 0 6px' : '0 6px', borderRadius: '6px',
                                border: `1px solid ${filled ? '#a9d8de' : hud.line}`,
                                background: filled ? '#eefafb'
                                  : holiday ? HOLIDAY_EMPTY
                                  : rest ? REST_EMPTY
                                  : '#ffffff',
                                fontSize: '11px', fontWeight: '700', color: '#334155',
                                outline: 'none', fontFamily: 'inherit',
                              }}
                            />
                            {filled && onSavePlan && (
                              <button type="button" className="slot-clear"
                                onClick={() => onSavePlan(slotKey, '')}
                                title={isEn ? 'Delete' : '削除'}
                                style={{
                                  position: 'absolute', top: '50%', right: '3px', transform: 'translateY(-50%)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  width: '17px', height: '17px', padding: 0,
                                  borderRadius: '5px', border: 'none', background: 'transparent',
                                  color: '#7c9aa0', cursor: 'pointer',
                                }}>
                                <X size={11} strokeWidth={3}/>
                              </button>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  ))}
                </div>

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

            {onProfileUpdate && (
              <button type="button" className="action-btn" onClick={() => setShowExamForm(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto',
                  padding: '4px 10px', borderRadius: '8px', cursor: 'pointer',
                  border: `1px solid ${hud.chipIn}`, background: '#ffffff', color: '#6b74a0',
                  fontSize: '10px', fontWeight: '900',
                }}>
                <Star size={11} color={EXAM_COLORS[0]}/>
                {isEn ? (showExamForm ? 'Close' : 'Exam dates') : (showExamForm ? '閉じる' : '試験日の登録')}
                {showExamForm ? <ChevronUp size={12} strokeWidth={3}/> : <ChevronDown size={12} strokeWidth={3}/>}
              </button>
            )}
          </div>

          {/* 試験日の登録 + 凡例 */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginTop: '10px' }}>
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <span style={{ fontSize: '10px', fontWeight: '900', color: hud.label }}>{isEn ? 'Less' : '少'}</span>
              <span style={{ width: '13px', height: '13px', borderRadius: '4px', background: EMPTY, border: '1px solid rgba(30,27,75,0.06)' }}/>
              {LEVELS.map(l => (
                <span key={l.min} style={{ width: '13px', height: '13px', borderRadius: '4px', background: l.color }}
                  title={l.max === Infinity ? `${l.min}${isEn ? 'min+' : '分以上'}` : `${l.min}〜${l.max}${isEn ? 'min' : '分'}`}/>
              ))}
              <span style={{ fontSize: '10px', fontWeight: '900', color: hud.label }}>{isEn ? 'More' : '多'}</span>
              <span style={{ width: '1px', height: '13px', background: hud.line, margin: '0 3px' }}/>
              <span style={{ width: '13px', height: '13px', borderRadius: '4px', background: REST_EMPTY, border: '1px solid rgba(219,39,119,0.18)' }}/>
              <span style={{ fontSize: '10px', fontWeight: '900', color: hud.label }}>{isEn ? 'Weekend' : '土日'}</span>
              <span style={{ width: '13px', height: '13px', borderRadius: '4px', background: HOLIDAY_EMPTY, border: `1px solid ${HOLIDAY_INK}44` }}/>
              <span style={{ fontSize: '10px', fontWeight: '900', color: hud.label }}>{isEn ? 'Holiday' : '祝日'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
