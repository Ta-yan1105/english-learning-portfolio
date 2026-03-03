import React, { useState, useEffect, useRef } from 'react';
import { quotesData } from './quotes_data';
import { Volume2, Mic, Play, Square } from 'lucide-react';

export default function DailyQuote() {
  const [currentQuote, setCurrentQuote] = useState(quotesData[0]);
  
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [audioUrl, setAudioUrl] = useState(null); // 録音した音声のURLを保存

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);

  // ブラウザの音声をあらかじめロードしておく（初回再生時の遅延や声質のバラつきを防ぐため）
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  const drawRandomQuote = () => {
    const randomIndex = Math.floor(Math.random() * quotesData.length);
    setCurrentQuote(quotesData[randomIndex]);
    setRecognizedText(''); 
    setAudioUrl(null); // 新しい名言になったら録音データをリセット
  };

  const playAudio = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); 
      const utterance = new SpeechSynthesisUtterance(currentQuote.english);
      utterance.lang = 'en-US'; 
      utterance.rate = 0.85; // 少しゆっくりにして聞き取りやすく

      // より人間に近い自然な音声（Natural, Premium, Google等）を探して適用する
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

    // --- 1. マイク録音の準備（自分の声を聞くため） ---
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
        stream.getTracks().forEach(track => track.stop()); // マイクのアクセスを解除
      };

      mediaRecorder.start();
    } catch (error) {
      console.error("Microphone access error:", error);
      alert("マイクへのアクセスが許可されていないため、録音できません。");
      return;
    }

    // --- 2. 音声認識の準備（発音を文字にするため） ---
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
        stopListening(); // 音声認識が終わったら録音も止める
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

  return (
    <div style={{ width: '100%', marginBottom: '25px', fontFamily: 'sans-serif', boxSizing: 'border-box' }}>
      <div style={{ 
        width: '100%', 
        backgroundColor: '#ffffff', 
        borderRadius: 'clamp(16px, 4vw, 24px)', 
        boxShadow: '0 10px 40px rgba(0,0,0,0.06)', 
        overflow: 'hidden'
      }}>
        {/* 上部：ヒーローセクション（写真と英文） */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'row', 
          flexWrap: 'wrap', 
          background: 'linear-gradient(135deg, #172554 0%, #0f172a 100%)', 
          color: 'white'
        }}>
          {/* 左側：写真 */}
          <div style={{ 
            flex: '1 1 250px', 
            padding: 'clamp(20px, 5vw, 40px)', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            background: 'transparent'
          }}>
            <img 
              src={currentQuote.image} 
              alt={currentQuote.author} 
              style={{ 
                width: '100%',          
                maxWidth: '260px',      
                aspectRatio: '1 / 1',   
                borderRadius: '20px', 
                objectFit: 'cover', 
                border: 'clamp(4px, 2vw, 8px) solid rgba(255,255,255,0.1)', 
                boxShadow: '0 15px 35px rgba(0,0,0,0.4)' 
              }} 
            />
          </div>

          {/* 右側：名言テキスト */}
          <div style={{ 
            flex: '2 1 300px', 
            padding: 'clamp(20px, 5vw, 40px)', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center' 
          }}>
            <h2 style={{ 
              fontSize: 'clamp(1.5rem, 5vw, 2.4rem)', 
              fontStyle: 'italic', 
              margin: '0 0 12px 0', 
              lineHeight: '1.3',
              fontWeight: '900',
              textShadow: '0 2px 8px rgba(0,0,0,0.5)'
            }}>
              "{currentQuote.english}"
            </h2>

            <p style={{ 
              fontSize: 'clamp(1.1rem, 4vw, 1.4rem)', 
              fontWeight: '900', 
              color: '#f8fafc', 
              margin: '0 0 20px 0', 
              lineHeight: '1.4',
              textShadow: '0 1px 4px rgba(0,0,0,0.4)'
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
              textShadow: '0 1px 2px rgba(0,0,0,0.3)'
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
          
          {/* ▼▼▼ 追加：文法解説の上の音声コントロールボタン群 ▼▼▼ */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={playAudio}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '10px 18px', borderRadius: '50px',
                border: 'none', backgroundColor: '#e0e7ff',
                color: '#4f46e5', fontSize: '0.95rem', fontWeight: 'bold',
                cursor: 'pointer', transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)'; }}
            >
              <Volume2 size={18} /> お手本を聞く
            </button>
            
            <button
              onClick={isListening ? stopListening : startListening}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '10px 18px', borderRadius: '50px',
                border: 'none', 
                backgroundColor: isListening ? '#ffe4e6' : '#f1f5f9',
                color: isListening ? '#e11d48' : '#64748b', 
                fontSize: '0.95rem', fontWeight: 'bold',
                cursor: 'pointer', transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
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
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '10px 18px', borderRadius: '50px',
                  border: 'none', backgroundColor: '#d1fae5',
                  color: '#059669', fontSize: '0.95rem', fontWeight: 'bold',
                  cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  animation: 'popIn 0.3s ease-out'
                }}
                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <Play size={18} fill="currentColor" /> 音読した音声を聞く
              </button>
            )}
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
          {/* ▲▲▲ ここまで追加 ▲▲▲ */}


          <div style={{ 
            backgroundColor: '#f8fafc', 
            padding: 'clamp(15px, 4vw, 25px)', 
            borderRadius: '16px', 
            borderLeft: 'clamp(4px, 2vw, 8px) solid #4f46e5',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
          }}>
            <h3 style={{ fontSize: 'clamp(1rem, 3vw, 1.1rem)', color: '#4f46e5', margin: '0 0 12px 0', fontWeight: '900' }}>【文法解説】</h3>
            {/* ▼▼▼ 変更：フォントの視認性を向上（色、行間、文字間隔、太さ） ▼▼▼ */}
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

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'clamp(25px, 6vw, 35px)' }}>
            <button 
              onClick={drawRandomQuote} 
              style={{ 
                padding: 'clamp(12px, 3vw, 18px) clamp(24px, 6vw, 45px)', 
                fontSize: 'clamp(1rem, 3vw, 1.2rem)', 
                fontWeight: '900', 
                color: 'white', 
                backgroundColor: '#4f46e5', 
                border: 'none', 
                borderRadius: '50px', 
                cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(79, 70, 229, 0.3)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              ✨ 次の名言
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}