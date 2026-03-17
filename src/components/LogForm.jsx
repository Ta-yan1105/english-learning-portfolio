import React, { useRef } from 'react';
import { Clipboard, RefreshCw, Send, Clock, Zap } from 'lucide-react';
import { CATEGORIES } from '../constants';

export default function LogForm({
  isMobile,
  logs,
  date, setDate,
  minutes, setMinutes,
  selectedCats, setSelectedCats,
  speakingType, setSpeakingType,
  reflection, setReflection,
  quality, setQuality,
  editingLogId,
  onSave,
  onCopyRecent,
  onCancel,
  formRef,
}) {
  const dragStartY   = useRef(null);
  const dragStartVal = useRef(null);
  const dragTarget   = useRef(null);

  const handlePointerDown = (e, target) => {
    dragStartY.current   = e.touches ? e.touches[0].clientY : e.clientY;
    dragStartVal.current = target === 'log_min' ? Number(minutes) : Number(quality);
    dragTarget.current   = target;
  };
  const handlePointerMove = (e) => {
    if (dragStartY.current === null) return;
    const diffY = dragStartY.current - (e.touches ? e.touches[0].clientY : e.clientY);
    if (dragTarget.current === 'log_min') {
      setMinutes(Math.max(1, Math.min(dragStartVal.current + Math.floor(diffY / 6), 300)));
    } else if (dragTarget.current === 'log_quality') {
      setQuality(Math.max(0, Math.min(dragStartVal.current + Math.floor(diffY / 2), 100)));
    }
  };
  const handlePointerUp = () => { dragStartY.current = null; dragTarget.current = null; };

  const card  = { background: 'white', borderRadius: '24px', padding: isMobile ? '20px 15px' : '25px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', boxSizing: 'border-box', width: '100%' };
  const input = { width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid #f1f5f9', background: '#f8fafc', fontWeight: 'bold', boxSizing: 'border-box', outline: 'none', fontSize: '14px' };

  return (
    <section
      ref={formRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{ ...card, border: '2px solid #4f46e5' }}
    >
      {/* ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '900', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clipboard size={18} color="#4f46e5"/> 学習を記録する
        </h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!editingLogId && logs.length > 0 && (
            <button className="action-btn" type="button" onClick={onCopyRecent}
              style={{ padding: '6px 12px', background: '#e0e7ff', color: '#4f46e5', borderRadius: '10px', fontWeight: '900', border: 'none', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <RefreshCw size={12}/> {isMobile ? 'コピー' : '前回をコピー'}
            </button>
          )}
          {editingLogId && (
            <button className="action-btn" type="button" onClick={onCancel}
              style={{ padding: '6px 12px', background: '#f1f5f9', color: '#64748b', borderRadius: '10px', fontWeight: '900', border: 'none', cursor: 'pointer', fontSize: '11px' }}>
              キャンセル
            </button>
          )}
          <button className="action-btn" onClick={onSave}
            style={{ padding: '6px 16px', background: '#4f46e5', color: 'white', borderRadius: '10px', fontWeight: '900', border: 'none', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Send size={12}/> {editingLogId ? '更新' : '登録'}
          </button>
        </div>
      </div>

      {/* 日付 */}
      <div style={{ marginBottom: '15px' }}>
        <input type="date" className="modern-input" value={date} onChange={e => setDate(e.target.value)}
          style={{ ...input, cursor: 'pointer' }}/>
      </div>

      {/* カテゴリ */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '15px' }}>
        {CATEGORIES.map(cat => (
          <button key={cat.id} type="button" className="category-btn"
            onClick={() => setSelectedCats(prev =>
              prev.includes(cat.id) ? prev.filter(c => c !== cat.id) : [...prev, cat.id]
            )}
            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '12px', border: 'none', backgroundColor: selectedCats.includes(cat.id) ? cat.color : '#f1f5f9', color: selectedCats.includes(cat.id) ? 'white' : '#64748b', fontSize: '13px', fontWeight: '900', cursor: 'pointer' }}>
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Speaking サブタイプ */}
      {selectedCats.includes('Speaking') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '4px', animation: 'popIn 0.3s ease-out', marginBottom: '15px' }}>
          <span style={{ fontSize: '11px', fontWeight: '900', color: '#f43f5e' }}>↳ 話す内容:</span>
          {['発表', 'やり取り'].map(type => (
            <button key={type} type="button" className="action-btn" onClick={() => setSpeakingType(type)}
              style={{ padding: '4px 12px', borderRadius: '8px', border: speakingType === type ? 'none' : '1px solid #fda4af', backgroundColor: speakingType === type ? '#f43f5e' : '#fff1f2', color: speakingType === type ? 'white' : '#f43f5e', fontSize: '11px', fontWeight: '900', cursor: 'pointer' }}>
              {type}
            </button>
          ))}
        </div>
      )}

      {/* 学習時間 / 集中度 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isMobile ? '10px' : '20px', marginBottom: '20px' }}>
        {[
          { label: '学習時間', icon: <Clock size={14} color="#94a3b8"/>, value: minutes, unit: '分', target: 'log_min' },
          { label: '集中度',   icon: <Zap  size={14} color="#94a3b8"/>, value: quality, unit: '%',  target: 'log_quality' },
        ].map(({ label, icon, value, unit, target }) => (
          <div key={target} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#f8fafc', padding: isMobile ? '15px 5px' : '20px', borderRadius: '16px', border: '1px solid #f1f5f9', boxSizing: 'border-box' }}>
            <label style={{ fontSize: '12px', fontWeight: '900', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '5px', whiteSpace: 'nowrap' }}>
              {icon} {label}
            </label>
            <div className="draggable-number" onPointerDown={e => handlePointerDown(e, target)} style={{ display: 'flex', alignItems: 'baseline', gap: '2px', cursor: 'ns-resize' }}>
              <span className="timer-text" style={{ fontSize: isMobile ? 'clamp(36px,10vw,48px)' : '64px', fontWeight: '900', color: '#4f46e5', lineHeight: 1, letterSpacing: '-0.02em', pointerEvents: 'none' }}>{value}</span>
              <span style={{ fontSize: isMobile ? '12px' : '18px', fontWeight: '900', color: '#4f46e5', pointerEvents: 'none' }}>{unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 振り返り */}
      <textarea className="modern-input" value={reflection} onChange={e => setReflection(e.target.value)}
        placeholder="学習内容や気づきを入力..."
        style={{ ...input, height: '120px', resize: 'vertical' }}/>
    </section>
  );
}
