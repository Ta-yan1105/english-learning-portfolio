import { useMemo } from 'react';
import {
  Activity, Sun, Calendar, CalendarDays,
  TrendingUp, Clock, Flame, BookOpen,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell, LabelList,
} from 'recharts';
import { CATEGORIES, formatMinutes, getUnit, getLocalDateString } from '../constants';
import i18n from '../i18n';

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

  const card   = { background: 'white', borderRadius: '24px', padding: isMobile ? '20px 15px' : '25px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', boxSizing: 'border-box', width: '100%' };
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
      const dayVocab = logs.filter(l => l.date === date && (l.categories || []).includes('Vocabulary'))
        .reduce((a, l) => a + (Number(l.vocabCount) || 0), 0);
      return (
        <div style={{ background: 'white', padding: '10px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '11px', fontWeight: 'bold' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', color: d.color }}>
            <span>{d.name}</span><span>{formatMinutes(d.value)}{getUnit(d.value)}</span>
          </div>
          {dayVocab > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', color: '#c084fc', marginTop: '4px' }}>
              <span>{lang === 'en' ? 'Vocab' : '単語'}</span><span>{dayVocab}{lang === 'en' ? ' words' : '語'}</span>
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
      <div style={{ background: 'white', padding: '10px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '11px', fontWeight: 'bold' }}>
        <div style={{ color: '#94a3b8', marginBottom: '6px' }}>{label}</div>
        {payload.map(entry => {
          const cat = CATEGORIES.find(c => c.id === entry.dataKey);
          if (!cat || entry.value === 0) return null;
          return (
            <div key={entry.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', color: cat.color, marginBottom: '4px' }}>
              <span>{lang === 'en' ? cat.label_en : cat.label}</span><span>{formatMinutes(entry.value)}{getUnit(entry.value)}</span>
            </div>
          );
        })}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', color: '#1e293b', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
          <span>{T.tooltipTotal}</span><span>{formatMinutes(total)}{getUnit(total)}</span>
        </div>
        {periodVocab > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', color: '#c084fc', marginTop: '4px' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
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
              <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f5f3ff', padding: '4px', borderRadius: '10px' }}>
                <BookOpen size={12} color="#c084fc" style={{ margin: '6px 4px 0 6px', flexShrink: 0 }}/>
                {[
                  { label: T.statDay,   value: vocabStats.day },
                  { label: T.statWeek,  value: vocabStats.week },
                  { label: T.statMonth, value: vocabStats.month },
                  { label: lang === 'en' ? 'Total' : '累計', value: vocabStats.total },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: 'white', borderRadius: '7px', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '5px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                    <span style={{ fontSize: '11px', fontWeight: '900', color: '#94a3b8' }}>{label}</span>
                    <span className="timer-text" style={{ fontSize: '13px', fontWeight: '900', color: '#c084fc' }}>{value}<span style={{ fontSize: '10px' }}>{lang === 'en' ? 'w' : '語'}</span></span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '10px', flexShrink: 0 }}>
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

        <div style={{ height: '280px', width: '100%', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '-5px', left: '10px', fontSize: '11px', fontWeight: '900', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', zIndex: 10 }}>
            <Clock size={12} color="#94a3b8"/>
            {{ day: T.chartLabelDay, week: T.chartLabelWeek, month: T.chartLabelMonth, year: T.chartLabelYear }[selectedRange]}{T.chartStudyTime}
          </div>

          {selectedRange === 'day' ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 25, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#cbd5e1" opacity={0.6}/>
                <XAxis type="number" orientation="top" axisLine={{ stroke: '#e2e8f0' }} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} tickFormatter={xAxisFormatter}/>
                <YAxis dataKey="name" type="category" axisLine={{ stroke: '#e2e8f0' }} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#1e293b' }} width={60}/>
                <Tooltip cursor={{ fill: '#f8fafc' }} content={customTooltip}/>
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={isMobile ? 20 : 30}>
                  {chartData.map((entry, i) => <Cell key={i} fill={entry.color}/>)}
                  <LabelList dataKey="value" position="insideRight" formatter={(v) => v > 0 ? `${formatMinutes(v)}${getUnit(v)}` : ''} fill="#1e293b" fontSize={10} fontWeight={900} offset={10}/>
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 25, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }}/>
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }}/>
                <Tooltip cursor={{ fill: '#f8fafc' }} content={customTooltip}/>
                {CATEGORIES.map((cat, i) => (
                  <Bar key={cat.id} dataKey={cat.id} stackId="a" fill={cat.color}
                    radius={i === CATEGORIES.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                    barSize={isMobile ? 20 : 30}/>
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </>
  );
}