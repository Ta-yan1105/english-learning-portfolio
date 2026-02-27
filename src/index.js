import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// HTMLにある "root" というIDの要素にReactアプリを描画します
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
