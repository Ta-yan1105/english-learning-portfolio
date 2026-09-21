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
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 55%, #3730a3 100%)',
          color: 'white',
          zIndex: 1,
          boxShadow: '0 10px 24px rgba(30, 27, 75, 0.28)'
        }}>

          {showImage && (
            <div style={{
              position: 'relative',
              zIndex: 1,
              flex: '1 1 250px',
              padding: 'clamp(20px, 5vw, 40px)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              background: 'transparent',
              boxSizing: 'border-box'
            }}>
              <img
                src={imageUrl}
                alt={currentQuote.author}
                onError={() => setImageError(true)}
                style={{
                  width: '100%',
                  maxWidth: '240px',
                  aspectRatio: '1 / 1',
                  borderRadius: '20px',
                  objectFit: 'contain',
                  backgroundColor: 'white',
                  border: 'clamp(4px, 2vw, 8px) solid rgba(255,255,255,0.1)',
                  boxShadow: '0 15px 35px rgba(0,0,0,0.4)'
                }}
              />
            </div>
          )}

          {/* 右側：名言テキスト */}
          <div style={{
            position: 'relative',
            zIndex: 1,
            flex: showImage ? '2 1 300px' : '1 1 100%',
            padding: 'clamp(20px, 5vw, 40px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            background: 'radial-gradient(ellipse at center, rgba(30, 27, 75, 0.85) 0%, rgba(30, 27, 75, 0.55) 60%, transparent 100%)',
            boxSizing: 'border-box',
            width: '100%'
          }}>
            <h2 style={{
              fontSize: 'clamp(1.5rem, 5vw, 2.4rem)',
              fontStyle: 'italic',
              margin: '0 0 12px 0',
              lineHeight: '1.3',
              fontWeight: '900',
              textShadow: '0 2px 4px rgba(0,0,0,0.55), 0 8px 20px rgba(0,0,0,0.45)',
              wordBreak: 'break-word',
              overflowWrap: 'break-word'
            }}>
              "{currentQuote.english}"
            </h2>

            <p style={{
              fontSize: 'clamp(1.1rem, 4vw, 1.4rem)',
              fontWeight: '900',
              color: '#f8fafc',
              margin: '0 0 20px 0',
              lineHeight: '1.4',
              textShadow: '0 1px 5px rgba(0,0,0,0.8)',
              wordBreak: 'keep-all',
              overflowWrap: 'break-word'
            }}>
              {currentQuote.japanese}
            </p>

            <p style={{
              fontSize: 'clamp(1rem, 3vw, 1.2rem)',
              color: '#bae6fd',
              margin: 0,
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'baseline',
              flexWrap: 'wrap',
              gap: '8px',
              textShadow: '0 1px 3px rgba(0,0,0,0.6)',
              wordBreak: 'break-word',
              overflowWrap: 'break-word'
            }}>
              <span>— {currentQuote.author}</span>
              <span style={{ fontSize: '0.85em', fontWeight: 'bold', color: '#fef08a' }}>
                💡 {currentQuote.info}
              </span>
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
