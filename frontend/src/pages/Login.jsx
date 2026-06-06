import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import useAppStore from '../store';
import toast from 'react-hot-toast';
import { Lock, Mail, Loader2, ArrowRight } from 'lucide-react';

const LOGO = 'https://i.ibb.co/5hLjp6qw/Dev-Shaala-Logo.png';

export default function Login() {
  const navigate = useNavigate();
  const { user, setUser, setUserProfile, setAuthLoading } = useAppStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const snap = await getDoc(doc(db, 'users', cred.user.uid));
      if (!snap.exists()) {
        toast.error("Profile record not found in database");
        await auth.signOut();
        setLoading(false);
        return;
      }
      
      const profile = snap.data();
      setUser(cred.user);
      setUserProfile(profile);
      
      toast.success(`Welcome to DevShaala, ${profile.name}!`);
      navigate('/dashboard');
    } catch (err) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
        toast.error('Invalid email or password');
      } else {
        toast.error(err.message || 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative bg-[#060814] overflow-hidden">
      {/* Background Animated Blobs */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full filter blur-[120px] opacity-40 bg-emerald-500/20 animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full filter blur-[120px] opacity-40 bg-purple-500/20 animate-pulse" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-slate-900/80 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <img src={LOGO} alt="DevShaala Logo" className="w-12 h-12 object-contain" />
          </div>
          <h1 className="text-2xl font-black font-outfit tracking-wider text-slate-100 uppercase">
            DEVSHAALA
          </h1>
          <p className="text-xs text-slate-400 font-semibold tracking-[0.2em] uppercase mt-1">
            CODE & MEET PORTAL
          </p>
        </div>

        {/* Card */}
        <div className="glass-panel p-8 rounded-3xl shadow-2xl relative border border-white/5 bg-slate-950/40">
          <h2 className="text-lg font-bold text-slate-100 mb-6 flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            Sign In
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Email Address
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your student or mentor email"
                  className="w-full bg-slate-900/60 border border-white/5 rounded-2xl pl-10 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition duration-150"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Password
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-slate-900/60 border border-white/5 rounded-2xl pl-10 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition duration-150"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold uppercase tracking-wider py-4 rounded-2xl transition duration-150 flex items-center justify-center gap-2 mt-6 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying account...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-slate-500 mt-6 tracking-widest uppercase font-semibold">
          DEVSHAALA © 2026
        </p>

      </div>
    </div>
  );
}
