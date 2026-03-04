import React, { useState, useEffect, useRef } from 'react';
import { quotesData } from './quotes_data';
import { Volume2, Mic, Play, Square, ChevronDown, ChevronUp } from 'lucide-react';

export default function DailyQuote() {
  const [currentQuote, setCurrentQuote] = useState(quotesData[0]);
  
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [audioUrl, setAudioUrl] = useState(null);

  // 画像の読み込みエラーを検知するState
  const [imageError, setImageError] = useState(false);

  // 解説エリアの開閉状態を管理するState
  const [showExplanation, setShowExplanation] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);

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
    const randomIndex = Math.floor(Math.random() * quotesData.length);
    setCurrentQuote(quotesData[randomIndex]);
    setRecognizedText(''); 
    setAudioUrl(null); 
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

  const startListening = async () => {
    setRecognizedText('');
    setAudioUrl(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        stream.getTracks().forEach(track => track.stop()); 
      };

      mediaRecorder.start();
    } catch (error) {
      console.error("Microphone access error:", error);
      alert("マイクへのアクセスが許可されていないため、録音できません。");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = 'en-US'; 
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        setRecognizedText('🎤 録音中... 英文を読んでください');
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setRecognizedText(`🗣️ 認識結果: "${transcript}"`);
      };

      recognition.onerror = (event) => {
        if (event.error !== 'aborted') {
          setRecognizedText('⚠️ うまく聞き取れませんでした。');
        }
      };

      recognition.onend = () => {
        stopListening(); 
      };

      recognition.start();
    } else {
      setIsListening(true);
      setRecognizedText('🎤 録音中... (このブラウザは発音のテキスト化には非対応ですが、録音は可能です)');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
  };

  const playRecordedAudio = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play();
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
      
      {/* 桜のアニメーション用のスタイル定義 */}
      <style>{`
        @keyframes sakuraFall {
          0% { top: -10%; transform: rotate(0deg); opacity: 0; }
          10% { opacity: 0.8; }
          90% { opacity: 0.8; }
          100% { top: 110%; transform: rotate(720deg); opacity: 0; }
        }
        @keyframes sakuraSway {
          0% { margin-left: -20px; }
          100% { margin-left: 20px; }
        }
      `}</style>

      <div style={{ 
        width: '100%', 
        backgroundColor: '#ffffff', 
        borderRadius: 'clamp(16px, 4vw, 24px)', 
        boxShadow: '0 10px 40px rgba(0,0,0,0.06)', 
        overflow: 'hidden'
      }}>
        {/* 上部：ヒーローセクション（写真と英文） */}
        <div style={{ 
          position: 'relative', 
          overflow: 'hidden', 
          display: 'flex', 
          flexDirection: 'row', 
          flexWrap: 'wrap', 
          background: `url('https://images.unsplash.com/photo-1522383225653-ed111181a951?auto=format&fit=crop&w=1200&q=80') center/cover no-repeat`,
          color: 'white'
        }}>
          
          {/* 桜のパーティクル（pointer-events: noneで干渉しない） */}
          {[...Array(25)].map((_, i) => {
            const size = 6 + Math.random() * 8; // 6px ~ 14px
            const left = Math.random() * 100; // 0% ~ 100%
            const fallDuration = 6 + Math.random() * 6; // 6s ~ 12s
            const swayDuration = 2 + Math.random() * 3; // 2s ~ 5s
            const delay = Math.random() * -15; // 初期状態から降らせるためのマイナス遅延

            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `${left}%`,
                  width: `${size}px`,
                  height: `${size}px`,
                  backgroundColor: 'rgba(253, 164, 175, 0.8)', // 桜の薄いピンク
                  borderRadius: '100% 0% 100% 0%', // 桜の花びら風の形
                  pointerEvents: 'none',
                  animation: `sakuraFall ${fallDuration}s linear ${delay}s infinite, sakuraSway ${swayDuration}s ease-in-out ${delay}s infinite alternate`,
                  zIndex: 0
                }}
              />
            );
          })}

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
              boxSizing: 'border-box' // SP時のレイアウト崩れ防止
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
            background: 'radial-gradient(ellipse at center, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.6) 60%, transparent 100%)',
            boxSizing: 'border-box', // SP時のレイアウト崩れ防止
            width: '100%' // SP時のレイアウト崩れ防止
          }}>
            <h2 style={{ 
              fontSize: 'clamp(1.5rem, 5vw, 2.4rem)', 
              fontStyle: 'italic', 
              margin: '0 0 12px 0', 
              lineHeight: '1.3',
              fontWeight: '900',
              textShadow: '0 2px 8px rgba(0,0,0,0.8)',
              wordBreak: 'break-word', // SP時の英語の単語折り返し
              overflowWrap: 'break-word' // SP時のはみ出し防止
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
              wordBreak: 'keep-all', // SP時の日本語の不自然な改行を防ぐ
              overflowWrap: 'break-word' // SP時のはみ出し防止
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
              wordBreak: 'break-word', // SP時のはみ出し防止
              overflowWrap: 'break-word' // SP時のはみ出し防止
            }}>
              <span>— {currentQuote.author}</span>
              <span style={{ fontSize: '0.85em', fontWeight: 'bold', color: '#fef08a' }}> 
                💡 {currentQuote.info}
              </span>
            </p>
          </div>
        </div>

        {/* 下部：詳細解説と音声コントロールエリア */}
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
            
            <button
              onClick={isListening ? stopListening : startListening}
              style={isListening ? {
                ...baseButtonStyle,
                backgroundColor: '#ffe4e6',
                color: '#e11d48',
              } : {
                ...baseButtonStyle,
                backgroundColor: '#f1f5f9',
                color: '#64748b',
              }}
              onMouseOver={(e) => { if (!isListening) Object.assign(e.currentTarget.style, buttonHoverStyle); }}
              onMouseOut={(e) => { 
                if (!isListening) Object.assign(e.currentTarget.style, { 
                  transform: 'translateY(0)', 
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  backgroundColor: '#f1f5f9',
                  color: '#64748b'
                }); 
              }}
            >
              {isListening ? (
                <><Square size={16} fill="currentColor" /> 録音停止</>
              ) : (
                <><Mic size={18} /> 音読に挑戦</>
              )}
            </button>

            {audioUrl && !isListening && (
              <button
                onClick={playRecordedAudio}
                style={{
                  ...baseButtonStyle,
                  backgroundColor: '#d1fae5',
                  color: '#059669',
                  animation: 'popIn 0.3s ease-out'
                }}
                onMouseOver={(e) => { Object.assign(e.currentTarget.style, buttonHoverStyle); }}
                onMouseOut={(e) => { 
                  Object.assign(e.currentTarget.style, { 
                    transform: 'translateY(0)', 
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    backgroundColor: '#d1fae5',
                    color: '#059669'
                  }); 
                }}
              >
                <Play size={18} fill="currentColor" /> 音読した音声を聞く
              </button>
            )}

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

          {/* 音声認識の結果表示エリア */}
          {recognizedText && (
            <div style={{
              fontSize: '0.95rem', color: '#334155',
              marginBottom: '20px', padding: '12px 16px',
              backgroundColor: '#f8fafc', borderRadius: '12px',
              borderLeft: '4px solid #94a3b8', fontWeight: 'bold',
              lineHeight: '1.4'
            }}>
              {recognizedText}
            </div>
          )}

          {/* 文法解説エリア */}
          {showExplanation && (
            <div style={{ 
              backgroundColor: '#f8fafc', 
              padding: 'clamp(15px, 4vw, 25px)', 
              borderRadius: '16px', 
              borderLeft: 'clamp(4px, 2vw, 8px) solid #4f46e5',
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