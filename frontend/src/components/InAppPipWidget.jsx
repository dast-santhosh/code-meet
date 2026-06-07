import React from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Video, VideoOff, Hand, Maximize2, Layers, LogOut } from 'lucide-react';
import { ParticipantVideo } from './VideoGrid';

export default function InAppPipWidget({
  commandant,
  commandantCode,
  userProfile,
  localStream,
  remoteStreams,
  micMuted,
  videoMuted,
  handRaised,
  onToggleMic,
  onToggleVideo,
  onToggleHand,
  onRestore,
  activeWorkspace,
  onChangeWorkspace
}) {
  const isSelfCmd = commandant && userProfile && commandant.userId === userProfile.uid;
  const cmdStream = commandant
    ? (isSelfCmd ? localStream : remoteStreams[commandant.userId])
    : null;
  const cmdVideoOn = commandant
    ? (isSelfCmd ? !videoMuted : !commandant.videoMuted)
    : false;

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0}
      dragConstraints={{ top: 50, bottom: window.innerHeight - 220, left: -window.innerWidth + 180, right: window.innerWidth - 180 }}
      initial={{ x: window.innerWidth - 200, y: window.innerHeight - 320 }}
      className="fixed z-[9999] w-[180px] bg-neutral-950/90 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden backdrop-blur-xl select-none"
    >
      {/* Header / Drag Handle */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-900 border-b border-white/5 cursor-move">
        <span className="text-[8px] font-black font-orbitron tracking-wider text-slate-400">CLASS PIP</span>
        <button 
          onClick={onRestore}
          className="p-1 hover:bg-white/5 rounded-lg text-emerald-400 hover:text-emerald-300 transition"
          title="Restore Full Screen Class"
        >
          <Maximize2 className="w-3 h-3" />
        </button>
      </div>

      {/* Video Window Frame */}
      <div className="h-[120px] bg-neutral-900/60 relative flex items-center justify-center p-1">
        {commandant ? (
          cmdStream && cmdVideoOn ? (
            <ParticipantVideo
              stream={cmdStream}
              name={commandant.name}
              isMuted={isSelfCmd ? micMuted : commandant.micMuted}
              isCameraOn={true}
              isHandRaised={false}
              isLocal={isSelfCmd}
              className="w-full h-full object-cover border-0 rounded-lg"
            />
          ) : (
            <div className="w-full h-full bg-black/60 p-2 overflow-auto text-[8px] font-mono text-emerald-400 select-text leading-relaxed whitespace-pre-wrap border border-white/5 rounded-lg text-left">
              {commandantCode || "# Code is empty"}
            </div>
          )
        ) : (
          <div className="text-center text-[9px] text-slate-500 italic">Commandant Offline</div>
        )}
      </div>

      {/* In-PIP Controls */}
      <div className="flex justify-around items-center p-2 bg-neutral-950 border-t border-white/5">
        <button
          onClick={onToggleMic}
          className={`p-1.5 rounded-lg border transition ${
            micMuted 
              ? 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20' 
              : 'bg-white/5 border-white/5 text-emerald-400 hover:bg-white/10'
          }`}
          title="Toggle Mic"
        >
          {micMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={onToggleVideo}
          className={`p-1.5 rounded-lg border transition ${
            videoMuted 
              ? 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20' 
              : 'bg-white/5 border-white/5 text-emerald-400 hover:bg-white/10'
          }`}
          title="Toggle Video"
        >
          {videoMuted ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={onToggleHand}
          className={`p-1.5 rounded-lg border transition ${
            handRaised 
              ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/20' 
              : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
          }`}
          title="Raise Hand"
        >
          <Hand className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Background Panel Switcher */}
      <div className="p-2 bg-neutral-900/40 border-t border-white/5 flex flex-col gap-1">
        <div className="flex items-center gap-1 text-[8px] font-bold text-slate-500 uppercase">
          <Layers className="w-2.5 h-2.5" />
          <span>Select Workspace</span>
        </div>
        <select
          value={activeWorkspace}
          onChange={(e) => onChangeWorkspace(e.target.value)}
          className="w-full bg-neutral-950 border border-white/5 rounded-lg px-2 py-1 text-[9px] font-bold text-slate-300 focus:outline-none focus:border-white/20 uppercase"
        >
          <option value="dashboard">Dashboard</option>
          <option value="ide">Guest IDE</option>
        </select>
      </div>
    </motion.div>
  );
}
