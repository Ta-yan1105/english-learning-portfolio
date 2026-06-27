import React, { useRef, useState } from 'react';
import {
  Timer as TimerIcon, Play, Pause, RefreshCw,
  List, Maximize, Minimize, Volume2, VolumeX, Watch, Mic, Save, Check, PlayCircle, StopCircle,
} from 'lucide-react';
import { useTimer } from '../hooks/useTimer';
import { useStopwatch } from '../hooks/useStopwatch';
import { WPM_SCALE_MAX, getWpmLevel } from '../utils/wpmLevels';

const toHalfWidthDigits = (str) => str.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));

const getMicPermissionGuide = (isEn) => {
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) {
    return isEn
      ? 'iPhone/iPad: Open the Settings app → Safari (or your browser) → Microphone → set to "Allow"'
      : 'iPhone/iPad: 「設定」アプリ → Safari（使用中のブラウザ）→ マイク → 「許可」に切り替えてください';
  }
  if (/Android/.test(ua)) {
    return isEn
      ? 'Android: Tap the icon left of the address bar → Permissions → set Microphone to "Allow"'
      : 'Android: アドレスバー左側のアイコンをタップ →「権限」→ マイクを「許可」に切り替えてください';
  }
  return isEn
    ? 'Allow microphone access for this site in your browser settings'
    : 'ブラウザの設定からこのサイトのマイク権限を「許可」に変更してください';
};

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
  const [playingIndex, setPlayingIndex] = useState(null);
  const audioRef = useRef(null);

  const togglePlay = (i, url) => {
    if (playingIndex === i) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingIndex(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(url);
    audio.onended = () => setPlayingIndex(null);
    audio.play();
    audioRef.current = audio;
    setPlayingIndex(i);
  };

  if (records.length === 0) return null;
  const isEn = lang === 'en';
  const chartH = 100;
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
              {r.audioUrl && (
                <button type="button" onClick={() => togglePlay(i, r.audioUrl)} title={playingIndex === i ? (isEn ? 'Stop' : '停止') : (isEn ? 'Play recording' : '録音を聞く')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0 0', display: 'flex' }}>
                  {playingIndex === i ? <StopCircle size={13} color="#ef4444"/> : <PlayCircle size={13} color="#4f46e5"/>}
                </button>
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
    transcript, setTranscript,
    recordVoice, setRecordVoice,
    micError,
    speechSupported,
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
    const tagged = readingRecords.map(r => ({ ...r, material: materialName.trim() }));
    onSaveReadingRecords(tagged, transcript);
    clearReadingRecords();
    setTranscript('');
    setReadingSaveStatus('saved');
    setTimeout(() => setReadingSaveStatus('idle'), 2500);
  };

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
  const numStyleFS = { ...numBase, fontSize: isMobile ? 'min(19vw, 100px)' : '380px' };

  const face = (ns, pad) => (
    <div style={{
      background: isComplete ? '#10b981' : `conic-gradient(#e2e8f0 ${consumedAngle}deg, #4f46e5 ${consumedAngle}deg)`,
      borderRadius: '34px', padding: '4px', margin: '20px auto 30px',
      width: 'fit-content', boxShadow: '0 15px 35px rgba(79,70,229,0.1)',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        background: 'linear-gradient(145deg,#ffffff,#f8fafc)', borderRadius: '30px',
        padding: pad, boxShadow: 'inset 0 2px 5px rgba(255,255,255,1)',
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
      width: 'fit-content', boxShadow: '0 24px 60px rgba(79,70,229,0.14)',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        background: 'linear-gradient(145deg,#ffffff,#f8fafc)', borderRadius: '56px',
        padding: isMobile ? '20px 12px' : '110px 80px',
        boxShadow: 'inset 0 3px 10px rgba(255,255,255,1)',
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
      width: 'fit-content', boxShadow: '0 15px 35px rgba(79,70,229,0.1)',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'baseline',
        background: 'linear-gradient(145deg,#ffffff,#f8fafc)', borderRadius: '30px',
        padding: pad, boxShadow: 'inset 0 2px 5px rgba(255,255,255,1)',
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

  const wpmPanel = (large = false) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: large ? '30px' : '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Mic size={large ? 20 : 16} color="#22d3ee"/>
        <span style={{ fontSize: large ? '16px' : '13px', fontWeight: '900', color: '#64748b' }}>{isEn ? 'Passage Word Count' : '音読する英文の単語数'}</span>
        <input
          type="text" inputMode="numeric" value={wordCount}
          onChange={e => setWordCount(toHalfWidthDigits(e.target.value).replace(/[^0-9]/g, ''))}
          placeholder="0"
          style={{ width: large ? '90px' : '70px', padding: large ? '8px 10px' : '6px 8px', fontSize: large ? '16px' : '14px', fontWeight: '900', textAlign: 'center', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#1e293b' }}
        />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
        <input type="checkbox" checked={recordVoice} onChange={e => setRecordVoice(e.target.checked)} style={{ width: '14px', height: '14px', cursor: 'pointer' }}/>
        <span style={{ fontSize: large ? '13px' : '12px', fontWeight: 'bold', color: '#64748b' }}>
          {isEn ? 'Record my voice & transcribe' : '自分の声を録音して文字起こしする'}
        </span>
      </label>
      {recordVoice && micError && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center', maxWidth: '90vw' }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#ef4444', textAlign: 'center' }}>
            ⚠️ {micError}
          </div>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#94a3b8', textAlign: 'center', background: '#f8fafc', padding: '8px 12px', borderRadius: '10px' }}>
            {getMicPermissionGuide(isEn)}
          </div>
        </div>
      )}
      {recordVoice && !speechSupported && (
        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#94a3b8', textAlign: 'center', maxWidth: '90vw', background: '#f8fafc', padding: '8px 12px', borderRadius: '10px' }}>
          {isEn
            ? 'Note: This browser/device does not support auto-transcription (recording still works). This is common on iPhone (Safari).'
            : '※ この端末・ブラウザは自動文字起こしに対応していません（録音は可能です）。iPhone（Safari）では仕様上対応していません。'}
        </div>
      )}
      {!isSwRunning && wpm > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', background: '#ecfdf5', padding: large ? '10px 22px' : '6px 14px', borderRadius: '14px' }}>
            <span className="timer-text" style={{ fontSize: large ? '32px' : '22px', fontWeight: '900', color: '#10b981' }}>{wpm}</span>
            <span style={{ fontSize: large ? '14px' : '11px', fontWeight: '900', color: '#10b981' }}>WPM</span>
          </div>
          <div style={{ width: large ? '260px' : '200px' }}>
            <div style={{ position: 'relative', height: '10px', borderRadius: '6px', background: '#e2e8f0', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, height: '100%', width: `${markerPct}%`,
                borderRadius: '6px', background: 'linear-gradient(90deg,#e0e7ff,#3730a3)', transition: 'width 0.3s ease',
              }}/>
            </div>
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <span style={{ fontSize: large ? '12px' : '11px', fontWeight: '900', color: wpmLevel.textColor, background: wpmLevel.color, padding: '2px 8px', borderRadius: '8px' }}>
                Lv.{wpmLevel.lv}
              </span>
              <span style={{ fontSize: large ? '15px' : '13px', fontWeight: '900', color: wpmLevel.color }}>
                {isEn ? wpmLevel.en : wpmLevel.ja}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const swControls = (large = false) => {
    const pad  = large ? '18px 30px' : '15px 40px';
    const icon = large ? 24 : 20;
    const fs   = '18px';
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <button className="action-btn" onClick={toggleStopwatch} style={{ padding: pad, borderRadius: '50px', border: 'none', background: isSwRunning ? '#f59e0b' : '#4f46e5', color: 'white', fontWeight: '900', cursor: 'pointer', fontSize: fs, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
            {isSwRunning ? <><Pause size={icon}/> {isEn ? 'Pause' : '一時停止'}</> : <><Play size={icon}/> {isEn ? 'Start' : 'スタート'}</>}
          </button>
          <button className="action-btn" onClick={resetStopwatch} style={{ padding: pad, borderRadius: '50px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: '900', cursor: 'pointer', fontSize: fs, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={icon}/> {isEn ? 'Reset' : 'リセット'}
          </button>
          {!isSwRunning && swElapsed > 0 && Number(wordCount) > 0 && (
            <button className="action-btn" onClick={recordReading} style={{ padding: pad, borderRadius: '50px', border: 'none', background: '#22c55e', color: 'white', fontWeight: '900', cursor: 'pointer', fontSize: fs, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
              <List size={icon}/> {isEn ? 'Record' : '記録して次へ'}
            </button>
          )}
        </div>
        {readingRecords.length > 0 && (
          <div style={{ marginLeft: '24px' }}>
            <ReadingBarChart records={readingRecords} lang={lang}/>
          </div>
        )}
      </div>
    );
  };

  const readingSaveButton = (large = false) => {
    if (readingRecords.length === 0 && readingSaveStatus !== 'saved') return null;
    const pad = large ? '14px 26px' : '12px 22px';
    return (
      <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
        {readingSaveStatus !== 'saved' && (
          <input
            type="text" value={materialName} onChange={e => setMaterialName(e.target.value)}
            placeholder={isEn ? 'Textbook / unit / page (optional)' : '教材名・単元・ページ（任意）'}
            style={{ width: large ? '260px' : '220px', maxWidth: '90vw', boxSizing: 'border-box', padding: '8px 14px', fontSize: '13px', fontWeight: 'bold', textAlign: 'center', border: '1.5px dashed #cbd5e1', borderRadius: '10px', background: '#f1f5f9', color: '#475569' }}
          />
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
        {readingSaveStatus !== 'saved' && (
          <textarea
            value={transcript} onChange={e => setTranscript(e.target.value)}
            placeholder={isEn ? 'Auto-transcribed from your spoken English (editable)' : '録音中に話した英語が自動で文字起こしされます（編集可）'}
            rows={4}
            style={{ width: large ? '560px' : '440px', maxWidth: '90vw', boxSizing: 'border-box', padding: '14px 18px', fontSize: '16px', fontFamily: 'inherit', lineHeight: 1.7, border: '1.5px dashed #cbd5e1', borderRadius: '12px', background: '#f1f5f9', color: '#334155', resize: 'vertical' }}
          />
        )}
      </div>
    );
  };

  const modeTabs = (
    <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '12px', margin: '0 auto 18px', width: 'fit-content' }}>
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
    const pad  = large ? '18px 30px' : '15px 40px';
    const icon = large ? 24 : 20;
    const fs   = '18px';
    return (
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
        <button className="action-btn" onClick={toggleTimer} style={{ padding: pad, borderRadius: '50px', border: 'none', background: isTimerRunning ? '#f59e0b' : '#4f46e5', color: 'white', fontWeight: '900', cursor: 'pointer', fontSize: fs, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
          {isTimerRunning ? <><Pause size={icon}/> {isEn ? 'Pause' : '一時停止'}</> : <><Play size={icon}/> {isEn ? 'Start' : 'スタート'}</>}
        </button>
        <button className="action-btn" onClick={resetTimer} style={{ padding: pad, borderRadius: '50px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: '900', cursor: 'pointer', fontSize: fs, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={icon}/> {isEn ? 'Reset' : 'リセット'}
        </button>
        {timerTimeLeft !== timerInputTime && (
          <button className="action-btn" onClick={recordLap} style={{ padding: pad, borderRadius: '50px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: '900', cursor: 'pointer', fontSize: fs, display: 'flex', alignItems: 'center', gap: '8px' }}>
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

  const card = { background: 'white', borderRadius: '24px', padding: isMobile ? '20px 15px' : '25px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', boxSizing: 'border-box', width: '100%', textAlign: 'center' };
  const isStopwatch = mode === 'stopwatch';
  const title = isStopwatch ? (isEn ? 'Stopwatch' : 'ストップウォッチ') : (isEn ? 'Study Timer' : '学習タイマー');
  const HeaderIcon = isStopwatch ? Watch : TimerIcon;
  const swipeHint = isEn ? '👆 Swipe min/sec up or down to set time' : '👆 分・秒の数字を上下にスワイプして時間を調整';

  return (
    <>
      <section
        style={card}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {modeTabs}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '15px', position: 'relative' }}>
          {soundBtn(false)}
          <HeaderIcon size={24} color="#4f46e5" style={{ marginRight: '8px' }}/>
          <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b', margin: 0 }}>{title}</h2>
          <button className="action-btn" onClick={handleEnterFullscreen} title={isEn ? 'Fullscreen' : '全画面表示'}
            style={{ position: 'absolute', right: 0, background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Maximize size={20}/>
          </button>
        </div>

        {isStopwatch ? (
          <>
            {swFace(numStyle, isMobile ? '50px 20px' : '80px 50px', isMobile ? '40px' : '60px')}
            {wpmPanel(false)}
            {swControls(false)}
            {readingSaveButton(false)}
          </>
        ) : (
          <>
            {face(numStyle, isMobile ? '50px 20px' : '80px 50px')}
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
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <HeaderIcon size={32} color="#4f46e5" style={{ marginRight: '10px' }}/>
                <h2 style={{ fontSize: '24px', fontWeight: '900', color: '#1e293b', margin: 0 }}>{title}</h2>
              </div>
              {isStopwatch ? (
                <>
                  {swFace(numStyleFS, isMobile ? '20px 12px' : '110px 80px', isMobile ? 'min(8vw, 40px)' : '140px')}
                  {wpmPanel(true)}
                  {swControls(true)}
                  {readingSaveButton(true)}
                </>
              ) : (
                <>
                  {faceFullscreen(numStyleFS)}
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
