/**
 * Prediction Stabilizer Module - SignBridge
 * Temporal smoothing with 15-frame rolling window and 1-second hold debouncing.
 */

export class PredictionStabilizer {
  /**
   * @param {Object} [options]
   * @param {number} [options.windowSize=15]
   * @param {number} [options.thresholdRatio=0.8]
   * @param {number} [options.holdDurationMs=1000]
   * @param {function(number): void} [options.onHoldProgress] - Progress ratio (0.0 to 1.0)
   * @param {function(string): void} [options.onSignAccepted] - Dispatched when sign meets 1s hold
   */
  constructor({
    windowSize = 15,
    thresholdRatio = 0.8,
    holdDurationMs = 1000,
    onHoldProgress = () => {},
    onSignAccepted = () => {}
  } = {}) {
    this.windowSize = windowSize;
    this.thresholdRatio = thresholdRatio; // 80%
    this.minCount = Math.ceil(this.windowSize * this.thresholdRatio); // 12
    this.holdDurationMs = holdDurationMs; // ~1000ms

    this.onHoldProgress = onHoldProgress;
    this.onSignAccepted = onSignAccepted;

    this.history = []; // Array of label strings or null
    this.candidateSign = null;
    this.holdStartTime = null;
    this.lastAcceptedSign = null;
  }

  /**
   * Push a prediction from the classifier into the rolling window
   * @param {{ label: string|null, confidence: number } | null} prediction 
   */
  push(prediction) {
    const label = (prediction && !prediction.rejected && prediction.label) ? prediction.label : null;

    // If hand is absent or prediction is null, unlock previous sign
    if (!label) {
      this.lastAcceptedSign = null;
    }

    // Add to rolling 15-item window
    this.history.push(label);
    if (this.history.length > this.windowSize) {
      this.history.shift();
    }

    // Tally frequencies
    const counts = {};
    for (const item of this.history) {
      if (item) {
        counts[item] = (counts[item] || 0) + 1;
      }
    }

    let dominantLabel = null;
    let maxCount = 0;
    for (const [key, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantLabel = key;
      }
    }

    // Check if one class fills at least 80% (12/15) of the window
    if (dominantLabel && maxCount >= this.minCount) {
      // If sign changed from previous accepted sign, unlock it
      if (this.lastAcceptedSign && this.lastAcceptedSign !== dominantLabel) {
        this.lastAcceptedSign = null;
      }

      // If this sign was already accepted and hasn't changed/reset, prevent re-accepting
      if (this.lastAcceptedSign === dominantLabel) {
        this.onHoldProgress(0.0);
        return;
      }

      const now = performance.now();

      if (this.candidateSign !== dominantLabel) {
        this.candidateSign = dominantLabel;
        this.holdStartTime = now;
        this.onHoldProgress(0.0);
      } else {
        const elapsed = now - this.holdStartTime;
        const progress = Math.min(1.0, elapsed / this.holdDurationMs);
        this.onHoldProgress(progress);

        // Sign held for ~1 second
        if (elapsed >= this.holdDurationMs) {
          this.lastAcceptedSign = dominantLabel;
          this.onSignAccepted(dominantLabel);

          // Reset window and candidate after accepting
          this.candidateSign = null;
          this.holdStartTime = null;
          this.history = [];
          this.onHoldProgress(0.0);
        }
      }
    } else {
      // No label has >= 80% agreement
      this.candidateSign = null;
      this.holdStartTime = null;
      this.onHoldProgress(0.0);
    }
  }

  /**
   * Reset stabilizer state
   */
  reset() {
    this.history = [];
    this.candidateSign = null;
    this.holdStartTime = null;
    this.lastAcceptedSign = null;
    this.onHoldProgress(0.0);
  }
}
