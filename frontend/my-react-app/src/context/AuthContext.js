// frontend/src/context/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Ensure token is available early (in case other parts read it)
  useEffect(() => {
    const init = async () => {
      try {
        const token = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');

        if (token && savedUser) {
          // verify token at backend
          try {
            const res = await authAPI.getMe();
            // backend returns { success: true, user: { ... } } or similar
            setUser(res.data.user ?? res.data);
          } catch (err) {
            // invalid token
            console.warn('Auth init: token invalid, clearing', err);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
          }
        }
      } catch (err) {
        console.error('Auth init error', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  // login: ensure token written to localStorage BEFORE other components fetch
  const login = async (email, password) => {
    try {
      const response = await authAPI.login(email, password);
      if (response.data?.success) {
        const { token, user } = response.data;
        // write token first (avoid race)
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        setUser(user);
        return { success: true };
      }
      return { success: false, error: response.data?.message };
    } catch (error) {
      console.error('Login error', error);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  };

  const register = async (name, email, password) => {
    try {
      const response = await authAPI.register(name, email, password);
      if (response.data?.success) {
        const { token, user } = response.data;
        // write token first
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        setUser(user);
        return { success: true };
      }
      return { success: false, error: response.data?.message };
    } catch (error) {
      console.error('Register error', error);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // optionally redirect to login from here
  };

  // while loading, render a small spinner to prevent components firing requests
  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', color: '#fff'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
