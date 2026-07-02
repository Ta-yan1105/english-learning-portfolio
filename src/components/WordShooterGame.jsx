import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Heart, Star, Trophy, RefreshCw, Play, Zap } from 'lucide-react';

const MAX_LIVES  = 10;
const SPAWN_BASE = 3000;
const SPEED_BASE = 9000;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function playGunshot() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.18), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1.0, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowshelf'; filter.frequency.value = 200; filter.gain.value = 8;
    src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    src.start(); setTimeout(() => ctx.close(), 400);
  } catch {}
}

function playMissSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.3); setTimeout(() => ctx.close(), 400);
  } catch {}
}

function playComboSound(combo) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = 'sine';
    const freq = 440 * Math.pow(2, Math.min(combo - 2, 8) / 12);
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.2); setTimeout(() => ctx.close(), 300);
  } catch {}
}

const comboMultiplier = (combo) => Math.min(5, Math.floor(combo / 3) + 1);

export default function WordShooterGame({ words = [], lang = 'ja', onClose }) {
  const isEn = lang === 'en';
  const [gameState, setGameState]       = useState('idle');
  const [activeWords, setActiveWords]   = useState([]);
  const [hintIds, setHintIds]           = useState(new Set());
  const [hitIds, setHitIds]             = useState(new Set());
  const [missIds, setMissIds]           = useState(new Set());
  const [input, setInput]               = useState('');
  const [score, setScore]               = useState(0);
  const [lives, setLives]               = useState(MAX_LIVES);
  const [combo, setCombo]               = useState(0);
  const [maxCombo, setMaxCombo]         = useState(0);
  const [screenFlash, setScreenFlash]   = useState(null);
  const [learningWord, setLearningWord] = useState(null); // ミス時の学習一時停止
  const [comboFlash, setComboFlash]     = useState(null); // コンボ表示

  const inputRef    = useRef(null);
  const scoreRef    = useRef(0);
  const livesRef    = useRef(MAX_LIVES);
  const comboRef    = useRef(0);
  const maxComboRef = useRef(0);
  const idRef       = useRef(0);
  const poolRef     = useRef([]);
  const spawnTimer  = useRef(null);
  const hintTimer   = useRef(null);
  const paused      = learningWord !== null;

  const difficulty = (s) => ({
    durationMs: Math.max(4500, SPEED_BASE - Math.floor(s / 5) * 400),
    spawnMs:    Math.max(1200, SPAWN_BASE - Math.floor(s / 5) * 200),
  });

  const spawnWord = useCallback(() => {
    if (!poolRef.current.length) return;
    const word = poolRef.current.shift(); poolRef.current.push(word);
    const { durationMs } = difficulty(scoreRef.current);
    const id = ++idRef.current;
    setActiveWords(prev => [...prev, {
      id, ...word,
      x: 18 + Math.random() * 64,
      y: 16 + Math.random() * 60,
      durationMs, spawnTime: Date.now(),
    }]);
  }, []);

  const startGame = useCallback(() => {
    if (!words.length) return;
    scoreRef.current = 0; livesRef.current = MAX_LIVES; comboRef.current = 0;
    maxComboRef.current = 0; idRef.current = 0;
    poolRef.current = shuffle(words);
    setScore(0); setLives(MAX_LIVES); setCombo(0); setMaxCombo(0);
    setActiveWords([]); setInput(''); setHintIds(new Set());
    setHitIds(new Set()); setMissIds(new Set());
    setScreenFlash(null); setLearningWord(null); setComboFlash(null);
    setGameState('playing');
  }, [words]);

  // スポーンループ（一時停止中は止める）
  useEffect(() => {
    if (gameState !== 'playing' || paused) { clearTimeout(spawnTimer.current); return; }
    const schedule = () => {
      spawnWord();
      const { spawnMs } = difficulty(scoreRef.current);
      spawnTimer.current = setTimeout(schedule, spawnMs);
    };
    spawnTimer.current = setTimeout(schedule, 400);
    return () => clearTimeout(spawnTimer.current);
  }, [gameState, paused, spawnWord]);

  // ヒント判定
  useEffect(() => {
    if (gameState !== 'playing' || paused) { clearInterval(hintTimer.current); return; }
    hintTimer.current = setInterval(() => {
      const now = Date.now();
      setActiveWords(prev => {
        const newHints = new Set();
        prev.forEach(w => { if ((now - w.spawnTime) / w.durationMs >= 0.62) newHints.add(w.id); });
        setHintIds(newHints);
        return prev;
      });
    }, 150);
    return () => clearInterval(hintTimer.current);
  }, [gameState, paused]);

  useEffect(() => { if (gameState === 'playing' && !paused) inputRef.current?.focus(); }, [gameState, paused]);

  // ミス処理：アニメーション止めて単語を大きく表示
  const handleMiss = useCallback((id) => {
    setActiveWords(prev => {
      const w = prev.find(x => x.id === id);
      if (!w) return prev;
      playMissSound();
      setMissIds(m => new Set(m).add(id));
      // コンボリセット
      comboRef.current = 0;
      setCombo(0);
      // ライフ消費
      const nextLives = livesRef.current - 1;
      livesRef.current = nextLives;
      setLives(nextLives);
      setScreenFlash('miss');
      setTimeout(() => setScreenFlash(null), 500);
      // 学習表示（アニメーション一時停止）
      setLearningWord({ ja: w.ja, en: w.en });
      return prev;
    });
  }, []);

  // 学習表示を閉じる
  const dismissLearning = useCallback(() => {
    setLearningWord(null);
    // ミスした単語を除去
    setMissIds(prev => { const s = new Set(prev); return s; });
    setActiveWords(prev => prev.filter(w => !missIds.has(w.id)));
    // ゲームオーバーチェック
    if (livesRef.current <= 0) {
      setGameState('gameover');
      return;
    }
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [missIds]);

  useEffect(() => {
    if (!learningWord) return;
    const t = setTimeout(dismissLearning, 3000);
    return () => clearTimeout(t);
  }, [learningWord, dismissLearning]);

  const handleInput = useCallback((val) => {
    setInput(val);
    const trimmed = val.trim().toLowerCase();
    if (!trimmed) return;
    setActiveWords(prev => {
      const target = prev.find(w => w.en.trim().toLowerCase() === trimmed);
      if (!target) return prev;
      playGunshot();
      setHitIds(h => new Set(h).add(target.id));
      setInput('');
      setScreenFlash('hit');
      setTimeout(() => setScreenFlash(null), 150);
      // コンボ計算
      const nextCombo = comboRef.current + 1;
      comboRef.current = nextCombo;
      if (nextCombo > maxComboRef.current) { maxComboRef.current = nextCombo; setMaxCombo(nextCombo); }
      setCombo(nextCombo);
      const mult = comboMultiplier(nextCombo);
      const pts  = mult;
      scoreRef.current += pts;
      setScore(scoreRef.current);
      if (nextCombo >= 3) { playComboSound(nextCombo); setComboFlash({ combo: nextCombo, mult }); setTimeout(() => setComboFlash(null), 900); }
      setTimeout(() => setActiveWords(p => p.filter(w => w.id !== target.id)), 420);
      return prev;
    });
  }, []);

  const bgColor = screenFlash === 'hit'
    ? 'radial-gradient(ellipse at center, #0a2a0a 0%, #0f172a 60%)'
    : screenFlash === 'miss'
    ? 'radial-gradient(ellipse at center, #2a0a0a 0%, #0f172a 60%)'
    : 'radial-gradient(ellipse at center, #0d1117 0%, #0f172a 60%)';

  const btnStyle = (color) => ({
    padding:'14px 32px', borderRadius:'50px', border:'none', background:color, color:'white',
    fontWeight:'900', fontSize:'16px', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px',
    boxShadow:'0 4px 16px rgba(0,0,0,0.3)',
  });

  return (
    <div style={{ position:'fixed', inset:0, zIndex:20000, overflow:'hidden', background: bgColor, transition:'background 0.1s', fontFamily:'sans-serif' }}>
      <div style={{ position:'absolute', inset:0, background:'radial-gradient(circle at 20% 30%, rgba(79,70,229,0.08) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(124,58,237,0.06) 0%, transparent 50%)' }}/>

      {/* 閉じる */}
      <button onClick={onClose} style={{ position:'absolute', top:16, right:16, zIndex:20, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'50%', width:40, height:40, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'rgba(255,255,255,0.7)' }}>
        <X size={20}/>
      </button>

      {/* HUD */}
      <div style={{ position:'absolute', top:16, left:16, display:'flex', alignItems:'center', gap:'16px', zIndex:20, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:'3px', flexWrap:'wrap', maxWidth:'200px' }}>
          {Array.from({ length: MAX_LIVES }).map((_, i) => (
            <Heart key={i} size={16} fill={i < lives ? '#ef4444' : 'none'} color={i < lives ? '#ef4444' : '#374151'}/>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'6px', color:'#fbbf24', fontWeight:'900', fontSize:'20px' }}>
          <Star size={18} fill="#fbbf24" color="#fbbf24"/> {score}
        </div>
        {combo >= 2 && (
          <div style={{ display:'flex', alignItems:'center', gap:'4px', background:'rgba(239,68,68,0.2)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'20px', padding:'2px 10px' }}>
            <Zap size={14} color="#fbbf24" fill="#fbbf24"/>
            <span style={{ color:'#fbbf24', fontWeight:'900', fontSize:'13px' }}>
              {combo}{isEn ? ' COMBO' : '連続'} ×{comboMultiplier(combo)}
            </span>
          </div>
        )}
      </div>

      {/* コンボフラッシュ */}
      {comboFlash && (
        <div style={{ position:'absolute', top:'22%', left:'50%', transform:'translateX(-50%)', zIndex:30, textAlign:'center', pointerEvents:'none', animation:'popIn 0.4s ease-out' }}>
          <div style={{ fontSize:'36px', fontWeight:'900', color:'#fbbf24', textShadow:'0 0 30px rgba(251,191,36,0.8)', whiteSpace:'nowrap' }}>
            🔥 {comboFlash.combo}{isEn ? ' COMBO!' : '連続！'}
          </div>
          <div style={{ fontSize:'18px', fontWeight:'900', color:'#f97316', marginTop:'4px' }}>×{comboFlash.mult} {isEn ? 'POINTS' : 'ポイント'}</div>
        </div>
      )}

      {/* 照準 */}
      {gameState === 'playing' && !paused && (
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:60, height:60, pointerEvents:'none', opacity:0.25 }}>
          <div style={{ position:'absolute', top:'50%', left:0, right:0, height:1, background:'#ef4444', transform:'translateY(-50%)' }}/>
          <div style={{ position:'absolute', left:'50%', top:0, bottom:0, width:1, background:'#ef4444', transform:'translateX(-50%)' }}/>
          <div style={{ position:'absolute', inset:8, borderRadius:'50%', border:'1px solid #ef4444' }}/>
        </div>
      )}

      {/* 飛んでくる単語（一時停止中はアニメーション停止） */}
      {gameState === 'playing' && activeWords.map(w => {
        const isHit  = hitIds.has(w.id);
        const isMiss = missIds.has(w.id);
        const showHint = hintIds.has(w.id) && !isHit;
        return (
          <div
            key={w.id}
            className={`word-approach${isHit ? ' word-hit' : ''}${isMiss ? ' word-miss' : ''}`}
            style={{
              position:'absolute', left:`${w.x}%`, top:`${w.y}%`,
              animationDuration:`${w.durationMs}ms`,
              animationPlayState: paused && !isHit && !isMiss ? 'paused' : 'running',
              zIndex:5,
            }}
            onAnimationEnd={(e) => {
              if (e.animationName === 'wordApproach' && gameState === 'playing' && !paused) handleMiss(w.id);
            }}
          >
            <div style={{
              background: showHint ? 'linear-gradient(135deg,rgba(239,68,68,0.25),rgba(15,23,42,0.9))' : 'linear-gradient(135deg,rgba(79,70,229,0.25),rgba(15,23,42,0.9))',
              backdropFilter:'blur(8px)',
              border:`1.5px solid ${showHint ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.15)'}`,
              borderRadius:'16px', padding:'10px 20px', whiteSpace:'nowrap', textAlign:'center',
              boxShadow: showHint ? '0 0 20px rgba(239,68,68,0.3)' : '0 0 20px rgba(79,70,229,0.2)',
            }}>
              <div style={{ fontSize:'24px', fontWeight:'900', color:'white', lineHeight:1.2 }}>{w.ja}</div>
              {showHint && <div style={{ fontSize:'13px', fontWeight:'900', color:'#fbbf24', marginTop:'4px' }}>
                {isEn ? `Hint: ${w.en[0].toUpperCase()}…` : `ヒント: ${w.en[0].toUpperCase()}…`}
              </div>}
            </div>
          </div>
        );
      })}

      {/* ミス時の学習オーバーレイ */}
      {learningWord && (
        <div onClick={dismissLearning} style={{
          position:'absolute', inset:0, zIndex:50, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'20px',
          background:'rgba(0,0,0,0.82)', backdropFilter:'blur(6px)', cursor:'pointer',
        }}>
          <div style={{ fontSize:'14px', fontWeight:'900', color:'#ef4444', letterSpacing:'0.1em', marginBottom:'4px' }}>
            ⚠️ {isEn ? 'MISSED — REMEMBER THIS!' : 'ミス！ ここで覚えよう！'}
          </div>
          <div style={{ textAlign:'center', background:'rgba(255,255,255,0.06)', border:'2px solid rgba(255,255,255,0.15)', borderRadius:'24px', padding:'32px 56px' }}>
            <div style={{ fontSize:'52px', fontWeight:'900', color:'white', lineHeight:1.2, marginBottom:'16px' }}>
              {learningWord.ja}
            </div>
            <div style={{ fontSize:'16px', color:'#94a3b8', fontWeight:'900', marginBottom:'8px', letterSpacing:'0.08em' }}>
              {isEn ? '→ ANSWER' : '→ 答え'}
            </div>
            <div style={{ fontSize:'44px', fontWeight:'900', color:'#22c55e', letterSpacing:'0.04em' }}>
              {learningWord.en}
            </div>
          </div>
          <div style={{ fontSize:'13px', color:'rgba(255,255,255,0.4)', fontWeight:'bold' }}>
            {isEn ? '(tap anywhere to continue • auto in 3s)' : '（タップして続ける • 3秒で自動再開）'}
          </div>
        </div>
      )}

      {/* 入力欄 */}
      {gameState === 'playing' && (
        <div style={{ position:'absolute', bottom:36, left:'50%', transform:'translateX(-50%)', width:'min(460px,88vw)', zIndex:10 }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => handleInput(e.target.value)}
            placeholder={isEn ? 'Type English to shoot…' : '英単語を入力して撃て！'}
            autoComplete="off" autoCorrect="off" spellCheck="false"
            style={{
              width:'100%', boxSizing:'border-box', padding:'18px 24px', fontSize:'22px', fontWeight:'900',
              borderRadius:'50px',
              border: screenFlash === 'hit' ? '2px solid #22c55e' : screenFlash === 'miss' ? '2px solid #ef4444' : '2px solid rgba(255,255,255,0.15)',
              background:'rgba(0,0,0,0.6)', backdropFilter:'blur(20px)', color:'white',
              outline:'none', textAlign:'center', letterSpacing:'0.04em', transition:'border-color 0.1s',
              boxShadow:'0 0 40px rgba(0,0,0,0.5)',
            }}
          />
          <div style={{ textAlign:'center', marginTop:'8px', fontSize:'11px', color:'rgba(255,255,255,0.3)', fontWeight:'bold' }}>
            {combo >= 3 ? `🔥 ×${comboMultiplier(combo)} ${isEn ? 'bonus active!' : 'ボーナス中！'}` : (isEn ? '3 in a row → bonus points!' : '3連続正解でボーナス！')}
          </div>
        </div>
      )}

      {/* ===== TITLE SCREEN ===== */}
      {gameState === 'idle' && (
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'0', padding:'32px', overflow:'hidden' }}>
          {/* 背景グロー */}
          <div style={{ position:'absolute', top:'30%', left:'50%', transform:'translate(-50%,-50%)', width:'600px', height:'600px', borderRadius:'50%', background:'radial-gradient(circle, rgba(79,70,229,0.18) 0%, transparent 70%)', pointerEvents:'none' }}/>
          <div style={{ position:'absolute', top:'60%', left:'30%', width:'300px', height:'300px', borderRadius:'50%', background:'radial-gradient(circle, rgba(239,68,68,0.10) 0%, transparent 70%)', pointerEvents:'none' }}/>

          {/* WORD */}
          <div style={{
            fontSize: 'clamp(52px, 10vw, 96px)', fontWeight:'900', letterSpacing:'0.18em',
            color:'transparent', backgroundClip:'text', WebkitBackgroundClip:'text',
            backgroundImage:'linear-gradient(135deg, #e0e7ff 0%, #818cf8 50%, #4f46e5 100%)',
            lineHeight:1, margin:0, textShadow:'none', filter:'drop-shadow(0 0 30px rgba(99,102,241,0.5))',
          }}>
            WORD
          </div>

          {/* SHOOTER */}
          <div style={{
            fontSize: 'clamp(42px, 8.5vw, 80px)', fontWeight:'900', letterSpacing:'0.25em',
            color:'transparent', backgroundClip:'text', WebkitBackgroundClip:'text',
            backgroundImage:'linear-gradient(135deg, #fca5a5 0%, #ef4444 50%, #b91c1c 100%)',
            lineHeight:1, margin:'4px 0 0', filter:'drop-shadow(0 0 30px rgba(239,68,68,0.5))',
          }}>
            SHOOTER
          </div>

          {/* 区切り線 */}
          <div style={{ width:'240px', height:'2px', background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)', margin:'24px 0 20px' }}/>

          {/* サブタイトル */}
          <div style={{ fontSize:'13px', fontWeight:'900', letterSpacing:'0.3em', color:'rgba(255,255,255,0.35)', marginBottom:'32px', textTransform:'uppercase' }}>
            English Vocabulary Training
          </div>

          {/* ルール pills */}
          <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'36px', maxWidth:'340px', width:'100%' }}>
            {[
              { icon:'🔫', text: isEn ? 'Words rush at you — type English to shoot!' : '単語が迫ってくる！英語を打って撃ち落とせ！' },
              { icon:'⚡', text: isEn ? '3 in a row = COMBO ×2, ×3…'               : '3連続正解でコンボ ×2, ×3…' },
              { icon:'📖', text: isEn ? 'Miss = word pause to study'                 : 'ミスしたら単語を覚えよう！' },
              { icon:'❤️', text: isEn ? '10 lives'                                   : 'ライフ10個' },
            ].map((r, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:'12px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', padding:'10px 16px' }}>
                <span style={{ fontSize:'18px', flexShrink:0 }}>{r.icon}</span>
                <span style={{ fontSize:'13px', fontWeight:'700', color:'rgba(255,255,255,0.65)', lineHeight:1.4 }}>{r.text}</span>
              </div>
            ))}
          </div>

          {!words.length
            ? <div style={{ padding:'14px 24px', borderRadius:'14px', background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)', color:'#fca5a5', fontWeight:'bold', fontSize:'13px', textAlign:'center', maxWidth:'300px' }}>
                {isEn ? '⚠️ No words configured yet.\nAsk your teacher to set them up.' : '⚠️ 単語が未設定です。\n先生に登録してもらいましょう。'}
              </div>
            : <button
                className="action-btn"
                onClick={startGame}
                style={{
                  padding:'18px 56px', borderRadius:'50px', border:'none',
                  background:'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  color:'white', fontWeight:'900', fontSize:'18px', cursor:'pointer',
                  display:'flex', alignItems:'center', gap:'10px',
                  boxShadow:'0 0 40px rgba(79,70,229,0.5), 0 4px 20px rgba(0,0,0,0.4)',
                  letterSpacing:'0.06em',
                }}>
                <Play size={22}/> START GAME
              </button>
          }
        </div>
      )}

      {/* ゲームオーバー */}
      {gameState === 'gameover' && (
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'24px', padding:'24px' }}>
          <Trophy size={64} color="#fbbf24" style={{ filter:'drop-shadow(0 0 20px rgba(251,191,36,0.5))' }}/>
          <h1 style={{ fontSize:'clamp(28px,6vw,48px)', fontWeight:'900', margin:0, letterSpacing:'0.1em', color:'transparent', backgroundClip:'text', WebkitBackgroundClip:'text', backgroundImage:'linear-gradient(135deg,#fca5a5,#ef4444)', filter:'drop-shadow(0 0 20px rgba(239,68,68,0.5))' }}>
            GAME OVER
          </h1>
          <div style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'24px', padding:'24px 48px', textAlign:'center', display:'flex', gap:'40px' }}>
            <div>
              <div style={{ fontSize:'11px', color:'#6366f1', fontWeight:'900', marginBottom:'6px', letterSpacing:'0.1em' }}>SCORE</div>
              <div style={{ fontSize:'52px', fontWeight:'900', color:'#fbbf24', lineHeight:1 }}>{score}</div>
            </div>
            <div>
              <div style={{ fontSize:'11px', color:'#ef4444', fontWeight:'900', marginBottom:'6px', letterSpacing:'0.1em' }}>MAX COMBO</div>
              <div style={{ fontSize:'52px', fontWeight:'900', color:'#f97316', lineHeight:1 }}>{maxCombo}🔥</div>
            </div>
          </div>
          <button className="action-btn" onClick={startGame} style={btnStyle('linear-gradient(135deg,#4f46e5,#7c3aed)')}>
            <RefreshCw size={20}/> {isEn ? 'Play Again' : 'もう一度'}
          </button>
        </div>
      )}
    </div>
  );
}
