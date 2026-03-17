// Blobverse Client — Entry Point with React UI
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

console.log('🟢 Blobverse client starting...');

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(React.createElement(App));

console.log('✨ Blobverse UI initialized');
