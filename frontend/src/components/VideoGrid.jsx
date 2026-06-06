import React, { useEffect, useRef } from 'react';
import { VideoOff, MicOff, Hand } from 'lucide-react';

export function ParticipantVideo({ stream, name, isMuted, isCameraOn, isHandRaised, isLocal, className = "" }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={`relative bg-slate-900 border border-white/5 overflow-hidden aspect-video rounded-xl shadow-lg flex items-center justify-center group ${className}`}>
      
      {/* Video element */}
      {isCameraOn && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal || isMuted}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 border border-white/5">
            <VideoOff className="w-4 h-4" />
          </div>
          <span className="text-[10px] text-slate-500 font-medium font-orbitron">CAM OFF</span>
        </div>
      )}

      {/* Name Tag & Indicators Overlay */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
        <div className="bg-slate-950/80 px-2 py-0.5 rounded-lg text-[9px] font-bold text-slate-200 border border-white/5 shadow-md flex items-center gap-1">
          <span className="truncate max-w-[80px]">{name}</span>
          {isLocal && <span className="text-[8px] text-emerald-400 font-semibold">(You)</span>}
        </div>

        <div className="flex gap-1">
          {/* Muted Indicator */}
          {isMuted && (
            <div className="bg-red-500/80 p-1 rounded-lg border border-red-500/20 shadow-md">
              <MicOff className="w-2.5 h-2.5 text-white" />
            </div>
          )}
          
          {/* Hand Raise Indicator */}
          {isHandRaised && (
            <div className="bg-yellow-500 p-1 rounded-lg border border-yellow-400/20 shadow-md animate-bounce">
              <Hand className="w-2.5 h-2.5 text-slate-950 fill-slate-950" />
            </div>
          )}
        </div>
      </div>
      
    </div>
  );
}

// Dummy export to prevent import failures
export default function VideoGrid() {
  return null;
}
