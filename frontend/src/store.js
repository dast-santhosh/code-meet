import { create } from 'zustand';

const useAppStore = create((set) => ({
  // Authentication State
  user: null,
  userProfile: null,
  role: null,
  authLoading: true,
  setUser: (user) => set({ user }),
  setUserProfile: (profile) => set({ userProfile: profile, role: profile?.role || null }),
  setAuthLoading: (loading) => set({ authLoading: loading }),
  clearUser: () => set({ user: null, userProfile: null, role: null }),

  // Meeting Session State
  activeMeetId: null,
  activeSquadron: null,
  setActiveMeet: (meetId, squadron) => set({ activeMeetId: meetId, activeSquadron: squadron }),
  clearMeet: () => set({ activeMeetId: null, activeSquadron: null }),

  // Editor Visual Preferences (Common IDLE/Shell preferences)
  editorTheme: 'vs-dark', // Options: 'vs-dark', 'light', 'hc-black', 'violet'
  editorFontSize: 14,
  editorFontFamily: 'Fira Code',
  setEditorTheme: (theme) => set({ editorTheme: theme }),
  setEditorFontSize: (size) => set({ editorFontSize: size }),
  setEditorFontFamily: (family) => set({ editorFontFamily: family }),

  // Draggable Portal Overlays
  showChat: false,
  showAI: false,
  showSearch: false,
  setShowChat: (show) => set({ showChat: show }),
  setShowAI: (show) => set({ showAI: show }),
  setShowSearch: (show) => set({ showSearch: show }),

  // Explorer State
  activeFile: 'main.py',
  setActiveFile: (fileName) => set({ activeFile: fileName })
}));

export default useAppStore;
