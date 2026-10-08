/**
 * Sample Recorder Module - SignBridge
 * Handles 3-second countdown and captures ~80 normalized landmark vectors per sign.
 */

export class SampleRecorder {
  /**
   * @param {import('./classifier.js').KNNClassifier} classifier 
   */
  constructor(classifier) {
    this.classifier = classifier;
    this.isRecording = false;
    this.targetSamples = 80;
    this.timerId = null;
  }

  /**
   * Helper delay promise
   * @param {number} ms 
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Start 3-second countdown then capture 80 frames of normalized landmarks
   * @param {string} label 
   * @param {Object} callbacks
   * @param {function(string): void} callbacks.onProgress 
   * @param {function(number, string): void} callbacks.onComplete 
   * @param {function(string, string): void} callbacks.onError 
   */
  async record(label, { onProgress, onComplete, onError }) {
    if (this.isRecording) {
      return;
    }

    if (!label) {
      onError('No label selected.', 'Please select a target label before recording.');
      return;
    }

    this.isRecording = true;

    // Phase 1: 3-second countdown
    onProgress('Counting down: 3');
    await this.sleep(1000);
    if (!this.isRecording) return;

    onProgress('Counting down: 2');
    await this.sleep(1000);
    if (!this.isRecording) return;

    onProgress('Counting down: 1');
    await this.sleep(1000);
    if (!this.isRecording) return;

    // Phase 2: Capture 80 normalized vectors
    const captured = [];
    let lastVectorTimestamp = 0;
    const intervalMs = 30; // Capture rate ~33 fps
    let timeoutAttempts = 0;
    const maxAttempts = 1200; // ~36 seconds max wait

    onProgress(`Recording: 0/${this.targetSamples}`);

    while (this.isRecording && captured.length < this.targetSamples && timeoutAttempts < maxAttempts) {
      timeoutAttempts++;
      const vector = window._latestNormalizedVector;

      // Only capture if hand is currently detected and vector has valid 63 numbers
      if (vector && Array.isArray(vector) && vector.length === 63) {
        captured.push([...vector]);
        onProgress(`Recording: ${captured.length}/${this.targetSamples}`);
      } else {
        // Skip frames with no hand detected
      }

      await this.sleep(intervalMs);
    }

    if (!this.isRecording) {
      onProgress('Recording cancelled');
      return;
    }

    if (captured.length < this.targetSamples) {
      onError(
        'Recording timed out.',
        'Ensure your hand is clearly visible in the camera frame throughout recording.'
      );
      this.isRecording = false;
      onProgress('Status: Idle');
      return;
    }

    // Phase 3: Add samples to classifier
    this.classifier.addSamples(label, captured);
    this.isRecording = false;

    onProgress(`Recorded ${captured.length} samples for ${label}`);
    onComplete(captured.length, label);
  }

  /**
   * Cancel ongoing recording session
   */
  cancel() {
    this.isRecording = false;
  }
}
