import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConversationList } from '@/components/sidebar/ConversationList';
import { AudioRecorder } from '@/components/audio/AudioRecorder';
import { TranscriptEditor } from '@/components/transcript/TranscriptEditor';
import { TranscriptionQueue } from '@/components/transcript/TranscriptionQueue';
import { PromptManager } from '@/components/analysis/PromptManager';
import { AnalysisResults } from '@/components/analysis/AnalysisResults';
import { ConversationTypeManager } from '@/components/settings/ConversationTypeManager';
import { useSessionStore } from '@/store/sessionStore';
import { useConversationsStore, selectSelectedConversation } from '@/store/conversationsStore';
import { Settings, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

export default function Dashboard() {
  const { toast } = useToast();
  const { activeTab, setActiveTab } = useSessionStore();
  const selectedConversation = selectSelectedConversation(useConversationsStore.getState());
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    audioStoragePath: './audio_files',
    openaiApiKey: '',
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Load user preferences
  React.useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const response = await fetch('/api/preferences');
        if (response.ok) {
          const prefs = await response.json();
          setSettings({
            audioStoragePath: prefs.audioStoragePath || './audio_files',
            openaiApiKey: prefs.apiKeys?.openai || '',
          });
        }
      } catch (error) {
        console.error('Failed to fetch preferences:', error);
      }
    };
    
    fetchPreferences();
  }, []);

  // Handle settings update
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const response = await apiRequest('PUT', '/api/preferences', {
        audioStoragePath: settings.audioStoragePath,
        apiKeys: {
          openai: settings.openaiApiKey,
        },
      });
      
      if (response.ok) {
        toast({
          title: 'Settings saved',
          description: 'Your settings have been updated successfully.',
        });
        setIsSettingsOpen(false);
      }
    } catch (error: unknown) {
      console.error('Failed to save settings:', error);
      toast({
        title: 'Failed to save settings',
        description: error instanceof Error ? error.message : 'An error occurred while saving settings.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="bg-white shadow-sm py-3 px-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
            <h1 className="text-xl font-medium text-textPrimary">Coaching Conversation Manager</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Button 
              variant="default" 
              size="sm" 
              className="text-white bg-primary hover:bg-primary/90 flex items-center px-3 py-1" 
              onClick={() => {
                // Reset selected conversation
                useConversationsStore.getState().setSelectedConversationId(null);
                
                // Reset session
                const sessionStore = useSessionStore.getState();
                sessionStore.resetSession();
                sessionStore.setActiveTab('transcript');
                sessionStore.setCurrentConversation(null);
                
                // Update URL to home
                window.history.pushState({}, '', '/');
                
                // Use Toast to confirm action to user
                toast({
                  title: "Starting new recording session",
                  description: "Ready to record a new conversation"
                });
                
                // Force focus on the student name field after a short delay
                setTimeout(() => {
                  const studentNameInput = document.querySelector('input[placeholder="Enter name..."]');
                  if (studentNameInput instanceof HTMLInputElement) {
                    studentNameInput.focus();
                  }
                }, 100);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Start New Conversation
            </Button>
            
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" className="flex items-center text-textSecondary hover:text-primary transition-colors">
                  <Settings className="h-5 w-5 mr-1" />
                  Settings
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[800px]">
                <DialogHeader>
                  <DialogTitle>Application Settings</DialogTitle>
                </DialogHeader>
                
                <div className="flex flex-col gap-6">
                  {/* System Settings Section */}
                  <div>
                    <h3 className="text-lg font-medium mb-3">System Settings</h3>
                    <div className="grid gap-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <label className="text-right text-sm font-medium col-span-1">
                          Storage Path
                        </label>
                        <Input
                          id="audioStoragePath"
                          value={settings.audioStoragePath}
                          onChange={(e) => setSettings({ ...settings, audioStoragePath: e.target.value })}
                          className="col-span-3"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <label className="text-right text-sm font-medium col-span-1">
                          OpenAI API Key
                        </label>
                        <Input
                          id="openaiApiKey"
                          type="password"
                          value={settings.openaiApiKey}
                          onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
                          className="col-span-3"
                          placeholder="sk-..."
                        />
                      </div>
                    </div>
                    <div className="flex justify-end mt-4">
                      <Button onClick={handleSaveSettings} disabled={isSavingSettings}>
                        {isSavingSettings ? 'Saving...' : 'Save Settings'}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Conversation Types Section */}
                  <div className="border-t pt-6">
                    <ConversationTypeManager />
                  </div>
                </div>
              </DialogContent>
            </Dialog>

          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-1/5 bg-white border-r overflow-y-auto p-4 flex flex-col">
          <ConversationList />
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto">
          {/* Recording Controls Section */}
          <div className="border-b bg-white p-4">
            {selectedConversation ? (
              <div className="bg-gray-100 rounded-md p-4 mb-2">
                <h2 className="text-xl font-medium mb-2">Selected Conversation</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Student:</p>
                    <p>{selectedConversation.student?.name || 'Unknown Student'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Recorded:</p>
                    <p>{new Date(selectedConversation.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Type:</p>
                    <p>{selectedConversation.type?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Date:</p>
                    <p>{selectedConversation.date 
                      ? new Date(selectedConversation.date).toLocaleDateString() 
                      : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <AudioRecorder />
            )}
          </div>

          {/* Tabs for Content Area */}
          <div className="bg-gray-50">
            <div className="px-4 border-b bg-white">
              <Tabs 
                value={activeTab} 
                onValueChange={(value) => {
                  // Prevent default behavior to avoid screen jump
                  setActiveTab(value as 'transcript' | 'analysis');
                }}
                className="w-full"
              >
                <TabsList>
                  <TabsTrigger value="transcript" onClick={(e) => e.preventDefault()}>Transcript</TabsTrigger>
                  <TabsTrigger value="analysis" onClick={(e) => e.preventDefault()}>Analysis</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="p-4">
              {/* Display transcription queue regardless of active tab */}
              <TranscriptionQueue />
              
              {activeTab === 'transcript' ? (
                <div className="bg-white rounded-md shadow-sm p-4">
                  <TranscriptEditor />
                </div>
              ) : (
                <div className="bg-white rounded-md shadow-sm p-4">
                  <div className="grid grid-cols-1 gap-4">
                    <PromptManager />
                    <AnalysisResults />
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
