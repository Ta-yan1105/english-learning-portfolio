import { useRef, cloneElement } from 'react';
import { Clipboard, RefreshCw, Send, Clock, Zap, BookOpen, CalendarDays, PenLine, Check, MessageCircle, Presentation, MessagesSquare, Plus, Minus } from 'lucide-react';
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

  /* ── セグメントバー：タップ／横ドラッグした位置から値を決める ── */
  const barDrag = useRef(false);
  const setFromBar = (e, el, min, max, setter) => {
    const rect = el.getBoundingClientRect();
    if (!rect.width) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setter(Math.round(min + (max - min) * ratio));
  };

  const card = {
    background: 'white',
    borderRadius: '24px',
    padding: isMobile ? '16px 14px' : '20px',
    marginBottom: '20px',
    boxShadow: '0 22px 50px rgba(30, 27, 75, 0.20), 0 8px 16px rgba(30, 27, 75, 0.10)',
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

  /* ── HUDパネル共通の外装（技能選択・数値入力で共有） ── */
  const hudPanel = {
    position: 'relative',
    padding: isMobile ? '14px 12px' : '18px 22px',
    borderRadius: '22px',
    border: '1.5px solid rgba(129,140,248,0.35)',
    backgroundImage: `
      linear-gradient(rgba(129,140,248,0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(129,140,248,0.06) 1px, transparent 1px),
      radial-gradient(ellipse at 15% -10%, rgba(99,102,241,0.45) 0%, transparent 60%),
      linear-gradient(160deg, #1e1b4b 0%, #312e81 55%, #1e1b4b 100%)
    `,
    backgroundSize: '24px 24px, 24px 24px, 100% 100%, 100% 100%',
    boxShadow: '0 20px 42px rgba(30,27,75,0.38), inset 0 1px 0 rgba(255,255,255,0.13)',
    overflow: 'hidden',
  };

  /* ── パネル見出し（点滅ランプ + 英字ラベル） ── */
  const hudHeading = (text, dot = '#22d3ee') => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: isMobile ? '14px' : '16px' }}>
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: dot, boxShadow: `0 0 9px ${dot}`, animation: 'hudPulse 1.8s ease-in-out infinite' }}/>
      <span style={{ fontSize: '10px', fontWeight: '900', letterSpacing: '0.22em', color: '#a5b4fc' }}>{text}</span>
    </div>
  );

  const speakingTypes = [
    { key: T.speakingType1, value: T.speakingType1 },
    { key: T.speakingType2, value: T.speakingType2 },
  ];

  /* ── カテゴリ色を影・背景に流用するためのユーティリティ ── */
  const rgb = (hex) => {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const alpha = (hex, a) => { const [r, g, b] = rgb(hex); return `rgba(${r}, ${g}, ${b}, ${a})`; };
  const shade = (hex, amt) => {
    const clamp = v => Math.max(0, Math.min(255, Math.round(v + amt)));
    const [r, g, b] = rgb(hex);
    return `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`;
  };

  /* ── 4技能（読む・聞く・話す・書く）とそれ以外を分ける ── */
  const CORE_IDS   = ['Reading', 'Listening', 'Speaking', 'Writing'];
  const coreSkills = CATEGORIES.filter(c => CORE_IDS.includes(c.id));
  const extraCats  = CATEGORIES.filter(c => !CORE_IDS.includes(c.id));
  const coreDone   = coreSkills.filter(c => selectedCats.includes(c.id)).length;

  const toggleCat = (id) => {
    const isAdding = !selectedCats.includes(id);
    setSelectedCats(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
    if (id === 'Class' && isAdding) setMinutes(50);
  };

  /* ── 技能タイル（4技能・補助カテゴリ共通） ──
     立体感と押し込みは App.css の .skill-tile が CSS変数を読んで描画する ── */
  const renderTile = (cat, compact = false) => {
    const on = selectedCats.includes(cat.id);
    return (
      <button key={cat.id} type="button" className="skill-tile" onClick={() => toggleCat(cat.id)}
        style={{
          position: 'relative',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: compact ? '5px' : '7px',
          padding: compact ? (isMobile ? '11px 6px' : '13px 10px') : (isMobile ? '14px 6px' : '17px 10px'),
          borderRadius: compact ? '15px' : '17px',
          border: on ? `1.5px solid ${shade(cat.color, 45)}` : '1.5px solid rgba(199,210,254,0.2)',
          background: on
            ? `linear-gradient(150deg, ${shade(cat.color, 26)} 0%, ${cat.color} 45%, ${shade(cat.color, -26)} 100%)`
            : 'rgba(199,210,254,0.07)',
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
          '--edge':   on ? shade(cat.color, -58) : 'rgba(12,10,45,0.75)',
          '--edge-h': on ? '6px' : '4px',
          '--glow':   on ? alpha(cat.color, 0.5) : 'rgba(10,8,40,0.4)',
          '--sheen':  on ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.07)',
        }}>
        {/* 選択チェック */}
        {on && (
          <span style={{
            position: 'absolute', top: compact ? '5px' : '7px', right: compact ? '5px' : '7px',
            width: '18px', height: '18px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.95)', color: shade(cat.color, -35),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.35)', animation: 'popIn 0.3s ease-out',
          }}>
            <Check size={11} strokeWidth={4}/>
          </span>
        )}

        {/* アイコン */}
        <span style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: compact ? (isMobile ? '32px' : '36px') : (isMobile ? '36px' : '42px'),
          height: compact ? (isMobile ? '32px' : '36px') : (isMobile ? '36px' : '42px'),
          borderRadius: '50%',
          background: on ? 'rgba(255,255,255,0.25)' : alpha(cat.color, 0.15),
          border: on ? '1px solid rgba(255,255,255,0.3)' : `1px solid ${alpha(cat.color, 0.35)}`,
          color: on ? '#ffffff' : cat.color,
          boxShadow: on ? 'inset 0 1px 0 rgba(255,255,255,0.5)' : `0 0 14px ${alpha(cat.color, 0.28)}`,
          transition: 'all 0.2s ease',
        }}>
          {cloneElement(cat.icon, { size: compact ? (isMobile ? 17 : 19) : (isMobile ? 19 : 22) })}
        </span>

        {/* ラベル */}
        <span style={{
          fontSize: compact ? '13px' : (isMobile ? '13px' : '14px'), fontWeight: '900', lineHeight: 1,
          color: on ? '#ffffff' : '#e0e7ff',
          textShadow: on ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
        }}>
          {lang === 'en' ? cat.label_en : cat.label}
        </span>
        {lang !== 'en' && (
          <span style={{
            fontSize: '9px', fontWeight: '900', letterSpacing: '0.1em', lineHeight: 1, whiteSpace: 'nowrap',
            color: on ? 'rgba(255,255,255,0.85)' : 'rgba(199,210,254,0.5)',
          }}>
            {cat.label_en.toUpperCase()}
          </span>
        )}
      </button>
    );
  };

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
            style={{ padding: '9px 22px', background: 'linear-gradient(150deg, #6366f1 0%, #4f46e5 50%, #4338ca 100%)', color: 'white', borderRadius: '50px', fontWeight: '900', border: 'none', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 10px 22px rgba(79,70,229,0.45), inset 0 1px 0 rgba(255,255,255,0.35)', letterSpacing: '0.02em' }}>
            <Send size={14}/> {editingLogId ? T.update : T.register}
          </button>
        </div>
      </div>

      {/* ===== 技能選択 HUD ===== */}
      <div style={{ ...hudPanel, marginBottom: '14px' }}>
        {hudHeading(lang === 'en' ? 'SKILL SELECT' : '技能を選ぶ')}

        {/* 4技能の達成ドット */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '11px', minHeight: '18px' }}>
          <span style={{ fontSize: '10px', fontWeight: '900', color: '#a5b4fc', letterSpacing: '0.16em' }}>
            {lang === 'en' ? '4 SKILLS' : '4技能'}
          </span>
          <span style={{ display: 'flex', gap: '5px' }}>
            {coreSkills.map(c => {
              const on = selectedCats.includes(c.id);
              return (
                <span key={c.id} style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: on ? c.color : 'rgba(199,210,254,0.22)',
                  boxShadow: on ? `0 0 10px ${c.color}, 0 0 0 3px ${alpha(c.color, 0.2)}` : 'none',
                  transition: 'all 0.25s ease',
                }}/>
              );
            })}
          </span>
          {coreDone === coreSkills.length && (
            <span style={{ fontSize: '10px', fontWeight: '900', color: '#22d3ee', letterSpacing: '0.08em', textShadow: '0 0 12px rgba(34,211,238,0.8)', animation: 'popIn 0.4s ease-out', whiteSpace: 'nowrap' }}>
              {lang === 'en' ? '🎉 ALL 4 SKILLS' : '🎉 4技能コンプリート'}
            </span>
          )}
        </div>

        {/* 4技能タイル */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? '10px' : '12px' }}>
          {coreSkills.map(cat => renderTile(cat))}
        </div>

        {/* 「話す」タイルから伸びるサブ選択（発表 / やり取り） */}
        {selectedCats.includes('Speaking') && (
          <div style={{ position: 'relative', marginTop: '22px', animation: 'popIn 0.3s ease-out' }}>
            {/* 「話す」タイルとつながる光の線 */}
            <span style={{
              position: 'absolute', top: '-16px', left: isMobile ? '25%' : '62.5%',
              transform: 'translateX(-50%)', width: '2px', height: '16px',
              background: 'linear-gradient(180deg, rgba(251,113,133,0) 0%, #fb7185 100%)',
              boxShadow: '0 0 8px rgba(251,113,133,0.8)',
            }}/>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? '8px' : '12px',
              flexWrap: 'wrap', padding: isMobile ? '12px 10px' : '13px 18px', borderRadius: '16px',
              background: 'linear-gradient(160deg, rgba(244,63,94,0.18) 0%, rgba(190,18,60,0.12) 100%)',
              border: '1.5px solid rgba(253,164,175,0.4)',
              boxShadow: '0 0 22px rgba(244,63,94,0.18) inset, 0 10px 24px rgba(0,0,0,0.25)',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: '900', color: '#fda4af', letterSpacing: '0.12em' }}>
                <MessageCircle size={13}/> {T.speakingTypeLabel.replace(/^↳\s*/, '')}
              </span>
              {speakingTypes.map(({ key, value }, idx) => {
                const on = speakingType === value;
                const TypeIcon = idx === 0 ? Presentation : MessagesSquare;
                return (
                  <button key={key} type="button" className="skill-tile" onClick={() => setSpeakingType(value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '7px',
                      padding: isMobile ? '9px 14px' : '10px 20px',
                      borderRadius: '50px',
                      border: on ? '1.5px solid #fda4af' : '1.5px solid rgba(253,164,175,0.35)',
                      background: on ? 'linear-gradient(150deg, #fb7185 0%, #f43f5e 45%, #be123c 100%)' : 'rgba(255,241,242,0.08)',
                      color: on ? '#ffffff' : '#fda4af',
                      fontSize: isMobile ? '12px' : '13px', fontWeight: '900', cursor: 'pointer',
                      textShadow: on ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
                      WebkitTapHighlightColor: 'transparent',
                      '--edge': on ? '#881337' : 'rgba(12,10,45,0.7)',
                      '--edge-h': on ? '5px' : '4px',
                      '--glow': on ? 'rgba(244,63,94,0.55)' : 'rgba(10,8,40,0.35)',
                      '--sheen': on ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.08)',
                    }}>
                    <TypeIcon size={15}/> {key}
                    {on && <Check size={13} strokeWidth={4}/>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 区切り線 */}
        <div style={{ height: '1px', margin: isMobile ? '16px 0 13px' : '18px 0 14px', background: 'linear-gradient(90deg, transparent, rgba(129,140,248,0.35), transparent)' }}/>

        {/* 補助カテゴリ（単語・音読・授業） */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '11px' }}>
          <span style={{ fontSize: '10px', fontWeight: '900', color: '#a5b4fc', letterSpacing: '0.16em' }}>
            {lang === 'en' ? 'MORE' : 'その他'}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: isMobile ? '10px' : '12px' }}>
          {extraCats.map(cat => renderTile(cat, true))}
        </div>
      </div>

      {/* ===== 数値入力 HUD（学習時間 / 集中度 / 単語数） ===== */}
      <div style={{ ...hudPanel, marginBottom: '14px' }}>
        {hudHeading(lang === 'en' ? 'SESSION INPUT' : 'セッション入力')}

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : (showVocab ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)'),
          gap: isMobile ? '18px' : '22px',
        }}>
          {[
            { label: T.fieldTime,  sub: 'TIME',  icon: <Clock size={14}/>,    value: minutes,    unit: T.unitMin,   target: 'log_min',     accent: '#818cf8', min: 1, max: 90,  step: 5, presets: [15, 25, 45, 60] },
            { label: T.fieldFocus, sub: 'FOCUS', icon: <Zap size={14}/>,      value: quality,    unit: T.unitPct,   target: 'log_quality', accent: '#fbbf24', min: 0, max: 100, step: 5, presets: [50, 70, 85, 100] },
            ...(showVocab ? [{ label: T.fieldVocab, sub: 'WORDS', icon: <BookOpen size={14}/>, value: vocabCount, unit: T.unitWords, target: 'log_vocab', accent: '#d8b4fe', min: 0, max: 150, step: 5, presets: [10, 30, 50, 100] }] : []),
          ].map(({ label, sub, icon, value, unit, target, accent, min, max, step, presets }) => {
            const setter = target === 'log_min' ? v => setMinutes(Math.max(1, Math.min(v, 90)))
                         : target === 'log_quality' ? v => setQuality(Math.max(0, Math.min(v, 100)))
                         : v => setVocabCount(Math.max(0, Math.min(v, 150)));
            const ratio = (value - min) / (max - min);
            const SEG = isMobile ? 22 : 20;
            const stepBtn = {
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '34px', height: '34px', flexShrink: 0,
              borderRadius: '50%', cursor: 'pointer',
              border: `1.5px solid ${alpha(accent, 0.45)}`,
              background: alpha(accent, 0.12),
              color: accent,
              WebkitTapHighlightColor: 'transparent',
            };
            return (
              <div key={target} style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
                {/* ラベル */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '9px', background: alpha(accent, 0.16), border: `1px solid ${alpha(accent, 0.38)}`, color: accent, flexShrink: 0 }}>
                    {icon}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: '900', color: '#e0e7ff' }}>{label}</span>
                  <span style={{ fontSize: '9px', fontWeight: '900', letterSpacing: '0.16em', color: alpha(accent, 0.75) }}>{sub}</span>
                </div>

                {/* 数値 + ステッパー */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <button type="button" className="hud-step" onClick={() => setter(value - step)} style={stepBtn}>
                    <Minus size={17} strokeWidth={3}/>
                  </button>
                  <div className="draggable-number" onPointerDown={e => handlePointerDown(e, target)}
                    style={{ display: 'flex', alignItems: 'baseline', gap: '5px', cursor: 'ns-resize', userSelect: 'none', touchAction: 'none' }}>
                    <span className="timer-text" style={{
                      fontSize: isMobile ? 'clamp(42px,12vw,54px)' : '48px', fontWeight: '900', color: '#ffffff',
                      lineHeight: 1, letterSpacing: '-0.03em', pointerEvents: 'none',
                      textShadow: `0 0 14px ${alpha(accent, 0.95)}, 0 0 38px ${alpha(accent, 0.5)}`,
                    }}>{value}</span>
                    <span style={{ fontSize: '14px', fontWeight: '900', color: accent, pointerEvents: 'none' }}>{unit}</span>
                  </div>
                  <button type="button" className="hud-step" onClick={() => setter(value + step)} style={stepBtn}>
                    <Plus size={17} strokeWidth={3}/>
                  </button>
                </div>

                {/* セグメントバー（タップ・ドラッグで直接指定） */}
                <div
                  onPointerDown={e => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); barDrag.current = true; setFromBar(e, e.currentTarget, min, max, setter); }}
                  onPointerMove={e => { if (barDrag.current) { e.stopPropagation(); setFromBar(e, e.currentTarget, min, max, setter); } }}
                  onPointerUp={() => { barDrag.current = false; }}
                  onPointerCancel={() => { barDrag.current = false; }}
                  style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '30px', cursor: 'ew-resize', touchAction: 'none' }}>
                  {Array.from({ length: SEG }).map((_, i) => {
                    const lit = (i + 1) / SEG <= ratio + 1e-9;
                    return (
                      <span key={i} style={{
                        flex: 1, height: lit ? '100%' : '48%', borderRadius: '3px',
                        background: lit ? `linear-gradient(180deg, ${accent} 0%, ${alpha(accent, 0.45)} 100%)` : 'rgba(199,210,254,0.14)',
                        boxShadow: lit ? `0 0 9px ${alpha(accent, 0.7)}` : 'none',
                        transition: 'height 0.15s ease, background 0.15s ease, box-shadow 0.15s ease',
                        pointerEvents: 'none',
                      }}/>
                    );
                  })}
                </div>

                {/* ワンタップ・プリセット */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {presets.map(pv => {
                    const on = value === pv;
                    return (
                      <button key={pv} type="button" className="hud-preset" onClick={() => setter(pv)}
                        style={{
                          padding: '5px 12px', borderRadius: '9px', cursor: 'pointer',
                          border: `1px solid ${on ? accent : 'rgba(199,210,254,0.22)'}`,
                          background: on ? alpha(accent, 0.24) : 'rgba(199,210,254,0.06)',
                          color: on ? '#ffffff' : '#c7d2fe',
                          fontSize: '11px', fontWeight: '900',
                          boxShadow: on ? `0 0 14px ${alpha(accent, 0.45)}` : 'none',
                          WebkitTapHighlightColor: 'transparent',
                        }}>
                        {pv}{unit}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== ひとことメモ（下段・全幅） ===== */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label style={{ fontSize: '11px', fontWeight: '900', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
          <PenLine size={13}/> {lang === 'en' ? 'Notes' : 'ひとことメモ'}
        </label>
        <textarea
          className="modern-input"
          value={reflection}
          onChange={e => setReflection(e.target.value)}
          placeholder={T.reflectionPlaceholder}
          style={{ ...input, minHeight: '84px', resize: 'vertical' }}
        />
      </div>
    </section>
  );
}
