import { create } from 'zustand';
import { Conversation, Student, ConversationType } from '@shared/schema';
import { RecordingState, PlayerState } from '@/lib/audio';

interface TranscriptionQueueItem {
  conversationId: number;
  audioPath: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

interface SessionState {
  // Current editing session
  activeTab: 'transcript' | 'analysis';
  currentSessionData: {
    studentName: string;
    class: string;
    conversationTypeId: number | null;
    date: string;
  };
  recordingState: RecordingState;
  playbackState: PlayerState;
  isTranscribing: boolean;
  transcriptSearchQuery: string;
  
  // Student auto-complete
  studentSuggestions: Student[];
  
  // Active conversation
  currentConversation: Conversation | null;
  
  // Transcription queue
  transcriptionQueue: TranscriptionQueueItem[];
  
  // Actions
  setActiveTab: (tab: 'transcript' | 'analysis') => void;
  updateSessionData: (data: Partial<SessionState['currentSessionData']>) => void;
  setRecordingState: (state: RecordingState) => void;
  setPlaybackState: (state: PlayerState) => void;
  setIsTranscribing: (isTranscribing: boolean) => void;
  setTranscriptSearchQuery: (query: string) => void;
  setStudentSuggestions: (suggestions: Student[]) => void;
  setCurrentConversation: (conversation: Conversation | null) => void;
  addToTranscriptionQueue: (item: Omit<TranscriptionQueueItem, 'status'>) => void;
  updateTranscriptionQueueItem: (conversationId: number, update: Partial<TranscriptionQueueItem>) => void;
  removeFromTranscriptionQueue: (conversationId: number) => void;
  resetSession: () => void;
}

const initialSessionData = {
  studentName: '',
  class: '',
  conversationTypeId: null,
  date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
};

const initialRecordingState: RecordingState = {
  isRecording: false,
  isPaused: false,
  duration: 0,
  audioBlob: undefined,
};

const initialPlaybackState: PlayerState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
};

export const useSessionStore = create<SessionState>((set) => ({
  // Initial state
  activeTab: 'transcript',
  currentSessionData: { ...initialSessionData },
  recordingState: { ...initialRecordingState },
  playbackState: { ...initialPlaybackState },
  isTranscribing: false,
  transcriptSearchQuery: '',
  studentSuggestions: [],
  currentConversation: null,
  transcriptionQueue: [],
  
  // Actions
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  updateSessionData: (data) => set((state) => ({
    currentSessionData: { ...state.currentSessionData, ...data },
  })),
  
  setRecordingState: (state) => set({ recordingState: state }),
  
  setPlaybackState: (state) => set({ playbackState: state }),
  
  setIsTranscribing: (isTranscribing) => set({ isTranscribing }),
  
  setTranscriptSearchQuery: (query) => set({ transcriptSearchQuery: query }),
  
  setStudentSuggestions: (suggestions) => set({ studentSuggestions: suggestions }),
  
  setCurrentConversation: (conversation) => set({ currentConversation: conversation }),
  
  // Transcription queue management
  addToTranscriptionQueue: (item) => set((state) => ({
    transcriptionQueue: [
      ...state.transcriptionQueue, 
      { ...item, status: 'pending' }
    ]
  })),
  
  updateTranscriptionQueueItem: (conversationId, update) => set((state) => ({
    transcriptionQueue: state.transcriptionQueue.map(item => 
      item.conversationId === conversationId 
        ? { ...item, ...update } 
        : item
    )
  })),
  
  removeFromTranscriptionQueue: (conversationId) => set((state) => ({
    transcriptionQueue: state.transcriptionQueue.filter(
      item => item.conversationId !== conversationId
    )
  })),
  
  resetSession: () => set({
    currentSessionData: { ...initialSessionData },
    recordingState: { ...initialRecordingState },
    playbackState: { ...initialPlaybackState },
    isTranscribing: false,
    transcriptSearchQuery: '',
    currentConversation: null,
    // Note: We don't reset the transcription queue as it should persist
  }),
}));
