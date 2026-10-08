/**
 * Text-to-Speech Module - SignBridge
 * SpeechSynthesis wrapper with voice selection, rate adjustment, and error handling.
 */

export class TTSHandler {
  /**
   * @param {Object} callbacks
   * @param {function(string): void} [callbacks.onStatusChange]
   * @param {function(string, string): void} [callbacks.onError]
   * @param {function(SpeechSynthesisVoice[], SpeechSynthesisVoice): void} [callbacks.onVoicesLoaded]
   */
  constructor({ onStatusChange, onError, onVoicesLoaded } = {}) {
    this.synth = window.speechSynthesis || null;
    this.voices = [];
    this.selectedVoice = null;
    this.rate = 1.0;

    this.onStatusChange = onStatusChange || (() => {});
    this.onError = onError || (() => {});
    this.onVoicesLoaded = onVoicesLoaded || (() => {});

    this.init();
  }

  /**
   * Check browser capability and load voices
   */
  init() {
    if (!this.synth || !('speechSynthesis' in window)) {
      this.onError(
        'Speech synthesis is not supported in this browser.',
        'Please open SignBridge in Google Chrome, Microsoft Edge, or another modern browser with Web Speech API support.'
      );
      this.onStatusChange('TTS: Unsupported');
      return;
    }

    const loadVoices = () => {
      this.voices = this.synth.getVoices();

      if (this.voices && this.voices.length > 0) {
        // Priority: find an en-IN voice first per spec
        const enInVoice = this.voices.find(v => {
          const l = (v.lang || '').toLowerCase().replace('_', '-');
          return l === 'en-in' || l.startsWith('en-in');
        });

        // Fallbacks: default voice, or any English voice, or first available voice
        const defaultVoice = this.voices.find(v => v.default);
        const englishVoice = this.voices.find(v => (v.lang || '').toLowerCase().startsWith('en'));

        this.selectedVoice = enInVoice || defaultVoice || englishVoice || this.voices[0];
        this.onVoicesLoaded(this.voices, this.selectedVoice);
        this.onStatusChange('TTS: Ready');
      } else {
        // Sometimes getVoices() returns empty array initially in Chrome until onvoiceschanged fires
      }
    };

    // Immediate attempt
    loadVoices();

    // Chrome and Edge populate voices asynchronously
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => {
        loadVoices();
      };
    }

    // Safety timeout: if after 1000ms voices are still empty, report error
    setTimeout(() => {
      if (this.synth && (!this.voices || this.voices.length === 0)) {
        this.onError(
          'No text-to-speech voices detected.',
          'Verify that text-to-speech voices are installed in your operating system language settings.'
        );
        this.onStatusChange('TTS: No voices');
      }
    }, 1000);
  }

  /**
   * Set voice by URI or identifier
   * @param {string} voiceURI 
   */
  setVoice(voiceURI) {
    if (!this.voices || this.voices.length === 0) return;
    const found = this.voices.find(v => v.voiceURI === voiceURI || v.name === voiceURI);
    if (found) {
      this.selectedVoice = found;
    }
  }

  /**
   * Set speech rate (0.5 to 2.0)
   * @param {number|string} rate 
   */
  setRate(rate) {
    this.rate = Math.max(0.5, Math.min(2.0, parseFloat(rate) || 1.0));
  }

  /**
   * Cancel ongoing speech and read message aloud
   * @param {string} text 
   */
  speak(text) {
    if (!text || typeof text !== 'string') return;
    const cleanText = text.trim();
    if (cleanText.length === 0) return;

    if (!this.synth) {
      this.onError(
        'Speech synthesis is unavailable.',
        'Cannot speak message because speech synthesis is unsupported.'
      );
      return;
    }

    try {
      // Cancel active speech for snappy instant response
      this.synth.cancel();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }
      utterance.rate = this.rate;

      utterance.onstart = () => {
        this.onStatusChange('TTS: Speaking');
      };

      utterance.onend = () => {
        this.onStatusChange('TTS: Ready');
      };

      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis error:', e);
        this.onStatusChange('TTS: Ready');
      };

      this.synth.speak(utterance);
    } catch (err) {
      console.error('Failed to trigger speech synthesis:', err);
      this.onError('Unable to speak text.', err.message);
    }
  }

  /**
   * Stop speaking immediately
   */
  stop() {
    if (this.synth) {
      this.synth.cancel();
      this.onStatusChange('TTS: Ready');
    }
  }
}
