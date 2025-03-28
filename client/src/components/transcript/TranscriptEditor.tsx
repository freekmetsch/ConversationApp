import React, { useState, useEffect, useCallback } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { useConversationsStore, selectSelectedConversation } from '@/store/conversationsStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { debounce } from 'lodash';
import { apiRequest } from '@/lib/queryClient';
import { transcribeConversation, updateTranscription } from '@/lib/openai';
import { queryClient } from '@/lib/queryClient';
import { Search, Edit, Printer, Loader2, RefreshCw } from 'lucide-react';
import { AudioPlayer } from '@/components/audio/AudioPlayer';

export function TranscriptEditor() {
  const { toast } = useToast();
  const { 
    isTranscribing, 
    transcriptSearchQuery, 
    setIsTranscribing,
    setTranscriptSearchQuery
  } = useSessionStore();
  
  const selectedConversation = selectSelectedConversation(useConversationsStore.getState());
  
  const [transcript, setTranscript] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [highlightedText, setHighlightedText] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Load transcript when conversation changes
  useEffect(() => {
    if (selectedConversation?.transcription?.text) {
      setTranscript(selectedConversation.transcription.text);
    } else {
      setTranscript('');
    }
  }, [selectedConversation]);
  
  // Effect for search highlighting
  useEffect(() => {
    if (!transcriptSearchQuery || transcriptSearchQuery.trim() === '') {
      setHighlightedText('');
      return;
    }
    
    setHighlightedText(transcriptSearchQuery.trim().toLowerCase());
  }, [transcriptSearchQuery]);
  
  // Add auto-refresh to check for transcription updates
  // This is especially useful when transcripts are being processed in the background
  const refreshTranscription = useCallback(async () => {
    if (!selectedConversation?.id || isEditing) return;
    
    setIsRefreshing(true);
    try {
      // Refresh the conversations data to get the latest transcription
      await queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      
      // The component will automatically update when the store is updated
      // due to the dependency on selectedConversation
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Failed to refresh transcription:", errorMessage);
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedConversation?.id, isEditing]);
  
  // Periodically check for transcription updates
  useEffect(() => {
    // Only poll if we have a selected conversation and it's missing a transcription
    // This avoids unnecessary polling for conversations that already have transcriptions
    if (!selectedConversation?.id || selectedConversation?.transcription || isEditing) {
      return;
    }
    
    // Check for updates every 5 seconds
    const intervalId = setInterval(() => {
      refreshTranscription();
    }, 5000);
    
    return () => clearInterval(intervalId);
  }, [selectedConversation?.id, selectedConversation?.transcription, isEditing, refreshTranscription]);
  
  // Handle transcript generation
  const handleGenerateTranscript = async () => {
    if (!selectedConversation) {
      toast({
        title: "No conversation selected",
        description: "Please select a conversation to transcribe.",
        variant: "destructive",
      });
      return;
    }
    
    setIsTranscribing(true);
    
    try {
      const result = await transcribeConversation(selectedConversation.id);
      setTranscript(result.text);
      
      // Update the conversations in the store
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      
      toast({
        title: "Transcription complete",
        description: "Your conversation has been transcribed successfully.",
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Failed to generate transcript:", error);
      toast({
        title: "Transcription failed",
        description: errorMessage || "Failed to generate transcript. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsTranscribing(false);
    }
  };
  
  // Handle transcript editing
  const handleEditTranscript = () => {
    setIsEditing(true);
  };
  
  // Save edited transcript
  const saveTranscript = async (text: string) => {
    if (!selectedConversation?.transcription?.id) return;
    
    setIsSaving(true);
    
    try {
      await updateTranscription(selectedConversation.transcription.id, text);
      
      // Update the conversations in the store
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      
      toast({
        title: "Transcript saved",
        description: "Your edits have been saved successfully.",
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Failed to save transcript:", error);
      toast({
        title: "Save failed",
        description: errorMessage || "Failed to save transcript. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Debounced save function for auto-saving while editing
  const debouncedSave = debounce(saveTranscript, 1000);
  
  // Handle transcript change
  const handleTranscriptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setTranscript(newText);
    debouncedSave(newText);
  };
  
  // Handle print transcript
  const handlePrintTranscript = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const studentName = selectedConversation?.student?.name || 'Unknown Student';
      const date = selectedConversation?.date 
        ? new Date(selectedConversation.date).toLocaleDateString() 
        : 'Unknown Date';
      // Check metadata safely - it might not have a class property
      const className = selectedConversation?.metadata ? 
        (selectedConversation.metadata as any)?.class || '' : '';
      const typeName = selectedConversation?.type?.name || 'Unknown Type';
      
      printWindow.document.write(`
        <html>
          <head>
            <title>Transcript - ${studentName}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 30px; }
              h1 { color: #2196F3; }
              .header { margin-bottom: 20px; }
              .meta { color: #757575; margin-bottom: 5px; }
              .transcript { line-height: 1.6; white-space: pre-wrap; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Coaching Conversation Transcript</h1>
              <div class="meta"><strong>Student:</strong> ${studentName}</div>
              <div class="meta"><strong>Date:</strong> ${date}</div>
              <div class="meta"><strong>Class:</strong> ${className}</div>
              <div class="meta"><strong>Type:</strong> ${typeName}</div>
            </div>
            <div class="transcript">${transcript}</div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };
  
  // Function to highlight search text
  const highlightSearchText = (text: string) => {
    if (!highlightedText) return text;
    
    const parts = text.split(new RegExp(`(${highlightedText})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === highlightedText.toLowerCase() 
        ? <span key={i} className="bg-yellow-100 px-0.5">{part}</span>
        : part
    );
  };
  
  // Parse transcript to show speaker labels and timestamps
  const renderTranscript = () => {
    if (!transcript) {
      return <div className="text-gray-500 italic">No transcript available.</div>;
    }
    
    // Very basic transcript parsing - this could be enhanced
    // to handle more structured transcript formats
    return transcript.split('\n').map((line, index) => {
      // Check for timestamps like [00:15]
      const timeMatch = line.match(/\[(\d{2}:\d{2})\]/);
      const time = timeMatch ? timeMatch[1] : null;
      
      // Check for speaker labels like "Coach:" or "Student:"
      const speakerMatch = line.match(/^(Coach|Student|Speaker \d+):/i);
      const speaker = speakerMatch ? speakerMatch[1] : null;
      
      // Format the line with the extracted information
      if (speaker) {
        const content = line.substring(speaker.length + 1).trim();
        return (
          <div key={index} className="flex mb-2">
            <div className="min-w-[80px] text-gray-500 text-sm">
              {time || `${Math.floor(index / 2)}:${(index % 2 * 30).toString().padStart(2, '0')}`}
            </div>
            <div className="flex-1">
              <p className="mb-1">
                <strong>{speaker}:</strong>{' '}
                {highlightSearchText(content)}
              </p>
            </div>
          </div>
        );
      }
      
      // For lines without explicit speaker labels
      return (
        <div key={index} className="flex mb-2">
          <div className="min-w-[80px] text-gray-500 text-sm">
            {time || ''}
          </div>
          <div className="flex-1">
            <p className="mb-1">{highlightSearchText(line)}</p>
          </div>
        </div>
      );
    });
  };
  
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium text-lg">Transcript</h3>
        <div className="flex space-x-2">
          {selectedConversation?.transcription ? (
            <>
              <Button 
                variant="ghost" 
                size="sm" 
                className="flex items-center text-primary hover:text-blue-700 text-sm"
                onClick={handleEditTranscript}
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="flex items-center text-primary hover:text-blue-700 text-sm"
                onClick={handlePrintTranscript}
              >
                <Printer className="h-4 w-4 mr-1" />
                Print
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="flex items-center text-primary hover:text-blue-700 text-sm"
                onClick={refreshTranscription}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="outline" 
                size="sm"
                className="flex items-center text-primary hover:text-blue-700 text-sm"
                onClick={handleGenerateTranscript}
                disabled={isTranscribing || !selectedConversation}
              >
                {isTranscribing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Transcribing...
                  </>
                ) : (
                  'Generate Transcript'
                )}
              </Button>
              {selectedConversation && !isTranscribing && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="flex items-center text-primary hover:text-blue-700 text-sm"
                  onClick={refreshTranscription}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              )}
            </>
          )}
          <div className="relative">
            <Input
              type="text"
              placeholder="Search in transcript..."
              className="px-3 py-1 text-sm w-48"
              value={transcriptSearchQuery}
              onChange={(e) => setTranscriptSearchQuery(e.target.value)}
            />
            <Search className="h-4 w-4 absolute right-3 top-2 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Audio player for the selected conversation */}
      {selectedConversation?.audioPath && (
        <div className="mb-4">
          <AudioPlayer />
        </div>
      )}

      <div className="border rounded-md p-4 max-h-[calc(100vh-350px)] overflow-y-auto">
        {isTranscribing ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            <p className="text-gray-600 mt-2">Transcribing audio...</p>
            <div className="w-full max-w-xs bg-gray-200 rounded-full h-2.5 mt-4">
              <div className="bg-primary h-2.5 rounded-full animate-pulse" style={{ width: '45%' }}></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">Using OpenAI Whisper API</p>
          </div>
        ) : isEditing ? (
          <div>
            <Textarea
              value={transcript}
              onChange={handleTranscriptChange}
              className="min-h-[300px] font-mono text-sm"
              placeholder="Edit transcript here..."
            />
            <div className="flex justify-between mt-2">
              <div className="text-xs text-gray-500">
                {isSaving ? 'Saving...' : 'Auto-saving enabled'}
              </div>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setIsEditing(false)}
              >
                Done Editing
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {renderTranscript()}
          </div>
        )}
      </div>
    </div>
  );
}
