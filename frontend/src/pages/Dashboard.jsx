import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import useAppStore from '../store';
import toast from 'react-hot-toast';
import { Video, LogOut, Play, Square, Loader2, BookOpen, UserCheck, Shield } from 'lucide-react';

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
      toast.success(`🎖 Classroom session started for ${squadron.name}!`);
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

  const handleJoinClass = (squadron) => {
    setActiveMeet(squadron.id, squadron);
    toast.success(`Joining session: ${squadron.name}`);
    navigate(`/meet/${squadron.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#060814]">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060814] text-slate-100 p-8 font-sans">
      
      {/* Dashboard Top Header */}
      <div className="max-w-5xl mx-auto flex items-center justify-between border-b border-white/5 pb-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-emerald-500/20 flex items-center justify-center">
            <img src="https://i.ibb.co/5hLjp6qw/Dev-Shaala-Logo.png" alt="DevShaala" className="w-7 h-7 object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-black font-outfit tracking-wide uppercase text-slate-200">
              DevShaala Code & Meet
            </h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold flex items-center gap-1">
              <Shield className="w-3 h-3 text-emerald-400" />
              {role === 'commandant' ? 'Mentor Control Station' : 'Student Cadet Lounge'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-300">{userProfile?.name}</p>
            <p className="text-[10px] text-slate-500 uppercase font-semibold">{userProfile?.email}</p>
          </div>
          <button 
            onClick={handleLogout} 
            className="p-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-2xl transition flex items-center justify-center gap-1.5 text-xs font-bold"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content Dashboard */}
      <div className="max-w-5xl mx-auto">
        <h2 className="text-sm font-bold tracking-widest font-orbitron text-emerald-400 uppercase mb-4">
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
                  className={`glass-panel p-6 rounded-3xl border transition duration-150 flex flex-col justify-between h-[200px] ${
                    isLive ? 'border-emerald-500/30 shadow-lg shadow-emerald-500/5 bg-emerald-950/5' : 'border-white/5 bg-slate-950/25'
                  }`}
                >
                  <div>
                    {/* Live Badge */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase font-orbitron">{sq.name}</span>
                      {isLive ? (
                        <div className="flex items-center gap-1 bg-red-500/20 border border-red-500/30 px-2 py-0.5 rounded-lg">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-[8px] font-black text-red-400 tracking-wider font-orbitron">LIVE</span>
                        </div>
                      ) : (
                        <span className="text-[8px] font-bold text-slate-600 bg-slate-900 border border-white/5 px-2 py-0.5 rounded-lg font-orbitron">STANDBY</span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-white mb-1">{sq.description || "Interactive Coding Session"}</h3>
                    {isLive && (
                      <p className="text-[10px] text-slate-400 flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                        Host: {session.startedByName}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-4">
                    {role === 'commandant' ? (
                      isLive ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleJoinClass(sq)}
                            className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black uppercase py-3 rounded-2xl transition flex items-center justify-center gap-1"
                          >
                            <Video className="w-3.5 h-3.5" />
                            Enter
                          </button>
                          <button
                            onClick={() => handleEndClass(sq.id)}
                            className="px-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-bold rounded-2xl transition flex items-center justify-center"
                          >
                            <Square className="w-3.5 h-3.5 fill-red-400" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartClass(sq)}
                          className="w-full bg-slate-900 hover:bg-slate-850 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase py-3.5 rounded-2xl transition flex items-center justify-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400" />
                          Start Class
                        </button>
                      )
                    ) : (
                      // CADET (Student) view
                      isLive ? (
                        <button
                          onClick={() => handleJoinClass(sq)}
                          className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black uppercase py-3.5 rounded-2xl transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 pulse-border"
                        >
                          <Video className="w-4 h-4" />
                          Join Class
                        </button>
                      ) : (
                        <div className="w-full bg-slate-900/40 text-slate-500 text-center py-3 text-xs font-bold uppercase rounded-2xl border border-white/5 cursor-not-allowed">
                          No active class
                        </div>
                      )
                    )}
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
