import React, { useRef, useState, useEffect } from 'react';
import {
  Timer as TimerIcon, Play, Pause, RefreshCw,
  List, Maximize, Minimize, Volume2, VolumeX, Watch, Save, Check, BookOpen, Triangle, Gauge,
} from 'lucide-react';
import { useTimer } from '../hooks/useTimer';
import { useStopwatch } from '../hooks/useStopwatch';
import { WPM_SCALE_MAX, getWpmLevel } from '../utils/wpmLevels';
import { hudPanelStyle, HudHeading, HudDivider, hud } from './hud';

const toHalfWidthDigits = (str) => str.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));

function LapList({ laps, lang = 'ja', maxHeight = '300px', large = false }) {
  if (laps.length === 0) return null;
  const isEn = lang === 'en';
  return (
    <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
      <div style={{
        width: '100%', maxWidth: large ? '520px' : '300px', backgroundColor: '#f8fafc',
        borderRadius: large ? '20px' : '12px', padding: large ? '24px' : '15px',
        border: '1px solid #f1f5f9', maxHeight, overflowY: 'auto',
      }}>
        <div style={{ fontSize: large ? '18px' : '12px', fontWeight: '900', color: '#94a3b8', marginBottom: large ? '16px' : '10px' }}>
          {isEn ? 'Lap Records' : 'ラップ記録'}
        </div>
        {laps.map((lap, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', gap: large ? '32px' : '12px',
            fontSize: large ? '22px' : '14px', fontWeight: 'bold', color: '#1e293b',
            padding: large ? '12px 0' : '6px 0',
            borderBottom: i !== laps.length - 1 ? '1px dashed #e2e8f0' : 'none',
          }}>
            <span>{isEn ? `Lap ${i + 1}` : `ラップ ${i + 1}`}</span>
            <div className="timer-text" style={{ display: 'flex', alignItems: 'center', gap: large ? '10px' : '6px' }}>
              <span style={{ color: '#4f46e5' }}>{lap.elapsed}</span>
              <span style={{ color: '#94a3b8', fontSize: large ? '16px' : '12px' }}>({isEn ? 'left ' : '残り '}{lap.remaining})</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReadingBarChart({ records, lang = 'ja' }) {
  if (records.length === 0) return null;
  const isEn = lang === 'en';
  const chartH = 180;
  const colW   = 22;
  const gutterW = 56;
  const LIMIT_LINE = 230; // 教養ある大人レベルの上限（その先はネイティブレベル）
  const STANDARD_LINE = 130; // 「標準」レベルの上限（一般的な目安のライン）
  const maxWpm  = Math.max(...records.map(r => r.wpm));
  const avgWpm  = Math.round(records.reduce((s, r) => s + r.wpm, 0) / records.length);
  const scaleMax = Math.max(100, Math.ceil(Math.max(maxWpm, LIMIT_LINE) / 50) * 50 + 50);
  const yPos = (v) => (v / scaleMax) * chartH;
  const gridLines = [];
  for (let v = 50; v < scaleMax; v += 50) gridLines.push(v);
  const barsWidth = records.length * colW + (records.length - 1) * 8;

  return (
    <div className="custom-scrollbar" style={{ display: 'inline-flex', flexDirection: 'column', background: '#fafbfc', border: '1px solid #f1f5f9', borderRadius: '12px', padding: '10px 14px 8px', maxWidth: '100%', overflowX: 'auto' }}>
      <div style={{ fontSize: '10px', fontWeight: '900', color: '#cbd5e1', marginBottom: '8px', textAlign: 'center', letterSpacing: '0.04em' }}>
        {isEn ? 'GROWTH' : '伸び率'}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
        <div style={{ position: 'relative', width: `${barsWidth}px`, height: `${chartH}px`, display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
          {gridLines.map(v => (
            <div key={v} style={{ position: 'absolute', left: 0, width: '100%', bottom: `${yPos(v)}px`, borderTop: '1px dashed #eef2f7' }}/>
          ))}
          <div style={{ position: 'absolute', left: 0, width: '100%', bottom: `${yPos(LIMIT_LINE)}px`, borderTop: '1.5px solid #3730a3' }}/>
          <div style={{ position: 'absolute', left: 0, width: '100%', bottom: `${yPos(STANDARD_LINE)}px`, borderTop: '1.5px dashed #94a3b8' }}/>
          <div style={{ position: 'absolute', left: 0, width: '100%', bottom: `${yPos(avgWpm)}px`, borderTop: '1.5px dashed #f59e0b' }}/>
          {records.map((r, i) => {
            const lv = getWpmLevel(r.wpm);
            const h  = Math.max(4, yPos(r.wpm));
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: `${chartH}px`, width: `${colW}px`, position: 'relative', zIndex: 1 }}>
                <span className="timer-text" style={{ fontSize: '10px', fontWeight: '900', color: lv.color, marginBottom: '2px' }}>{r.wpm}</span>
                <div style={{ width: '16px', height: `${h}px`, background: lv.color, borderRadius: '4px 4px 0 0', transition: 'height 0.3s ease' }}/>
              </div>
            );
          })}
        </div>
        <div style={{ position: 'relative', width: `${gutterW}px`, height: `${chartH}px`, marginLeft: '6px', flexShrink: 0 }}>
          <span style={{ position: 'absolute', left: 0, bottom: `${yPos(LIMIT_LINE) - 6}px`, fontSize: '8px', fontWeight: '900', color: '#3730a3', whiteSpace: 'nowrap' }}>
            {isEn ? `Limit ${LIMIT_LINE}` : `上限 ${LIMIT_LINE}`}
          </span>
          <span style={{ position: 'absolute', left: 0, bottom: `${yPos(STANDARD_LINE) - 6}px`, fontSize: '8px', fontWeight: '900', color: '#94a3b8', whiteSpace: 'nowrap' }}>
            {isEn ? `Average ${STANDARD_LINE}` : `標準 ${STANDARD_LINE}`}
          </span>
          <span style={{ position: 'absolute', left: 0, bottom: `${yPos(avgWpm) - 6}px`, fontSize: '8px', fontWeight: '900', color: '#f59e0b', whiteSpace: 'nowrap' }}>
            {isEn ? `Your Avg ${avgWpm}` : `自分の平均 ${avgWpm}`}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
        {records.map((r, i) => {
          const prev  = i > 0 ? records[i - 1] : null;
          const delta = prev ? r.wpm - prev.wpm : null;
          return (
            <div key={i} style={{ width: `${colW}px`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: '700' }}>{isEn ? `#${i + 1}` : `${i + 1}回`}</span>
              {delta !== null && (
                <span style={{ fontSize: '9px', fontWeight: '900', color: delta > 0 ? '#16a34a' : delta < 0 ? '#ef4444' : '#cbd5e1' }}>
                  {delta > 0 ? `↑${delta}` : delta < 0 ? `↓${Math.abs(delta)}` : '→0'}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Timer({ isMobile, lang = 'ja', onTimerComplete, onSaveReadingRecords }) {
  const isEn = lang === 'en';
  const [mode, setMode] = useState('timer'); // 'timer' | 'stopwatch'
  const [readingSaveStatus, setReadingSaveStatus] = useState('idle'); // 'idle' | 'saved'
  const [readingMode, setReadingMode] = useState(false); // 音読スピード計測を使うかどうか
  const [showMaterialPrompt, setShowMaterialPrompt] = useState(false);
  const materialInputRef = useRef(null);

  const {
    timerInputTime, setTimerInputTime,
    timerTimeLeft,  setTimerTimeLeft,
    isTimerRunning,
    laps,
    isFullscreen,
    isSoundEnabled,
    toggleSound,
    toggleTimer,
    resetTimer,
    recordLap,
    handleEnterFullscreen,
    handleExitFullscreen,
    formatTimerDisplay,
  } = useTimer({ onComplete: onTimerComplete });

  const {
    swElapsed,
    isSwRunning,
    wordCount, setWordCount,
    materialName, setMaterialName,
    toggleStopwatch,
    resetStopwatch,
    formatStopwatch,
    wpm,
    readingRecords,
    recordReading,
    clearReadingRecords,
  } = useStopwatch();

  const handleSaveReadingRecords = () => {
    if (readingRecords.length === 0 || !onSaveReadingRecords) return;
    if (!materialName.trim() && !showMaterialPrompt) {
      setShowMaterialPrompt(true);
      materialInputRef.current?.focus();
      return;
    }
    setShowMaterialPrompt(false);
    const tagged = readingRecords.map(r => ({ ...r, material: materialName.trim() }));
    onSaveReadingRecords(tagged);
    clearReadingRecords();
    setReadingSaveStatus('saved');
    setTimeout(() => setReadingSaveStatus('idle'), 2500);
  };

  /* ── 単語数の増減：1語ずつ。長押しすると加速して連続で増減する ── */
  const holdTimerRef = useRef(null);
  const stepWords = (delta) => setWordCount(prev => String(Math.max(0, Math.min((Number(prev) || 0) + delta, 1000))));
  const endWordHold = () => { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; };
  const startWordHold = (delta) => {
    stepWords(delta);
    let held = 0;
    const run = (wait) => {
      holdTimerRef.current = setTimeout(() => {
        stepWords(delta);
        held += wait;
        run(held > 1800 ? 35 : held > 800 ? 70 : 140);
      }, wait);
    };
    run(420); // 長押しと判定するまでの待ち時間
  };
  useEffect(() => endWordHold, []);

  const dragStartY   = useRef(null);
  const dragStartVal = useRef(null);
  const dragTarget   = useRef(null);

  const handlePointerDown = (e, target) => {
    if (isTimerRunning) return;
    dragStartY.current   = e.touches ? e.touches[0].clientY : e.clientY;
    dragStartVal.current = timerInputTime;
    dragTarget.current   = target;
  };
  const handlePointerMove = (e) => {
    if (dragStartY.current === null) return;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const diffY   = dragStartY.current - clientY;
    let newTime   = dragStartVal.current;
    if (dragTarget.current === 'min') newTime += Math.floor(diffY / 10) * 60;
    if (dragTarget.current === 'sec') newTime += Math.floor(diffY / 5);
    newTime = Math.max(1, Math.min(newTime, 5999));
    if (newTime !== timerInputTime) { setTimerInputTime(newTime); setTimerTimeLeft(newTime); }
  };
  const handlePointerUp = () => { dragStartY.current = null; dragTarget.current = null; };

  const remainingRatio = timerInputTime > 0 ? timerTimeLeft / timerInputTime : 0;
  const consumedAngle  = (1 - remainingRatio) * 360;
  const timeDisplay    = formatTimerDisplay(timerTimeLeft);
  const isComplete     = timerTimeLeft === 0;

  const numColor = isComplete ? '#10b981' : '#4f46e5';
  const numBase  = { fontWeight: '900', color: numColor, lineHeight: '1', letterSpacing: '-0.02em', textShadow: '0 4px 15px rgba(79,70,229,0.15)', pointerEvents: 'none' };
  const numStyle   = { ...numBase, fontSize: isMobile ? '100px' : '160px' };
  const numStyleFS = { ...numBase, fontSize: isMobile ? 'min(19vw, 100px)' : 'min(26vh, 380px)' };

  const face = (ns, pad) => (
    <div style={{
      background: isComplete ? '#10b981' : `conic-gradient(#e2e8f0 ${consumedAngle}deg, #4f46e5 ${consumedAngle}deg)`,
      borderRadius: '34px', padding: '4px', margin: '20px auto 30px',
      width: 'fit-content', boxShadow: '0 18px 38px rgba(79,70,229,0.28), 0 6px 12px rgba(79,70,229,0.16)',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        background: 'linear-gradient(145deg,#ffffff,#f8fafc)', borderRadius: '30px',
        padding: pad, boxShadow: 'inset 0 2px 5px rgba(255,255,255,1), inset 0 -4px 10px rgba(79,70,229,0.07)',
      }}>
        <div className="draggable-number" onPointerDown={e => handlePointerDown(e, 'min')} style={{ cursor: isTimerRunning ? 'default' : 'ns-resize', padding: '0 5px' }}>
          <div className="timer-text" style={ns}>{timeDisplay.m}</div>
        </div>
        <div className="timer-text" style={{ ...ns, paddingBottom: isMobile ? '10px' : '15px' }}>:</div>
        <div className="draggable-number" onPointerDown={e => handlePointerDown(e, 'sec')} style={{ cursor: isTimerRunning ? 'default' : 'ns-resize', padding: '0 5px' }}>
          <div className="timer-text" style={ns}>{timeDisplay.s}</div>
        </div>
      </div>
    </div>
  );

  const faceFullscreen = (ns) => (
    <div style={{
      background: isComplete ? '#10b981' : `conic-gradient(#e2e8f0 ${consumedAngle}deg, #4f46e5 ${consumedAngle}deg)`,
      borderRadius: '64px', padding: '8px', margin: '20px auto 30px',
      width: 'fit-content', boxShadow: '0 28px 64px rgba(79,70,229,0.32), 0 10px 20px rgba(79,70,229,0.18)',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        background: 'linear-gradient(145deg,#ffffff,#f8fafc)', borderRadius: '56px',
        padding: isMobile ? '20px 12px' : 'min(8vh, 110px) min(6vw, 80px)',
        boxShadow: 'inset 0 3px 10px rgba(255,255,255,1), inset 0 -6px 16px rgba(79,70,229,0.07)',
      }}>
        <div className="draggable-number" onPointerDown={e => handlePointerDown(e, 'min')} style={{ cursor: isTimerRunning ? 'default' : 'ns-resize', padding: '0 8px' }}>
          <div className="timer-text" style={ns}>{timeDisplay.m}</div>
        </div>
        <div className="timer-text" style={{ ...ns, paddingBottom: isMobile ? '12px' : '20px' }}>:</div>
        <div className="draggable-number" onPointerDown={e => handlePointerDown(e, 'sec')} style={{ cursor: isTimerRunning ? 'default' : 'ns-resize', padding: '0 8px' }}>
          <div className="timer-text" style={ns}>{timeDisplay.s}</div>
        </div>
      </div>
    </div>
  );

  const swDisplay = formatStopwatch(swElapsed);

  const swFace = (ns, pad, csFontSize) => (
    <div style={{
      background: isSwRunning ? '#4f46e5' : '#e2e8f0',
      borderRadius: '34px', padding: '4px', margin: '20px auto 30px',
      width: 'fit-content', boxShadow: '0 18px 38px rgba(79,70,229,0.28), 0 6px 12px rgba(79,70,229,0.16)',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'baseline',
        background: 'linear-gradient(145deg,#ffffff,#f8fafc)', borderRadius: '30px',
        padding: pad, boxShadow: 'inset 0 2px 5px rgba(255,255,255,1), inset 0 -4px 10px rgba(79,70,229,0.07)',
      }}>
        <div className="timer-text" style={ns}>{swDisplay.m}</div>
        <div className="timer-text" style={ns}>:</div>
        <div className="timer-text" style={ns}>{swDisplay.s}</div>
        <div className="timer-text" style={{ ...ns, fontSize: csFontSize, color: '#94a3b8' }}>.{swDisplay.cs}</div>
      </div>
    </div>
  );

  const wpmLevel  = wpm > 0 ? getWpmLevel(wpm) : null;
  const markerPct = Math.min(100, (wpm / WPM_SCALE_MAX) * 100);

  /* ── 音読スピード計測のオン・オフ ── */
  const readingToggle = (large = false) => {
    const accent = '#0891b2';
    const on = readingMode;
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: large ? '26px' : '22px' }}>
        <button type="button" className="skill-tile" onClick={() => setReadingMode(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: large ? '12px 26px' : '11px 22px',
            borderRadius: '50px',
            border: on ? `1.5px solid ${accent}` : '1.5px solid rgba(8,145,178,0.28)',
            background: on ? `linear-gradient(150deg, #22b8cf 0%, ${accent} 55%, #0e7490 100%)` : '#ffffff',
            color: on ? '#ffffff' : accent,
            fontSize: large ? '15px' : '14px', fontWeight: '900', cursor: 'pointer',
            textShadow: on ? '0 1px 2px rgba(0,0,0,0.18)' : 'none',
            WebkitTapHighlightColor: 'transparent',
            '--edge': on ? '#0e7490' : '#dbe6ec',
            '--edge-h': on ? '5px' : '4px',
            '--glow': on ? 'rgba(8,145,178,0.3)' : 'rgba(30,27,75,0.06)',
            '--sheen': on ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0)',
          }}>
          <BookOpen size={large ? 19 : 17}/>
          {isEn ? 'Reading Speed' : '音読スピードを測る'}
          {on && <Check size={large ? 17 : 15} strokeWidth={4}/>}
        </button>
      </div>
    );
  };

  /* ── 音読スピードの入力パネル（単語数 + WPM 表示） ── */
  const readingPanel = (large = false) => {
    const words = Number(wordCount) || 0;
    const setWords = (v) => setWordCount(String(Math.max(0, Math.min(v, 1000))));
    const presets = [50, 100, 150, 200];
    const accent = '#0891b2';
    /* △▽ボタン：1タップで1語、長押しで連続増減 */
    const spinBtn = (delta) => ({
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: '46px', height: '30px', flexShrink: 0,
      borderRadius: delta > 0 ? '10px 10px 4px 4px' : '4px 4px 10px 10px',
      cursor: 'pointer',
      border: '1.5px solid rgba(8,145,178,0.3)',
      background: '#ffffff',
      color: accent,
      boxShadow: '0 2px 6px rgba(30,27,75,0.06)',
      touchAction: 'none',
      WebkitTapHighlightColor: 'transparent',
    });
    const spinHandlers = (delta) => ({
      onPointerDown: (e) => { e.preventDefault(); startWordHold(delta); },
      onPointerUp: endWordHold,
      onPointerLeave: endWordHold,
      onPointerCancel: endWordHold,
    });
    return (
      <div style={{ ...hudPanelStyle(isMobile), width: large ? '560px' : '100%', maxWidth: '100%', margin: '0 auto 20px' }}>
        <HudHeading text={isEn ? 'READING SPEED' : '音読スピード'} isMobile={isMobile}/>

        {/* 単語数 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '9px', background: 'rgba(8,145,178,0.1)', border: '1px solid rgba(8,145,178,0.22)', color: accent, flexShrink: 0 }}>
            <BookOpen size={14}/>
          </span>
          <span style={{ fontSize: '12px', fontWeight: '900', color: hud.ink }}>
            {isEn ? 'Word Count' : '音読する単語数'}
          </span>
          <span style={{ fontSize: '9px', fontWeight: '900', letterSpacing: '0.16em', color: hud.label }}>WORDS</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <input
              type="text" inputMode="numeric" value={wordCount}
              onChange={e => {
                const digits = toHalfWidthDigits(e.target.value).replace(/[^0-9]/g, '');
                setWordCount(digits === '' ? '' : String(Math.min(Number(digits), 1000)));
              }}
              placeholder="0"
              className="timer-text"
              style={{
                width: large ? '150px' : '128px', padding: '4px 0', background: 'transparent',
                border: 'none', borderBottom: '2px solid rgba(8,145,178,0.3)', outline: 'none',
                fontSize: large ? '52px' : '46px', fontWeight: '900', textAlign: 'center',
                color: accent, letterSpacing: '-0.03em',
                textShadow: '0 3px 10px rgba(8,145,178,0.25)',
              }}
            />
            <span style={{ fontSize: '14px', fontWeight: '900', color: 'rgba(8,145,178,0.7)' }}>{isEn ? 'words' : '語'}</span>
          </div>

          {/* △▽ スピナー（1語単位・長押しで連続） */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button type="button" className="hud-step" style={spinBtn(1)} {...spinHandlers(1)}
              aria-label={isEn ? 'Increase by 1 word' : '1語増やす'}>
              <Triangle size={13} fill="currentColor" strokeWidth={0}/>
            </button>
            <button type="button" className="hud-step" style={spinBtn(-1)} {...spinHandlers(-1)}
              aria-label={isEn ? 'Decrease by 1 word' : '1語減らす'}>
              <Triangle size={13} fill="currentColor" strokeWidth={0} style={{ transform: 'rotate(180deg)' }}/>
            </button>
          </div>
        </div>

        {/* ワンタップ・プリセット */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {presets.map(pv => {
            const on = words === pv;
            return (
              <button key={pv} type="button" className="hud-preset" onClick={() => setWords(pv)}
                style={{
                  padding: '5px 12px', borderRadius: '9px', cursor: 'pointer',
                  border: `1px solid ${on ? accent : hud.chipIn}`,
                  background: on ? accent : '#ffffff',
                  color: on ? '#ffffff' : '#7c86a8',
                  fontSize: '11px', fontWeight: '900',
                  boxShadow: on ? '0 4px 10px rgba(8,145,178,0.3)' : '0 1px 3px rgba(30,27,75,0.05)',
                  WebkitTapHighlightColor: 'transparent',
                }}>
                {pv}{isEn ? 'w' : '語'}
              </button>
            );
          })}
        </div>

        {/* 計測結果（WPM） */}
        {!isSwRunning && wpm > 0 && wpmLevel && (
          <>
            <HudDivider margin={isMobile ? '16px 0 14px' : '18px 0 15px'}/>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '9px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.22)', color: '#10b981', flexShrink: 0 }}>
                <Gauge size={14}/>
              </span>
              <span style={{ fontSize: '12px', fontWeight: '900', color: hud.ink }}>
                {isEn ? 'Your Speed' : '今回のスピード'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
              <span className="timer-text" style={{
                fontSize: large ? '60px' : '52px', fontWeight: '900', color: '#10b981', lineHeight: 1,
                letterSpacing: '-0.03em', textShadow: '0 3px 12px rgba(16,185,129,0.28)',
              }}>{wpm}</span>
              <span style={{ fontSize: '15px', fontWeight: '900', color: 'rgba(16,185,129,0.72)', letterSpacing: '0.08em' }}>WPM</span>
            </div>

            {/* レベルゲージ（標準・上限の目印つき） */}
            <div style={{ position: 'relative', height: '12px', borderRadius: '7px', background: hud.track, overflow: 'hidden', marginBottom: '8px' }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, height: '100%', width: `${markerPct}%`,
                borderRadius: '7px', background: `linear-gradient(90deg, rgba(16,185,129,0.55), ${wpmLevel.color})`,
                transition: 'width 0.4s ease',
              }}/>
              {[[130, isEn ? 'Average' : '標準'], [230, isEn ? 'Limit' : '上限']].map(([v]) => (
                <div key={v} style={{ position: 'absolute', top: 0, bottom: 0, left: `${Math.min(100, (v / WPM_SCALE_MAX) * 100)}%`, width: '1.5px', background: 'rgba(255,255,255,0.9)' }}/>
              ))}
            </div>
            <div style={{ position: 'relative', height: '14px', marginBottom: '12px' }}>
              {[[130, isEn ? 'Average' : '標準'], [230, isEn ? 'Limit' : '上限']].map(([v, label]) => (
                <span key={v} style={{ position: 'absolute', left: `${Math.min(100, (v / WPM_SCALE_MAX) * 100)}%`, transform: 'translateX(-50%)', fontSize: '9px', fontWeight: '900', color: hud.label, whiteSpace: 'nowrap' }}>
                  {label} {v}
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: '900', color: wpmLevel.textColor, background: wpmLevel.color, padding: '3px 10px', borderRadius: '8px' }}>
                Lv.{wpmLevel.lv}
              </span>
              <span style={{ fontSize: '14px', fontWeight: '900', color: wpmLevel.color }}>
                {isEn ? wpmLevel.en : wpmLevel.ja}
              </span>
            </div>
          </>
        )}

        {/* 使い方のヒント */}
        {wpm === 0 && (
          <div style={{ marginTop: '14px', fontSize: '11px', fontWeight: 'bold', color: hud.label, textAlign: 'center', lineHeight: 1.6 }}>
            {isEn
              ? 'Enter the word count, then start the stopwatch and read aloud.'
              : '単語数を入れて、スタートを押したら音読を始めましょう。'}
          </div>
        )}
      </div>
    );
  };


  const swControls = (large = false) => {
    const pad  = large ? '16px 26px' : (isMobile ? '12px 18px' : '15px 40px');
    const icon = large ? 22 : (isMobile ? 17 : 20);
    const fs   = isMobile && !large ? '15px' : '18px';
    return (
      <div style={{ display: 'flex', justifyContent: 'center', gap: isMobile ? '10px' : '20px', flexWrap: 'wrap' }}>
        <button className="action-btn" onClick={toggleStopwatch} style={{ padding: pad, borderRadius: '50px', border: 'none', background: isSwRunning ? '#f59e0b' : '#4f46e5', color: 'white', fontWeight: '900', cursor: 'pointer', fontSize: fs, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
          {isSwRunning ? <><Pause size={icon}/> {isEn ? 'Pause' : '一時停止'}</> : <><Play size={icon}/> {isEn ? 'Start' : 'スタート'}</>}
        </button>
        <button className="action-btn" onClick={resetStopwatch} style={{ padding: pad, borderRadius: '50px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: '900', cursor: 'pointer', fontSize: fs, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={icon}/> {isEn ? 'Reset' : 'リセット'}
        </button>
        {readingMode && !isSwRunning && swElapsed > 0 && Number(wordCount) > 0 && (
          <button className="action-btn" onClick={recordReading} style={{ padding: pad, borderRadius: '50px', border: 'none', background: '#22c55e', color: 'white', fontWeight: '900', cursor: 'pointer', fontSize: fs, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
            <List size={icon}/> {isEn ? 'Record' : '記録して次へ'}
          </button>
        )}
      </div>
    );
  };

  const chartBlock = () => {
    if (readingRecords.length === 0) return null;
    return <ReadingBarChart records={readingRecords} lang={lang}/>;
  };

  const readingSaveButton = (large = false) => {
    if (readingRecords.length === 0 && readingSaveStatus !== 'saved') return null;
    const pad = large ? '14px 26px' : '12px 22px';
    return (
      <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
        {readingSaveStatus !== 'saved' && (
          <input
            ref={materialInputRef}
            type="text" value={materialName}
            onChange={e => { setMaterialName(e.target.value); if (e.target.value.trim()) setShowMaterialPrompt(false); }}
            placeholder={isEn ? 'Textbook / unit / page (optional)' : '教材名・単元・ページ（任意）'}
            style={{ width: large ? '260px' : '220px', maxWidth: '90vw', boxSizing: 'border-box', padding: '8px 14px', fontSize: '13px', fontWeight: 'bold', textAlign: 'center', border: showMaterialPrompt ? '1.5px solid #f59e0b' : '1.5px dashed #cbd5e1', borderRadius: '10px', background: '#f1f5f9', color: '#475569' }}
          />
        )}
        {showMaterialPrompt && readingSaveStatus !== 'saved' && (
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#f59e0b', textAlign: 'center', maxWidth: '90vw' }}>
            {isEn ? 'Please enter the textbook / unit / page (or press Save again to skip)' : '教材名・単元・ページを入力してください（このまま保存する場合は再度保存ボタンを押してください）'}
          </div>
        )}
        {readingSaveStatus === 'saved' ? (
          <div style={{ padding: pad, borderRadius: '50px', background: '#ecfdf5', color: '#10b981', fontWeight: '900', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Check size={18}/> {isEn ? 'Saved to today\'s log!' : '今日の学習ログに保存しました！'}
          </div>
        ) : (
          <button className="action-btn" onClick={handleSaveReadingRecords} style={{ padding: pad, borderRadius: '50px', border: 'none', background: '#4f46e5', color: 'white', fontWeight: '900', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
            <Save size={18}/> {isEn ? `Save Today's Records (${readingRecords.length})` : `今日の記録として保存（${readingRecords.length}件）`}
          </button>
        )}
      </div>
    );
  };

  const modeTabs = (
    <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '12px', margin: '0 auto', width: 'fit-content' }}>
      {[
        ['timer', isEn ? 'Timer' : 'タイマー', TimerIcon],
        ['stopwatch', isEn ? 'Stopwatch' : 'ストップウォッチ', Watch],
      ].map(([m, label, Icon]) => (
        <button key={m} onClick={() => setMode(m)} className="action-btn" style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '9px', border: 'none', cursor: 'pointer',
          background: mode === m ? 'white' : 'transparent', color: mode === m ? '#4f46e5' : '#94a3b8',
          fontWeight: '900', fontSize: '13px', boxShadow: mode === m ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
        }}>
          <Icon size={14}/> {label}
        </button>
      ))}
    </div>
  );

  const controls = (large = false) => {
    const pad  = large ? '16px 26px' : (isMobile ? '10px 13px' : '15px 40px');
    const icon = large ? 24 : (isMobile ? 15 : 20);
    const fs   = isMobile && !large ? '12px' : '18px';
    return (
      <div style={{ display: 'flex', justifyContent: 'center', gap: isMobile ? '6px' : '20px', flexWrap: 'wrap' }}>
        <button className="action-btn" onClick={toggleTimer} style={{ padding: pad, borderRadius: '50px', border: 'none', background: isTimerRunning ? '#f59e0b' : '#4f46e5', color: 'white', fontWeight: '900', cursor: 'pointer', fontSize: fs, display: 'flex', alignItems: 'center', gap: isMobile ? '5px' : '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', whiteSpace: 'nowrap' }}>
          {isTimerRunning ? <><Pause size={icon}/> {isEn ? 'Pause' : '一時停止'}</> : <><Play size={icon}/> {isEn ? 'Start' : 'スタート'}</>}
        </button>
        <button className="action-btn" onClick={resetTimer} style={{ padding: pad, borderRadius: '50px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: '900', cursor: 'pointer', fontSize: fs, display: 'flex', alignItems: 'center', gap: isMobile ? '5px' : '8px', whiteSpace: 'nowrap' }}>
          <RefreshCw size={icon}/> {isEn ? 'Reset' : 'リセット'}
        </button>
        {timerTimeLeft !== timerInputTime && (
          <button className="action-btn" onClick={recordLap} style={{ padding: pad, borderRadius: '50px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: '900', cursor: 'pointer', fontSize: fs, display: 'flex', alignItems: 'center', gap: isMobile ? '5px' : '8px', whiteSpace: 'nowrap' }}>
            <List size={icon}/> {isEn ? 'Lap' : 'ラップ記録'}
          </button>
        )}
      </div>
    );
  };

  const soundBtn = (fixed = false) => (
    <button className="action-btn" onClick={toggleSound}
      title={isSoundEnabled ? (isEn ? 'Sound: ON' : 'アラーム音：オン') : (isEn ? 'Sound: OFF' : 'アラーム音：オフ')}
      style={{ ...(fixed ? { position: 'fixed', top: '20px', right: '70px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '40px', height: '40px', zIndex: 10001 } : { position: 'absolute', left: 0, background: 'none', border: 'none' }), display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '4px', color: isSoundEnabled ? '#4f46e5' : '#94a3b8' }}>
      {isSoundEnabled ? <Volume2 size={20}/> : <VolumeX size={20}/>}
    </button>
  );

  const card = { background: 'white', borderRadius: '24px', padding: isMobile ? '20px 15px' : '25px', marginBottom: '20px', boxShadow: '0 22px 50px rgba(30, 27, 75, 0.20), 0 8px 16px rgba(30, 27, 75, 0.10), 0 0 0 1px rgba(79, 70, 229, 0.07)', boxSizing: 'border-box', width: '100%', textAlign: 'center' };
  const isStopwatch = mode === 'stopwatch';
  const swipeHint = isEn ? '👆 Swipe min/sec up or down to set time' : '👆 分・秒の数字を上下にスワイプして時間を調整';

  /* よく使う時間をワンタップで設定する */
  const TIME_PRESETS = [25, 50, 75, 90];
  const applyPreset = (min) => {
    if (isTimerRunning) return;
    const sec = min * 60;
    setTimerInputTime(sec);
    setTimerTimeLeft(sec);
  };
  const timePresets = (large = false) => {
    if (isTimerRunning) return null;
    return (
      <div style={{ display: 'flex', justifyContent: 'center', gap: large ? '10px' : '8px', flexWrap: 'wrap', marginBottom: large ? '22px' : '18px' }}>
        {TIME_PRESETS.map(m => {
          const on = timerInputTime === m * 60;
          return (
            <button key={m} type="button" className="hud-preset" onClick={() => applyPreset(m)}
              style={{
                padding: large ? '8px 20px' : '6px 16px', borderRadius: '50px', cursor: 'pointer',
                border: `1px solid ${on ? '#4f46e5' : '#c9cfe8'}`,
                background: on ? '#4f46e5' : '#ffffff',
                color: on ? '#ffffff' : '#7c86a8',
                fontSize: large ? '15px' : '13px', fontWeight: '900',
                boxShadow: on ? '0 4px 12px rgba(79,70,229,0.3)' : '0 1px 3px rgba(30,27,75,0.05)',
                WebkitTapHighlightColor: 'transparent',
              }}>
              {m}{isEn ? 'm' : '分'}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <section
        style={card}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* タブがモードを示すので見出しは置かず、左右に操作アイコンだけ添える */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
          {soundBtn(false)}
          {modeTabs}
          <button className="action-btn" onClick={handleEnterFullscreen} title={isEn ? 'Fullscreen' : '全画面表示'}
            style={{ position: 'absolute', right: 0, background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Maximize size={20}/>
          </button>
        </div>

        {isStopwatch ? (
          <>
            {swFace(numStyle, isMobile ? '50px 20px' : '80px 50px', isMobile ? '40px' : '60px')}
            {swControls(false)}
            {readingToggle(false)}
            {readingMode && (
              <div style={{ marginTop: '16px', animation: 'popIn 0.3s ease-out' }}>
                {readingPanel(false)}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              {chartBlock()}
            </div>
            {readingSaveButton(false)}
          </>
        ) : (
          <>
            {face(numStyle, isMobile ? '50px 20px' : '80px 50px')}
            {timePresets(false)}
            {!isTimerRunning && timerTimeLeft !== 0 && (
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '25px' }}>
                {swipeHint}
              </div>
            )}
            {controls(false)}
            <LapList laps={laps} lang={lang}/>
          </>
        )}
      </section>

      {isFullscreen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#f4f7fa', zIndex: 10000, overflowY: 'auto', overflowX: 'hidden' }}>
          {soundBtn(true)}
          <button className="action-btn" onClick={handleExitFullscreen}
            style={{ position: 'fixed', top: '20px', right: '20px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', zIndex: 10001 }}>
            <Minimize size={20}/>
          </button>

          <div
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            style={{ minHeight: '100%', display: 'flex', flexDirection: isMobile || isStopwatch ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '80px 20px 40px' : '40px', boxSizing: 'border-box', gap: isMobile ? '0' : '40px' }}
          >
            {!isMobile && !isStopwatch && <div style={{ flex: 1 }}/>}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              {isStopwatch ? (
                <>
                  {swFace(numStyleFS, isMobile ? '20px 12px' : 'min(8vh, 110px) min(6vw, 80px)', isMobile ? 'min(8vw, 40px)' : 'min(9vh, 140px)')}
                  {swControls(true)}
                  {readingToggle(true)}
                  {readingMode && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px', animation: 'popIn 0.3s ease-out' }}>
                      {readingPanel(true)}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {chartBlock()}
                  </div>
                  {readingSaveButton(true)}
                </>
              ) : (
                <>
                  {faceFullscreen(numStyleFS)}
                  {timePresets(true)}
                  {!isTimerRunning && timerTimeLeft !== 0 && (
                    <div style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '25px' }}>
                      {swipeHint}
                    </div>
                  )}
                  {controls(true)}
                </>
              )}
            </div>

            {!isStopwatch && (!isMobile ? (
              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start', paddingLeft: '40px' }}>
                <LapList laps={laps} lang={lang} maxHeight="60vh" large/>
              </div>
            ) : (
              <LapList laps={laps} lang={lang} maxHeight="25vh" large/>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
