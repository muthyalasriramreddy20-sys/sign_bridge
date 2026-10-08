/**
 * Hand Tracking Module - SignBridge
 * MediaPipe Tasks Vision HandLandmarker integration in VIDEO mode with mirrored overlay and normalization.
 */

export const HAND_CONNECTIONS = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index finger
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle finger
  [9, 10], [10, 11], [11, 12],
  // Ring finger
  [13, 14], [14, 15], [15, 16],
  // Pinky finger
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm base connections
  [5, 9], [9, 13], [13, 17]
];

/**
 * Normalizes 21 3D hand landmarks:
 * 1. Subtracts the wrist landmark (index 0) so the wrist is centered at (0, 0, 0).
 * 2. Divides by the Euclidean distance from the wrist to landmark 9 (middle finger base).
 * 3. Flattens into a 63-number vector [x0, y0, z0, x1, y1, z1, ..., x20, y20, z20].
 * @param {Array<{x: number, y: number, z: number}>} landmarks 
 * @returns {number[]} 63-number normalized feature vector
 */
export function normalizeLandmarks(landmarks) {
  if (!landmarks || landmarks.length !== 21) {
    return [];
  }

  const wrist = landmarks[0];
  const middleBase = landmarks[9];

  const dx = middleBase.x - wrist.x;
  const dy = middleBase.y - wrist.y;
  const dz = (middleBase.z || 0) - (wrist.z || 0);
  const distance = Math.hypot(dx, dy, dz) || 1.0;

  const vector = [];
  for (let i = 0; i < 21; i++) {
    const pt = landmarks[i];
    vector.push(
      (pt.x - wrist.x) / distance,
      (pt.y - wrist.y) / distance,
      ((pt.z || 0) - (wrist.z || 0)) / distance
    );
  }
  return vector;
}

export class HandTracker {
  /**
   * @param {Object} options
   * @param {HTMLVideoElement} options.videoElement
   * @param {HTMLCanvasElement} options.canvasElement
   * @param {HTMLElement} [options.placeholderElement]
   * @param {function(string): void} [options.onModelStatusChange]
   * @param {function(string): void} [options.onCameraStatusChange]
   * @param {function(string): void} [options.onHandStatusChange]
   * @param {function(Array, number[]): void} [options.onLandmarks]
   * @param {function(string, string): void} [options.onError]
   */
  constructor({
    videoElement,
    canvasElement,
    placeholderElement,
    onModelStatusChange,
    onCameraStatusChange,
    onHandStatusChange,
    onLandmarks,
    onError
  }) {
    this.videoElement = videoElement;
    this.canvasElement = canvasElement;
    this.placeholderElement = placeholderElement;
    this.ctx = canvasElement ? canvasElement.getContext('2d') : null;

    this.onModelStatusChange = onModelStatusChange || (() => {});
    this.onCameraStatusChange = onCameraStatusChange || (() => {});
    this.onHandStatusChange = onHandStatusChange || (() => {});
    this.onLandmarks = onLandmarks || (() => {});
    this.onError = onError || (() => {});

    this.landmarker = null;
    this.stream = null;
    this.isCameraActive = false;
    this.animationFrameId = null;
    this.lastVideoTime = -1;
    this.isModelLoaded = false;
  }

  /**
   * Load MediaPipe Tasks Vision and initialize HandLandmarker
   */
  async initModel() {
    this.onModelStatusChange('Model: loading');

    try {
      // 1. Verify model file exists locally in models/hand_landmarker.task
      try {
        const headCheck = await fetch('models/hand_landmarker.task', { method: 'HEAD' });
        if (!headCheck.ok) {
          throw new Error('Model file not found (status ' + headCheck.status + ')');
        }
      } catch (fileErr) {
        this.onModelStatusChange('Model: failed');
        this.onError(
          'MediaPipe model file missing.',
          'Please download hand_landmarker.task from the MediaPipe docs into the models/ folder.'
        );
        return false;
      }

      // 2. Load Vision task module from jsDelivr CDN
      const visionTasks = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14');
      const { FilesetResolver, HandLandmarker } = visionTasks;

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );

      // 3. Instantiate HandLandmarker in VIDEO mode
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'models/hand_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: 1
      });

      this.isModelLoaded = true;
      this.onModelStatusChange('Model: loaded');
      return true;
    } catch (err) {
      console.error('Failed to initialize HandLandmarker:', err);
      this.onModelStatusChange('Model: failed');
      this.onError(
        'Failed to initialize HandLandmarker model.',
        'Check network connectivity for the MediaPipe CDN, or verify that models/hand_landmarker.task is valid.'
      );
      return false;
    }
  }

  /**
   * Start camera stream and detection loop
   */
  async startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.onError(
        'Camera not supported.',
        'Your browser does not support navigator.mediaDevices.getUserMedia.'
      );
      this.onCameraStatusChange('Camera: Unsupported');
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });

      this.videoElement.srcObject = this.stream;
      await this.videoElement.play();

      this.isCameraActive = true;
      this.onCameraStatusChange('Camera: On');

      if (this.placeholderElement) {
        this.placeholderElement.style.display = 'none';
      }

      // Start detection loop
      this.startDetectionLoop();
    } catch (err) {
      console.warn('getUserMedia error:', err);
      this.isCameraActive = false;
      this.onCameraStatusChange('Camera: Denied');

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        this.onError(
          'Camera permission denied.',
          'Click the camera icon in Chrome address bar to grant access, then click "Camera on" again.'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        this.onError(
          'No camera found.',
          'Please connect a webcam and verify it in system settings.'
        );
      } else {
        this.onError('Unable to start camera.', err.message);
      }
    }
  }

  /**
   * Stop camera stream and reset overlay
   */
  stopCamera() {
    this.isCameraActive = false;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    if (this.placeholderElement) {
      this.placeholderElement.style.display = 'flex';
    }

    this.clearCanvas();
    this.onCameraStatusChange('Camera: Off');
    this.onHandStatusChange('Hand: not detected');
  }

  /**
   * Toggle camera on/off
   */
  async toggleCamera() {
    if (this.isCameraActive) {
      this.stopCamera();
    } else {
      await this.startCamera();
    }
  }

  /**
   * Continuous requestAnimationFrame detection loop
   */
  startDetectionLoop() {
    const loop = () => {
      if (!this.isCameraActive) return;

      this.detectFrame();
      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  /**
   * Run detection for a single video frame
   */
  detectFrame() {
    if (!this.videoElement || this.videoElement.readyState < 2) return;

    // Match canvas dimensions to video
    const videoWidth = this.videoElement.videoWidth;
    const videoHeight = this.videoElement.videoHeight;

    if (videoWidth && videoHeight) {
      if (this.canvasElement.width !== videoWidth || this.canvasElement.height !== videoHeight) {
        this.canvasElement.width = videoWidth;
        this.canvasElement.height = videoHeight;
      }
    }

    this.clearCanvas();

    // Check if model is loaded and video time advanced
    if (this.landmarker && this.isModelLoaded) {
      const currentTime = this.videoElement.currentTime;
      if (currentTime !== this.lastVideoTime) {
        this.lastVideoTime = currentTime;

        const results = this.landmarker.detectForVideo(this.videoElement, performance.now());

        if (results && results.landmarks && results.landmarks.length > 0) {
          const firstHandLandmarks = results.landmarks[0];
          this.onHandStatusChange('Hand: detected');

          // Draw landmarks and connections in white with black outline
          this.drawLandmarksAndConnections(firstHandLandmarks, this.canvasElement.width, this.canvasElement.height);

          // Compute normalized vector
          const normalized = normalizeLandmarks(firstHandLandmarks);
          this.onLandmarks(firstHandLandmarks, normalized);
        } else {
          this.onHandStatusChange('Hand: not detected');
          this.onLandmarks(null, null);
        }
      }
    }
  }

  /**
   * Clear the overlay canvas
   */
  clearCanvas() {
    if (this.ctx && this.canvasElement) {
      this.ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
    }
  }

  /**
   * Draw the 21 landmarks and their connections in white with a black outline
   * @param {Array<{x: number, y: number, z: number}>} landmarks 
   * @param {number} width 
   * @param {number} height 
   */
  drawLandmarksAndConnections(landmarks, width, height) {
    if (!this.ctx || !landmarks) return;
    const ctx = this.ctx;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1. Draw connections
    for (const [startIndex, endIndex] of HAND_CONNECTIONS) {
      const p1 = landmarks[startIndex];
      const p2 = landmarks[endIndex];
      if (!p1 || !p2) continue;

      const x1 = p1.x * width;
      const y1 = p1.y * height;
      const x2 = p2.x * width;
      const y2 = p2.y * height;

      // Outer black stroke for contrast
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 5;
      ctx.stroke();

      // Inner white line
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // 2. Draw 21 landmark points
    for (let i = 0; i < landmarks.length; i++) {
      const pt = landmarks[i];
      const x = pt.x * width;
      const y = pt.y * height;

      // Outer black circle
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = '#000000';
      ctx.fill();

      // Inner white circle
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    }
  }
}
