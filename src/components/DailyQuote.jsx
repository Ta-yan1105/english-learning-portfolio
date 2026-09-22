import React, { useState, useEffect } from 'react';
import { quotesData } from '../quotes_data';
import { Volume2, ChevronDown, ChevronUp } from 'lucide-react';

/* 直前と同じものを避けてランダムに1件選ぶ */
const pickRandomQuote = (exclude) => {
  if (quotesData.length === 0) return null;
  if (quotesData.length === 1) return quotesData[0];
  let next;
  do {
    next = quotesData[Math.floor(Math.random() * quotesData.length)];
  } while (next === exclude);
  return next;
};

export default function DailyQuote() {
  // 初期表示もランダムにする（関数を渡すと初回マウント時に1度だけ実行される）
  const [currentQuote, setCurrentQuote] = useState(() => pickRandomQuote());

  // 画像の読み込みエラーを検知するState
  const [imageError, setImageError] = useState(false);

  // 解説エリアの開閉状態を管理するState
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  // 名言が切り替わった時に画像エラー状態をリセットする
  useEffect(() => {
    setImageError(false);
  }, [currentQuote]);

  const drawRandomQuote = () => {
    setCurrentQuote(prev => pickRandomQuote(prev));
    setShowExplanation(false); // 次の名言に切り替わったら解説を閉じる
  };

  const playAudio = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(currentQuote.english);
      utterance.lang = 'en-US';
      utterance.rate = 0.85;

      const voices = window.speechSynthesis.getVoices();
      const naturalVoice = voices.find(v =>
        (v.lang === 'en-US' || v.lang === 'en-GB') &&
        (v.name.includes('Natural') || v.name.includes('Google US English') || v.name.includes('Samantha') || v.name.includes('Premium'))
      );
      if (naturalVoice) {
        utterance.voice = naturalVoice;
      }

      window.speechSynthesis.speak(utterance);
    } else {
      alert('お使いのブラウザは音声読み上げに対応していません。');
    }
  };

  if (!currentQuote) return null;

  // 写真データの厳密な有効性チェック
  const imageUrl = currentQuote.image;
  const isDummyAvatar = typeof imageUrl === 'string' && (imageUrl.includes('ui-avatars.com') || imageUrl.includes('placeholder'));
  const isValidUrlFormat =
    typeof imageUrl === 'string' &&
    imageUrl.trim().length > 4 &&
    (imageUrl.startsWith('http') || imageUrl.startsWith('/') || imageUrl.startsWith('.') || imageUrl.startsWith('data:')) &&
    !isDummyAvatar;

  const showImage = isValidUrlFormat && !imageError;

  /* 英文の長さで字の大きさを変え、どの名言も1〜2行に収める
     （収録365件：中央値53字、95%が89字以内、最長106字） */
  const len = currentQuote.english.length;
  const quoteFontSize =
      len <= 40 ? 'clamp(1.6rem, 6vw, 2.4rem)'
    : len <= 60 ? 'clamp(1.35rem, 4.8vw, 1.85rem)'
    : len <= 90 ? 'clamp(1.15rem, 3.9vw, 1.5rem)'
    :             'clamp(1.05rem, 3.4vw, 1.3rem)';

  // 全ボタン共通のベーススタイル
  const baseButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 18px',
    borderRadius: '50px',
    border: 'none',
    backgroundColor: '#e0e7ff',
    color: '#4f46e5',
    fontSize: '0.95rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  };

  const buttonHoverStyle = {
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
  };

  return (
    <div style={{ width: '100%', marginBottom: '25px', fontFamily: 'sans-serif', boxSizing: 'border-box' }}>

      <div style={{
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: 'clamp(16px, 4vw, 24px)',
        boxShadow: '0 22px 50px rgba(30, 27, 75, 0.20), 0 8px 16px rgba(30, 27, 75, 0.10), 0 0 0 1px rgba(79, 70, 229, 0.07)',
        overflow: 'hidden'
      }}>
        {/* 上部：ヒーローセクション（英文） */}
        <div style={{
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 55%, #3730a3 100%)',
          color: 'white',
          zIndex: 1,
          boxShadow: '0 10px 24px rgba(30, 27, 75, 0.28)'
        }}>
          {/* 方眼と光：奥行きを出すための下地 */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px),
              radial-gradient(ellipse at 14% -25%, rgba(165,180,252,0.42) 0%, transparent 60%)
            `,
            backgroundSize: '26px 26px, 26px 26px, 100% 100%',
          }}/>

          {/* 引用符のウォーターマーク */}
          <span style={{
            position: 'absolute', top: 'clamp(-34px, -5vw, -20px)', right: 'clamp(8px, 3vw, 28px)',
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 'clamp(140px, 24vw, 240px)', lineHeight: 1, fontWeight: 700,
            color: 'rgba(255,255,255,0.085)', pointerEvents: 'none', userSelect: 'none',
          }}>”</span>

          <div
            key={currentQuote.english}
            style={{
              position: 'relative', zIndex: 1,
              padding: 'clamp(22px, 5vw, 40px)',
              boxSizing: 'border-box',
              textAlign: 'center',
              animation: 'quoteIn 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>

            {/* HUD見出し */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', marginBottom: 'clamp(14px, 2.6vw, 20px)' }}>
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%', background: '#a5b4fc',
                boxShadow: '0 0 8px #a5b4fc', animation: 'hudPulse 1.8s ease-in-out infinite',
              }}/>
              <span style={{ fontSize: '10px', fontWeight: '900', letterSpacing: '0.22em', color: 'rgba(199,210,254,0.9)' }}>
                QUOTE
              </span>
            </div>

            {/* 発言者：写真を主役に、名前と紹介を横に添える */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
              gap: 'clamp(12px, 2.6vw, 18px)',
              marginBottom: 'clamp(20px, 4vw, 30px)',
            }}>
              {showImage && (
                <img
                  src={imageUrl}
                  alt={currentQuote.author}
                  onError={() => setImageError(true)}
                  style={{
                    /* 元画像は幅250pxの縦長サムネイル。同じ縦横比の枠にしてトリミングを最小にする */
                    width: 'clamp(140px, 34vw, 210px)',
                    aspectRatio: '4 / 5',
                    borderRadius: 'clamp(12px, 2.5vw, 18px)',
                    objectFit: 'cover',
                    objectPosition: 'top center',
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    flexShrink: 0,
                    boxShadow: '0 0 0 3px rgba(255,255,255,0.4), 0 0 0 10px rgba(255,255,255,0.12), 0 22px 46px rgba(15,12,60,0.55)',
                  }}
                />
              )}

              <div style={{ width: '100%', minWidth: 0 }}>
                {/* 名前の上の細いアクセント */}
                <div style={{
                  width: '30px', height: '2px', borderRadius: '2px', margin: '0 auto 10px',
                  background: 'linear-gradient(90deg, rgba(252,211,77,0.15), #fcd34d, rgba(252,211,77,0.15))',
                }}/>
                <div style={{
                  fontSize: 'clamp(1.15rem, 3.6vw, 1.5rem)', fontWeight: '900', color: '#ffffff',
                  lineHeight: 1.25, letterSpacing: '-0.01em', wordBreak: 'break-word',
                  textShadow: '0 2px 10px rgba(15,12,60,0.4)',
                }}>
                  {currentQuote.author}
                </div>
                {currentQuote.info && (
                  <p style={{
                    margin: 'clamp(8px, 1.8vw, 11px) 0 0 0',
                    fontSize: 'clamp(0.78rem, 2.3vw, 0.88rem)',
                    fontWeight: '700',
                    lineHeight: 1.7,
                    color: 'rgba(199,210,254,0.85)',
                    wordBreak: 'break-word',
                  }}>
                    {currentQuote.info}
                  </p>
                )}
              </div>
            </div>

            {/* 英文：横幅をすべて使い、長さに応じて字を詰めて1〜2行に収める */}
            <h2 style={{
              fontSize: quoteFontSize,
              fontStyle: 'italic',
              margin: '0 0 clamp(12px, 2.4vw, 18px) 0',
              lineHeight: 1.3,
              letterSpacing: '-0.015em',
              fontWeight: '800',
              textShadow: '0 2px 12px rgba(15,12,60,0.45)',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
            }}>
              {currentQuote.english}
            </h2>

            <div style={{
              width: '46px', height: '2px', borderRadius: '2px', margin: '0 auto clamp(12px, 2.4vw, 16px)',
              background: 'linear-gradient(90deg, rgba(255,255,255,0.1), rgba(255,255,255,0.85), rgba(255,255,255,0.1))',
            }}/>

            <p style={{
              fontSize: 'clamp(0.98rem, 3.2vw, 1.2rem)',
              fontWeight: '700',
              color: 'rgba(237,240,255,0.95)',
              margin: 0,
              lineHeight: 1.75,
              wordBreak: 'keep-all',
              overflowWrap: 'break-word',
            }}>
              {currentQuote.japanese}
            </p>
          </div>
        </div>

        {/* 下部：詳細解説とコントロールエリア */}
        <div style={{ padding: 'clamp(20px, 5vw, 35px)' }}>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>

            <button
              onClick={() => setShowExplanation(!showExplanation)}
              style={{
                ...baseButtonStyle,
                backgroundColor: showExplanation ? '#fffbeb' : '#fef3c7',
                color: showExplanation ? '#f59e0b' : '#d97706',
                boxShadow: showExplanation ? 'none' : '0 2px 4px rgba(0,0,0,0.05)'
              }}
              onMouseOver={(e) => {
                if (!showExplanation) Object.assign(e.currentTarget.style, buttonHoverStyle);
              }}
              onMouseOut={(e) => {
                if (!showExplanation) Object.assign(e.currentTarget.style, {
                  transform: 'translateY(0)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                });
              }}
            >
              {showExplanation ? <><ChevronUp size={18} /> 解説を閉じる</> : <><ChevronDown size={18} /> 名言解説</>}
            </button>

            <button
              onClick={playAudio}
              style={baseButtonStyle}
              onMouseOver={(e) => { Object.assign(e.currentTarget.style, buttonHoverStyle); }}
              onMouseOut={(e) => { Object.assign(e.currentTarget.style, baseButtonStyle, { transform: 'translateY(0)' }); }}
            >
              <Volume2 size={18} /> お手本を聞く
            </button>

            {/* 「次の名言」ボタン */}
            <button
              onClick={drawRandomQuote}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '10px 18px', borderRadius: '50px',
                border: 'none', backgroundColor: '#4f46e5',
                color: 'white', fontSize: '0.95rem', fontWeight: 'bold',
                cursor: 'pointer', transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)',
                marginLeft: 'auto'
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.backgroundColor = '#4338ca'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(79, 70, 229, 0.3)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.backgroundColor = '#4f46e5'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(79, 70, 229, 0.2)'; }}
            >
              ✨ 次の名言
            </button>
          </div>

          {/* 文法解説エリア */}
          {showExplanation && (
            <div style={{
              backgroundColor: '#f8fafc',
              padding: 'clamp(15px, 4vw, 25px)',
              borderRadius: '16px',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
              animation: 'popIn 0.3s ease-out'
            }}>
              <h3 style={{ fontSize: 'clamp(1rem, 3vw, 1.1rem)', color: '#4f46e5', margin: '0 0 12px 0', fontWeight: '900' }}>【文法解説】</h3>
              <p style={{
                fontSize: 'clamp(0.95rem, 3vw, 1.1rem)',
                color: '#1e293b',
                lineHeight: '2',
                letterSpacing: '0.03em',
                margin: 0,
                whiteSpace: 'pre-wrap',
                fontWeight: '600',
                fontFamily: "'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif"
              }}>
                {currentQuote.grammar}
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
