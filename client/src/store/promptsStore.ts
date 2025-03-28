import { create } from 'zustand';
import { Prompt } from '@shared/schema';

interface PromptsState {
  // Prompts data
  prompts: Prompt[];
  isLoading: boolean;
  newPrompt: {
    name: string;
    text: string;
  };
  editingPromptId: number | null;
  selectedPromptIds: number[];
  promptSearchQuery: string;
  
  // Actions
  setPrompts: (prompts: Prompt[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  updateNewPrompt: (data: Partial<PromptsState['newPrompt']>) => void;
  setEditingPromptId: (id: number | null) => void;
  toggleSelectedPrompt: (id: number) => void;
  setSelectedPromptIds: (ids: number[]) => void;
  setPromptSearchQuery: (query: string) => void;
  addPrompt: (prompt: Prompt) => void;
  updatePrompt: (id: number, data: Partial<Prompt>) => void;
  removePrompt: (id: number) => void;
  resetNewPrompt: () => void;
}

const initialNewPrompt = {
  name: '',
  text: '',
};

export const usePromptsStore = create<PromptsState>((set) => ({
  // Initial state
  prompts: [],
  isLoading: false,
  newPrompt: { ...initialNewPrompt },
  editingPromptId: null,
  selectedPromptIds: [],
  promptSearchQuery: '',
  
  // Actions
  setPrompts: (prompts) => set({ prompts }),
  
  setIsLoading: (isLoading) => set({ isLoading }),
  
  updateNewPrompt: (data) => set((state) => ({
    newPrompt: { ...state.newPrompt, ...data },
  })),
  
  setEditingPromptId: (id) => set({ editingPromptId: id }),
  
  toggleSelectedPrompt: (id) => set((state) => {
    const isSelected = state.selectedPromptIds.includes(id);
    return {
      selectedPromptIds: isSelected
        ? state.selectedPromptIds.filter((promptId) => promptId !== id)
        : [...state.selectedPromptIds, id],
    };
  }),
  
  setSelectedPromptIds: (ids) => set({ selectedPromptIds: ids }),
  
  setPromptSearchQuery: (query) => set({ promptSearchQuery: query }),
  
  addPrompt: (prompt) => set((state) => ({
    prompts: [...state.prompts, prompt],
  })),
  
  updatePrompt: (id, data) => set((state) => ({
    prompts: state.prompts.map((prompt) => 
      prompt.id === id ? { ...prompt, ...data } : prompt
    ),
  })),
  
  removePrompt: (id) => set((state) => ({
    prompts: state.prompts.filter((prompt) => prompt.id !== id),
    selectedPromptIds: state.selectedPromptIds.filter((promptId) => promptId !== id),
    editingPromptId: state.editingPromptId === id ? null : state.editingPromptId,
  })),
  
  resetNewPrompt: () => set({ 
    newPrompt: { ...initialNewPrompt },
    editingPromptId: null
  }),
}));

// Selectors
export const selectFilteredPrompts = (state: PromptsState) => {
  const { prompts, promptSearchQuery } = state;
  
  if (!promptSearchQuery) {
    return prompts;
  }
  
  const query = promptSearchQuery.toLowerCase();
  return prompts.filter((prompt) => 
    prompt.name.toLowerCase().includes(query) || 
    prompt.text.toLowerCase().includes(query)
  );
};
