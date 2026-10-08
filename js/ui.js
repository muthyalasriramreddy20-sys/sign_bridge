/**
 * UI Module - SignBridge
 * Manages DOM elements, status display, transcript management, and conversation logging.
 */

export const elements = {
  // System / Model Status & Global Reset
  systemStatus: document.getElementById('system-status'),
  resetAllBtn: document.getElementById('reset-all-btn'),
  speechStatus: document.getElementById('speech-status'),
  cameraStatus: document.getElementById('camera-status'),
  handStatus: document.getElementById('hand-status'),
  ttsStatus: document.getElementById('tts-status'),
  trainingStatus: document.getElementById('training-status'),

  // Speech / Incoming Controls
  speechErrorBox: document.getElementById('speech-error-box'),
  speechErrorTitle: document.getElementById('speech-error-title'),
  speechErrorDesc: document.getElementById('speech-error-desc'),
  toggleMicBtn: document.getElementById('toggle-mic-btn'),
  speechLangSelect: document.getElementById('speech-lang-select'),
  speedSlider: document.getElementById('speed-slider'),
  speedValueLabel: document.getElementById('speed-value-label'),

  // Offline / Test Input
  testSpellInput: document.getElementById('test-spell-input'),
  testSpellBtn: document.getElementById('test-spell-btn'),
  clearQueueBtn: document.getElementById('clear-queue-btn'),
  queueStatusText: document.getElementById('queue-status-text'),

  // Transcripts
  incomingTranscript: document.getElementById('incoming-transcript'),
  finalTranscripts: document.getElementById('final-transcripts'),
  interimTranscript: document.getElementById('interim-transcript'),

  // Fingerspelling
  fingerspellCard: document.getElementById('fingerspell-card'),
  fingerspellImg: document.getElementById('fingerspell-img'),
  fingerspellLetter: document.getElementById('fingerspell-letter'),
  currentWordDisplay: document.getElementById('current-word-display'),

  // TTS & Outgoing Reply Controls
  ttsErrorBox: document.getElementById('tts-error-box'),
  ttsErrorTitle: document.getElementById('tts-error-title'),
  ttsErrorDesc: document.getElementById('tts-error-desc'),
  ttsVoiceSelect: document.getElementById('tts-voice-select'),
  ttsRateSlider: document.getElementById('tts-rate-slider'),
  ttsRateLabel: document.getElementById('tts-rate-label'),
  replyTextInput: document.getElementById('reply-text-input'),
  sendReplyBtn: document.getElementById('send-reply-btn'),
  quickReplyBtns: document.querySelectorAll('.quick-reply-btn'),

  // Camera / Hand Sign Outgoing Controls
  cameraErrorBox: document.getElementById('camera-error-box'),
  cameraErrorTitle: document.getElementById('camera-error-title'),
  cameraErrorDesc: document.getElementById('camera-error-desc'),
  toggleCameraBtn: document.getElementById('toggle-camera-btn'),
  clearOutgoingBtn: document.getElementById('clear-outgoing-btn'),
  webcamVideo: document.getElementById('webcam-video'),
  handCanvas: document.getElementById('hand-canvas'),
  cameraPlaceholder: document.getElementById('camera-placeholder'),
  detectedSign: document.getElementById('detected-sign'),
  holdProgressBar: document.getElementById('hold-progress-bar'),
  holdProgressPct: document.getElementById('hold-progress-pct'),
  wordBufferDisplay: document.getElementById('word-buffer-display'),
  manualSpaceBtn: document.getElementById('manual-space-btn'),
  manualDeleteBtn: document.getElementById('manual-delete-btn'),
  manualCommitSendBtn: document.getElementById('manual-commit-send-btn'),
  autoSendToggle: document.getElementById('auto-send-toggle'),
  outgoingText: document.getElementById('outgoing-text'),
  speakOutgoingBtn: document.getElementById('speak-outgoing-btn'),
  clearMessageBtn: document.getElementById('clear-message-btn'),

  // Conversation Log
  conversationLog: document.getElementById('conversation-log'),
  clearHistoryBtn: document.getElementById('clear-history-btn'),

  // Training Mode
  trainingDetails: document.getElementById('training-details'),
  trainingErrorBox: document.getElementById('training-error-box'),
  trainingErrorTitle: document.getElementById('training-error-title'),
  trainingErrorDesc: document.getElementById('training-error-desc'),
  trainingSignSelect: document.getElementById('training-sign-select'),
  recordSampleBtn: document.getElementById('record-sample-btn'),
  recordingStatusBadge: document.getElementById('recording-status-badge'),
  trainingTotalSamples: document.getElementById('training-total-samples'),
  trainingTableBody: document.getElementById('training-table-body'),
  clearAllSamplesBtn: document.getElementById('clear-all-samples-btn'),
  exportModelBtn: document.getElementById('export-model-btn'),
  importModelInput: document.getElementById('import-model-input')
};

/**
 * Update text content of a status indicator element
 * @param {HTMLElement} element 
 * @param {string} text 
 */
export function setStatus(element, text) {
  if (element) {
    element.textContent = text;
  }
}

/**
 * Update live detected sign text
 * @param {string|null} label 
 * @param {number} [confidence] 
 */
export function updateDetectedSign(label, confidence) {
  if (!elements.detectedSign) return;

  if (label && confidence !== undefined) {
    elements.detectedSign.textContent = `Detected: ${label} (${Math.round(confidence * 100)}%)`;
  } else {
    elements.detectedSign.textContent = 'Detected: None';
  }
}

/**
 * Update hold progress bar fill and percentage text
 * @param {number} ratio - 0.0 to 1.0
 */
export function updateHoldProgress(ratio) {
  const clamped = Math.max(0, Math.min(1, ratio || 0));
  const pct = Math.round(clamped * 100);

  if (elements.holdProgressBar) {
    elements.holdProgressBar.style.width = `${pct}%`;
  }
  if (elements.holdProgressPct) {
    elements.holdProgressPct.textContent = `${pct}%`;
  }
}

/**
 * Update current word buffer display: "Word: H E L L"
 * @param {string[]} lettersArray 
 */
export function updateWordBufferDisplay(lettersArray) {
  if (!elements.wordBufferDisplay) return;

  if (!lettersArray || lettersArray.length === 0) {
    elements.wordBufferDisplay.textContent = 'Word: ';
  } else {
    elements.wordBufferDisplay.textContent = `Word: ${lettersArray.join(' ')}`;
  }
}

/**
 * Update constructed outgoing message transcript
 * @param {string} text 
 */
export function updateConstructedMessageDisplay(text) {
  if (!elements.outgoingText) return;

  if (!text || text.trim().length === 0) {
    elements.outgoingText.textContent = '[Signed words will accumulate here. Click \'Speak Message\' to read aloud.]';
  } else {
    elements.outgoingText.textContent = text;
  }
}

/**
 * Display or hide error box in speech panel
 * @param {string} title 
 * @param {string} message 
 */
export function showSpeechError(title, message) {
  if (elements.speechErrorBox && elements.speechErrorTitle && elements.speechErrorDesc) {
    elements.speechErrorTitle.textContent = title;
    elements.speechErrorDesc.textContent = message;
    elements.speechErrorBox.style.display = 'block';
  }
}

export function hideSpeechError() {
  if (elements.speechErrorBox) {
    elements.speechErrorBox.style.display = 'none';
  }
}

/**
 * Display or hide error box in TTS reply section
 * @param {string} title 
 * @param {string} message 
 */
export function showTTSError(title, message) {
  if (elements.ttsErrorBox && elements.ttsErrorTitle && elements.ttsErrorDesc) {
    elements.ttsErrorTitle.textContent = title;
    elements.ttsErrorDesc.textContent = message;
    elements.ttsErrorBox.style.display = 'block';
  }
}

export function hideTTSError() {
  if (elements.ttsErrorBox) {
    elements.ttsErrorBox.style.display = 'none';
  }
}

/**
 * Display or hide error box in camera section
 * @param {string} title 
 * @param {string} message 
 */
export function showCameraError(title, message) {
  if (elements.cameraErrorBox && elements.cameraErrorTitle && elements.cameraErrorDesc) {
    elements.cameraErrorTitle.textContent = title;
    elements.cameraErrorDesc.textContent = message;
    elements.cameraErrorBox.style.display = 'block';
  }
}

export function hideCameraError() {
  if (elements.cameraErrorBox) {
    elements.cameraErrorBox.style.display = 'none';
  }
}

/**
 * Display or hide error box in training section
 * @param {string} title 
 * @param {string} message 
 */
export function showTrainingError(title, message) {
  if (elements.trainingErrorBox && elements.trainingErrorTitle && elements.trainingErrorDesc) {
    elements.trainingErrorTitle.textContent = title;
    elements.trainingErrorDesc.textContent = message;
    elements.trainingErrorBox.style.display = 'block';
  }
}

export function hideTrainingError() {
  if (elements.trainingErrorBox) {
    elements.trainingErrorBox.style.display = 'none';
  }
}

/**
 * Render the Training Mode samples table
 * @param {Record<string, number>} labelCounts 
 * @param {number} totalCount 
 * @param {function(string): void} onDeleteLabel 
 */
export function renderTrainingTable(labelCounts, totalCount, onDeleteLabel) {
  if (!elements.trainingTableBody) return;

  if (elements.trainingTotalSamples) {
    elements.trainingTotalSamples.textContent = `Total Samples: ${totalCount}`;
  }

  const labels = Object.keys(labelCounts);
  if (labels.length === 0) {
    elements.trainingTableBody.innerHTML = `
      <tr>
        <td colspan="3" class="table-empty-cell">No samples recorded yet. Select a label and click "Record".</td>
      </tr>
    `;
    return;
  }

  labels.sort((a, b) => {
    if (a === 'SPACE') return 1;
    if (b === 'SPACE') return -1;
    if (a === 'DELETE') return 1;
    if (b === 'DELETE') return -1;
    return a.localeCompare(b);
  });

  elements.trainingTableBody.innerHTML = '';

  for (const label of labels) {
    const count = labelCounts[label];
    const tr = document.createElement('tr');

    const tdLabel = document.createElement('td');
    tdLabel.textContent = label;

    const tdCount = document.createElement('td');
    tdCount.textContent = `${count} samples`;

    const tdAction = document.createElement('td');
    tdAction.className = 'action-col';

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn-secondary btn-small';
    delBtn.textContent = 'Delete';
    delBtn.setAttribute('aria-label', `Delete samples for ${label}`);
    delBtn.addEventListener('click', () => {
      onDeleteLabel(label);
    });

    tdAction.appendChild(delBtn);
    tr.appendChild(tdLabel);
    tr.appendChild(tdCount);
    tr.appendChild(tdAction);

    elements.trainingTableBody.appendChild(tr);
  }
}

/**
 * Populate voice select dropdown
 * @param {SpeechSynthesisVoice[]} voices 
 * @param {SpeechSynthesisVoice|null} selectedVoice 
 */
export function populateVoices(voices, selectedVoice) {
  if (!elements.ttsVoiceSelect || !voices) return;

  elements.ttsVoiceSelect.innerHTML = '';
  voices.forEach((voice) => {
    const option = document.createElement('option');
    option.value = voice.voiceURI || voice.name;
    const isEnIn = (voice.lang || '').toLowerCase().replace('_', '-').includes('en-in');
    option.textContent = `${voice.name} (${voice.lang})${isEnIn ? ' [Recommended]' : ''}`;
    
    if (selectedVoice && (voice.voiceURI === selectedVoice.voiceURI || voice.name === selectedVoice.name)) {
      option.selected = true;
    }
    elements.ttsVoiceSelect.appendChild(option);
  });
}

/**
 * Update TTS rate display label
 * @param {number|string} rate 
 */
export function updateRateLabel(rate) {
  if (elements.ttsRateLabel) {
    elements.ttsRateLabel.textContent = `${parseFloat(rate).toFixed(1)}x`;
  }
}

/**
 * Update the interim transcript line (normal weight)
 * @param {string} text 
 */
export function setInterimTranscript(text) {
  if (elements.interimTranscript) {
    elements.interimTranscript.textContent = text ? `... ${text}` : '';
  }
}

/**
 * Append finalized speech transcript line
 * @param {string} text 
 */
export function appendFinalTranscript(text) {
  if (!elements.finalTranscripts || !text) return;

  const hint = elements.finalTranscripts.querySelector('.transcript-empty-hint');
  if (hint) {
    hint.remove();
  }

  const lineEl = document.createElement('div');
  lineEl.className = 'final-line';
  lineEl.textContent = text;
  elements.finalTranscripts.appendChild(lineEl);

  if (elements.incomingTranscript) {
    elements.incomingTranscript.scrollTop = elements.incomingTranscript.scrollHeight;
  }
}

/**
 * Clear all incoming transcripts
 */
export function clearTranscripts() {
  if (elements.finalTranscripts) {
    elements.finalTranscripts.innerHTML = '<div class="transcript-empty-hint">[Speech transcript will appear here]</div>';
  }
  if (elements.interimTranscript) {
    elements.interimTranscript.textContent = '';
  }
}

/**
 * Format timestamp as [HH:MM]
 * @returns {string}
 */
export function getFormattedTime() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `[${hours}:${minutes}]`;
}

/**
 * Append entry to the Conversation Log
 * @param {string} text 
 * @param {string} [prefix="They said:"] 
 */
export function appendConversationLog(text, prefix = 'They said:') {
  if (!elements.conversationLog || !text) return;

  const placeholder = elements.conversationLog.querySelector('.placeholder-entry');
  if (placeholder) {
    placeholder.remove();
  }

  const entryEl = document.createElement('div');
  entryEl.className = 'log-entry';
  entryEl.textContent = `${getFormattedTime()} ${prefix} ${text}`;
  elements.conversationLog.appendChild(entryEl);

  elements.conversationLog.scrollTop = elements.conversationLog.scrollHeight;
}

/**
 * Clear the Conversation Log and restore placeholder
 */
export function clearConversationLog() {
  if (!elements.conversationLog) return;
  elements.conversationLog.innerHTML = '<div class="log-entry placeholder-entry">[Conversation history cleared]</div>';
}

/**
 * Update queue status text display
 * @param {number} count 
 */
export function updateQueueStatus(count) {
  if (elements.queueStatusText) {
    elements.queueStatusText.textContent = `Queue: ${count} ${count === 1 ? 'letter' : 'letters'}`;
  }
}

/**
 * Update speed numeric label
 * @param {number|string} ms 
 */
export function updateSpeedLabel(ms) {
  if (elements.speedValueLabel) {
    elements.speedValueLabel.textContent = `${ms} ms`;
  }
}
