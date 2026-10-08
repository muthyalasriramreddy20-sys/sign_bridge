/**
 * Speech Recognition Module - SignBridge
 * Web Speech API wrapper with continuous transcription, auto-restart,
 * and intelligent TTS speech-pause coordination to avoid audio echo.
 */

export class SpeechHandler {
  /**
   * @param {Object} callbacks
   * @param {function(string): void} [callbacks.onInterim] - Called on interim speech results
   * @param {function(string): void} [callbacks.onFinal] - Called when a speech sentence/phrase is finalized
   * @param {function(string): void} [callbacks.onStatusChange] - Called on listening state or status change
   * @param {function(string, string): void} [callbacks.onError] - Called on error (message, suggestedFix)
   */
  constructor({ onInterim, onFinal, onStatusChange, onError } = {}) {
    this.onInterim = onInterim || (() => {});
    this.onFinal = onFinal || (() => {});
    this.onStatusChange = onStatusChange || (() => {});
    this.onError = onError || (() => {});

    this.isListening = false;
    this.pausedForTTS = false;
    this.recognition = null;
    this.lang = 'en-US';
    this.restartTimeoutId = null;

    this.initRecognition();
  }

  /**
   * Check browser capability and initialize SpeechRecognition instance
   */
  initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.onError(
        'Speech recognition is not supported in this browser.',
        'Please open SignBridge in Google Chrome, or use the "Test Input" box below to fingerspell text without a microphone.'
      );
      this.onStatusChange('Mic: Unsupported');
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.lang;

      this.recognition.onstart = () => {
        if (!this.pausedForTTS) {
          this.onStatusChange('Mic: Listening');
        }
      };

      this.recognition.onresult = (event) => {
        // Drop any results if paused for TTS
        if (this.pausedForTTS) return;

        let interimText = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          if (result.isFinal) {
            const cleanFinal = transcript.trim();
            if (cleanFinal.length > 0) {
              this.onFinal(cleanFinal);
            }
          } else {
            interimText += transcript;
          }
        }
        this.onInterim(interimText);
      };

      this.recognition.onerror = (event) => {
        console.warn('SpeechRecognition error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          this.isListening = false;
          this.onStatusChange('Mic: Denied');
          this.onError(
            'Microphone access was denied.',
            'Click the camera/mic icon in Chrome address bar to allow microphone access, then click "Start Listening" again.'
          );
        } else if (event.error === 'no-speech') {
          // Normal silence, auto-restart handles if needed
        } else if (event.error === 'audio-capture') {
          this.isListening = false;
          this.onStatusChange('Mic: No device');
          this.onError(
            'No microphone detected.',
            'Ensure a microphone is plugged in and recognized by your system settings.'
          );
        }
      };

      this.recognition.onend = () => {
        // Do not auto-restart if deliberately paused for TTS playback
        if (this.pausedForTTS) {
          this.onStatusChange('Mic: Paused (TTS)');
          return;
        }

        // Auto-restart recognition if it stopped while mic is active
        if (this.isListening) {
          clearTimeout(this.restartTimeoutId);
          this.restartTimeoutId = setTimeout(() => {
            if (this.isListening && !this.pausedForTTS && this.recognition) {
              try {
                this.recognition.start();
              } catch (err) {
                console.debug('Recognition restart notice:', err);
              }
            }
          }, 200);
        } else {
          this.onStatusChange('Mic: Idle');
        }
      };
    } catch (err) {
      console.error('Failed to construct SpeechRecognition:', err);
      this.onError('Unable to initialize speech recognition.', err.message);
    }
  }

  /**
   * Pause mic recognition temporarily while TTS speaks to avoid picking up computer audio
   */
  pauseForTTS() {
    if (this.isListening) {
      this.pausedForTTS = true;
      this.onStatusChange('Mic: Paused (TTS)');
      if (this.recognition) {
        try {
          this.recognition.stop();
        } catch (err) {
          console.debug('Recognition pause stop error:', err);
        }
      }
    }
  }

  /**
   * Resume mic recognition after TTS finishes speaking
   */
  resumeAfterTTS() {
    if (this.pausedForTTS) {
      this.pausedForTTS = false;
      // Allow 350ms acoustic buffer for room echo to settle before listening
      setTimeout(() => {
        if (this.isListening && !this.pausedForTTS && this.recognition) {
          try {
            this.recognition.start();
            this.onStatusChange('Mic: Listening');
          } catch (err) {
            console.debug('Recognition resume error:', err);
          }
        }
      }, 350);
    }
  }

  /**
   * Set language (e.g. en-US, en-IN, en-GB)
   * @param {string} langCode 
   */
  setLanguage(langCode) {
    this.lang = langCode;
    if (this.recognition) {
      this.recognition.lang = langCode;
      if (this.isListening && !this.pausedForTTS) {
        try {
          this.recognition.stop();
        } catch (e) {
          console.debug(e);
        }
      }
    }
  }

  /**
   * Start listening to microphone
   */
  start() {
    if (!this.recognition) {
      this.initRecognition();
      if (!this.recognition) return;
    }
    this.isListening = true;
    this.pausedForTTS = false;
    try {
      this.recognition.start();
    } catch (err) {
      console.debug('Speech recognition already active:', err);
    }
  }

  /**
   * Stop listening to microphone
   */
  stop() {
    this.isListening = false;
    this.pausedForTTS = false;
    clearTimeout(this.restartTimeoutId);
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (err) {
        console.debug('Speech stop error:', err);
      }
    }
    this.onStatusChange('Mic: Idle');
    this.onInterim('');
  }

  /**
   * Toggle between listening and idle
   */
  toggle() {
    if (this.isListening) {
      this.stop();
    } else {
      this.start();
    }
  }
}
