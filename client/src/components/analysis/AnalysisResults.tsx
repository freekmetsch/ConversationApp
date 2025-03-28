import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useConversationsStore, selectSelectedConversation } from '@/store/conversationsStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';
import { Loader2, FileDown, Trash2, RefreshCcw } from 'lucide-react';

export function AnalysisResults() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const selectedConversation = selectSelectedConversation(useConversationsStore.getState());
  const [isLoading, setIsLoading] = useState(false);
  const [analyses, setAnalyses] = useState<any[]>([]);
  
  // Add refresh function
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Function to manually refresh the analyses
  const refreshAnalyses = () => {
    setRefreshTrigger(prev => prev + 1);
  };
  
  // Fetch analyses when conversation changes or refresh is triggered
  // Add loading and management of analyses
  useEffect(() => {
    if (selectedConversation?.id) {
      fetchAnalysesData();
    } else {
      setAnalyses([]);
    }
    
    // Set up polling for analyses if none are loaded yet
    let intervalId: number | undefined;
    
    if (selectedConversation?.id && analyses.length === 0) {
      // Poll every 3 seconds to check for new analyses
      intervalId = window.setInterval(() => {
        fetchAnalysesData(false); // Don't show loading state for polling
      }, 3000);
    }
    
    return () => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
  }, [selectedConversation, refreshTrigger]);
  
  // This dependency array warning is ignored because we want to add the intervalId
  // only when analyses.length is initially 0
  
  // Function to fetch analyses data
  const fetchAnalysesData = async (showLoading = true) => {
    if (!selectedConversation?.id) return;
    
    if (showLoading) setIsLoading(true);
    
    try {
      // Create a timestamp to prevent caching
      const timestamp = new Date().getTime();
      
      // Fetch analyses
      const analysesResponse = await fetch(
        `/api/conversations/${selectedConversation.id}/analyses?t=${timestamp}`
      );
      
      if (!analysesResponse.ok) {
        throw new Error(`Failed to fetch analyses: ${analysesResponse.statusText}`);
      }
      
      const analysesData = await analysesResponse.json();
      
      // If we already have the same number of analyses and they're the same IDs,
      // no need to refetch prompts and update state
      if (
        analyses.length === analysesData.length &&
        analyses.every(a => analysesData.some((d: any) => d.id === a.id))
      ) {
        return;
      }
      
      // Get all unique prompt IDs
      const promptIds = [...new Set(analysesData.map((a: any) => a.promptId))];
      
      // Fetch all prompts in parallel
      const promptPromises = promptIds.map(id =>
        fetch(`/api/prompts/${id}?t=${timestamp}`)
          .then(res => res.ok ? res.json() : null)
          .catch(() => null)
      );
      
      const prompts = await Promise.all(promptPromises);
      
      // Create a map of prompt ID to prompt data
      const promptsMap = new Map();
      promptIds.forEach((id, index) => {
        if (prompts[index]) {
          promptsMap.set(id, prompts[index]);
        }
      });
      
      // Combine analyses with their prompts
      const analysesWithPrompts = analysesData.map((analysis: any) => ({
        ...analysis,
        prompt: promptsMap.get(analysis.promptId) || null
      }));
      
      setAnalyses(analysesWithPrompts);
    } catch (error) {
      console.error('Failed to fetch analysis data:', error);
      if (error instanceof Error && showLoading) {
        toast({
          title: 'Failed to load analyses',
          description: error.message,
          variant: 'destructive'
        });
      }
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };
  
  // Delete an analysis
  const handleDeleteAnalysis = async (analysisId: number) => {
    if (!confirm('Are you sure you want to delete this analysis?')) return;
    
    try {
      await apiRequest('DELETE', `/api/analyses/${analysisId}`, {});
      
      // Refresh the data
      refreshAnalyses();
      
      toast({
        title: 'Analysis deleted',
        description: 'The analysis has been deleted successfully.',
      });
    } catch (error) {
      console.error('Failed to delete analysis:', error);
      toast({
        title: 'Failed to delete analysis',
        description: error instanceof Error ? error.message : 'An error occurred while deleting the analysis.',
        variant: 'destructive',
      });
    }
  };
  
  // Export analysis as text file
  const handleExportAnalysis = (analysis: any) => {
    const analysisText = analysis.result;
    const blob = new Blob([analysisText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analysis-${analysis.prompt?.name || 'unnamed'}-${format(new Date(analysis.createdAt), 'yyyy-MM-dd')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Format analysis content for display
  const formatAnalysisContent = (content: string) => {
    // Replace line breaks with <br> elements
    const withLineBreaks = content.replace(/\n/g, '<br>');
    
    // Format lists and headers (basic Markdown-like formatting)
    const withFormatting = withLineBreaks
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^# (.+)$/gm, '<h3 class="font-medium text-lg">$1</h3>')
      .replace(/^## (.+)$/gm, '<h4 class="font-medium">$1</h4>')
      .replace(/^- (.+)$/gm, '<li class="ml-5">$1</li>')
      .replace(/<\/li><br><li/g, '</li><li');
    
    return <div dangerouslySetInnerHTML={{ __html: withFormatting }} />;
  };
  
  // If no conversation is selected, show a message
  if (!selectedConversation) {
    return (
      <div className="text-center py-8 text-gray-500">
        Select a conversation to view analyses
      </div>
    );
  }
  
  // If the selected conversation has no transcription, show a message
  if (!selectedConversation.transcription) {
    return (
      <div className="text-center py-8 text-gray-500">
        Generate a transcription for this conversation before running analyses
      </div>
    );
  }
  
  return (
    <div>
      <h3 className="font-medium text-lg mb-4">Analysis Results</h3>
      
      {analyses.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No analyses available for this conversation. Use the prompts above to analyze this conversation.
        </div>
      ) : (
        analyses.map((analysis) => (
          <Card key={analysis.id} className="border rounded-md mb-4">
            <CardHeader className="bg-gray-50 p-3 border-b flex justify-between items-center">
              <h4 className="font-medium">{analysis.prompt?.name || 'Analysis'}</h4>
              <div className="flex space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-primary text-sm"
                  onClick={() => handleExportAnalysis(analysis)}
                >
                  <FileDown className="h-4 w-4 mr-1" />
                  Export
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-error text-sm"
                  onClick={() => handleDeleteAnalysis(analysis.id)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="mb-2 text-sm text-gray-500">
                Generated with GPT-4o Mini • {format(new Date(analysis.createdAt), 'MMM d, yyyy')}
              </div>
              <div className="text-gray-800">
                {formatAnalysisContent(analysis.result)}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
