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
    <div style={{ width: '100%', marginBottom: '25px', fontFamily: 'sans-serif' }}>
      <div style={{ 
        width: '100%', 
        backgroundColor: '#ffffff', 
        borderRadius: '24px', 
        boxShadow: '0 10px 40px rgba(0,0,0,0.06)', 
        overflow: 'hidden'
      }}>
        {/* 上部：ヒーローセクション（写真と英文） */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'row', 
          flexWrap: 'wrap',
          backgroundColor: '#1e3a8a', 
          color: 'white'
        }}>
          {/* 左側：大きくカッコいい写真（★ここを角枠・大サイズに変更しました！） */}
          <div style={{ 
            flex: '1 1 300px', 
            padding: '40px', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            background: 'linear-gradient(135deg, #1e3a8a 0%, #172554 100%)'
          }}>
            <img 
              src={currentQuote.image} 
              alt={currentQuote.author} 
              style={{ 
                width: '260px',       // 以前より大きく（220px → 260px）
                height: '260px',      // 以前より大きく
                borderRadius: '20px', // 丸（50%）から、モダンな角丸スクエアに変更
                objectFit: 'cover', 
                border: '8px solid rgba(255,255,255,0.1)',
                boxShadow: '0 15px 35px rgba(0,0,0,0.3)'
              }} 
            />
          </div>

          {/* 右側：名言テキスト */}
          <div style={{ 
            flex: '2 1 400px', 
            padding: '40px', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center' 
          }}>
            <h2 style={{ 
              fontSize: '2.4rem', 
              fontStyle: 'italic', 
              margin: '0 0 20px 0', 
              lineHeight: '1.2',
              fontWeight: '900',
              textShadow: '2px 2px 4px rgba(0,0,0,0.2)'
            }}>
              "{currentQuote.english}"
            </h2>
            <p style={{ fontSize: '1.2rem', color: '#93c5fd', margin: 0, fontWeight: 'bold' }}>
              — {currentQuote.author}
            </p>
          </div>
        </div>

        {/* 下部：詳細解説エリア */}
        <div style={{ padding: '35px' }}>
          <div style={{ marginBottom: '25px' }}>
            <p style={{ fontSize: '1.4rem', fontWeight: '900', color: '#1e293b', marginBottom: '10px' }}>
              {currentQuote.japanese}
            </p>
            <p style={{ fontSize: '1.1rem', color: '#64748b', fontWeight: 'bold', lineHeight: '1.6' }}>
              💡 {currentQuote.info}
            </p>
          </div>
          
          <div style={{ 
            backgroundColor: '#f8fafc', 
            padding: '25px', 
            borderRadius: '16px', 
            borderLeft: '8px solid #4f46e5',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
          }}>
            <h3 style={{ fontSize: '1.1rem', color: '#4f46e5', margin: '0 0 12px 0', fontWeight: '900' }}>【文法解説】</h3>
            <p style={{ 
              fontSize: '1.1rem', 
              color: '#334155', 
              lineHeight: '1.8', 
              margin: 0, 
              whiteSpace: 'pre-wrap',
              fontWeight: '500'
            }}>
              {currentQuote.grammar}
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '35px' }}>
            <button 
              onClick={drawRandomQuote} 
              style={{ 
                padding: '18px 45px', 
                fontSize: '1.2rem', 
                fontWeight: '900', 
                color: 'white', 
                backgroundColor: '#4f46e5', 
                border: 'none', 
                borderRadius: '50px', 
                cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(79, 70, 229, 0.3)'
              }}
            >
              ✨ 次の名言
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}