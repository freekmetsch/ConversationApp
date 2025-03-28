export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioBlob?: Blob;
  audioLevel?: number; // Audio level for visualization
}

export interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  [key: string]: any; // Allow for additional properties
}

// Voice-optimized Web Audio API recorder
class AudioRecorderService {
  // Web Audio API context
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  
  // Voice optimization filter nodes
  private highpassFilter: BiquadFilterNode | null = null;
  private lowpassFilter: BiquadFilterNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  
  // Recording state
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private startTime: number = 0;
  private pausedTime: number = 0;
  private updateCallback: ((state: RecordingState) => void) | null = null;
  private intervalId: number | null = null;
  private audioLevel: number = 0;
  private dataArray: Uint8Array | null = null;

  constructor() {
    this.reset();
  }

  private reset() {
    // Clean up existing resources
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    this.disposeAudioNodes();
    
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.startTime = 0;
    this.pausedTime = 0;
    this.audioLevel = 0;
    this.dataArray = null;
    
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  
  private disposeAudioNodes() {
    // Disconnect and clean up audio nodes to prevent memory leaks
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    
    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }
    
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    
    if (this.highpassFilter) {
      this.highpassFilter.disconnect();
      this.highpassFilter = null;
    }
    
    if (this.lowpassFilter) {
      this.lowpassFilter.disconnect();
      this.lowpassFilter = null;
    }
    
    if (this.compressorNode) {
      this.compressorNode.disconnect();
      this.compressorNode = null;
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      // We don't close the audio context as it may be reused
      // But we make sure to disconnect all nodes
    }
  }

  private updateState() {
    if (!this.updateCallback) return;
    
    this.updateAudioLevel();
    
    const isRecording = this.mediaRecorder !== null && this.mediaRecorder.state !== 'inactive';
    const isPaused = this.mediaRecorder !== null && this.mediaRecorder.state === 'paused';
    
    let duration = 0;
    if (this.startTime > 0) {
      if (isPaused) {
        duration = this.pausedTime;
      } else {
        duration = (Date.now() - this.startTime) / 1000;
      }
    }
    
    let audioBlob = undefined;
    if (this.audioChunks.length > 0) {
      audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
    }
    
    this.updateCallback({
      isRecording,
      isPaused,
      duration,
      audioBlob,
      audioLevel: this.audioLevel
    });
  }
  
  private updateAudioLevel() {
    if (!this.analyserNode || !this.dataArray) return;
    
    // Get the audio level data
    this.analyserNode.getByteFrequencyData(this.dataArray);
    
    // Calculate the average level from the frequency data
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    
    // Normalize to 0-1 range (dataArray values are 0-255)
    this.audioLevel = sum / (this.dataArray.length * 255);
  }

  public async start(onUpdate: (state: RecordingState) => void): Promise<void> {
    try {
      this.updateCallback = onUpdate;
      this.reset();
      
      // Request audio access with voice-optimized constraints
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1, // Mono recording for speech
          sampleRate: 44100, // CD quality, downsample if needed later
        }
      };
      
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Set up Web Audio API for processing and visualization
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
      
      // Create voice optimization filters
      // High-pass filter to remove low frequency noise (rumble, wind)
      this.highpassFilter = this.audioContext.createBiquadFilter();
      this.highpassFilter.type = 'highpass';
      this.highpassFilter.frequency.value = 85; // Hz - removes very low frequencies
      
      // Low-pass filter to smooth out high-frequency noise
      this.lowpassFilter = this.audioContext.createBiquadFilter();
      this.lowpassFilter.type = 'lowpass';
      this.lowpassFilter.frequency.value = 10000; // Hz - human voice generally < 8-10kHz
      
      // Compressor to even out volume and prevent clipping
      this.compressorNode = this.audioContext.createDynamicsCompressor();
      this.compressorNode.threshold.value = -24; // dB
      this.compressorNode.knee.value = 30; // dB
      this.compressorNode.ratio.value = 12; // compression ratio
      this.compressorNode.attack.value = 0.003; // seconds - fast attack for voice
      this.compressorNode.release.value = 0.25; // seconds - natural release
      
      // Set up analyzer for visualization
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
      
      // Connect the audio processing graph
      this.sourceNode.connect(this.highpassFilter);
      this.highpassFilter.connect(this.lowpassFilter);
      this.lowpassFilter.connect(this.compressorNode);
      this.compressorNode.connect(this.analyserNode);
      // Don't connect to destination - we're not playing back during recording
      
      // Create MediaRecorder with optimized settings
      const options = {
        mimeType: 'audio/webm;codecs=opus', // opus codec is great for voice
        audioBitsPerSecond: 128000 // 128kbps is good for voice quality
      };
      
      // Create a MediaStream from the processed audio
      // For this, we need to use a ScriptProcessor to capture post-processing audio
      this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      // Get processed audio data for the MediaRecorder
      const destination = this.audioContext.createMediaStreamDestination();
      this.compressorNode.connect(destination);
      
      // Create the MediaRecorder with the processed stream
      try {
        this.mediaRecorder = new MediaRecorder(destination.stream, options);
      } catch (e) {
        // Fallback for browsers that don't support the opus codec
        console.warn('Opus codec not supported, falling back to default codec');
        this.mediaRecorder = new MediaRecorder(destination.stream);
      }
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      
      this.mediaRecorder.onstop = () => {
        this.updateState();
        
        // Clean up resources when recording is complete
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
        }
        
        this.disposeAudioNodes();
      };
      
      // Start recording
      this.startTime = Date.now();
      this.mediaRecorder.start(1000); // Collect data every second
      
      // Update state regularly for visualization and UI updates
      this.intervalId = window.setInterval(() => this.updateState(), 100);
      this.updateState();
      
    } catch (error: unknown) {
      console.error('Error starting recording:', error);
      this.reset(); // Clean up any partial setup
      throw new Error(`Could not start recording: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public pause(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.pausedTime = (Date.now() - this.startTime) / 1000;
      this.updateState();
      
      // Also suspend the audio context to save resources
      if (this.audioContext && this.audioContext.state === 'running') {
        this.audioContext.suspend();
      }
    }
  }

  public resume(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      // Resume the audio context first
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      
      this.mediaRecorder.resume();
      this.startTime = Date.now() - (this.pausedTime * 1000);
      this.updateState();
    }
  }

  public stop(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      // updateState will be called in onstop handler
    }
  }

  public getAudioBlob(): Blob | null {
    if (this.audioChunks.length === 0) return null;
    
    // Convert to WAV format for compatibility
    return new Blob(this.audioChunks, { type: 'audio/wav' });
  }
}

class AudioPlayerService {
  private audio: HTMLAudioElement | null = null;
  private updateCallback: ((state: PlayerState) => void) | null = null;
  private intervalId: number | null = null;

  constructor() {
    this.reset();
  }

  private reset() {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
    }
    
    this.audio = new Audio();
    
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private updateState() {
    if (!this.updateCallback || !this.audio) return;
    
    this.updateCallback({
      isPlaying: !this.audio.paused,
      currentTime: this.audio.currentTime,
      duration: this.audio.duration || 0
    });
  }

  public load(audioBlob: Blob, onUpdate: (state: PlayerState) => void): void {
    this.reset();
    this.updateCallback = onUpdate;
    
    const audioUrl = URL.createObjectURL(audioBlob);
    this.audio = new Audio(audioUrl);
    
    this.audio.onloadedmetadata = () => this.updateState();
    this.audio.onended = () => this.updateState();
    
    // Update state regularly
    this.intervalId = window.setInterval(() => this.updateState(), 100);
    this.updateState();
  }

  public loadUrl(url: string, onUpdate: (state: PlayerState) => void): void {
    this.reset();
    this.updateCallback = onUpdate;
    
    this.audio = new Audio(url);
    
    this.audio.onloadedmetadata = () => this.updateState();
    this.audio.onended = () => this.updateState();
    
    // Update state regularly
    this.intervalId = window.setInterval(() => this.updateState(), 100);
    this.updateState();
  }

  public play(): void {
    if (this.audio) {
      this.audio.play()
        .catch(err => {
          console.error('Error playing audio:', err);
          // Provide a more descriptive error message to the user
          const errorMessage = err.name === 'NotAllowedError' 
            ? 'Playback was blocked by browser. User interaction required.' 
            : `Error playing audio: ${err.message || 'Unknown error'}`;
            
          // Create a custom event to notify components of the error
          const errorEvent = new CustomEvent('audio-player-error', { 
            detail: { message: errorMessage } 
          });
          document.dispatchEvent(errorEvent);
        });
      this.updateState();
    }
  }

  public pause(): void {
    if (this.audio) {
      this.audio.pause();
      this.updateState();
    }
  }

  public stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.updateState();
    }
  }

  public seek(time: number): void {
    if (this.audio) {
      this.audio.currentTime = Math.max(0, Math.min(time, this.audio.duration || 0));
      this.updateState();
    }
  }

  public rewind(seconds: number = 5): void {
    if (this.audio) {
      this.audio.currentTime = Math.max(0, this.audio.currentTime - seconds);
      this.updateState();
    }
  }

  public forward(seconds: number = 5): void {
    if (this.audio) {
      this.audio.currentTime = Math.min(this.audio.duration || 0, this.audio.currentTime + seconds);
      this.updateState();
    }
  }
}

export const audioRecorder = new AudioRecorderService();
export const audioPlayer = new AudioPlayerService();

// Helper function to format time in HH:MM:SS format for long recordings
export function formatTime(seconds: number): string {
  // Handle edge cases for invalid input values
  if (seconds === undefined || seconds === null || isNaN(seconds) || !isFinite(seconds)) {
    return "0:00";
  }
  
  // Ensure the value is positive
  seconds = Math.max(0, seconds);
  
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

// Helper function to create FormData from an audio blob
export function createAudioFormData(
  audioBlob: Blob, 
  filename: string = 'recording.wav',
  metadata: Record<string, any> = {}
): FormData {
  const formData = new FormData();
  formData.append('audio', audioBlob, filename);
  
  // Add metadata as form fields
  Object.entries(metadata).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (typeof value === 'object') {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, String(value));
      }
    }
  });
  
  return formData;
}
