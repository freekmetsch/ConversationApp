import React, { useEffect, useState } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { useConversationsStore, selectSelectedConversation } from '@/store/conversationsStore';
import { formatTime } from '@/lib/audio';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, SkipBack, SkipForward, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PlayerState } from '@/lib/audio';

export function AudioPlayer() {
  const { toast } = useToast();
  const { setPlaybackState } = useSessionStore();
  const selectedConversation = selectSelectedConversation(useConversationsStore.getState());
  
  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  
  // Initialize the audio element
  useEffect(() => {
    const audioEl = document.createElement('audio');
    audioEl.style.display = 'none';
    document.body.appendChild(audioEl);
    
    // Handle metadata loading (duration, etc)
    audioEl.addEventListener('loadedmetadata', () => {
      const validDuration = isFinite(audioEl.duration) ? audioEl.duration : 0;
      setDuration(validDuration);
      updatePlaybackState(false, 0, validDuration);
    });
    
    // Handle time updates during playback
    audioEl.addEventListener('timeupdate', () => {
      setCurrentTime(audioEl.currentTime);
      const validDuration = isFinite(audioEl.duration) ? audioEl.duration : 0;
      updatePlaybackState(!audioEl.paused, audioEl.currentTime, validDuration);
    });
    
    // Handle play/pause state
    audioEl.addEventListener('play', () => setIsPlaying(true));
    audioEl.addEventListener('pause', () => setIsPlaying(false));
    
    // Handle playback end
    audioEl.addEventListener('ended', () => {
      setIsPlaying(false);
      setCurrentTime(0);
      const validDuration = isFinite(audioEl.duration) ? audioEl.duration : 0;
      updatePlaybackState(false, 0, validDuration);
    });
    
    // Handle errors
    audioEl.addEventListener('error', (e) => {
      console.error('Audio playback error:', e);
      setError('Failed to load audio file');
      setIsLoading(false);
      toast({
        title: 'Audio Error',
        description: 'Could not load or play the audio file. The file might be corrupted or in an unsupported format.',
        variant: 'destructive'
      });
    });
    
    setAudioElement(audioEl);
    
    // Cleanup on unmount
    return () => {
      audioEl.pause();
      audioEl.src = '';
      try {
        document.body.removeChild(audioEl);
      } catch (e) {
        // Element might already be removed
      }
    };
  }, []);
  
  // Helper function to update the global playback state
  const updatePlaybackState = (playing: boolean, time: number, audioDuration: number) => {
    setPlaybackState({
      isPlaying: playing,
      currentTime: time,
      duration: audioDuration
    });
  };
  
  // Load audio when conversation changes
  useEffect(() => {
    if (!audioElement || !selectedConversation?.audioPath) return;
    
    // Reset state
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setError(null);
    setIsLoading(true);
    
    // Add cache-busting parameter
    const timestamp = new Date().getTime();
    const audioUrl = `/api/audio/${selectedConversation.audioPath}?t=${timestamp}`;
    
    console.log("Loading audio from:", audioUrl);
    audioElement.src = audioUrl;
    
    try {
      audioElement.load();
      
      // Set a timeout to detect loading issues
      const timeoutId = setTimeout(() => {
        if (audioElement && audioElement.readyState === 0) {
          setError("Audio file is taking too long to load");
          setIsLoading(false);
        }
      }, 5000);
      
      // Handle successful audio load
      audioElement.addEventListener('loadeddata', () => {
        clearTimeout(timeoutId);
        console.log("Audio loaded successfully");
        
        // If duration is not available in metadata, estimate it
        if (!isFinite(audioElement.duration) || audioElement.duration === 0) {
          estimateDurationFromFileSize(audioUrl);
        } else {
          setIsLoading(false);
        }
      }, { once: true });
      
      return () => clearTimeout(timeoutId);
    } catch (err) {
      console.error("Error loading audio:", err);
      setError("Failed to load audio file");
      setIsLoading(false);
    }
  }, [selectedConversation, audioElement]);
  
  // Estimate duration from file size when metadata is not available
  const estimateDurationFromFileSize = (url: string) => {
    fetch(url, { method: 'HEAD' }).then(response => {
      const contentLength = response.headers.get('Content-Length');
      if (contentLength) {
        // Rough estimate based on 128 kbps audio
        const fileSizeInBytes = parseInt(contentLength, 10);
        const estimatedDuration = fileSizeInBytes / (128 * 1024 / 8);
        
        if (estimatedDuration > 0) {
          setDuration(estimatedDuration);
          updatePlaybackState(false, 0, estimatedDuration);
          console.log("Duration estimated from file size:", estimatedDuration);
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    }).catch(err => {
      console.warn("Could not estimate duration:", err);
      setIsLoading(false);
    });
  };
  
  // Update loading state based on duration
  useEffect(() => {
    if (duration > 0) {
      setIsLoading(false);
    }
  }, [duration]);
  
  // Player control functions
  const handlePlayPause = () => {
    if (!audioElement) return;
    
    if (isPlaying) {
      audioElement.pause();
    } else {
      const playPromise = audioElement.play();
      if (playPromise) {
        playPromise.catch(err => {
          console.error('Play error:', err);
          toast({
            title: 'Playback Error',
            description: 'Could not start playback. Try clicking the play button again.',
            variant: 'destructive'
          });
        });
      }
    }
  };
  
  const handleRewind = () => {
    if (!audioElement) return;
    audioElement.currentTime = Math.max(0, audioElement.currentTime - 5);
  };
  
  const handleForward = () => {
    if (!audioElement) return;
    audioElement.currentTime = Math.min(audioElement.duration || 0, audioElement.currentTime + 5);
  };
  
  const handleSeek = (value: number[]) => {
    if (!audioElement) return;
    audioElement.currentTime = value[0];
  };
  
  // Hide player if no conversation is selected
  if (!selectedConversation?.audioPath) {
    return null;
  }
  
  // Render player UI
  return (
    <div className="bg-gray-100 rounded-md p-4 mb-4">
      {error ? (
        <div className="flex items-center justify-center text-error p-2">
          <AlertCircle className="mr-2 h-5 w-5" />
          <span>{error}</span>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center p-2">
          <div className="animate-spin mr-2"><Loader2 className="h-5 w-5" /></div>
          <span className="text-gray-500">Loading audio...</span>
        </div>
      ) : (
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-700 hover:text-primary"
            onClick={handleRewind}
            disabled={!duration}
          >
            <SkipBack className="h-5 w-5" />
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            className="text-gray-700 hover:text-primary"
            onClick={handlePlayPause}
            disabled={!duration}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5" />
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-700 hover:text-primary"
            onClick={handleForward}
            disabled={!duration}
          >
            <SkipForward className="h-5 w-5" />
          </Button>
          
          <div className="flex-1 mx-2">
            <Slider
              value={[currentTime]}
              max={duration || 1}
              step={0.1}
              onValueChange={handleSeek}
              disabled={!duration}
            />
          </div>
          
          <div className="text-sm text-gray-600 font-mono min-w-[80px] text-right">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
      )}
    </div>
  );
}
