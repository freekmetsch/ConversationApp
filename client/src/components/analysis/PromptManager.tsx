import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { usePromptsStore, selectFilteredPrompts } from '@/store/promptsStore';
import { useConversationsStore, selectSelectedConversation } from '@/store/conversationsStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { analyzeConversation } from '@/lib/openai';
import { Edit, Trash2, Plus, Play } from 'lucide-react';
import { format } from 'date-fns';

export function PromptManager() {
  const { toast } = useToast();
  
  const {
    prompts,
    newPrompt,
    editingPromptId,
    selectedPromptIds,
    promptSearchQuery,
    setPrompts,
    setIsLoading,
    updateNewPrompt,
    setEditingPromptId,
    toggleSelectedPrompt,
    setPromptSearchQuery,
    resetNewPrompt
  } = usePromptsStore();
  
  const selectedConversation = selectSelectedConversation(useConversationsStore.getState());
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Fetch prompts
  const { isLoading } = useQuery({
    queryKey: ['/api/prompts'],
    queryFn: async () => {
      setIsLoading(true);
      const response = await fetch('/api/prompts');
      if (!response.ok) throw new Error('Failed to fetch prompts');
      const data = await response.json();
      setPrompts(data);
      setIsLoading(false);
      return data;
    },
  });
  
  // Create prompt mutation
  const createPromptMutation = useMutation({
    mutationFn: async (data: { name: string; text: string }) => {
      const response = await apiRequest('POST', '/api/prompts', data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/prompts'] });
      toast({
        title: 'Prompt created',
        description: 'Your prompt has been created successfully.',
      });
      resetNewPrompt();
    },
    onError: (error) => {
      toast({
        title: 'Failed to create prompt',
        description: error.message || 'An error occurred while creating the prompt.',
        variant: 'destructive',
      });
    },
  });
  
  // Update prompt mutation
  const updatePromptMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { name: string; text: string } }) => {
      const response = await apiRequest('PUT', `/api/prompts/${id}`, data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/prompts'] });
      toast({
        title: 'Prompt updated',
        description: 'Your prompt has been updated successfully.',
      });
      setEditingPromptId(null);
      resetNewPrompt();
    },
    onError: (error) => {
      toast({
        title: 'Failed to update prompt',
        description: error.message || 'An error occurred while updating the prompt.',
        variant: 'destructive',
      });
    },
  });
  
  // Delete prompt mutation
  const deletePromptMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/prompts/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prompts'] });
      toast({
        title: 'Prompt deleted',
        description: 'Your prompt has been deleted successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to delete prompt',
        description: error.message || 'An error occurred while deleting the prompt.',
        variant: 'destructive',
      });
    },
  });
  
  // Run analysis mutation
  const runAnalysisMutation = useMutation({
    mutationFn: async ({ conversationId, promptIds }: { conversationId: number; promptIds: number[] }) => {
      const response = await analyzeConversation(conversationId, promptIds);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      toast({
        title: 'Analysis complete',
        description: 'Your transcript has been analyzed successfully.',
      });
      setIsAnalyzing(false);
    },
    onError: (error) => {
      toast({
        title: 'Analysis failed',
        description: error.message || 'An error occurred during analysis.',
        variant: 'destructive',
      });
      setIsAnalyzing(false);
    },
  });
  
  // Handle submit for creating/updating prompts
  const handleSubmitPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPrompt.name || !newPrompt.text) {
      toast({
        title: 'Missing information',
        description: 'Please provide both a name and text for the prompt.',
        variant: 'destructive',
      });
      return;
    }
    
    if (editingPromptId !== null) {
      updatePromptMutation.mutate({
        id: editingPromptId,
        data: {
          name: newPrompt.name,
          text: newPrompt.text,
        },
      });
    } else {
      createPromptMutation.mutate({
        name: newPrompt.name,
        text: newPrompt.text,
      });
    }
  };
  
  // Handle edit prompt
  const handleEditPrompt = (promptId: number) => {
    const promptToEdit = prompts.find(p => p.id === promptId);
    if (promptToEdit) {
      updateNewPrompt({
        name: promptToEdit.name,
        text: promptToEdit.text,
      });
      setEditingPromptId(promptId);
    }
  };
  
  // Handle delete prompt
  const handleDeletePrompt = (promptId: number) => {
    if (confirm('Are you sure you want to delete this prompt?')) {
      deletePromptMutation.mutate(promptId);
    }
  };
  
  // Handle run analysis
  const handleRunAnalysis = (promptId?: number) => {
    if (!selectedConversation) {
      toast({
        title: 'No conversation selected',
        description: 'Please select a conversation to analyze.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!selectedConversation.transcription) {
      toast({
        title: 'No transcription available',
        description: 'Please generate a transcription before running analysis.',
        variant: 'destructive',
      });
      return;
    }
    
    const promptIds = promptId ? [promptId] : selectedPromptIds;
    
    if (promptIds.length === 0) {
      toast({
        title: 'No prompts selected',
        description: 'Please select at least one prompt for analysis.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsAnalyzing(true);
    runAnalysisMutation.mutate({
      conversationId: selectedConversation.id,
      promptIds,
    });
  };
  
  // Cancel editing
  const handleCancelEdit = () => {
    setEditingPromptId(null);
    resetNewPrompt();
  };
  
  // Get filtered prompts
  const filteredPrompts = selectFilteredPrompts(usePromptsStore.getState());
  
  return (
    <div className="border-b pb-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium text-lg">Custom Prompts</h3>
        {editingPromptId === null && (
          <Button
            variant="ghost"
            size="sm"
            className="text-primary hover:text-blue-700 text-sm flex items-center"
            onClick={() => resetNewPrompt()}
          >
            <Plus className="h-4 w-4 mr-1" />
            New Prompt
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="col-span-2">
          <Card className="border rounded-md">
            <CardContent className="p-3">
              <form onSubmit={handleSubmitPrompt}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <Input
                      type="text"
                      placeholder="Prompt name"
                      className="w-full font-medium border-none focus:outline-none focus:ring-0 p-0 mb-1"
                      value={newPrompt.name}
                      onChange={(e) => updateNewPrompt({ name: e.target.value })}
                    />
                    <Textarea
                      placeholder="Enter your custom prompt here..."
                      className="w-full border border-gray-300 rounded p-2 text-sm h-24 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      value={newPrompt.text}
                      onChange={(e) => updateNewPrompt({ text: e.target.value })}
                    />
                  </div>
                  <div className="flex space-x-1 ml-2">
                    {editingPromptId !== null && (
                      <Button
                        variant="ghost"
                        size="icon"
                        type="button"
                        className="text-gray-500 hover:text-gray-700"
                        onClick={handleCancelEdit}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex justify-between mt-2">
                  <div className="text-xs text-gray-500">
                    {editingPromptId !== null ? `Editing prompt #${editingPromptId}` : 'Create a new prompt'}
                  </div>
                  <Button
                    type="submit"
                    className="bg-primary text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                    disabled={createPromptMutation.isPending || updatePromptMutation.isPending}
                  >
                    {createPromptMutation.isPending || updatePromptMutation.isPending
                      ? 'Saving...'
                      : editingPromptId !== null ? 'Update Prompt' : 'Save Prompt'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Search for prompts */}
        {filteredPrompts.length > 0 && (
          <div className="col-span-2 mb-2">
            <Input
              type="text"
              placeholder="Search prompts..."
              value={promptSearchQuery}
              onChange={(e) => setPromptSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
        )}

        {/* Saved Prompts */}
        {isLoading ? (
          <div className="col-span-2 text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Loading prompts...</p>
          </div>
        ) : filteredPrompts.length === 0 ? (
          <div className="col-span-2 text-center py-4 text-gray-500">
            No prompts found. Create your first prompt to get started.
          </div>
        ) : (
          filteredPrompts.map((prompt) => (
            <Card key={prompt.id} className="border rounded-md">
              <CardContent className="p-3 flex flex-col">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">{prompt.name}</h4>
                    <p className="text-xs text-gray-500 truncate mb-2">{prompt.text.substring(0, 60)}...</p>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-gray-500 hover:text-primary p-1"
                      onClick={() => handleEditPrompt(prompt.id)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-gray-500 hover:text-error p-1"
                      onClick={() => handleDeletePrompt(prompt.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-auto flex justify-between items-center">
                  <label className="flex items-center text-sm">
                    <Checkbox 
                      checked={selectedPromptIds.includes(prompt.id)} 
                      onCheckedChange={() => toggleSelectedPrompt(prompt.id)}
                      className="mr-2"
                    />
                    <span>Select for batch analysis</span>
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-primary text-xs"
                    onClick={() => handleRunAnalysis(prompt.id)}
                    disabled={isAnalyzing || !selectedConversation || !selectedConversation.transcription}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Run
                  </Button>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Created: {format(new Date(prompt.createdAt), 'MMM d, yyyy')}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {filteredPrompts.length > 0 && (
        <div className="mt-4 flex justify-end">
          <Button
            className="bg-primary text-white px-4 py-2 rounded text-sm hover:bg-blue-600 flex items-center"
            onClick={() => handleRunAnalysis()}
            disabled={isAnalyzing || selectedPromptIds.length === 0 || !selectedConversation || !selectedConversation.transcription}
          >
            {isAnalyzing ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Analyzing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-1" />
                Run Selected Analyses
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
