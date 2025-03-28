import React, { useEffect } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { useConversationsStore } from '@/store/conversationsStore';
import { Loader2, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { queryClient } from '@/lib/queryClient';

export function TranscriptionQueue() {
  const { transcriptionQueue, removeFromTranscriptionQueue, updateTranscriptionQueueItem } = useSessionStore();
  const { conversations } = useConversationsStore();
  
  // Monitor the queue for completed items and trigger a refresh
  useEffect(() => {
    // Check if any items have completed status
    const completedItems = transcriptionQueue.filter(item => item.status === 'completed');
    if (completedItems.length > 0) {
      // Refresh the data to show the updated transcriptions
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      
      // Mark them as seen so we don't refresh repeatedly
      completedItems.forEach(item => {
        // Remove the item from the queue after a delay to give user time to see the confirmation
        setTimeout(() => {
          removeFromTranscriptionQueue(item.conversationId);
        }, 5000);
      });
    }
  }, [transcriptionQueue, removeFromTranscriptionQueue]);
  
  if (transcriptionQueue.length === 0) {
    return null;
  }
  
  // Map conversation IDs to names for better display
  const getConversationName = (conversationId: number) => {
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation?.student?.name) {
      return conversation.student.name;
    }
    return `Conversation #${conversationId}`;
  };
  
  return (
    <div className="mb-4 bg-gray-50 border rounded-md p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium flex items-center">
          <Clock className="h-4 w-4 mr-1" />
          Transcription Queue ({transcriptionQueue.length})
        </h3>
        
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 w-6 p-0"
          onClick={() => {
            // Refresh all conversations data
            queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
          }}
          title="Refresh transcription status"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>
      
      <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
        {transcriptionQueue.map((item) => (
          <div 
            key={item.conversationId} 
            className="flex items-center justify-between bg-white p-2 rounded text-xs border"
          >
            <div className="flex items-center">
              {item.status === 'pending' && (
                <Clock className="h-3 w-3 text-gray-500 mr-2" />
              )}
              {item.status === 'processing' && (
                <Loader2 className="h-3 w-3 text-blue-500 animate-spin mr-2" />
              )}
              {item.status === 'completed' && (
                <CheckCircle className="h-3 w-3 text-green-500 mr-2" />
              )}
              {item.status === 'failed' && (
                <XCircle className="h-3 w-3 text-red-500 mr-2" />
              )}
              
              <span className="truncate max-w-[150px]">
                {getConversationName(item.conversationId)}
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Badge 
                variant={
                  item.status === 'completed' ? 'default' : 
                  item.status === 'processing' ? 'secondary' :
                  item.status === 'failed' ? 'destructive' : 'outline'
                }
                className="text-[10px] py-0 px-1"
              >
                {item.status}
              </Badge>
              
              {(item.status === 'completed' || item.status === 'failed') && (
                <button 
                  className="text-gray-400 hover:text-gray-600"
                  onClick={() => removeFromTranscriptionQueue(item.conversationId)}
                  title="Remove from queue"
                >
                  &times;
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}