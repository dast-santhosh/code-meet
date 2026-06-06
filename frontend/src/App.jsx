import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase/config';
import useAppStore from './store';
import { Toaster } from 'react-hot-toast';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MeetRoom from './pages/MeetRoom';

export default function App() {
  const { setUser, setUserProfile, setAuthLoading, authLoading, user, editorTheme } = useAppStore();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        // Fetch Firestore profile
        try {
          const docSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (docSnap.exists()) {
            setUserProfile(docSnap.data());
          }
        } catch (e) {
          console.error("Error fetching user profile:", e);
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setAuthLoading(false);
    });

    return () => unsub();
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#060814]">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin" />
      </div>
    );
  }

  // Determine active visual theme class
  const getThemeClass = () => {
    if (editorTheme === 'violet') return 'theme-violet';
    if (editorTheme === 'light') return 'theme-light';
    if (editorTheme === 'hc-black') return 'theme-hc';
    return '';
  };

  return (
    <div className={getThemeClass()}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
          <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" replace />} />
          <Route path="/meet/:squadronId" element={user ? <MeetRoom /> : <Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster 
        position="top-right"
        toastOptions={{
          className: 'glass-panel text-slate-100 border border-white/5 bg-slate-900/90 text-xs font-medium',
          duration: 3000
        }}
      />
    </div>
  );
}
