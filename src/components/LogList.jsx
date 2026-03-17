import React from 'react';
import { List, Edit, Trash2, Clock, Zap } from 'lucide-react';
import { CATEGORIES, formatMinutes, getUnit, getLocalDateString } from '../constants';

export default function LogList({
  isMobile,
  filteredLogs,
  selectedRange,
  date, setDate,
  onEdit,
  onDelete,
  onExport,
}) {
  /* ----- 前後ナビ ----- */
  const navigate = (dir) => {
    const d = new Date(date + 'T00:00:00');
    if      (selectedRange === 'day')   d.setDate(d.getDate() + dir);
    else if (selectedRange === 'week')  d.setDate(d.getDate() + dir * 7);
    else if (selectedRange === 'month') d.setMonth(d.getMonth() + dir);
    else if (selectedRange === 'year')  d.setFullYear(d.getFullYear() + dir);
    setDate(getLocalDateString(d));
  };

  const rangeLabel = () => {
    const d = new Date(date + 'T00:00:00');
    if (selectedRange === 'day')
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    if (selectedRange === 'week') {
      const day   = d.getDay() || 7;
      const start = new Date(d);
      if (day !== 1) start.setDate(d.getDate() - day + 1);
      const end = new Date(start); end.setDate(start.getDate() + 6);
      return `${start.getMonth()+1}/${start.getDate()} 〜 ${end.getMonth()+1}/${end.getDate()}`;
    }
    if (selectedRange === 'month') return `${d.getFullYear()}/${d.getMonth() + 1}`;
    if (selectedRange === 'year')  return `${d.getFullYear()}年`;
    return '';
  };

  const card = { background: 'white', borderRadius: '24px', padding: isMobile ? '20px 15px' : '25px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', boxSizing: 'border-box', width: '100%' };

  return (
    <section style={card}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '900', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <List size={18} color="#4f46e5"/> 学習ログ一覧
        </h2>
        <div style={{ display: 'flex', gap: '6px' }}>
          {['excel', 'gsheet', 'csv'].map(f => (
            <button className="action-btn" key={f} onClick={() => onExport(filteredLogs, f)}
              style={{ padding: '6px 10px', background: f === 'excel' ? '#1d6f42' : f === 'gsheet' ? '#34a853' : '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* 日付ナビ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', borderRadius: '12px', padding: '8px 12px', marginBottom: '16px', border: '1px solid #f1f5f9' }}>
        <button className="action-btn" onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#4f46e5', padding: '0 8px', fontWeight: '900', lineHeight: 1 }}>
          ◀
        </button>
        <span style={{ fontSize: '13px', fontWeight: '900', color: '#1e293b' }}>{rangeLabel()}</span>
        <button className="action-btn" onClick={() => navigate(1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#4f46e5', padding: '0 8px', fontWeight: '900', lineHeight: 1 }}>
          ▶
        </button>
      </div>

      {/* ログ一覧 */}
      {filteredLogs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontWeight: 'bold', fontSize: '14px' }}>
          📭 この期間の学習記録はありません
        </div>
      ) : (
        <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '500px', overflowY: 'auto', paddingRight: '10px' }}>
          {filteredLogs.map(log => {
            const hasText = log.reflection && log.reflection.trim() !== '';
            return (
              <div key={log.id} style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div className="timer-text" style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '900' }}>{log.date}</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="action-btn" onClick={() => onEdit(log)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#64748b' }}><Edit size={14}/></button>
                    <button className="action-btn" onClick={() => onDelete(log.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#ef4444' }}><Trash2 size={14}/></button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                  {(log.categories || []).map(c => {
                    const cat = CATEGORIES.find(x => x.id === c);
                    return (
                      <span key={c} style={{ backgroundColor: cat ? cat.color : '#e0e7ff', color: 'white', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '900' }}>
                        {cat ? cat.label : c}{c === 'Speaking' && log.speakingType ? `(${log.speakingType})` : ''}
                      </span>
                    );
                  })}
                </div>

                {hasText && (
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', lineHeight: 1.5, marginBottom: '10px' }}>
                    {log.reflection}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '20px', paddingTop: '10px', borderTop: '1px dashed #e2e8f0', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={14} color="#64748b"/>
                    <span className="timer-text" style={{ fontSize: '14px', fontWeight: '900' }}>
                      {formatMinutes(log.minutes)}<span style={{ fontSize: '10px' }}>{getUnit(log.minutes)}</span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Zap size={14} color="#f59e0b"/>
                    <span className="timer-text" style={{ fontSize: '14px', fontWeight: '900' }}>
                      {log.quality}<span style={{ fontSize: '10px' }}>%</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
