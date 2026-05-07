import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ToastProvider } from './shared/components/ToastProvider';
import AppRoutes from './routes/AppRoutes';
import './styles/tokens.css';
import './styles/animations.css';
import './styles/utilities.css';
import './styles/modals.css';
import './styles/empty-states.css';
import './Modern.css';

/**
 * Root Application Component
 * Slim shell: providers + routing only.
 */
function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <AppRoutes />
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
