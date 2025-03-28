import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useSessionStore } from '@/store/sessionStore';
import { useConversationsStore } from '@/store/conversationsStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { 
  audioRecorder, 
  audioPlayer, 
  formatTime, 
  createAudioFormData,
  RecordingState, 
  PlayerState 
} from '@/lib/audio';
import { apiRequest } from '@/lib/queryClient';
import { 
  Play, 
  Pause, 
  Square, 
  Rewind, 
  FastForward, 
  Mic, 
  Upload, 
  Loader2,
  Plus
} from 'lucide-react';
import { queryClient } from '@/lib/queryClient';
import { format } from 'date-fns';

export function AudioRecorder() {
  const { toast } = useToast();
  
  // Access stores
  const { 
    currentSessionData, 
    recordingState, 
    playbackState,
    setRecordingState, 
    setPlaybackState,
    setIsTranscribing,
    resetSession,
    addToTranscriptionQueue,
    updateTranscriptionQueueItem
  } = useSessionStore();
  
  const { addConversation } = useConversationsStore();
  
  // Local states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [conversationTypes, setConversationTypes] = useState([]);
  const [students, setStudents] = useState([]);
  
  // Handle recording state update
  const handleRecordingUpdate = useCallback((state: RecordingState) => {
    setRecordingState(state);
  }, [setRecordingState]);
  
  // Handle playback state update
  const handlePlaybackUpdate = useCallback((state: PlayerState) => {
    setPlaybackState(state);
  }, [setPlaybackState]);
  
  // Start recording
  const handleStartRecording = async () => {
    try {
      await audioRecorder.start(handleRecordingUpdate);
      toast({
        title: "Recording started",
        description: "Your audio is now being recorded.",
      });
    } catch (error) {
      console.error("Failed to start recording:", error);
      toast({
        title: "Recording failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };
  
  // Pause recording
  const handlePauseRecording = () => {
    if (recordingState.isPaused) {
      audioRecorder.resume();
    } else {
      audioRecorder.pause();
    }
  };
  
  // Stop recording
  const handleStopRecording = () => {
    audioRecorder.stop();
    
    // If we have an audio blob, load it for playback
    if (recordingState.audioBlob) {
      audioPlayer.load(recordingState.audioBlob, handlePlaybackUpdate);
    }
  };
  
  // Play audio
  const handlePlayAudio = () => {
    if (playbackState.isPlaying) {
      audioPlayer.pause();
    } else {
      audioPlayer.play();
    }
  };
  
  // Stop audio playback
  const handleStopAudio = () => {
    audioPlayer.stop();
  };
  
  // Rewind audio
  const handleRewindAudio = () => {
    audioPlayer.rewind();
  };
  
  // Fast forward audio
  const handleForwardAudio = () => {
    audioPlayer.forward();
  };
  
  // Save the recording
  const handleSaveRecording = async () => {
    if (!recordingState.audioBlob) {
      toast({
        title: "No recording available",
        description: "Please record or import audio first.",
        variant: "destructive",
      });
      return;
    }
    
    if (!currentSessionData.studentName) {
      toast({
        title: "Student name required",
        description: "Please enter a student name.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Find or create the student
      let studentId = null;
      
      // Check if student exists
      const studentResponse = await fetch(`/api/students?name=${encodeURIComponent(currentSessionData.studentName)}`);
      let student = await studentResponse.json();
      
      if (!Array.isArray(student) || student.length === 0) {
        // Create a new student
        const createStudentResponse = await apiRequest(
          "POST",
          "/api/students",
          { name: currentSessionData.studentName }
        );
        student = await createStudentResponse.json();
        studentId = student.id;
      } else {
        studentId = student[0].id;
      }
      
      // Create form data with the audio and metadata
      const formData = new FormData();
      formData.append('audio', recordingState.audioBlob, 'recording.wav');
      formData.append('studentId', String(studentId));
      formData.append('typeId', currentSessionData.conversationTypeId ? String(currentSessionData.conversationTypeId) : '');
      formData.append('date', currentSessionData.date);
      formData.append('metadata', JSON.stringify({})); // No longer storing class information
      
      // Submit the form data
      const response = await fetch('/api/conversations', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save recording: ${response.statusText}`);
      }
      
      const conversation = await response.json();
      
      // Add the conversation to the store
      addConversation(conversation);
      
      // Add to transcription queue instead of transcribing immediately
      addToTranscriptionQueue({
        conversationId: conversation.id,
        audioPath: conversation.audioPath
      });
      
      // Start processing the queue in the background
      toast({
        title: "Added to transcription queue",
        description: "Your recording will be transcribed in the background.",
      });
      
      // Process transcription in the background
      updateTranscriptionQueueItem(conversation.id, { status: 'processing' });
      
      // Start transcription in the background without waiting for it to complete
      // This allows the UI to remain responsive
      apiRequest(
        "POST",
        `/api/conversations/${conversation.id}/transcribe`,
        {}
      )
      .then(response => {
        if (!response.ok) {
          updateTranscriptionQueueItem(conversation.id, { 
            status: 'failed',
            error: `Failed to transcribe: ${response.statusText}`
          });
          console.error(`Failed to transcribe recording: ${response.statusText}`);
          toast({
            title: "Transcription failed",
            description: `The recording was saved but transcription failed: ${response.statusText}`,
            variant: "destructive",
          });
        } else {
          // Mark as completed in the queue
          updateTranscriptionQueueItem(conversation.id, { status: 'completed' });
          toast({
            title: "Transcription completed",
            description: "Your conversation has been transcribed.",
          });
        }
      })
      .catch(error => {
        updateTranscriptionQueueItem(conversation.id, { 
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        console.error("Transcription error:", error);
      });
      
      // Invalidate conversations query to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      
      // This is a radically different approach - instead of calling internal store methods
      // we'll reset the entire store state with a forceful approach
      
      // First reset the session using the store method
      resetSession();
      
      // Force a complete reset of the session data
      // We need to use both approaches to ensure the state is completely reset
      
      // 1. Direct state update through the store's setState method
      useSessionStore.setState(state => ({
        ...state,
        currentSessionData: {
          studentName: "",
          class: "",
          conversationTypeId: null,
          date: format(new Date(), 'yyyy-MM-dd')
        }
      }));
      
      // 2. Update through the store's action
      const store = useSessionStore.getState();
      store.updateSessionData({
        studentName: "",
        class: "",
        conversationTypeId: null,
        date: format(new Date(), 'yyyy-MM-dd')
      });
      
      // 3. Force DOM update with a timeout
      setTimeout(() => {
        // Clear the student name field directly
        const studentNameInput = document.querySelector('input[placeholder="Enter name..."]');
        if (studentNameInput instanceof HTMLInputElement) {
          studentNameInput.value = "";
          // Trigger a change event to ensure React state is updated
          const event = new Event('input', { bubbles: true });
          studentNameInput.dispatchEvent(event);
        }
      }, 50);
      
      toast({
        title: "Recording saved and transcribed",
        description: "Your coaching conversation has been saved successfully.",
      });
    } catch (error) {
      console.error("Failed to save recording:", error);
      toast({
        title: "Failed to save recording",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setIsTranscribing(false);
    }
  };
  
  // Handle file drop
  const handleFileDrop = async (files: FileList) => {
    if (files.length === 0) return;
    
    // Count valid audio files
    let validFiles = 0;
    for (let i = 0; i < files.length; i++) {
      if (files[i].type.startsWith('audio/')) {
        validFiles++;
      }
    }
    
    // Process the first file for immediate playback, queue the rest
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Check if file is audio
      if (!file.type.startsWith('audio/')) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not an audio file. Skipping.`,
          variant: "destructive",
        });
        continue;
      }
      
      try {
        // Convert File to Blob
        const blob = new Blob([await file.arrayBuffer()], { type: file.type });
        
        // Only set the first file for recording state/playback
        if (i === 0) {
          // Update recording state
          setRecordingState({
            isRecording: false,
            isPaused: false,
            duration: 0, // This will be updated when the audio is loaded
            audioBlob: blob,
          });
          
          // Load the file for playback
          audioPlayer.load(blob, handlePlaybackUpdate);
          
          toast({
            title: "Audio imported",
            description: `${file.name} has been imported successfully.`,
          });
        } else {
          // For additional files, notify the user they'll be queued after saving
          toast({
            title: "Multiple files detected",
            description: `${file.name} will be processed after you save the current recording.`,
          });
        }
      } catch (error) {
        console.error("Failed to import audio:", error);
        toast({
          title: "Failed to import audio",
          description: error instanceof Error ? error.message : "Unknown error occurred",
          variant: "destructive",
        });
      }
    }
    
    // Notify the user of the multi-file upload if there are multiple valid files
    if (validFiles > 1) {
      toast({
        title: "Multiple audio files",
        description: `${validFiles} audio files imported. First file loaded for editing, others will be queued for processing.`,
      });
    }
  };
  
  // Handle drag and drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };
  
  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    handleFileDrop(e.dataTransfer.files);
  };
  
  // File input change handler
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileDrop(e.target.files);
    }
  };
  
  // Fetch conversation types and students
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch conversation types
        const typesResponse = await fetch('/api/conversation-types');
        if (typesResponse.ok) {
          const types = await typesResponse.json();
          setConversationTypes(types);
        }
        
        // Fetch students
        const studentsResponse = await fetch('/api/students');
        if (studentsResponse.ok) {
          const students = await studentsResponse.json();
          setStudents(students);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    };
    
    fetchData();
  }, []);
  
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <h2 className="text-xl font-medium">Recording Session</h2>
          {recordingState.isRecording && (
            <span className="animate-pulse bg-error px-2 py-0.5 text-white text-xs rounded-full">
              RECORDING
            </span>
          )}
        </div>
      </div>

      {/* Metadata Form */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Student Name</label>
          <Input
            type="text"
            placeholder="Enter name..."
            value={currentSessionData.studentName}
            onChange={(e) => useSessionStore.setState(state => ({
              currentSessionData: { ...state.currentSessionData, studentName: e.target.value }
            }))}
            list="student-suggestions"
          />
          <datalist id="student-suggestions">
            {students.map((student: any) => (
              <option key={student.id} value={student.name} />
            ))}
          </datalist>
        </div>
        <div className="col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Conversation Type</label>
          <Select
            value={currentSessionData.conversationTypeId ? String(currentSessionData.conversationTypeId) : ""}
            onValueChange={(value) => useSessionStore.setState(state => ({
              currentSessionData: { 
                ...state.currentSessionData, 
                conversationTypeId: value ? parseInt(value) : null 
              }
            }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type..." />
            </SelectTrigger>
            <SelectContent>
              {conversationTypes.map((type: any) => (
                <SelectItem key={type.id} value={String(type.id)}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <Input
            type="date"
            value={currentSessionData.date}
            onChange={(e) => useSessionStore.setState(state => ({
              currentSessionData: { ...state.currentSessionData, date: e.target.value }
            }))}
          />
        </div>
      </div>

      {/* Audio Visualization and Controls */}
      <div className="bg-gray-100 rounded-md p-4 mb-4">
        <div className="h-24 flex items-center justify-center mb-4 relative">
          {/* Audio waveform visualization (placeholder) */}
          <div className="w-full h-16 bg-gradient-to-b from-blue-800 to-primary flex items-center justify-center rounded-md">
            {!recordingState.audioBlob && !recordingState.isRecording ? (
              <div className="text-white flex items-center">
                <Plus className="h-5 w-5 mr-2" />
                Record or import audio to begin
              </div>
            ) : (
              <div className="flex space-x-1 items-center justify-center w-full">
                {/* Audio level-based visualization bars */}
                {Array.from({ length: 40 }).map((_, i) => {
                  // Calculate dynamic height based on real audio level
                  // Create a more realistic waveform pattern with center emphasis
                  const barPosition = Math.abs((i - 20) / 20); // 0 at center, 1 at edges
                  const baseHeight = 20; // Minimum height
                  
                  // When recording, use actual audio level data
                  // When playing back a recording, use a pre-recorded pattern
                  const heightMultiplier = recordingState.isRecording && typeof recordingState.audioLevel === 'number'
                    ? recordingState.audioLevel * 100 // Scale 0-1 to 0-100
                    : (playbackState.isPlaying ? (Math.sin(Date.now() / 100 + i) + 1) * 30 : 30);
                    
                  // Apply a curve that's higher in the middle (for voice frequencies)
                  const dynamicHeight = baseHeight + heightMultiplier * (1 - barPosition * 0.8);
                  
                  return (
                    <div 
                      key={i} 
                      className="bg-white w-1 rounded-md transition-all duration-75"
                      style={{ 
                        height: `${dynamicHeight}%`,
                        opacity: recordingState.isRecording || playbackState.isPlaying ? 1 : 0.6,
                        transform: `scaleY(${recordingState.isRecording || playbackState.isPlaying ? 1 : 0.8})`,
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Time indicators */}
          <div className="absolute bottom-0 left-0 w-full flex justify-between text-xs text-gray-600 px-2">
            <span>
              {recordingState.isRecording || playbackState.isPlaying
                ? formatTime(playbackState.isPlaying ? playbackState.currentTime : recordingState.duration)
                : '0:00'}
            </span>
            <span>
              {playbackState.duration > 0 
                ? formatTime(playbackState.duration) 
                : '2:00:00'}
            </span>
          </div>
        </div>
        
        {/* Recording Controls */}
        <div className="flex justify-center space-x-6">
          <Button
            variant="ghost"
            size="icon"
            className="flex flex-col items-center text-gray-600 hover:text-primary transition-colors focus:outline-none"
            onClick={handlePlayAudio}
            disabled={!recordingState.audioBlob || recordingState.isRecording}
          >
            <div className="bg-white p-3 rounded-full shadow-sm hover:shadow">
              {playbackState.isPlaying ? (
                <Pause className="h-6 w-6" />
              ) : (
                <Play className="h-6 w-6" />
              )}
            </div>
            <span className="text-xs mt-1">{playbackState.isPlaying ? 'Pause' : 'Play'}</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="flex flex-col items-center text-gray-600 hover:text-error transition-colors focus:outline-none"
            onClick={recordingState.isRecording ? handlePauseRecording : handleStartRecording}
            disabled={playbackState.isPlaying}
          >
            <div className="bg-white p-3 rounded-full shadow-sm hover:shadow">
              <Mic className="h-6 w-6" />
            </div>
            <span className="text-xs mt-1">
              {recordingState.isRecording 
                ? (recordingState.isPaused ? 'Resume' : 'Pause') 
                : 'Record'}
            </span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="flex flex-col items-center text-gray-600 hover:text-gray-800 transition-colors focus:outline-none"
            onClick={handleStopRecording}
            disabled={!recordingState.isRecording}
          >
            <div className="bg-white p-3 rounded-full shadow-sm hover:shadow">
              <Square className="h-6 w-6" />
            </div>
            <span className="text-xs mt-1">Stop</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="flex flex-col items-center text-gray-600 hover:text-gray-800 transition-colors focus:outline-none"
            onClick={handleRewindAudio}
            disabled={!recordingState.audioBlob || recordingState.isRecording || playbackState.currentTime === 0}
          >
            <div className="bg-white p-3 rounded-full shadow-sm hover:shadow">
              <Rewind className="h-6 w-6" />
            </div>
            <span className="text-xs mt-1">Rewind</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="flex flex-col items-center text-gray-600 hover:text-gray-800 transition-colors focus:outline-none"
            onClick={handleForwardAudio}
            disabled={!recordingState.audioBlob || recordingState.isRecording || 
              (playbackState.currentTime >= playbackState.duration && playbackState.duration > 0)}
          >
            <div className="bg-white p-3 rounded-full shadow-sm hover:shadow">
              <FastForward className="h-6 w-6" />
            </div>
            <span className="text-xs mt-1">Forward</span>
          </Button>
        </div>
        
        {/* Save Button */}
        {recordingState.audioBlob && !recordingState.isRecording && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="default"
              className="bg-primary hover:bg-blue-600 text-white"
              onClick={handleSaveRecording}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Recording'
              )}
            </Button>
          </div>
        )}
      </div>
      
      {/* Drag & Drop Import Area */}
      <div
        className={`border-2 border-dashed rounded-md p-6 text-center transition-colors ${
          isDraggingOver ? 'border-primary bg-blue-50' : 'border-gray-300'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="audio-file-input"
          className="hidden"
          accept="audio/mpeg,audio/wav,audio/mp4"
          onChange={handleFileInputChange}
        />
        <label htmlFor="audio-file-input" className="cursor-pointer">
          <Upload className="h-10 w-10 mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-600 mb-1">Drag and drop audio files here</p>
          <p className="text-xs text-gray-500">Supports MP3, WAV, and M4A</p>
        </label>
      </div>
    </div>
  );
}
