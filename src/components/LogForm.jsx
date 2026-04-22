import { useRef } from 'react';
import { Clipboard, RefreshCw, Send, Clock, Zap, BookOpen } from 'lucide-react';
import { CATEGORIES } from '../constants';
import i18n from '../i18n';

export default function LogForm({
  isMobile,
  lang = 'ja',
  logs,
  date, setDate,
  minutes, setMinutes,
  selectedCats, setSelectedCats,
  speakingType, setSpeakingType,
  vocabCount, setVocabCount,
  reflection, setReflection,
  quality, setQuality,
  editingLogId,
  onSave,
  onCopyRecent,
  onCancel,
  formRef,
}) {
  const T = i18n[lang];
  const dragStartY   = useRef(null);
  const dragStartVal = useRef(null);
  const dragTarget   = useRef(null);

  const showVocab = selectedCats.includes('Vocabulary');

  const handlePointerDown = (e, target) => {
    dragStartY.current   = e.touches ? e.touches[0].clientY : e.clientY;
    dragStartVal.current = target === 'log_min' ? Number(minutes) : target === 'log_quality' ? Number(quality) : Number(vocabCount);
    dragTarget.current   = target;
  };
  const handlePointerMove = (e) => {
    if (dragStartY.current === null) return;
    const diffY = dragStartY.current - (e.touches ? e.touches[0].clientY : e.clientY);
    if (dragTarget.current === 'log_min') {
      setMinutes(Math.max(1, Math.min(dragStartVal.current + Math.floor(diffY / 6), 300)));
    } else if (dragTarget.current === 'log_quality') {
      setQuality(Math.max(0, Math.min(dragStartVal.current + Math.floor(diffY / 2), 100)));
    } else if (dragTarget.current === 'log_vocab') {
      setVocabCount(Math.max(0, Math.min(dragStartVal.current + Math.floor(diffY / 2), 9999)));
    }
  };
  const handlePointerUp = () => { dragStartY.current = null; dragTarget.current = null; };

  const card = {
    background: 'white',
    borderRadius: '24px',
    padding: isMobile ? '20px 15px' : '25px',
    marginBottom: '20px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: '100%',
    border: '2px solid #4f46e5',
    overflow: 'hidden',
  };

  const input = {
    width: '100%',
    maxWidth: '100%',
    padding: '16px',
    borderRadius: '16px',
    border: '1px solid #f1f5f9',
    background: '#f8fafc',
    fontWeight: 'bold',
    boxSizing: 'border-box',
    outline: 'none',
    fontSize: '14px',
    display: 'block',
    minWidth: 0,
    margin: 0,
  };

  const speakingTypes = [
    { key: T.speakingType1, value: T.speakingType1 },
    { key: T.speakingType2, value: T.speakingType2 },
  ];

  return (
    <section
      ref={formRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={card}
    >
      {/* ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '900', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clipboard size={18} color="#4f46e5"/> {T.logFormTitle}
        </h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!editingLogId && logs.length > 0 && (
            <button className="action-btn" type="button" onClick={onCopyRecent}
              style={{ padding: '6px 12px', background: '#e0e7ff', color: '#4f46e5', borderRadius: '10px', fontWeight: '900', border: 'none', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <RefreshCw size={12}/> {isMobile ? T.copyPrevShort : T.copyPrev}
            </button>
          )}
          {editingLogId && (
            <button className="action-btn" type="button" onClick={onCancel}
              style={{ padding: '6px 12px', background: '#f1f5f9', color: '#64748b', borderRadius: '10px', fontWeight: '900', border: 'none', cursor: 'pointer', fontSize: '11px' }}>
              {T.cancel}
            </button>
          )}
          <button className="action-btn" onClick={onSave}
            style={{ padding: '6px 16px', background: '#4f46e5', color: 'white', borderRadius: '10px', fontWeight: '900', border: 'none', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Send size={12}/> {editingLogId ? T.update : T.register}
          </button>
        </div>
      </div>

      {/* 日付 */}
      <input
        type="date"
        className="modern-input"
        value={date}
        onChange={e => setDate(e.target.value)}
        style={{ ...input, cursor: 'pointer', marginBottom: '15px', textAlign: 'center', fontSize: '16px', WebkitAppearance: 'none' }}
      />

      {/* カテゴリ */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '15px' }}>
        {CATEGORIES.map(cat => (
          <button key={cat.id} type="button" className="category-btn"
            onClick={() => {
              const isAdding = !selectedCats.includes(cat.id);
              setSelectedCats(prev =>
                prev.includes(cat.id) ? prev.filter(c => c !== cat.id) : [...prev, cat.id]
              );
              if (cat.id === 'Class' && isAdding) setMinutes(50);
            }}
            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '12px', border: 'none', backgroundColor: selectedCats.includes(cat.id) ? cat.color : '#f1f5f9', color: selectedCats.includes(cat.id) ? 'white' : '#64748b', fontSize: '13px', fontWeight: '900', cursor: 'pointer' }}>
            {cat.icon} {lang === 'en' ? cat.label_en : cat.label}
          </button>
        ))}
      </div>

      {/* Speaking サブタイプ */}
      {selectedCats.includes('Speaking') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '4px', animation: 'popIn 0.3s ease-out', marginBottom: '15px' }}>
          <span style={{ fontSize: '11px', fontWeight: '900', color: '#f43f5e' }}>{T.speakingTypeLabel}</span>
          {speakingTypes.map(({ key, value }) => (
            <button key={key} type="button" className="action-btn" onClick={() => setSpeakingType(value)}
              style={{ padding: '4px 12px', borderRadius: '8px', border: speakingType === value ? 'none' : '1px solid #fda4af', backgroundColor: speakingType === value ? '#f43f5e' : '#fff1f2', color: speakingType === value ? 'white' : '#f43f5e', fontSize: '11px', fontWeight: '900', cursor: 'pointer' }}>
              {key}
            </button>
          ))}
        </div>
      )}

      {/* 学習時間 / 集中度 / 単語数 */}
      <div style={{ display: 'grid', gridTemplateColumns: showVocab ? 'repeat(3, 1fr)' : '1fr 1fr', gap: isMobile ? '8px' : '20px', marginBottom: '20px' }}>
        {[
          { label: T.fieldTime,  icon: <Clock    size={14} color="#94a3b8"/>, value: minutes,    unit: T.unitMin,   target: 'log_min' },
          { label: T.fieldFocus, icon: <Zap      size={14} color="#94a3b8"/>, value: quality,    unit: T.unitPct,   target: 'log_quality' },
          ...(showVocab ? [{ label: T.fieldVocab, icon: <BookOpen size={14} color="#94a3b8"/>, value: vocabCount, unit: T.unitWords, target: 'log_vocab' }] : []),
        ].map(({ label, icon, value, unit, target }) => (
          <div key={target} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#f8fafc', padding: isMobile ? '12px 4px' : '20px', borderRadius: '16px', border: '1px solid #f1f5f9', boxSizing: 'border-box' }}>
            <label style={{ fontSize: '11px', fontWeight: '900', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '5px', whiteSpace: 'nowrap' }}>
              {icon} {label}
            </label>
            <div className="draggable-number" onPointerDown={e => handlePointerDown(e, target)} style={{ display: 'flex', alignItems: 'baseline', gap: '2px', cursor: 'ns-resize' }}>
              <span className="timer-text" style={{ fontSize: isMobile ? (showVocab ? 'clamp(28px,7vw,40px)' : 'clamp(36px,10vw,48px)') : '56px', fontWeight: '900', color: '#4f46e5', lineHeight: 1, letterSpacing: '-0.02em', pointerEvents: 'none' }}>{value}</span>
              <span style={{ fontSize: isMobile ? '11px' : '16px', fontWeight: '900', color: '#4f46e5', pointerEvents: 'none' }}>{unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 振り返り */}
      <textarea
        className="modern-input"
        value={reflection}
        onChange={e => setReflection(e.target.value)}
        placeholder={T.reflectionPlaceholder}
        style={{ ...input, height: '120px', resize: 'vertical' }}
      />
    </section>
  );
}
