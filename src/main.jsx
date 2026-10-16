// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

// Import stylesheet design system & page styles
import './styles/tokens.css';
import './styles/global.css';
import './styles/components.css';
import './styles/pages/home.css';
import './styles/pages/work.css';
import './styles/pages/services.css';
import './styles/pages/pricing.css';
import './styles/pages/about.css';
import './styles/pages/contact.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
