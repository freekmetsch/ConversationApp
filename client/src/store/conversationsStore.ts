import { create } from 'zustand';
import { ConversationWithDetails } from '@shared/schema';

interface ConversationsState {
  // Conversations data
  conversations: ConversationWithDetails[];
  isLoading: boolean;
  selectedConversationId: number | null;
  
  // Search and filter
  searchQuery: string;
  selectedTypeId: number | null;
  
  // Actions
  setConversations: (conversations: ConversationWithDetails[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  setSelectedConversationId: (id: number | null) => void;
  setSearchQuery: (query: string) => void;
  setSelectedTypeId: (typeId: number | null) => void;
  addConversation: (conversation: ConversationWithDetails) => void;
  updateConversation: (id: number, data: Partial<ConversationWithDetails>) => void;
  removeConversation: (id: number) => void;
}

export const useConversationsStore = create<ConversationsState>((set) => ({
  // Initial state
  conversations: [],
  isLoading: false,
  selectedConversationId: null,
  searchQuery: '',
  selectedTypeId: null,
  
  // Actions
  setConversations: (conversations) => set({ conversations }),
  
  setIsLoading: (isLoading) => set({ isLoading }),
  
  setSelectedConversationId: (id) => set({ selectedConversationId: id }),
  
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  setSelectedTypeId: (typeId) => set({ selectedTypeId: typeId }),
  
  addConversation: (conversation) => set((state) => ({
    conversations: [...state.conversations, conversation],
  })),
  
  updateConversation: (id, data) => set((state) => ({
    conversations: state.conversations.map((conv) => 
      conv.id === id ? { ...conv, ...data } : conv
    ),
  })),
  
  removeConversation: (id) => set((state) => ({
    conversations: state.conversations.filter((conv) => conv.id !== id),
    selectedConversationId: state.selectedConversationId === id ? null : state.selectedConversationId,
  })),
}));

// Selectors
export const selectFilteredConversations = (state: ConversationsState) => {
  const { conversations, searchQuery, selectedTypeId } = state;
  
  return conversations.filter((conv) => {
    // Filter by search query
    const matchesSearch = searchQuery === '' || 
      (conv.student?.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
       conv.type?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
       conv.transcription?.text.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Filter by conversation type
    const matchesType = selectedTypeId === null || conv.typeId === selectedTypeId;
    
    return matchesSearch && matchesType;
  });
};

export const selectSelectedConversation = (state: ConversationsState) => {
  return state.conversations.find((conv) => conv.id === state.selectedConversationId) || null;
};
