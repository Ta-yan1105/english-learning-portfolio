import React, { useRef } from 'react';
import {
  Timer as TimerIcon, Play, Pause, RefreshCw,
  List, Maximize, Minimize, Volume2, VolumeX,
} from 'lucide-react';
import { useTimer } from '../hooks/useTimer';

function LapList({ laps, maxHeight = '300px' }) {
  if (laps.length === 0) return null;
  return (
    <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
      <div style={{
        width: '100%', maxWidth: '300px', backgroundColor: '#f8fafc',
        borderRadius: '12px', padding: '15px', border: '1px solid #f1f5f9',
        maxHeight, overflowY: 'auto',
      }}>
        <div style={{ fontSize: '12px', fontWeight: '900', color: '#94a3b8', marginBottom: '10px' }}>ラップ記録</div>
        {laps.map((lap, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: '14px', fontWeight: 'bold', color: '#1e293b',
            padding: '6px 0', borderBottom: i !== laps.length - 1 ? '1px dashed #e2e8f0' : 'none',
          }}>
            <span>ラップ {i + 1}</span>
            <div className="timer-text" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#4f46e5' }}>{lap.elapsed}</span>
              <span style={{ color: '#94a3b8', fontSize: '12px' }}>(残り {lap.remaining})</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Timer({ isMobile, onTimerComplete }) {
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
  const numStyleFS = { ...numBase, fontSize: isMobile ? '140px' : '280px' };

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
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '20px auto 30px' }}>
      <div className="draggable-number" onPointerDown={e => handlePointerDown(e, 'min')} style={{ cursor: isTimerRunning ? 'default' : 'ns-resize', padding: '0 8px' }}>
        <div className="timer-text" style={ns}>{timeDisplay.m}</div>
      </div>
      <div className="timer-text" style={{ ...ns, paddingBottom: isMobile ? '12px' : '20px' }}>:</div>
      <div className="draggable-number" onPointerDown={e => handlePointerDown(e, 'sec')} style={{ cursor: isTimerRunning ? 'default' : 'ns-resize', padding: '0 8px' }}>
        <div className="timer-text" style={ns}>{timeDisplay.s}</div>
      </div>
    </div>
  );

  const controls = (large = false) => {
    const pad  = large ? '18px 30px' : '15px 40px';
    const icon = large ? 24 : 20;
    const fs   = '18px';
    return (
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
        <button className="action-btn" onClick={toggleTimer} style={{ padding: pad, borderRadius: '50px', border: 'none', background: isTimerRunning ? '#f59e0b' : '#4f46e5', color: 'white', fontWeight: '900', cursor: 'pointer', fontSize: fs, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
          {isTimerRunning ? <><Pause size={icon}/> 一時停止</> : <><Play size={icon}/> スタート</>}
        </button>
        <button className="action-btn" onClick={resetTimer} style={{ padding: pad, borderRadius: '50px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: '900', cursor: 'pointer', fontSize: fs, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={icon}/> リセット
        </button>
        {timerTimeLeft !== timerInputTime && (
          <button className="action-btn" onClick={recordLap} style={{ padding: pad, borderRadius: '50px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: '900', cursor: 'pointer', fontSize: fs, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <List size={icon}/> ラップ記録
          </button>
        )}
      </div>
    );
  };

  const soundBtn = (fixed = false) => (
    <button className="action-btn" onClick={toggleSound} title={isSoundEnabled ? 'アラーム音：オン' : 'アラーム音：オフ'}
      style={{ ...(fixed ? { position: 'fixed', top: '20px', right: '70px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '40px', height: '40px', zIndex: 10001 } : { position: 'absolute', left: 0, background: 'none', border: 'none' }), display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '4px', color: isSoundEnabled ? '#4f46e5' : '#94a3b8' }}>
      {isSoundEnabled ? <Volume2 size={20}/> : <VolumeX size={20}/>}
    </button>
  );

  const card = { background: 'white', borderRadius: '24px', padding: isMobile ? '20px 15px' : '25px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', boxSizing: 'border-box', width: '100%', textAlign: 'center' };

  return (
    <>
      <section
        style={card}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '15px', position: 'relative' }}>
          {soundBtn(false)}
          <TimerIcon size={24} color="#4f46e5" style={{ marginRight: '8px' }}/>
          <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b', margin: 0 }}>学習タイマー</h2>
          <button className="action-btn" onClick={handleEnterFullscreen} title="全画面表示"
            style={{ position: 'absolute', right: 0, background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Maximize size={20}/>
          </button>
        </div>

        {face(numStyle, isMobile ? '50px 20px' : '80px 50px')}

        {!isTimerRunning && timerTimeLeft !== 0 && (
          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '25px' }}>
            👆 分・秒の数字を上下にスワイプして時間を調整
          </div>
        )}
        {controls(false)}
        <LapList laps={laps}/>
      </section>

      {isFullscreen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#f4f7fa', zIndex: 10000, overflowY: 'auto' }}>
          {soundBtn(true)}
          <button className="action-btn" onClick={handleExitFullscreen}
            style={{ position: 'fixed', top: '20px', right: '20px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', zIndex: 10001 }}>
            <Minimize size={20}/>
          </button>

          <div
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            style={{ minHeight: '100%', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '80px 20px 40px' : '40px', boxSizing: 'border-box', gap: isMobile ? '0' : '40px' }}
          >
            {!isMobile && <div style={{ flex: 1 }}/>}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <TimerIcon size={32} color="#4f46e5" style={{ marginRight: '10px' }}/>
                <h2 style={{ fontSize: '24px', fontWeight: '900', color: '#1e293b', margin: 0 }}>学習タイマー</h2>
              </div>
              {faceFullscreen(numStyleFS)}
              {!isTimerRunning && timerTimeLeft !== 0 && (
                <div style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '25px' }}>
                  👆 分・秒の数字を上下にスワイプして時間を調整
                </div>
              )}
              {controls(true)}
            </div>

            {!isMobile ? (
              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start', paddingLeft: '40px' }}>
                <LapList laps={laps} maxHeight="60vh"/>
              </div>
            ) : (
              <LapList laps={laps} maxHeight="25vh"/>
            )}
          </div>
        </div>
      )}
    </>
  );
}