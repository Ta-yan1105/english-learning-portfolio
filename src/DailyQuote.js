import React, { useState } from 'react';
import { quotesData } from './quotes_data';

export default function DailyQuote() {
  const [currentQuote, setCurrentQuote] = useState(quotesData[0]);

  const drawRandomQuote = () => {
    const randomIndex = Math.floor(Math.random() * quotesData.length);
    setCurrentQuote(quotesData[randomIndex]);
  };

  if (!currentQuote) return null;

  return (
    // 外枠の余白も画面サイズに合わせて可変（clamp）に
    <div style={{ width: '100%', marginBottom: '25px', fontFamily: 'sans-serif', boxSizing: 'border-box' }}>
      <div style={{ 
        width: '100%', 
        backgroundColor: '#ffffff', 
        borderRadius: 'clamp(16px, 4vw, 24px)', // スマホでは少し丸みを小さく
        boxShadow: '0 10px 40px rgba(0,0,0,0.06)', 
        overflow: 'hidden'
      }}>
        {/* 上部：ヒーローセクション（写真と英文） */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'row', 
          flexWrap: 'wrap', // ★画面が狭いと自動で縦並びになる魔法のプロパティ
          backgroundColor: '#1e3a8a', 
          color: 'white'
        }}>
          {/* 左側：大きくカッコいい写真（レスポンシブ対応版） */}
          <div style={{ 
            flex: '1 1 250px', // 基準サイズを少し下げてスマホで折り返しやすく
            padding: 'clamp(20px, 5vw, 40px)', // 余白も画面に合わせて自動伸縮
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            background: 'linear-gradient(135deg, #1e3a8a 0%, #172554 100%)'
          }}>
            <img 
              src={currentQuote.image} 
              alt={currentQuote.author} 
              style={{ 
                width: '100%',          // 親要素に対して100%広がる
                maxWidth: '260px',      // ただし最大260pxでストップ
                aspectRatio: '1 / 1',   // 常に綺麗な正方形を保つ
                borderRadius: '20px', 
                objectFit: 'cover', 
                border: 'clamp(4px, 2vw, 8px) solid rgba(255,255,255,0.1)', // 枠線の太さも可変
                boxShadow: '0 15px 35px rgba(0,0,0,0.3)'
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
              fontSize: 'clamp(1.5rem, 5vw, 2.4rem)', // ★スマホでは小さく、PCでは大きく自動調整！
              fontStyle: 'italic', 
              margin: '0 0 20px 0', 
              lineHeight: '1.3',
              fontWeight: '900',
              textShadow: '2px 2px 4px rgba(0,0,0,0.2)'
            }}>
              "{currentQuote.english}"
            </h2>
            <p style={{ fontSize: 'clamp(1rem, 3vw, 1.2rem)', color: '#93c5fd', margin: 0, fontWeight: 'bold' }}>
              — {currentQuote.author}
            </p>
          </div>
        </div>

        {/* 下部：詳細解説エリア */}
        <div style={{ padding: 'clamp(20px, 5vw, 35px)' }}>
          <div style={{ marginBottom: '25px' }}>
            <p style={{ fontSize: 'clamp(1.1rem, 4vw, 1.4rem)', fontWeight: '900', color: '#1e293b', marginBottom: '10px' }}>
              {currentQuote.japanese}
            </p>
            <p style={{ fontSize: 'clamp(0.9rem, 3vw, 1.1rem)', color: '#64748b', fontWeight: 'bold', lineHeight: '1.6' }}>
              💡 {currentQuote.info}
            </p>
          </div>
          
          <div style={{ 
            backgroundColor: '#f8fafc', 
            padding: 'clamp(15px, 4vw, 25px)', 
            borderRadius: '16px', 
            borderLeft: 'clamp(4px, 2vw, 8px) solid #4f46e5',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
          }}>
            <h3 style={{ fontSize: 'clamp(1rem, 3vw, 1.1rem)', color: '#4f46e5', margin: '0 0 12px 0', fontWeight: '900' }}>【文法解説】</h3>
            <p style={{ 
              fontSize: 'clamp(0.95rem, 3vw, 1.1rem)', 
              color: '#334155', 
              lineHeight: '1.8', 
              margin: 0, 
              whiteSpace: 'pre-wrap',
              fontWeight: '500'
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