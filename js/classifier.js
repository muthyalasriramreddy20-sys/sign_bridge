/**
 * KNN Classifier Module - SignBridge
 * Custom k-Nearest Neighbors (k=5) classifier with configurable thresholds,
 * localStorage persistence, and JSON export/import.
 */

export const DEFAULT_CONFIDENCE_THRESHOLD = 0.6; // Minimum vote share (3/5)
export const DEFAULT_MAX_DISTANCE_THRESHOLD = 1.25; // Maximum allowable Euclidean distance

export class KNNClassifier {
  /**
   * @param {number} [k=5] 
   * @param {Object} [options]
   * @param {number} [options.confidenceThreshold=0.6]
   * @param {number} [options.maxDistanceThreshold=1.25]
   */
  constructor(k = 5, { confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD, maxDistanceThreshold = DEFAULT_MAX_DISTANCE_THRESHOLD } = {}) {
    this.k = k;
    this.confidenceThreshold = confidenceThreshold;
    this.maxDistanceThreshold = maxDistanceThreshold;

    this.dataset = []; // Array of { label: string, features: number[] }
    this.STORAGE_KEY = 'signbridge_knn_dataset';
  }

  /**
   * Add a single sample to the dataset and save to localStorage
   * @param {string} label 
   * @param {number[]} features - 63-number normalized landmark vector
   * @returns {boolean}
   */
  addSample(label, features) {
    if (!label || !Array.isArray(features) || features.length !== 63) {
      return false;
    }
    this.dataset.push({ label, features: [...features] });
    this.saveToLocalStorage();
    return true;
  }

  /**
   * Add multiple samples in batch and save to localStorage
   * @param {string} label 
   * @param {number[][]} featuresList 
   */
  addSamples(label, featuresList) {
    if (!label || !Array.isArray(featuresList)) return;
    for (const feat of featuresList) {
      if (feat && feat.length === 63) {
        this.dataset.push({ label, features: [...feat] });
      }
    }
    this.saveToLocalStorage();
  }

  /**
   * Delete all samples recorded for a specific label
   * @param {string} label 
   */
  deleteLabel(label) {
    this.dataset = this.dataset.filter((item) => item.label !== label);
    this.saveToLocalStorage();
  }

  /**
   * Clear all samples from dataset and storage
   */
  clearAll() {
    this.dataset = [];
    this.saveToLocalStorage();
  }

  /**
   * Return map of labels to sample counts
   * @returns {Record<string, number>}
   */
  getLabelCounts() {
    const counts = {};
    for (const item of this.dataset) {
      counts[item.label] = (counts[item.label] || 0) + 1;
    }
    return counts;
  }

  /**
   * Get total number of recorded samples
   * @returns {number}
   */
  getTotalSamples() {
    return this.dataset.length;
  }

  /**
   * Save dataset to browser localStorage
   */
  saveToLocalStorage() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.dataset));
    } catch (err) {
      console.warn('Failed to save KNN dataset to localStorage:', err);
    }
  }

  /**
   * Load dataset from browser localStorage on startup
   * @returns {boolean}
   */
  loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.dataset = parsed.filter(
            (item) => item && item.label && Array.isArray(item.features) && item.features.length === 63
          );
          return true;
        }
      }
    } catch (err) {
      console.warn('Failed to load KNN dataset from localStorage:', err);
    }
    return false;
  }

  /**
   * Export dataset as formatted JSON string
   * @returns {string}
   */
  exportJSON() {
    return JSON.stringify(
      {
        appName: 'SignBridge',
        version: 1,
        exportedAt: new Date().toISOString(),
        totalSamples: this.dataset.length,
        dataset: this.dataset
      },
      null,
      2
    );
  }

  /**
   * Import dataset from JSON string
   * @param {string} jsonString 
   * @returns {number} number of imported samples
   */
  importJSON(jsonString) {
    const parsed = JSON.parse(jsonString);
    const rawList = Array.isArray(parsed) ? parsed : parsed.dataset || [];
    const valid = rawList.filter(
      (item) => item && item.label && Array.isArray(item.features) && item.features.length === 63
    );

    this.dataset = valid;
    this.saveToLocalStorage();
    return this.dataset.length;
  }

  /**
   * Euclidean distance between two 63-number feature vectors
   * @param {number[]} a 
   * @param {number[]} b 
   * @returns {number}
   */
  distance(a, b) {
    let sum = 0;
    for (let i = 0; i < 63; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Classify 63-vector using k=5 nearest neighbors.
   * Rejects if vote share < confidenceThreshold (0.6) or nearest neighbor distance > maxDistanceThreshold.
   * @param {number[]} features 
   * @returns {{ label: string|null, confidence: number, nearestDistance: number, rejected: boolean, reason?: string } | null}
   */
  predict(features) {
    if (!this.dataset || this.dataset.length === 0 || !features || features.length !== 63) {
      return null;
    }

    const k = Math.min(this.k, this.dataset.length);
    const distances = this.dataset.map((item) => ({
      label: item.label,
      dist: this.distance(features, item.features)
    }));

    // Sort by smallest distance
    distances.sort((a, b) => a.dist - b.dist);
    const topK = distances.slice(0, k);
    const nearestDistance = topK[0].dist;

    // Vote share
    const votes = {};
    for (const neighbor of topK) {
      votes[neighbor.label] = (votes[neighbor.label] || 0) + 1;
    }

    let bestLabel = null;
    let maxVotes = -1;
    for (const [label, count] of Object.entries(votes)) {
      if (count > maxVotes) {
        maxVotes = count;
        bestLabel = label;
      }
    }

    const confidence = maxVotes / k;

    // Check threshold rejection conditions
    if (nearestDistance > this.maxDistanceThreshold) {
      return {
        label: null,
        candidate: bestLabel,
        confidence,
        nearestDistance,
        rejected: true,
        reason: 'distance'
      };
    }

    if (confidence < this.confidenceThreshold) {
      return {
        label: null,
        candidate: bestLabel,
        confidence,
        nearestDistance,
        rejected: true,
        reason: 'confidence'
      };
    }

    return {
      label: bestLabel,
      confidence,
      nearestDistance,
      rejected: false
    };
  }
}
