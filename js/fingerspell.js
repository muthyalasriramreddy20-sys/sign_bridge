/**
 * Fingerspelling Module - SignBridge
 * Sequential ASL alphabet playback queue with dynamic pacing and fallback display.
 */

export class FingerspellPlayer {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.cardElement
   * @param {HTMLImageElement} options.imgElement
   * @param {HTMLElement} options.letterElement
   * @param {HTMLElement} options.wordDisplayElement
   * @param {function(number): void} [options.onQueueChange]
   */
  constructor({ cardElement, imgElement, letterElement, wordDisplayElement, onQueueChange }) {
    this.cardElement = cardElement;
    this.imgElement = imgElement;
    this.letterElement = letterElement;
    this.wordDisplayElement = wordDisplayElement;
    this.onQueueChange = onQueueChange || (() => {});

    this.queue = []; // Array of words (e.g. ["HELLO", "WORLD"])
    this.baseSpeed = 800; // ms per letter (range 300 - 1500)
    this.isPlaying = false;
    this.shouldCancel = false;
    this.currentWord = '';
    this.currentLetterIndex = -1;

    // Cache image availability to prevent repeated 404 network delays
    this.imageAvailabilityCache = new Map();
  }

  /**
   * Set base playback speed in milliseconds
   * @param {number} ms 
   */
  setSpeed(ms) {
    this.baseSpeed = Math.max(300, Math.min(1500, Number(ms) || 800));
  }

  /**
   * Total letters remaining in queue including pending words
   * @returns {number}
   */
  getTotalLettersInQueue() {
    let count = 0;
    if (this.currentWord && this.currentLetterIndex >= 0) {
      count += Math.max(0, this.currentWord.length - this.currentLetterIndex);
    }
    for (const word of this.queue) {
      count += word.length;
    }
    return count;
  }

  notifyQueueChange() {
    this.onQueueChange(this.getTotalLettersInQueue());
  }

  /**
   * Enqueue text string.
   * Splits text into words, filters non-A-Z characters, and enqueues words.
   * @param {string} text 
   */
  enqueueText(text) {
    if (!text || typeof text !== 'string') return;

    // Split text into whitespace-delimited tokens, keep only A-Z
    const tokens = text.toUpperCase().split(/\s+/);
    const validWords = [];

    for (const token of tokens) {
      const cleanWord = token.replace(/[^A-Z]/g, '');
      if (cleanWord.length > 0) {
        validWords.push(cleanWord);
      }
    }

    if (validWords.length === 0) return;

    this.queue.push(...validWords);
    this.notifyQueueChange();

    if (!this.isPlaying) {
      this.startPlaybackLoop();
    }
  }

  /**
   * Clear the queue and cancel active playback
   */
  clear() {
    this.queue = [];
    this.shouldCancel = true;
    this.currentWord = '';
    this.currentLetterIndex = -1;
    this.resetDisplay();
    this.notifyQueueChange();
  }

  /**
   * Reset card and word display to idle state
   */
  resetDisplay() {
    if (this.imgElement) {
      this.imgElement.style.display = 'none';
      this.imgElement.src = '';
    }
    if (this.letterElement) {
      this.letterElement.style.display = 'block';
      this.letterElement.textContent = '-';
    }
    if (this.wordDisplayElement) {
      this.wordDisplayElement.innerHTML = '<span class="word-placeholder">Awaiting input</span>';
    }
  }

  /**
   * Helper delay promise that can be cancelled
   * @param {number} ms 
   */
  async sleep(ms) {
    return new Promise((resolve) => {
      const start = Date.now();
      const interval = setInterval(() => {
        if (this.shouldCancel || Date.now() - start >= ms) {
          clearInterval(interval);
          resolve();
        }
      }, 25);
    });
  }

  /**
   * Check if image exists for a letter, cached
   * @param {string} letter 
   * @returns {Promise<boolean>}
   */
  async checkImageExists(letter) {
    const key = letter.toLowerCase();
    if (this.imageAvailabilityCache.has(key)) {
      return this.imageAvailabilityCache.get(key);
    }

    return new Promise((resolve) => {
      const img = new Image();
      let finished = false;

      const finish = (result) => {
        if (!finished) {
          finished = true;
          this.imageAvailabilityCache.set(key, result);
          resolve(result);
        }
      };

      img.onload = () => finish(true);
      img.onerror = () => finish(false);
      img.src = `signs/${key}.png`;

      // 100ms timeout fallback
      setTimeout(() => finish(false), 100);
    });
  }

  /**
   * Render blank card for 150ms between repeated letters
   */
  async showBlankCard() {
    if (this.imgElement) this.imgElement.style.display = 'none';
    if (this.letterElement) {
      this.letterElement.style.display = 'block';
      this.letterElement.textContent = '';
    }
    await this.sleep(150);
  }

  /**
   * Render a single letter inside the 2px-border card
   * @param {string} letter 
   */
  async displayLetter(letter) {
    const hasImage = await this.checkImageExists(letter);
    if (this.shouldCancel) return;

    if (hasImage) {
      this.imgElement.src = `signs/${letter.toLowerCase()}.png`;
      this.imgElement.alt = `ASL sign for ${letter}`;
      this.imgElement.style.display = 'block';
      this.letterElement.style.display = 'none';
    } else {
      this.imgElement.style.display = 'none';
      this.letterElement.style.display = 'block';
      this.letterElement.textContent = letter;
    }
  }

  /**
   * Render the word under the card with the active letter bold and underlined
   * @param {string} word 
   * @param {number} activeIndex 
   */
  renderWordProgress(word, activeIndex) {
    if (!this.wordDisplayElement) return;

    const html = word
      .split('')
      .map((ch, idx) => {
        const isActive = idx === activeIndex;
        return `<span class="word-letter ${isActive ? 'active' : ''}">${ch}</span>`;
      })
      .join('');

    this.wordDisplayElement.innerHTML = html;
  }

  /**
   * Calculate effective speed per letter.
   * If total letters in queue exceeds 40, speed up playback slightly.
   * @returns {number}
   */
  getEffectiveSpeed() {
    const total = this.getTotalLettersInQueue();
    if (total > 40) {
      // Speed up slightly when queue exceeds 40 letters (e.g. ~65% duration)
      return Math.max(200, Math.round(this.baseSpeed * 0.65));
    }
    return this.baseSpeed;
  }

  /**
   * Main playback loop
   */
  async startPlaybackLoop() {
    this.isPlaying = true;
    this.shouldCancel = false;

    let previousLetter = null;

    while (this.queue.length > 0 && !this.shouldCancel) {
      const word = this.queue.shift();
      this.currentWord = word;

      for (let i = 0; i < word.length; i++) {
        if (this.shouldCancel) break;

        this.currentLetterIndex = i;
        this.notifyQueueChange();

        const letter = word[i];

        // If the same letter repeats (like LL in "hello"), show a blank card for 150ms between them
        if (previousLetter === letter) {
          await this.showBlankCard();
          if (this.shouldCancel) break;
        }

        // Highlight active letter in the word tracker
        this.renderWordProgress(word, i);

        // Display card letter or image
        await this.displayLetter(letter);
        if (this.shouldCancel) break;

        previousLetter = letter;

        // Letter duration with dynamic speed adjustment if queue > 40
        const duration = this.getEffectiveSpeed();
        await this.sleep(duration);
      }

      if (this.shouldCancel) break;

      // Reset previous letter between words
      previousLetter = null;

      // Short pause between words
      const wordPause = Math.max(250, Math.round(this.getEffectiveSpeed() * 0.6));
      await this.sleep(wordPause);
    }

    this.isPlaying = false;
    this.currentWord = '';
    this.currentLetterIndex = -1;
    this.notifyQueueChange();

    if (!this.shouldCancel) {
      this.resetDisplay();
    }
    this.shouldCancel = false;
  }
}
