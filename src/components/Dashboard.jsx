import { useMemo } from 'react';
import {
  Activity, Sun, Calendar, CalendarDays,
  TrendingUp, Clock, Flame, BookOpen, PieChart,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell, LabelList,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { CATEGORIES, formatMinutes, getUnit, getLocalDateString } from '../constants';
import { hudPanelStyle, HudHeading, hud } from './hud';
import i18n from '../i18n';

const GRID     = '#e7eaf6'; // 目盛り線（面から一段だけ濃い）
const GAP      = '#f7f8fd'; // 積み上げの隙間＝パネル面の色
const AXIS_INK = '#9aa2c4'; // 軸ラベル

/* レーダーの頂点：技能色の点に面色の2pxリングを付けて重なりでも読めるようにする */
const renderRadarDot = ({ cx, cy, payload, index }) => {
  const datum = payload?.payload ?? payload; // recharts は点オブジェクトを渡すので元データを取り出す
  if (cx == null || cy == null || !datum?.today) return null; // 0分の技能は点を打たない
  return (
    <circle key={index} cx={cx} cy={cy} r={4.5} fill={datum.color} stroke={GAP} strokeWidth={2}/>
  );
};

const xAxisFormatter = (v) => {
  if (v <= 0) return '0';
  return `${formatMinutes(v)}${getUnit(v)}`;
};


export default function Dashboard({
  isMobile,
  lang = 'ja',
  logs,
  selectedRange, setSelectedRange,
  date,
  timeStats,
  streak,
}) {
  const T = i18n[lang];
  const chartData = useMemo(() => {
    const getBreakdown = (arr) => {
      const bd = {};
      CATEGORIES.forEach(c => { bd[c.id] = 0; });
      arr.forEach(l => {
        const cats = l.categories || [];
        if (cats.length > 0) {
          const v = Number(l.minutes) / cats.length;
          cats.forEach(c => { bd[c] = (bd[c] || 0) + v; });
        }
      });
      return bd;
    };

    if (selectedRange === 'day') {
      const skillMap = {};
      logs.filter(l => l.date === date).forEach(l =>
        (l.categories || []).forEach(c => { skillMap[c] = (skillMap[c] || 0) + (Number(l.minutes) || 0); })
      );
      return CATEGORIES.map(cat => ({ name: lang === 'en' ? cat.label_en : cat.label, value: skillMap[cat.id] || 0, color: cat.color }));
    }
    if (selectedRange === 'week') {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const base  = new Date(date + 'T00:00:00');
      const idx   = base.getDay() || 7;
      const start = new Date(base);
      if (idx !== 1) start.setDate(base.getDate() - idx + 1);
      return days.map((label, i) => {
        const d    = new Date(start); d.setDate(start.getDate() + i);
        const dStr = getLocalDateString(d);
        const dl   = logs.filter(l => l.date === dStr);
        return { name: label, value: dl.reduce((a, c) => a + (Number(c.minutes) || 0), 0), ...getBreakdown(dl) };
      });
    }
    if (selectedRange === 'month') {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const y = new Date(date + 'T00:00:00').getFullYear();
      return months.map((label, i) => {
        const ml = logs.filter(l => { const d = new Date(l.date + 'T00:00:00'); return d.getFullYear() === y && d.getMonth() === i; });
        return { name: label, value: ml.reduce((a, c) => a + (Number(c.minutes) || 0), 0), ...getBreakdown(ml) };
      });
    }
    if (selectedRange === 'year') {
      return [2026, 2027, 2028, 2029, 2030, 2031].map(y => {
        const yl = logs.filter(l => new Date(l.date + 'T00:00:00').getFullYear() === y);
        return { name: y.toString(), value: yl.reduce((a, c) => a + (Number(c.minutes) || 0), 0), ...getBreakdown(yl) };
      });
    }
    return [];
  }, [selectedRange, logs, date]);

  /* 日別レーダー：今日の各技能と、比較用の今週平均 */
  const radarData = useMemo(() => {
    if (selectedRange !== 'day') return [];
    const base  = new Date(date + 'T00:00:00');
    const idx   = base.getDay() || 7;
    const start = new Date(base);
    if (idx !== 1) start.setDate(base.getDate() - idx + 1);
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i);
      return getLocalDateString(d);
    });

    const sumBySkill = (rows) => {
      const m = {};
      rows.forEach(l => (l.categories || []).forEach(c => {
        m[c] = (m[c] || 0) + (Number(l.minutes) || 0);
      }));
      return m;
    };
    const todayMap = sumBySkill(logs.filter(l => l.date === date));
    const weekMap  = sumBySkill(logs.filter(l => weekDates.includes(l.date)));

    return CATEGORIES.map(cat => ({
      skill: lang === 'en' ? cat.label_en : cat.label,
      color: cat.color,
      today: todayMap[cat.id] || 0,
      weekAvg: Math.round(((weekMap[cat.id] || 0) / 7) * 10) / 10,
    }));
  }, [logs, date, selectedRange, lang]);

  const vocabStats = useMemo(() => {
    const todayStr = getLocalDateString(new Date());
    const ws = (() => { const d = new Date(); d.setHours(0,0,0,0); const day = d.getDay() || 7; if (day !== 1) d.setDate(d.getDate() - day + 1); return d; })();
    const ms = (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })();
    let day = 0, week = 0, month = 0, total = 0;
    logs.forEach(l => {
      const v = Number(l.vocabCount) || 0;
      total += v;
      if (l.date === todayStr) day += v;
      const ld = new Date(l.date + 'T00:00:00');
      if (ld >= ws) week += v;
      if (ld >= ms) month += v;
    });
    return { day, week, month, total };
  }, [logs]);

  const startOfWeek = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); const day = x.getDay() || 7; if (day !== 1) x.setDate(x.getDate() - day + 1); return x; };

  const weekComparison = useMemo(() => {
    const thisStart = startOfWeek(new Date());
    const lastStart = new Date(thisStart); lastStart.setDate(thisStart.getDate() - 7);
    const lastEnd   = new Date(thisStart); lastEnd.setDate(thisStart.getDate() - 1);
    let thisWeek = 0, lastWeek = 0;
    logs.forEach(l => {
      const d = new Date(l.date + 'T00:00:00');
      const m = Number(l.minutes) || 0;
      if (d >= thisStart) thisWeek += m;
      else if (d >= lastStart && d <= lastEnd) lastWeek += m;
    });
    const delta = thisWeek - lastWeek;
    const pct = lastWeek > 0 ? Math.round((delta / lastWeek) * 100) : (thisWeek > 0 ? 100 : null);
    return { thisWeek, lastWeek, delta, pct };
  }, [logs]);

  const skillBalance = useMemo(() => {
    const thisStart = startOfWeek(new Date());
    const weekLogs  = logs.filter(l => new Date(l.date + 'T00:00:00') >= thisStart);
    const totals = {};
    CATEGORIES.forEach(c => { totals[c.id] = 0; });
    let grandTotal = 0;
    weekLogs.forEach(l => {
      const cats = l.categories || [];
      if (cats.length === 0) return;
      const per = (Number(l.minutes) || 0) / cats.length;
      cats.forEach(c => { totals[c] = (totals[c] || 0) + per; });
      grandTotal += Number(l.minutes) || 0;
    });
    return CATEGORIES.map(c => ({ ...c, minutes: totals[c.id], pct: grandTotal > 0 ? (totals[c.id] / grandTotal) * 100 : 0 }))
      .filter(c => c.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes);
  }, [logs]);

  const card   ={ background: 'white', borderRadius: '24px', padding: isMobile ? '20px 15px' : '25px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', boxSizing: 'border-box', width: '100%' };
  const hStyle = { fontSize: '16px', fontWeight: '900', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' };
  const tabStyle = (r) => ({
    padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', border: 'none',
    backgroundColor: selectedRange === r ? '#ffffff' : 'transparent',
    color: selectedRange === r ? '#4f46e5' : '#64748b',
    display: 'flex', alignItems: 'center', gap: '4px',
    boxShadow: selectedRange === r ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
    transition: 'all 0.2s ease',
  });

  const customTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const total = payload[0].payload.value;
    if (selectedRange === 'day') {
      const d = payload[0].payload;
      if (d && d.skill !== undefined) {
        return (
          <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '12px', border: `1px solid ${hud.line}`, boxShadow: '0 8px 20px rgba(30,27,75,0.10)', fontSize: '11px', fontWeight: 'bold' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155', marginBottom: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: d.color, flexShrink: 0 }}/>
              {d.skill}
            </div>
            {[
              { label: lang === 'en' ? 'Today' : '今日', v: d.today, c: '#4f46e5' },
              { label: lang === 'en' ? 'Week avg' : '今週平均', v: d.weekAvg, c: '#c3cade' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', color: '#334155', marginTop: '3px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '12px', height: '3px', borderRadius: '2px', background: r.c, flexShrink: 0 }}/>
                  {r.label}
                </span>
                <span className="timer-text">{formatMinutes(r.v)}{getUnit(r.v)}</span>
              </div>
            ))}
          </div>
        );
      }
      const dayVocab = logs.filter(l => l.date === date && (l.categories || []).includes('Vocabulary'))
        .reduce((a, l) => a + (Number(l.vocabCount) || 0), 0);
      return (
        <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '12px', border: `1px solid ${hud.line}`, boxShadow: '0 8px 20px rgba(30,27,75,0.10)', fontSize: '11px', fontWeight: 'bold' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', color: '#334155' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: d.color, flexShrink: 0 }}/>
              {d.name}
            </span>
            <span className="timer-text">{formatMinutes(d.value)}{getUnit(d.value)}</span>
          </div>
          {dayVocab > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', color: '#334155', marginTop: '4px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#4a3aa7', flexShrink: 0 }}/>
                {lang === 'en' ? 'Vocab' : '単語'}
              </span>
              <span className="timer-text">{dayVocab}{lang === 'en' ? ' words' : '語'}</span>
            </div>
          )}
        </div>
      );
    }
    const periodVocab = (() => {
      if (selectedRange === 'week') {
        const base = new Date(date + 'T00:00:00');
        const idx  = base.getDay() || 7;
        const start = new Date(base);
        if (idx !== 1) start.setDate(base.getDate() - idx + 1);
        const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return getLocalDateString(d); });
        const dayStr = days[['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(label)];
        return logs.filter(l => l.date === dayStr).reduce((a, l) => a + (Number(l.vocabCount) || 0), 0);
      }
      if (selectedRange === 'month') {
        const y = new Date(date + 'T00:00:00').getFullYear();
        const mIdx = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(label);
        return logs.filter(l => { const d = new Date(l.date + 'T00:00:00'); return d.getFullYear() === y && d.getMonth() === mIdx; }).reduce((a, l) => a + (Number(l.vocabCount) || 0), 0);
      }
      if (selectedRange === 'year') {
        return logs.filter(l => new Date(l.date + 'T00:00:00').getFullYear() === Number(label)).reduce((a, l) => a + (Number(l.vocabCount) || 0), 0);
      }
      return 0;
    })();
    return (
      <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '12px', border: `1px solid ${hud.line}`, boxShadow: '0 8px 20px rgba(30,27,75,0.10)', fontSize: '11px', fontWeight: 'bold' }}>
        <div style={{ color: '#94a3b8', marginBottom: '6px' }}>{label}</div>
        {payload.map(entry => {
          const cat = CATEGORIES.find(c => c.id === entry.dataKey);
          if (!cat || entry.value === 0) return null;
          return (
            <div key={entry.dataKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', color: '#334155', marginBottom: '4px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: cat.color, flexShrink: 0 }}/>
                {lang === 'en' ? cat.label_en : cat.label}
              </span>
              <span className="timer-text">{formatMinutes(entry.value)}{getUnit(entry.value)}</span>
            </div>
          );
        })}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', color: '#1e293b', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
          <span>{T.tooltipTotal}</span><span>{formatMinutes(total)}{getUnit(total)}</span>
        </div>
        {periodVocab > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', color: '#4a3aa7', marginTop: '4px' }}>
            <span>{lang === 'en' ? 'Vocab' : '単語'}</span><span>{periodVocab}{lang === 'en' ? ' words' : '語'}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* チャートカード */}
      <section style={card} key={selectedRange}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <h2 style={{ ...hStyle, margin: 0, flexShrink: 0 }}><Activity size={18} color="#4f46e5"/> {T.analysisTitle}</h2>

          {/* 時間統計 + 単語数 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, maxWidth: '100%' }}>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
              {[
                { label: T.statDay,   value: timeStats.dayTotal },
                { label: T.statWeek,  value: timeStats.weekTotal },
                { label: T.statMonth, value: timeStats.monthTotal },
                { label: T.statYear,  value: timeStats.yearTotal },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: 'white', borderRadius: '7px', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '5px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                  <span style={{ fontSize: '11px', fontWeight: '900', color: '#94a3b8' }}>{label}</span>
                  <span className="timer-text" style={{ fontSize: '13px', fontWeight: '900', color: '#4f46e5' }}>{formatMinutes(value)}<span style={{ fontSize: '10px' }}>{getUnit(value)}</span></span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fff1f2', borderRadius: '7px', padding: '5px 10px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <Flame size={12} color="#ef4444"/>
                <span style={{ fontSize: '11px', fontWeight: '900', color: '#f87171' }}>{T.streakLabel}</span>
                <span className="timer-text" style={{ fontSize: '13px', fontWeight: '900', color: '#ef4444' }}>{streak}<span style={{ fontSize: '10px' }}>{T.streakUnit}</span></span>
              </div>
            </div>
            {vocabStats.total > 0 && (
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#f5f3ff', padding: '4px', borderRadius: '10px' }}>
                <BookOpen size={12} color="#4a3aa7" style={{ margin: '0 2px 0 6px', flexShrink: 0 }}/>
                {[
                  { label: T.statDay,   value: vocabStats.day },
                  { label: T.statWeek,  value: vocabStats.week },
                  { label: T.statMonth, value: vocabStats.month },
                  { label: lang === 'en' ? 'Total' : '累計', value: vocabStats.total },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: 'white', borderRadius: '7px', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '5px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                    <span style={{ fontSize: '11px', fontWeight: '900', color: '#94a3b8' }}>{label}</span>
                    <span className="timer-text" style={{ fontSize: '13px', fontWeight: '900', color: '#4a3aa7' }}>{value}<span style={{ fontSize: '10px' }}>{lang === 'en' ? 'w' : '語'}</span></span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '10px', flexShrink: 0, maxWidth: '100%' }}>
            {[
              { id: 'day',   label: 'DAY',   icon: <Sun size={14}/> },
              { id: 'week',  label: 'WEEK',  icon: <Calendar size={14}/> },
              { id: 'month', label: 'MONTH', icon: <CalendarDays size={14}/> },
              { id: 'year',  label: 'YEAR',  icon: <TrendingUp size={14}/> },
            ].map(tab => (
              <button className="action-btn" key={tab.id} onClick={() => setSelectedRange(tab.id)} style={tabStyle(tab.id)}>
                {tab.icon} <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{
          ...hudPanelStyle(isMobile),
          padding: isMobile ? '14px 10px 12px' : '16px 18px 14px',
          /* チャート自身が目盛りを持つので、パネルの方眼は敷かず無地の面にする */
          backgroundImage: 'none',
          background: 'linear-gradient(160deg, #fdfdff 0%, #f7f9fe 100%)',
        }}>
          <HudHeading
            text={`${{ day: T.chartLabelDay, week: T.chartLabelWeek, month: T.chartLabelMonth, year: T.chartLabelYear }[selectedRange]}${T.chartStudyTime}`}
            isMobile={isMobile}
          />

          <div style={{ height: isMobile ? '240px' : '260px', width: '100%' }}>
            {selectedRange === 'day' ? (
              /* 技能ごとの偏りを見る日は、7技能を軸にしたレーダーで「今日」と「今週平均」を重ねる */
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius={isMobile ? '68%' : '72%'} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    {/* 外周がわずかに沈む＝ドーム状の奥行き */}
                    <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%"   stopColor="#ffffff" stopOpacity="1"/>
                      <stop offset="72%"  stopColor="#fbfcff" stopOpacity="1"/>
                      <stop offset="100%" stopColor="#eceffb" stopOpacity="1"/>
                    </radialGradient>
                  </defs>
                  <PolarGrid gridType="polygon" stroke={GRID} strokeWidth={1} fill="url(#radarGlow)" fillOpacity={1}/>
                  <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11, fontWeight: 900, fill: '#334155' }}/>
                  {/* 目盛りは軸と軸の間に逃がして、技能名と重ならないようにする */}
                  <PolarRadiusAxis angle={64} axisLine={false} tickCount={3}
                    tick={{ fontSize: 9, fontWeight: 700, fill: AXIS_INK }}
                    tickFormatter={(v) => v > 0 ? xAxisFormatter(v) : ''}/>
                  <Tooltip content={customTooltip}/>
                  {/* 下敷き：今週平均（輪郭だけ） */}
                  <Radar name={lang === 'en' ? 'Week avg' : '今週平均'} dataKey="weekAvg"
                    stroke="#a8b1d1" strokeWidth={1.5} fill="#a8b1d1" fillOpacity={0.12} dot={false} isAnimationActive={false}/>
                  {/* 手前：今日 */}
                  <Radar name={lang === 'en' ? 'Today' : '今日'} dataKey="today"
                    stroke="#4f46e5" strokeWidth={2.5} fill="#4f46e5" fillOpacity={0.14}
                    dot={renderRadarDot}/>
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 6, left: -22, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1}/>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: AXIS_INK }}/>
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: AXIS_INK }}/>
                  <Tooltip cursor={{ fill: 'rgba(99,102,241,0.06)' }} content={customTooltip}/>
                  {CATEGORIES.map((cat, i) => (
                    <Bar key={cat.id} dataKey={cat.id} stackId="a" fill={cat.color}
                      /* 積み重ねの境目は面の色で2px空けて、線ではなく余白で分ける */
                      stroke={GAP} strokeWidth={2}
                      radius={i === CATEGORIES.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                      barSize={isMobile ? 14 : 18}/>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* 凡例：色だけに頼らせない */}
          {selectedRange === 'day' ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: '6px', paddingTop: '10px', borderTop: `1px solid ${hud.line}` }}>
              {[
                { label: lang === 'en' ? 'Today' : '今日', color: '#4f46e5' },
                { label: lang === 'en' ? 'Week avg' : '今週平均', color: '#c3cade' },
              ].map(l => (
                <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: '900', color: '#64748b' }}>
                  <span style={{ width: '14px', height: '3px', borderRadius: '2px', background: l.color, flexShrink: 0 }}/>
                  {l.label}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${hud.line}` }}>
              {CATEGORIES.map(cat => (
                <span key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: '900', color: '#64748b' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: cat.color, flexShrink: 0 }}/>
                  {lang === 'en' ? cat.label_en : cat.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 今週の学習バランス + 前週比 */}
      <section style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          <h2 style={hStyle}><PieChart size={18} color="#4f46e5"/> {lang === 'en' ? "This Week's Balance" : '今週の学習バランス'}</h2>
          {weekComparison.pct !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: weekComparison.delta >= 0 ? '#ecfdf5' : '#fef2f2', padding: '6px 12px', borderRadius: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: '900', color: '#94a3b8' }}>{lang === 'en' ? 'vs last week' : '前週比'}</span>
              <span className="timer-text" style={{ fontSize: '13px', fontWeight: '900', color: weekComparison.delta >= 0 ? '#16a34a' : '#ef4444' }}>
                {weekComparison.delta >= 0 ? '↑' : '↓'}{Math.abs(weekComparison.pct)}%
              </span>
            </div>
          )}
        </div>

        {skillBalance.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontWeight: 'bold', fontSize: '13px' }}>
            {lang === 'en' ? 'No records yet this week' : '今週はまだ記録がありません'}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '2px', height: '14px', marginBottom: '14px' }}>
              {skillBalance.map((c, i) => (
                <div key={c.id} style={{
                  width: `${c.pct}%`, background: c.color,
                  borderRadius: skillBalance.length === 1 ? '7px'
                    : i === 0 ? '7px 2px 2px 7px'
                    : i === skillBalance.length - 1 ? '2px 7px 7px 2px' : '2px',
                }} title={`${lang === 'en' ? c.label_en : c.label} ${Math.round(c.pct)}%`}/>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {skillBalance.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '900' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: c.color, flexShrink: 0 }}/>
                  <span style={{ color: '#1e293b' }}>{lang === 'en' ? c.label_en : c.label}</span>
                  <span className="timer-text" style={{ color: '#94a3b8', fontWeight: 'bold' }}>
                    {Math.round(c.pct)}% ({formatMinutes(c.minutes)}{getUnit(c.minutes)})
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}