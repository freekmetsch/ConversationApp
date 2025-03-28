import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useConversationsStore, selectFilteredConversations } from '@/store/conversationsStore';
import { useSessionStore } from '@/store/sessionStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ConversationType } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';

export function ConversationList() {
  const { toast } = useToast();
  
  const { 
    conversations, 
    isLoading, 
    selectedConversationId, 
    searchQuery,
    selectedTypeId,
    setConversations, 
    setIsLoading, 
    setSelectedConversationId,
    setSearchQuery,
    setSelectedTypeId
  } = useConversationsStore();
  
  const { setActiveTab, setCurrentConversation } = useSessionStore();
  
  // Fetch conversations
  const { data: conversationsData, isLoading: isLoadingConversations } = useQuery({
    queryKey: ['/api/conversations'],
    queryFn: async () => {
      setIsLoading(true);
      const response = await fetch('/api/conversations');
      if (!response.ok) throw new Error('Failed to fetch conversations');
      return await response.json();
    },
  });
  
  // Fetch conversation types
  const { data: conversationTypes } = useQuery({
    queryKey: ['/api/conversation-types'],
    queryFn: async () => {
      const response = await fetch('/api/conversation-types');
      if (!response.ok) throw new Error('Failed to fetch conversation types');
      return await response.json();
    },
  });
  
  // Update conversations when data is loaded
  useEffect(() => {
    if (conversationsData) {
      setConversations(conversationsData);
      setIsLoading(false);
    }
  }, [conversationsData, setConversations, setIsLoading]);
  
  // Handle conversation selection
  const handleSelectConversation = (id: number) => {
    setSelectedConversationId(id);
    
    // Find the selected conversation and set it as the current conversation
    const selectedConversation = conversations.find(conv => conv.id === id);
    if (selectedConversation) {
      setCurrentConversation(selectedConversation);
      setActiveTab('transcript');
    }
  };
  
  // Get filtered conversations
  const filteredConversations = selectFilteredConversations(useConversationsStore.getState());
  
  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <div className="relative">
          <Input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-10"
          />
          <Search className="h-5 w-5 absolute right-3 top-2.5 text-gray-400" />
        </div>
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-600">Filter by:</label>
          <Select
            value={selectedTypeId ? String(selectedTypeId) : "all"}
            onValueChange={(value) => setSelectedTypeId(value === "all" ? null : parseInt(value))}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {conversationTypes?.map((type: ConversationType) => (
                <SelectItem key={type.id} value={String(type.id)}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="overflow-y-auto flex-1">
        {isLoading || isLoadingConversations ? (
          // Loading skeletons
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="mb-3">
              <CardContent className="p-3">
                <div className="flex justify-between items-center mb-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="flex items-center">
                  <Skeleton className="h-4 w-20" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredConversations.length === 0 ? (
          <div className="text-center text-gray-500 py-4">
            No conversations found
          </div>
        ) : (
          // Conversation list
          filteredConversations.map((conversation) => {
            // Format the date
            const formattedDate = conversation.date 
              ? format(new Date(conversation.date), 'MMM d, yyyy')
              : 'Unknown date';
            
            // Determine badge color based on conversation type
            let badgeColorClass = 'bg-blue-100 text-primary';
            if (conversation.type?.name === 'Feedback') {
              badgeColorClass = 'bg-green-100 text-secondary';
            } else if (conversation.type?.name === 'Performance Review') {
              badgeColorClass = 'bg-orange-100 text-accent';
            }
            
            return (
              <Card 
                key={conversation.id} 
                className={`hover:bg-gray-50 p-3 rounded-md border cursor-pointer mb-3 ${
                  selectedConversationId === conversation.id ? 'border-primary ring-1 ring-primary' : ''
                }`}
                onClick={() => handleSelectConversation(conversation.id)}
              >
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium text-base">{conversation.student?.name || 'Unknown Student'}</h4>
                  <span className="text-xs text-gray-500">{formattedDate}</span>
                </div>
                <div className="flex items-center">
                  {conversation.type && (
                    <span className={`px-2 py-0.5 ${badgeColorClass} rounded-full text-xs`}>
                      {conversation.type.name}
                    </span>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
