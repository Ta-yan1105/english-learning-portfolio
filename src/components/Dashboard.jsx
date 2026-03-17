import React, { useMemo } from 'react';
import {
  Zap, Activity, Sun, Calendar, CalendarDays,
  TrendingUp, Clock,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell, LabelList,
} from 'recharts';
import { CATEGORIES, formatMinutes, getUnit, getLocalDateString } from '../constants';

const xAxisFormatter = (v) => {
  if (v <= 0) return '0';
  return `${formatMinutes(v)}${getUnit(v)}`;
};

export default function Dashboard({
  isMobile,
  logs,
  selectedRange, setSelectedRange,
  date,
  timeStats,
  streak,
  profile,
  onProfileUpdate,
}) {
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
      return CATEGORIES.map(cat => ({ name: cat.label, value: skillMap[cat.id] || 0, color: cat.color }));
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
      return (
        <div style={{ background: 'white', padding: '10px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '11px', fontWeight: 'bold' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', color: d.color }}>
            <span>{d.name}</span><span>{formatMinutes(d.value)}{getUnit(d.value)}</span>
          </div>
        </div>
      );
    }
    return (
      <div style={{ background: 'white', padding: '10px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '11px', fontWeight: 'bold' }}>
        <div style={{ color: '#94a3b8', marginBottom: '6px' }}>{label}</div>
        {payload.map(entry => {
          const cat = CATEGORIES.find(c => c.id === entry.dataKey);
          if (!cat || entry.value === 0) return null;
          return (
            <div key={entry.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', color: cat.color, marginBottom: '4px' }}>
              <span>{cat.label}</span><span>{formatMinutes(entry.value)}{getUnit(entry.value)}</span>
            </div>
          );
        })}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', color: '#1e293b', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
          <span>合計</span><span>{formatMinutes(total)}{getUnit(total)}</span>
        </div>
      </div>
    );
  };

  const altitude   = Math.floor(timeStats.allTotal / 60);
  const GOAL       = 3015;
  const progress   = Math.min(altitude / GOAL, 1);
  const percentage = Math.round(progress * 100);

  const checkpoints = [
    { alt: 0,    label: '室堂',       pct: 0    },
    { alt: 754,  label: '一ノ越',     pct: 0.25 },
    { alt: 1565, label: '雄山',       pct: 0.52 },
    { alt: 2436, label: '大汝山',     pct: 0.81 },
    { alt: 3015, label: '富士ノ折立', pct: 1    },
  ];
  const nextCP       = checkpoints.find(cp => altitude < cp.alt);
  const remainToNext = nextCP ? nextCP.alt - altitude : 0;
  const fillY        = 220 - progress * 210;

  return (
    <>
      <section style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <h2 style={{ ...hStyle, margin: 0 }}><Zap size={18} color="#4f46e5"/> 学習状況</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: isMobile ? '6px' : '10px', fontSize: '13px', fontWeight: '900', color: '#1e293b', flexWrap: 'wrap', alignItems: 'center', background: '#f8fafc', padding: '6px 12px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
              {[['日', timeStats.dayTotal], ['週', timeStats.weekTotal], ['月', timeStats.monthTotal], ['年', timeStats.yearTotal]].map(([label, val], i, arr) => (
                <React.Fragment key={label}>
                  <span>{label}: <span className="timer-text" style={{ color: '#4f46e5' }}>{formatMinutes(val)}</span><span style={{ fontSize: '11px', marginLeft: '1px' }}>{getUnit(val)}</span></span>
                  {i < arr.length - 1 && <span style={{ color: '#cbd5e1' }}>|</span>}
                </React.Fragment>
              ))}
            </div>
            <div style={{ background: '#fee2e2', padding: '4px 10px', borderRadius: '8px' }}>
              <span style={{ color: '#ef4444', fontSize: '13px', fontWeight: '900' }}>🔥 連続 {streak} 日</span>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes cloudDrift {
            0%   { transform: translateX(0px); }
            50%  { transform: translateX(10px); }
            100% { transform: translateX(0px); }
          }
          @keyframes sunPulse {
            0%, 100% { opacity:1; transform:scale(1); }
            50%       { opacity:0.85; transform:scale(1.08); }
          }
          @keyframes shimmer {
            0%   { opacity: 0.85; }
            50%  { opacity: 1; }
            100% { opacity: 0.85; }
          }
        `}</style>

        <div style={{ display: 'flex', gap: '16px', flexDirection: isMobile ? 'column' : 'row' }}>

          {/* 左：山グラフィック */}
          <div style={{
            flex: '1 1 0', borderRadius: '16px', overflow: 'hidden',
            background: 'linear-gradient(180deg, #e0f2fe 0%, #bae6fd 40%, #7dd3fc 70%, #a5d6a7 90%, #c8e6c9 100%)',
            position: 'relative', minHeight: isMobile ? '220px' : '280px',
          }}>
            <div style={{ position: 'absolute', top: '7%', left: '10%', fontSize: '26px', animation: 'sunPulse 4s ease-in-out infinite', filter: 'drop-shadow(0 0 8px rgba(255,200,0,0.5))', zIndex: 2 }}>☀️</div>

            {[
              { top: '10%', left: '28%', w: 60, delay: '0s' },
              { top: '6%',  left: '60%', w: 50, delay: '2s' },
              { top: '18%', left: '74%', w: 38, delay: '1s' },
            ].map((c, i) => (
              <div key={i} style={{ position: 'absolute', top: c.top, left: c.left, animation: `cloudDrift 7s ease-in-out ${c.delay} infinite`, zIndex: 2 }}>
                <svg width={c.w} height={c.w * 0.45} viewBox="0 0 80 36">
                  <ellipse cx="40" cy="28" rx="36" ry="12" fill="white"/>
                  <ellipse cx="26" cy="22" rx="17" ry="13" fill="white"/>
                  <ellipse cx="54" cy="20" rx="15" ry="12" fill="white"/>
                </svg>
              </div>
            ))}

            {checkpoints.filter(cp => cp.pct > 0 && cp.pct < 1).map((cp, i) => {
              const reached = altitude >= cp.alt;
              const yPos = `${100 - cp.pct * 78}%`;
              return (
                <div key={i} style={{
                  position: 'absolute', right: '8px', top: yPos,
                  fontSize: '10px', fontWeight: '900', zIndex: 5,
                  color: reached ? '#f59e0b' : 'rgba(80,80,80,0.5)',
                  transition: 'color 0.5s',
                  textShadow: reached ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                }}>
                  — {cp.label}
                </div>
              );
            })}

            <svg
              style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '85%' }}
              viewBox="0 0 400 220"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981"/>
                  <stop offset="50%" stopColor="#059669"/>
                  <stop offset="100%" stopColor="#047857"/>
                </linearGradient>
                <linearGradient id="emptyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#cbd5e1" stopOpacity="0.5"/>
                  <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.3"/>
                </linearGradient>
                <linearGradient id="snowFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="white" stopOpacity="0.95"/>
                  <stop offset="100%" stopColor="white" stopOpacity="0"/>
                </linearGradient>
                <clipPath id="filledClip">
                  <rect x="0" y={fillY} width="400" height={220 - fillY}/>
                </clipPath>
                <clipPath id="emptyClip">
                  <rect x="0" y="0" width="400" height={fillY}/>
                </clipPath>
                <clipPath id="mountainClip">
                  <polygon points="-10,220 200,10 410,220"/>
                </clipPath>
                <clipPath id="rightPeakClip">
                  <polygon points="245,220 315,58 405,220"/>
                </clipPath>
              </defs>

              <polygon points="-20,220 70,105 160,220" fill="#94a3b8" opacity="0.25"/>
              <polygon points="270,220 345,85 420,220" fill="#94a3b8" opacity="0.25"/>
              <polygon points="245,220 315,58 405,220" fill="url(#emptyGrad)" clipPath="url(#emptyClip)"/>
              <polygon points="245,220 315,58 405,220" fill="url(#fillGrad)" clipPath="url(#filledClip)" style={{ animation: 'shimmer 3s ease-in-out infinite' }}/>
              <polygon points="-10,220 200,10 410,220" fill="url(#emptyGrad)" clipPath="url(#emptyClip)"/>
              <polygon points="-10,220 200,10 410,220" fill="url(#fillGrad)" clipPath="url(#filledClip)" style={{ animation: 'shimmer 3s ease-in-out infinite' }}/>
              {progress > 0 && progress < 1 && (
                <line x1="0" y1={fillY} x2="400" y2={fillY} stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeDasharray="6 4"/>
              )}
              <polygon points="168,42 200,10 232,42 220,68 180,68" fill="url(#snowFill)" clipPath="url(#mountainClip)"/>
              <polygon points="298,75 315,58 332,75 324,92 306,92" fill="url(#snowFill)" clipPath="url(#rightPeakClip)" opacity="0.85"/>
              <polygon points="-10,220 200,10 410,220" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1"/>
              <rect x="0" y="210" width="400" height="10" fill="#4ade80" opacity="0.6" rx="2"/>
            </svg>

            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center', zIndex: 10, pointerEvents: 'none',
            }}>
              <div className="timer-text" style={{
                fontSize: isMobile ? '48px' : '64px',
                fontWeight: '900', color: 'white', lineHeight: 1,
                textShadow: '0 2px 12px rgba(0,0,0,0.4)',
              }}>{percentage}%</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.9)', fontWeight: '900', textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>
                {altitude.toLocaleString()} / {GOAL.toLocaleString()}歩
              </div>
            </div>

            {altitude >= GOAL && (
              <div style={{ position: 'absolute', top: '8%', left: '50%', transform: 'translateX(-50%)', fontSize: '24px', zIndex: 10 }}>🚩</div>
            )}
          </div>

          {/* 右：数値パネル */}
          <div style={{
            width: isMobile ? '100%' : '150px',
            display: 'flex',
            flexDirection: isMobile ? 'row' : 'column',
            gap: '10px',
            flexShrink: 0,
          }}>
            {/* 現在地 */}
            <div style={{ flex: 1, background: 'linear-gradient(135deg,#0ea5e9,#38bdf8)', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.85)', fontWeight: '900', marginBottom: '4px' }}>🗻 現在地</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                <span className="timer-text" style={{ fontSize: isMobile ? '26px' : '32px', fontWeight: '900', color: 'white', lineHeight: 1 }}>{altitude.toLocaleString()}</span>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)', fontWeight: '900' }}>歩</span>
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', marginTop: '2px', fontWeight: 'bold' }}>目標 {GOAL.toLocaleString()}歩</div>
            </div>

            {/* 今日 */}
            <div style={{ flex: 1, background: 'linear-gradient(135deg,#7c3aed,#a855f7)', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.85)', fontWeight: '900', marginBottom: '4px' }}>📖 今日</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                <span className="timer-text" style={{ fontSize: isMobile ? '26px' : '32px', fontWeight: '900', color: 'white', lineHeight: 1 }}>{formatMinutes(timeStats.dayTotal)}</span>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)', fontWeight: '900' }}>{getUnit(timeStats.dayTotal)}</span>
              </div>
            </div>

            {/* 次の目標 */}
            <div style={{ flex: 1, background: 'linear-gradient(135deg,#10b981,#34d399)', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.85)', fontWeight: '900', marginBottom: '4px' }}>
                {nextCP ? '⛺ 次の目標まで' : '🎉 登頂達成！'}
              </div>
              {nextCP ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                    <span className="timer-text" style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: '900', color: 'white', lineHeight: 1 }}>{remainToNext.toLocaleString()}</span>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)', fontWeight: '900' }}>歩</span>
                  </div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.75)', marginTop: '2px', fontWeight: 'bold' }}>{nextCP.label}</div>
                </>
              ) : (
                <div style={{ fontSize: '13px', color: 'white', fontWeight: '900' }}>富士ノ折立</div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* チャートカード */}
      <section style={card} key={selectedRange}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <h2 style={{ ...hStyle, margin: 0 }}><Activity size={18} color="#4f46e5"/> 学習傾向の分析</h2>
          <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
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
            {{ day: '本日', week: '今週', month: '今月', year: '今年' }[selectedRange]}の学習時間
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
                  <LabelList dataKey="value" position="insideRight" formatter={xAxisFormatter} fill="#1e293b" fontSize={10} fontWeight={900} offset={10}/>
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