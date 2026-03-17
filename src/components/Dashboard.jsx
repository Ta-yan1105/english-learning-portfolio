import React, { useMemo } from 'react';
import {
  Zap, Activity, Sun, Calendar, CalendarDays,
  TrendingUp, Clock, Target,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell, LabelList,
} from 'recharts';
import { CATEGORIES, formatMinutes, getUnit, getLocalDateString } from '../constants';

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
  /* ----- chart data ----- */
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

  /* ----- weekly goal ----- */
  const weeklyGoal   = Number(profile.weeklyGoal) || 0;
  const weekProgress = weeklyGoal > 0 ? Math.min((timeStats.weekTotal / weeklyGoal) * 100, 100) : 0;

  /* ----- styles ----- */
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

  const altitude = Math.floor(timeStats.allTotal / 60);

  return (
    <>
      {/* ===== 学習状況カード ===== */}
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

        {/* --- 週間目標 --- */}
        <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '16px', marginBottom: '24px', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '900', color: '#1e293b' }}>
              <Target size={16} color="#4f46e5"/> 週間目標
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="number"
                value={profile.weeklyGoal || ''}
                onChange={e => onProfileUpdate('weeklyGoal', e.target.value)}
                placeholder="目標 (分)"
                style={{ width: '80px', padding: '4px 8px', borderRadius: '8px', border: '1px solid #e2e8f0', fontWeight: '900', fontSize: '13px', textAlign: 'center', outline: 'none', background: 'white' }}
              />
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>分/週</span>
            </div>
          </div>
          {weeklyGoal > 0 ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', fontWeight: 'bold', marginBottom: '6px' }}>
                <span>{formatMinutes(timeStats.weekTotal)}{getUnit(timeStats.weekTotal)} / {formatMinutes(weeklyGoal)}{getUnit(weeklyGoal)}</span>
                <span style={{ color: weekProgress >= 100 ? '#10b981' : '#4f46e5', fontWeight: '900' }}>{Math.round(weekProgress)}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${weekProgress}%`, height: '100%', background: weekProgress >= 100 ? '#10b981' : 'linear-gradient(90deg,#4f46e5,#0ea5e9)', borderRadius: '4px', transition: 'width 0.5s ease' }}/>
              </div>
              {weekProgress >= 100 && <div style={{ marginTop: '6px', fontSize: '12px', color: '#10b981', fontWeight: '900', textAlign: 'center' }}>🎉 今週の目標達成！</div>}
            </>
          ) : (
            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>目標分数を入力してください</div>
          )}
        </div>

        {/* --- 立山登頂チャレンジ --- */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>🏔️</span>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#1e293b' }}>
                立山登頂チャレンジ <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>(標高3,015m)</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="timer-text" style={{ fontSize: '48px', fontWeight: '900', color: '#10b981', lineHeight: 1 }}>{altitude}</span>
              <span style={{ fontSize: '12px', fontWeight: '900', color: '#94a3b8' }}> / 3,015歩</span>
            </div>
          </div>
          <div style={{ position: 'relative', width: '100%', height: '50px', marginTop: '10px' }}>
            <div style={{ position: 'absolute', right: '-4px', top: '-15px', fontSize: '20px', zIndex: 1, opacity: 0.8 }}>🗻</div>
            <div style={{
              position: 'absolute',
              left: `calc(${Math.min((altitude / 3015) * 100, 100)}% - 10px)`,
              bottom: `calc(${Math.min((altitude / 3015) * 100, 100)}%)`,
              fontSize: '18px', transition: 'left 1s ease-out, bottom 1s ease-out', zIndex: 3,
              filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.3))',
              transform: altitude >= 3015 ? 'none' : 'scaleX(-1)',
            }}>
              <div style={{ animation: altitude >= 3015 ? 'none' : 'climbingWalk 1.5s infinite ease-in-out' }}>
                {altitude >= 3015 ? '🚩' : '🚶'}
              </div>
            </div>
            <div style={{ width: '100%', height: '100%', backgroundColor: '#f1f5f9', clipPath: 'polygon(0 100%,100% 0,100% 100%)', borderRadius: '4px' }}>
              <div style={{ width: `${Math.min((altitude / 3015) * 100, 100)}%`, height: '100%', backgroundColor: '#10b981', transition: 'width 1s ease-out' }}/>
            </div>
            <div style={{ position: 'absolute', left: `calc(${Math.min((altitude / 3015) * 100, 100)}%)`, top: '52px', transform: 'translateX(-50%)', fontSize: '11px', fontWeight: '900', color: '#10b981', transition: 'left 1s ease-out', whiteSpace: 'nowrap', zIndex: 2 }}>
              ▲ {altitude}歩
            </div>
          </div>
        </div>
      </section>

      {/* ===== チャートカード ===== */}
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
                <XAxis type="number" orientation="top" axisLine={{ stroke: '#e2e8f0' }} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} tickFormatter={v => v > 0 ? `${formatMinutes(v)}${getUnit(v)}` : '0'}/>
                <YAxis dataKey="name" type="category" axisLine={{ stroke: '#e2e8f0' }} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#1e293b' }} width={60}/>
                <Tooltip cursor={{ fill: '#f8fafc' }} content={customTooltip}/>
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={isMobile ? 20 : 30}>
                  {chartData.map((entry, i) => <Cell key={i} fill={entry.color}/>)}
                  <LabelList dataKey="value" position="insideRight" formatter={v => v > 0 ? `${formatMinutes(v)}${getUnit(v)}` : ''} fill="#1e293b" fontSize={10} fontWeight={900} offset={10}/>
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
