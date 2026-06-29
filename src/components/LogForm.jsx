import { useRef } from 'react';
import { Clipboard, RefreshCw, Send, Clock, Zap, BookOpen, CalendarDays, PenLine } from 'lucide-react';
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
      setMinutes(Math.max(1, Math.min(dragStartVal.current + Math.floor(diffY / 6), 90)));
    } else if (dragTarget.current === 'log_quality') {
      setQuality(Math.max(0, Math.min(dragStartVal.current + Math.floor(diffY / 2), 100)));
    } else if (dragTarget.current === 'log_vocab') {
      setVocabCount(Math.max(0, Math.min(dragStartVal.current + Math.floor(diffY / 2), 150)));
    }
  };
  const handlePointerUp = () => { dragStartY.current = null; dragTarget.current = null; };

  const card = {
    background: 'white',
    borderRadius: '24px',
    padding: isMobile ? '16px 14px' : '20px',
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
    padding: '12px 14px',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    background: '#eef1f5',
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '900', margin: 0, display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '10px', background: '#e0e7ff', flexShrink: 0 }}>
            <Clipboard size={17} color="#4f46e5"/>
          </span>
          {T.logFormTitle}
        </h2>

        {/* 日付（中央寄せ） */}
        <div style={{ flex: isMobile ? '1 1 100%' : 1, display: 'flex', justifyContent: 'center', order: isMobile ? 1 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#eef1f5', borderRadius: '12px', padding: '7px 14px', boxSizing: 'border-box' }}>
            <CalendarDays size={15} color="#94a3b8" style={{ flexShrink: 0 }}/>
            <input
              type="date"
              className="logform-date-input"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{ position: 'relative', border: 'none', background: 'none', padding: '3px 0', margin: 0, fontWeight: '900', fontSize: '14px', color: '#1e293b', outline: 'none', cursor: 'pointer' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
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
            style={{ padding: '6px 16px', background: '#4f46e5', color: 'white', borderRadius: '10px', fontWeight: '900', border: 'none', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 4px 12px rgba(79,70,229,0.25)' }}>
            <Send size={12}/> {editingLogId ? T.update : T.register}
          </button>
        </div>
      </div>

      {/* カテゴリ */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '4px', animation: 'popIn 0.3s ease-out', marginBottom: '12px' }}>
          <span style={{ fontSize: '11px', fontWeight: '900', color: '#f43f5e' }}>{T.speakingTypeLabel}</span>
          {speakingTypes.map(({ key, value }) => (
            <button key={key} type="button" className="action-btn" onClick={() => setSpeakingType(value)}
              style={{ padding: '4px 12px', borderRadius: '8px', border: speakingType === value ? 'none' : '1px solid #fda4af', backgroundColor: speakingType === value ? '#f43f5e' : '#fff1f2', color: speakingType === value ? 'white' : '#f43f5e', fontSize: '11px', fontWeight: '900', cursor: 'pointer' }}>
              {key}
            </button>
          ))}
        </div>
      )}

      {/* 学習時間 / 集中度 / 単語数 + 振り返り */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '12px' : '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-start', flexWrap: 'wrap', gap: isMobile ? '8px' : '12px', flexShrink: 0 }}>
          {[
            { label: T.fieldTime,  icon: <Clock    size={14} color="white"/>, value: minutes,    unit: T.unitMin,   target: 'log_min',     color: '#4f46e5', min: 1, max: 90 },
            { label: T.fieldFocus, icon: <Zap      size={14} color="white"/>, value: quality,    unit: T.unitPct,   target: 'log_quality', color: '#f59e0b', min: 0, max: 100 },
            ...(showVocab ? [{ label: T.fieldVocab, icon: <BookOpen size={14} color="white"/>, value: vocabCount, unit: T.unitWords, target: 'log_vocab', color: '#c084fc', min: 0, max: 150 }] : []),
          ].map(({ label, icon, value, unit, target, color, min, max }) => {
            const setter = target === 'log_min' ? v => setMinutes(Math.max(1, Math.min(v, 90)))
                         : target === 'log_quality' ? v => setQuality(Math.max(0, Math.min(v, 100)))
                         : v => setVocabCount(Math.max(0, Math.min(v, 150)));
            return (
              <div key={target} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'white', padding: isMobile ? '12px 4px' : '16px', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 2px 10px rgba(0,0,0,0.04)', boxSizing: 'border-box', flex: isMobile ? '1 1 0%' : '0 1 150px', minWidth: isMobile ? 0 : '130px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '8px', background: color, marginBottom: '6px' }}>
                  {icon}
                </div>
                <label style={{ fontSize: '11px', fontWeight: '900', color: '#94a3b8', marginBottom: '4px', whiteSpace: 'nowrap' }}>
                  {label}
                </label>
                <div className="draggable-number" onPointerDown={e => handlePointerDown(e, target)} style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', cursor: 'ns-resize', paddingBottom: '4px' }}>
                  <span className="timer-text" style={{ fontSize: isMobile ? (showVocab ? 'clamp(28px,7vw,40px)' : 'clamp(36px,10vw,48px)') : '48px', fontWeight: '900', color, lineHeight: 1, letterSpacing: '-0.02em', pointerEvents: 'none' }}>{value}</span>
                  <span style={{ fontSize: isMobile ? '11px' : '14px', fontWeight: '900', color, lineHeight: 1, pointerEvents: 'none' }}>{unit}</span>
                </div>
                <input
                  type="range" min={min} max={max} value={value}
                  onChange={e => setter(Number(e.target.value))}
                  onPointerDown={e => e.stopPropagation()}
                  style={{ width: '100%', marginTop: '4px', accentColor: color, cursor: 'pointer' }}
                />
              </div>
            );
          })}
        </div>

        {/* 振り返り（余白を活用） */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: isMobile ? 'auto' : '200px' }}>
          <label style={{ fontSize: '11px', fontWeight: '900', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
            <PenLine size={13}/> {lang === 'en' ? 'Notes' : 'ひとことメモ'}
          </label>
          <textarea
            className="modern-input"
            value={reflection}
            onChange={e => setReflection(e.target.value)}
            placeholder={T.reflectionPlaceholder}
            style={{ ...input, flex: 1, minHeight: '90px', resize: 'vertical' }}
          />
        </div>
      </div>
    </section>
  );
}
