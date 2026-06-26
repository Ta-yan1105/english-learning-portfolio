import React from 'react';
import { List, Edit, Trash2, Clock, Zap, BookOpen, Mic } from 'lucide-react';
import { CATEGORIES, formatMinutes, getUnit, getLocalDateString } from '../constants';
import { getWpmLevel } from '../utils/wpmLevels';
import i18n from '../i18n';

export default function LogList({
  isMobile,
  lang = 'ja',
  filteredLogs,
  readingLogs = [],
  selectedRange,
  date, setDate,
  onEdit,
  onDelete,
  onExport,
}) {
  const T = i18n[lang];
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
    if (selectedRange === 'year')  return `${d.getFullYear()}${T.yearSuffix}`;
    return '';
  };

  const card = { background: 'white', borderRadius: '24px', padding: isMobile ? '20px 15px' : '25px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', boxSizing: 'border-box', width: '100%' };

  return (
    <section style={card}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '900', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <List size={18} color="#4f46e5"/> {T.logListTitle}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8' }}>{rangeLabel()} {T.exportLabel}</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {['excel', 'gsheet', 'csv'].map(f => (
              <button className="action-btn" key={f} onClick={() => onExport(filteredLogs, f, rangeLabel())}
                style={{ padding: '6px 10px', background: f === 'excel' ? '#1d6f42' : f === 'gsheet' ? '#34a853' : '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                {f.toUpperCase()}
              </button>
            ))}
          </div>
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

      {/* 音読記録（その日の総合記録） */}
      {selectedRange === 'day' && (() => {
        const rLog = readingLogs.find(r => r.date === date);
        const attempts = rLog?.attempts || [];
        if (attempts.length === 0) return null;
        const isEn = lang === 'en';
        const best = Math.max(...attempts.map(a => a.wpm));
        const bestLevel = getWpmLevel(best);
        return (
          <div style={{ background: '#f5f3ff', border: '1px solid #ede9fe', borderRadius: '16px', padding: '14px 16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Mic size={16} color="#22d3ee"/>
              <span style={{ fontSize: '13px', fontWeight: '900', color: '#1e293b' }}>
                {isEn ? `Reading Records (${attempts.length})` : `音読記録（${attempts.length}回）`}
              </span>
              <span style={{ fontSize: '11px', fontWeight: '900', color: bestLevel.textColor === 'white' ? 'white' : bestLevel.textColor, background: bestLevel.color, padding: '2px 8px', borderRadius: '8px' }}>
                {isEn ? `Best ${best} WPM` : `最高 ${best} WPM`}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {attempts.map((a, i) => {
                const lv = getWpmLevel(a.wpm);
                const prev = i > 0 ? attempts[i - 1] : null;
                const delta = prev ? a.wpm - prev.wpm : null;
                return (
                  <div key={i} className="timer-text" style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'white', borderRadius: '8px', padding: '4px 9px', fontSize: '12px', fontWeight: '900', border: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#94a3b8' }}>{isEn ? `#${i + 1}` : `${i + 1}回`}</span>
                    {a.material && (
                      <span style={{ color: '#6366f1', maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.material}>
                        {a.material}
                      </span>
                    )}
                    <span style={{ color: lv.color }}>{a.wpm} WPM</span>
                    <span style={{ color: '#cbd5e1', fontWeight: 'normal' }}>·</span>
                    <span style={{ color: '#64748b' }}>{a.wordCount}{isEn ? 'w' : '語'}</span>
                    {delta !== null && (
                      <span style={{ fontSize: '10px', color: delta > 0 ? '#16a34a' : delta < 0 ? '#ef4444' : '#94a3b8' }}>
                        {delta > 0 ? `↑${delta}` : delta < 0 ? `↓${Math.abs(delta)}` : '→0'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {rLog.transcript && (
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#475569', lineHeight: 1.6, background: 'white', border: '1px solid #f1f5f9', borderRadius: '8px', padding: '8px 10px', whiteSpace: 'pre-wrap' }}>
                {rLog.transcript}
              </div>
            )}
          </div>
        );
      })()}

      {/* ログ一覧 */}
      {filteredLogs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontWeight: 'bold', fontSize: '14px' }}>
          📭 {T.noLogs}
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
                        {cat ? (lang === 'en' ? cat.label_en : cat.label) : c}{c === 'Speaking' && log.speakingType ? `(${log.speakingType})` : ''}
                      </span>
                    );
                  })}
                </div>

                {hasText && (
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', lineHeight: 1.5, marginBottom: '10px' }}>
                    {log.reflection}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px dashed #e2e8f0', alignItems: 'center' }}>
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
                  {log.vocabCount != null && (log.categories || []).includes('Vocabulary') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <BookOpen size={14} color="#c084fc"/>
                      <span className="timer-text" style={{ fontSize: '14px', fontWeight: '900', color: '#c084fc' }}>
                        {log.vocabCount}<span style={{ fontSize: '10px' }}>語</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
