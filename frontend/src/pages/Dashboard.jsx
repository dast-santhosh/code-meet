import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import useAppStore from '../store';
import toast from 'react-hot-toast';
import { Video, LogOut, Play, Square, Loader2, BookOpen, UserCheck, Shield, Award, Terminal } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, userProfile, role, clearUser, setActiveMeet } = useAppStore();
  const [squadrons, setSquadrons] = useState([]);
  const [activeSessions, setActiveSessions] = useState({});
  const [loading, setLoading] = useState(true);

  // Redirect to login if user profile is missing
  useEffect(() => {
    if (!user || !userProfile) {
      navigate('/login');
    }
  }, [user, userProfile]);

  // Real-time listener for squadrons and session states
  useEffect(() => {
    if (!userProfile) return;

    let unsubSquadrons = () => {};
    let unsubSessions = () => {};

    if (role === 'commandant') {
      // Fetch squadrons managed by this Commandant
      const qSq = query(collection(db, 'squadrons'), where('commandantId', '==', userProfile.uid));
      unsubSquadrons = onSnapshot(qSq, (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setSquadrons(list);
        setLoading(false);
      }, (err) => {
        toast.error("Failed to fetch squadrons: " + err.message);
        setLoading(false);
      });
    } else if (role === 'cadet') {
      // Fetch squadrons where Cadet is enrolled
      const enrolled = userProfile.enrolledSquadrons || [];
      if (enrolled.length === 0) {
        setSquadrons([]);
        setLoading(false);
      } else {
        // Query squadrons by ID list
        // Note: Firestore 'in' query supports up to 30 items
        const qSq = query(collection(db, 'squadrons'), where('__name__', 'in', enrolled));
        unsubSquadrons = onSnapshot(qSq, (snap) => {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setSquadrons(list);
          setLoading(false);
        }, (err) => {
          toast.error("Failed to fetch enrolled squadrons: " + err.message);
          setLoading(false);
        });
      }
    }

    // Listener for active code_meet_sessions
    const qSessions = query(collection(db, 'code_meet_sessions'), where('active', '==', true));
    unsubSessions = onSnapshot(qSessions, (snap) => {
      const sessionsMap = {};
      snap.docs.forEach(doc => {
        sessionsMap[doc.id] = doc.data();
      });
      setActiveSessions(sessionsMap);
    });

    return () => {
      unsubSquadrons();
      unsubSessions();
    };
  }, [userProfile]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      clearUser();
      toast.success("Logged out successfully");
      navigate('/login');
    } catch (err) {
      toast.error("Logout failed: " + err.message);
    }
  };

  const handleStartClass = async (squadron) => {
    try {
      const sessionRef = doc(db, 'code_meet_sessions', squadron.id);
      await setDoc(sessionRef, {
        active: true,
        squadronId: squadron.id,
        squadronName: squadron.name,
        startedAt: new Date().toISOString(),
        startedBy: userProfile.uid,
        startedByName: userProfile.name,
        codeSnapshot: "# Write python program here\nprint('Hello DevShaala!')\n"
      });
      setActiveMeet(squadron.id, squadron);
      toast.success(`Classroom session started for ${squadron.name}!`, {
        icon: <Award className="w-4 h-4 text-emerald-400" />
      });

      // Request fullscreen on user gesture
      try {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        } else if (docEl.msRequestFullscreen) {
          await docEl.msRequestFullscreen();
        }
      } catch (e) {
        console.log("Fullscreen request failed:", e);
      }

      navigate(`/meet/${squadron.id}`);
    } catch (err) {
      toast.error("Failed to start session: " + err.message);
    }
  };

  const handleEndClass = async (squadronId) => {
    try {
      const sessionRef = doc(db, 'code_meet_sessions', squadronId);
      await deleteDoc(sessionRef);
      toast.success("Class session ended");
    } catch (err) {
      toast.error("Failed to end session: " + err.message);
    }
  };

  const handleJoinClass = async (squadron) => {
    setActiveMeet(squadron.id, squadron);
    toast.success(`Joining session: ${squadron.name}`);

    // Request fullscreen on user gesture
    try {
      const docEl = document.documentElement;
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      } else if (docEl.msRequestFullscreen) {
        await docEl.msRequestFullscreen();
      }
    } catch (e) {
      console.log("Fullscreen request failed:", e);
    }

    navigate(`/meet/${squadron.id}`);
  };

  const getThumbnail = (name) => {
    const n = (name || '').toLowerCase();
    if (n.includes('python')) {
      return 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=500&auto=format&fit=crop&q=60';
    }
    if (n.includes('computer') || n.includes('hardware') || n.includes('os') || n.includes('basic')) {
      return 'https://images.unsplash.com/photo-1547082299-de196ea013d6?w=500&auto=format&fit=crop&q=60';
    }
    if (n.includes('ai') || n.includes('artificial') || n.includes('skill') || n.includes('professional')) {
      return 'https://images.unsplash.com/photo-1677442136019-21780efad99a?w=500&auto=format&fit=crop&q=60';
    }
    return 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=500&auto=format&fit=crop&q=60';
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="w-10 h-10 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-100 p-8 font-sans">
      
      {/* Dashboard Top Header */}
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/5 pb-6 mb-8">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-12 h-12 rounded-full bg-white border border-white/10 flex items-center justify-center p-1.5 flex-shrink-0">
            <img src="https://i.ibb.co/5hLjp6qw/Dev-Shaala-Logo.png" alt="DevShaala" className="w-7 h-7 object-contain" />
          </div>
          <div className="text-left">
            <h1 className="text-lg md:text-xl font-black font-outfit tracking-wide uppercase text-slate-200 leading-tight">
              DevShaala Code & Meet
            </h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold flex items-center gap-1 mt-0.5">
              <Shield className="w-3 h-3 text-slate-400" />
              {role === 'commandant' ? 'Mentor Control Station' : 'Student Cadet Lounge'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto border-t border-white/5 pt-4 md:border-t-0 md:pt-0">
          <div className="text-left md:text-right">
            <p className="text-xs font-bold text-slate-300">{userProfile?.name}</p>
            <p className="text-[10px] text-slate-500 uppercase font-semibold">{userProfile?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate('/ide')} 
              className="p-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-white rounded-xl transition flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer"
              title="Open IDE"
            >
              <Terminal className="w-4 h-4" />
              <span>Open IDE</span>
            </button>
            <button 
              onClick={handleLogout} 
              className="p-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl transition flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Dashboard */}
      <div className="max-w-5xl mx-auto">
        <h2 className="text-sm font-bold tracking-widest font-orbitron text-white uppercase mb-4">
          {role === 'commandant' ? 'MY SQUADRONS' : 'ENROLLED CLASSES'}
        </h2>

        {squadrons.length === 0 ? (
          <div className="glass-panel p-10 rounded-3xl border border-white/5 bg-slate-950/20 text-center text-slate-500 max-w-lg mx-auto mt-12">
            <BookOpen className="w-8 h-8 mx-auto text-slate-700 mb-3" />
            <p className="text-xs font-medium">You are not associated with any active squadron classes yet.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {squadrons.map((sq) => {
              const session = activeSessions[sq.id];
              const isLive = !!session;

              return (
                <div 
                  key={sq.id} 
                  className={`flex flex-col bg-neutral-900/30 border rounded-3xl overflow-hidden hover:border-neutral-700 transition duration-300 shadow-md group ${
                    isLive ? 'border-neutral-700 bg-neutral-900/60 shadow-lg shadow-black/20' : 'border-neutral-850/80 bg-neutral-900/20'
                  }`}
                >
                  {/* Thumbnail Banner with float badge */}
                  <div className="h-[140px] w-full relative overflow-hidden bg-neutral-950">
                    <img 
                      src={getThumbnail(sq.name)} 
                      alt={sq.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500 opacity-80"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/80 via-transparent to-transparent" />
                    
                    {/* Live status float badge */}
                    <div className="absolute top-3 right-3">
                      {isLive ? (
                        <div className="flex items-center gap-1.5 bg-red-500/20 backdrop-blur-md border border-red-500/40 px-2.5 py-1 rounded-xl shadow-lg">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-[8px] font-black text-red-400 tracking-wider font-orbitron">LIVE</span>
                        </div>
                      ) : (
                        <span className="text-[8px] font-bold text-slate-400 bg-neutral-950/80 backdrop-blur-md border border-white/5 px-2.5 py-1 rounded-xl font-orbitron">STANDBY</span>
                      )}
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-5 flex flex-col justify-between flex-1 gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-white tracking-wide uppercase line-clamp-1 group-hover:text-white transition">
                        {sq.name}
                      </h3>
                      {isLive && (
                        <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                          <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                          <span>Host: {session.startedByName}</span>
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div>
                      {role === 'commandant' ? (
                        isLive ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleJoinClass(sq)}
                              className="flex-1 bg-white hover:bg-neutral-200 text-black text-xs font-black uppercase py-3 rounded-2xl transition flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Video className="w-3.5 h-3.5" />
                              Enter
                            </button>
                            <button
                              onClick={() => handleEndClass(sq.id)}
                              className="px-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-bold rounded-2xl transition flex items-center justify-center cursor-pointer"
                            >
                              <Square className="w-3.5 h-3.5 fill-red-400" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartClass(sq)}
                            className="w-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-white text-xs font-black uppercase py-3.5 rounded-2xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-white text-white" />
                            Start Class
                          </button>
                        )
                      ) : (
                        // CADET (Student) view
                        isLive ? (
                          <button
                            onClick={() => handleJoinClass(sq)}
                            className="w-full bg-white hover:bg-neutral-200 text-black text-xs font-black uppercase py-3.5 rounded-2xl transition flex items-center justify-center gap-1.5 shadow-lg shadow-black/20 cursor-pointer"
                          >
                            <Video className="w-4 h-4" />
                            Join Class
                          </button>
                        ) : (
                          <div className="w-full bg-neutral-900/40 text-slate-500 text-center py-3 text-xs font-bold uppercase rounded-2xl border border-white/5 cursor-not-allowed">
                            No active class
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
