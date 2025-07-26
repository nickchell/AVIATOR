// Audio Manager for instant sound playback
// Uses Web Audio API for low-latency audio without <audio> tags

class AudioManager {
  private audioContext: AudioContext | null = null;
  private crashBuffer: AudioBuffer | null = null;
  private isInitialized = false;
  private isUnlocked = false;
  private fallbackAudio: HTMLAudioElement | null = null;

  // Initialize audio context and load sounds
  async init(): Promise<void> {
    try {
      // Create audio context with proper browser compatibility
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Load crash sound
      await this.loadCrashSound();
      
      this.isInitialized = true;
      console.log('AudioManager: Initialized successfully');
    } catch (error) {
      console.error('AudioManager: Failed to initialize Web Audio API, falling back to HTML audio', error);
      // Fallback to HTML audio
      this.initFallbackAudio();
    }
  }

  // Initialize fallback HTML audio
  private initFallbackAudio(): void {
    try {
      this.fallbackAudio = new Audio('/crash.mp3');
      this.fallbackAudio.preload = 'auto';
      this.isInitialized = true;
      this.isUnlocked = true;
      console.log('AudioManager: Fallback HTML audio initialized');
    } catch (error) {
      console.error('AudioManager: Failed to initialize fallback audio', error);
    }
  }

  // Load crash sound into audio buffer
  private async loadCrashSound(): Promise<void> {
    try {
      // Try multiple paths and formats
      const audioPaths = [
        '/crash.mp3',
        '/public/crash.mp3',
        './crash.mp3'
      ];

      let response: Response | null = null;
      let audioPath: string | null = null;

      for (const path of audioPaths) {
        try {
          response = await fetch(path);
          if (response.ok) {
            audioPath = path;
            break;
          }
        } catch (e) {
          console.warn(`AudioManager: Failed to fetch ${path}`, e);
        }
      }

      if (!response || !response.ok || !audioPath) {
        throw new Error('Failed to fetch crash sound from any path');
      }
      
      const arrayBuffer = await response.arrayBuffer();
      this.crashBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
      console.log('AudioManager: Crash sound loaded successfully from', audioPath);
    } catch (error) {
      console.error('AudioManager: Failed to load crash sound', error);
      throw error; // Re-throw to trigger fallback
    }
  }

  // Unlock audio context on first user interaction
  unlockAudio(): void {
    if (this.fallbackAudio) {
      // HTML audio doesn't need unlocking
      return;
    }

    if (!this.audioContext || this.isUnlocked) return;

    try {
      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      // Create a silent buffer to unlock audio
      const buffer = this.audioContext.createBuffer(1, 1, 22050);
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.start(0);
      source.stop(0.001);

      this.isUnlocked = true;
      console.log('AudioManager: Audio unlocked successfully');
    } catch (error) {
      console.error('AudioManager: Failed to unlock audio', error);
    }
  }

  // Play crash sound instantly
  playCrashSound(): void {
    if (!this.isInitialized) {
      console.warn('AudioManager: Cannot play crash sound - not initialized');
      return;
    }

    try {
      if (this.fallbackAudio) {
        // Use HTML audio fallback
        this.fallbackAudio.currentTime = 0;
        this.fallbackAudio.play().then(() => {
          console.log('AudioManager: Crash sound played successfully via HTML audio fallback');
        }).catch((error) => {
          console.error('AudioManager: Failed to play fallback audio', error);
        });
        return;
      }

      if (!this.isUnlocked || !this.audioContext || !this.crashBuffer) {
        console.warn('AudioManager: Cannot play crash sound - not ready');
        return;
      }

      // Create new buffer source for each playback (reusable)
      const source = this.audioContext.createBufferSource();
      source.buffer = this.crashBuffer;
      
      // Connect to destination
      source.connect(this.audioContext.destination);
      
      // Play instantly
      source.start(0);
      
      console.log('AudioManager: Crash sound played successfully via Web Audio API');
    } catch (error) {
      console.error('AudioManager: Failed to play crash sound', error);
    }
  }

  // Check if audio is ready
  isReady(): boolean {
    if (this.fallbackAudio) {
      return this.isInitialized;
    }
    return this.isInitialized && this.isUnlocked && this.audioContext !== null && this.crashBuffer !== null;
  }

  // Get audio context state
  getState(): string {
    if (this.fallbackAudio) {
      return 'fallback';
    }
    return this.audioContext?.state || 'closed';
  }

  // Cleanup resources
  dispose(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.fallbackAudio) {
      this.fallbackAudio.pause();
      this.fallbackAudio = null;
    }
    this.crashBuffer = null;
    this.isInitialized = false;
    this.isUnlocked = false;
  }
}

// Create singleton instance
const audioManager = new AudioManager();

// Export functions for external use
export const initCrashAudio = async (): Promise<void> => {
  await audioManager.init();
};

export const unlockAudio = (): void => {
  audioManager.unlockAudio();
};

export const playCrashSound = (): void => {
  audioManager.playCrashSound();
};

export const isAudioReady = (): boolean => {
  return audioManager.isReady();
};

export const getAudioState = (): string => {
  return audioManager.getState();
};

export const disposeAudio = (): void => {
  audioManager.dispose();
};

// Export the manager instance for advanced usage
export default audioManager; 