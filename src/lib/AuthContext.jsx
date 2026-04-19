import React, { createContext, useState, useContext, useEffect } from 'react';
import { authApi } from '@/api/openaiClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [isLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings] = useState({});

  useEffect(() => {
    // Check if this is a new browser session (not a refresh)
    const isNewSession = !sessionStorage.getItem('app_session');
    
    if (isNewSession) {
      // First time opening app - clear tokens and show login
      localStorage.removeItem('token');
      localStorage.removeItem('certis_token');
      sessionStorage.setItem('app_session', 'true');
    } else {
      // Refresh - check if user was logged in
      const token = localStorage.getItem('token') || localStorage.getItem('certis_token');
      if (token) {
        checkUserAuth();
      }
    }
  }, []);

  const checkUserAuth = async () => {
    setIsLoadingAuth(true);
    try {
      const currentUser = await authApi.me();
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch {
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const login = async (email, password) => {
    try {
      setAuthError(null);
      // Hash password with SHA256 (same as backend)
      const hashedPassword = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
        .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));
      
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: hashedPassword })
      });
      
      if (!response.ok) {
        throw new Error('Invalid credentials');
      }
      
      const result = await response.json();
      localStorage.setItem('token', result.access_token);
      localStorage.setItem('certis_token', result.access_token);
      setUser(result.user);
      setIsAuthenticated(true);
      return result;
    } catch (err) {
      setAuthError({ type: 'auth_failed', message: err.message });
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('certis_token');
    setUser(null);
    setIsAuthenticated(false);
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      login,
      logout,
      navigateToLogin,
      checkAppState: checkUserAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
