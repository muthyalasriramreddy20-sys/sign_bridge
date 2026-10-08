/**
 * Main Application Entry Point - SignBridge
 * Orchestrates two-way communication: Speech-to-Fingerspelling, Live Hand Sign Recognition,
 * Prediction Stabilization, Text-to-Speech with Mic Acoustic Echo Avoidance, Auto-Send, and Reset All.
 */

import {
  elements,
  setStatus,
  showSpeechError,
  hideSpeechError,
  showTTSError,
  hideTTSError,
  showCameraError,
  hideCameraError,
  showTrainingError,
  hideTrainingError,
  renderTrainingTable,
  populateVoices,
  updateRateLabel,
  setInterimTranscript,
  appendFinalTranscript,
  clearTranscripts,
  appendConversationLog,
  clearConversationLog,
  updateQueueStatus,
  updateSpeedLabel,
  updateDetectedSign,
  updateHoldProgress,
  updateWordBufferDisplay,
  updateConstructedMessageDisplay
} from './ui.js';

import { SpeechHandler } from './speech.js';
import { FingerspellPlayer } from './fingerspell.js';
import { TTSHandler } from './tts.js';
import { HandTracker } from './handtracking.js';
import { KNNClassifier } from './classifier.js';
import { SampleRecorder } from './recorder.js';
import { PredictionStabilizer } from './stabilizer.js';

/**
 * Text cleanup and autocorrect function for fingerspelled / typed output.
 * Trims extraneous whitespace, collapses consecutive spaces, and applies sentence-casing.
 * 
 * =========================================================================================
 * LLM EXTENSION HOOK:
 * Replace or augment this function with a Gemini API / local Chrome Built-in AI Prompt API call
 * to perform context-aware grammatical reconstruction of ASL glosses into fluent sentences.
 * Example:
 *   async function cleanupTextWithLLM(rawText) {
 *     const response = await ai.languageModel.prompt(`Expand ASL gloss into fluent English: ${rawText}`);
 *     return response;
 *   }
 * =========================================================================================
 * 
 * @param {string} text - Raw reconstructed characters/words
 * @returns {string} Cleaned, sentence-cased text
 */
export function cleanupText(text) {
  if (!text || typeof text !== 'string') return '';

  // 1. Trim and collapse multiple consecutive whitespace characters
  let clean = text.trim().replace(/\s+/g, ' ');
  if (clean.length === 0) return '';

  // 2. Sentence-case: capitalize the first letter and letters following terminal punctuation
  clean = clean.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, (match) => match.toUpperCase());

  return clean;
}

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Fingerspell Player (Incoming ASL display)
  const fingerspell = new FingerspellPlayer({
    cardElement: elements.fingerspellCard,
    imgElement: elements.fingerspellImg,
    letterElement: elements.fingerspellLetter,
    wordDisplayElement: elements.currentWordDisplay,
    onQueueChange: (count) => {
      updateQueueStatus(count);
    }
  });

  if (elements.speedSlider) {
    fingerspell.setSpeed(elements.speedSlider.value);
    updateSpeedLabel(elements.speedSlider.value);
  }

  // 2. Initialize Speech Handler (Incoming Speech-to-Text)
  const speech = new SpeechHandler({
    onInterim: (interimText) => {
      setInterimTranscript(interimText);
    },
    onFinal: (finalText) => {
      setInterimTranscript('');
      appendFinalTranscript(finalText);
      appendConversationLog(finalText, 'They said:');
      fingerspell.enqueueText(finalText);
    },
    onStatusChange: (statusText) => {
      setStatus(elements.speechStatus, statusText);
      if (elements.toggleMicBtn) {
        if (speech.isListening) {
          elements.toggleMicBtn.textContent = 'Stop Listening';
          elements.toggleMicBtn.setAttribute('aria-pressed', 'true');
        } else {
          elements.toggleMicBtn.textContent = 'Start Listening';
          elements.toggleMicBtn.setAttribute('aria-pressed', 'false');
        }
      }
    },
    onError: (title, suggestedFix) => {
      showSpeechError(title, suggestedFix);
    }
  });

  // 3. Initialize TTS Handler (Outgoing Reply)
  // Coordinated with speechHandler to pause mic recognition while speaking, preventing audio echo loops
  const tts = new TTSHandler({
    onStatusChange: (statusText) => {
      setStatus(elements.ttsStatus, statusText);
      if (statusText === 'TTS: Speaking') {
        speech.pauseForTTS();
      } else if (statusText === 'TTS: Ready') {
        speech.resumeAfterTTS();
      }
    },
    onError: (title, suggestedFix) => {
      showTTSError(title, suggestedFix);
      speech.resumeAfterTTS();
    },
    onVoicesLoaded: (voices, selectedVoice) => {
      populateVoices(voices, selectedVoice);
      hideTTSError();
    }
  });

  // Rate Slider
  if (elements.ttsRateSlider) {
    tts.setRate(elements.ttsRateSlider.value);
    updateRateLabel(elements.ttsRateSlider.value);

    elements.ttsRateSlider.addEventListener('input', (e) => {
      const rateVal = e.target.value;
      updateRateLabel(rateVal);
      tts.setRate(rateVal);
    });
  }

  // Voice Selection
  if (elements.ttsVoiceSelect) {
    elements.ttsVoiceSelect.addEventListener('change', (e) => {
      tts.setVoice(e.target.value);
    });
  }

  // Send Reply Function (TTS + Conversation Log)
  const sendReplyMessage = (messageText) => {
    if (!messageText || typeof messageText !== 'string') return;
    const clean = cleanupText(messageText);
    if (clean.length === 0) return;

    hideTTSError();
    tts.speak(clean);
    appendConversationLog(clean, 'You said:');
  };

  // Text Input Send Button & Enter Key (Right column top)
  if (elements.sendReplyBtn) {
    elements.sendReplyBtn.addEventListener('click', () => {
      if (!elements.replyTextInput) return;
      const text = elements.replyTextInput.value;
      if (text.trim().length > 0) {
        sendReplyMessage(text);
        elements.replyTextInput.value = '';
      }
    });
  }

  if (elements.replyTextInput) {
    elements.replyTextInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const text = elements.replyTextInput.value;
        if (text.trim().length > 0) {
          sendReplyMessage(text);
          elements.replyTextInput.value = '';
        }
      }
    });
  }

  // 8 Quick-Reply Buttons
  if (elements.quickReplyBtns) {
    elements.quickReplyBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const replyText = btn.getAttribute('data-reply') || btn.textContent.trim();
        sendReplyMessage(replyText);
      });
    });
  }

  // Mic Toggle Button
  if (elements.toggleMicBtn) {
    elements.toggleMicBtn.addEventListener('click', () => {
      hideSpeechError();
      speech.toggle();
    });
  }

  // Language Select
  if (elements.speechLangSelect) {
    elements.speechLangSelect.addEventListener('change', (e) => {
      speech.setLanguage(e.target.value);
    });
  }

  // Speed Slider
  if (elements.speedSlider) {
    elements.speedSlider.addEventListener('input', (e) => {
      const speedVal = Number(e.target.value);
      updateSpeedLabel(speedVal);
      fingerspell.setSpeed(speedVal);
    });
  }

  // Offline / Test Input ("Spell It")
  const triggerTestSpell = () => {
    if (!elements.testSpellInput) return;
    const text = elements.testSpellInput.value.trim();
    if (text.length === 0) return;

    elements.testSpellInput.value = '';
    hideSpeechError();

    appendFinalTranscript(text);
    appendConversationLog(text, 'They said:');
    fingerspell.enqueueText(text);
  };

  if (elements.testSpellBtn) {
    elements.testSpellBtn.addEventListener('click', triggerTestSpell);
  }

  if (elements.testSpellInput) {
    elements.testSpellInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        triggerTestSpell();
      }
    });
  }

  // Clear Queue Button
  if (elements.clearQueueBtn) {
    elements.clearQueueBtn.addEventListener('click', () => {
      fingerspell.clear();
    });
  }

  // Clear Conversation Log
  if (elements.clearHistoryBtn) {
    elements.clearHistoryBtn.addEventListener('click', () => {
      clearConversationLog();
    });
  }

  // 4. Initialize KNN Classifier & Sample Recorder (Training Mode)
  const classifier = new KNNClassifier(5);
  classifier.loadFromLocalStorage();

  const recorder = new SampleRecorder(classifier);

  const updateTrainingTable = () => {
    renderTrainingTable(
      classifier.getLabelCounts(),
      classifier.getTotalSamples(),
      (labelToDelete) => {
        classifier.deleteLabel(labelToDelete);
        updateTrainingTable();
        setStatus(elements.recordingStatusBadge, `Deleted samples for ${labelToDelete}`);
      }
    );
  };

  updateTrainingTable();

  // 5. Outgoing Live Word Buffer, Auto-Send, and Message State
  let currentWordBuffer = [];
  let constructedMessage = '';
  let autoSendTimer = null;

  const resetAutoSendTimer = () => {
    if (autoSendTimer) {
      clearTimeout(autoSendTimer);
      autoSendTimer = null;
    }

    if (elements.autoSendToggle && elements.autoSendToggle.checked) {
      if (currentWordBuffer.length > 0 || constructedMessage.trim().length > 0) {
        autoSendTimer = setTimeout(() => {
          sendOutgoingSignedMessage();
        }, 4000); // 4-second pause auto-send
      }
    }
  };

  const commitCurrentWord = () => {
    if (currentWordBuffer.length > 0) {
      const word = currentWordBuffer.join('');
      constructedMessage = constructedMessage.length > 0 ? `${constructedMessage} ${word}` : word;
      currentWordBuffer = [];
      updateWordBufferDisplay(currentWordBuffer);
      updateConstructedMessageDisplay(constructedMessage);
      resetAutoSendTimer();
    }
  };

  const deleteLastLetter = () => {
    if (currentWordBuffer.length > 0) {
      currentWordBuffer.pop();
      updateWordBufferDisplay(currentWordBuffer);
      resetAutoSendTimer();
    } else if (constructedMessage.length > 0) {
      constructedMessage = constructedMessage.slice(0, -1).trimEnd();
      updateConstructedMessageDisplay(constructedMessage);
      resetAutoSendTimer();
    }
  };

  const sendOutgoingSignedMessage = () => {
    if (autoSendTimer) {
      clearTimeout(autoSendTimer);
      autoSendTimer = null;
    }

    // Commit any in-progress word buffer first
    if (currentWordBuffer.length > 0) {
      const word = currentWordBuffer.join('');
      constructedMessage = constructedMessage.length > 0 ? `${constructedMessage} ${word}` : word;
      currentWordBuffer = [];
      updateWordBufferDisplay(currentWordBuffer);
    }

    const raw = constructedMessage.trim();
    if (raw.length === 0) return;

    // Pass through cleanupText (trim, collapse spaces, sentence-case)
    const cleaned = cleanupText(raw);

    // Speak and log
    sendReplyMessage(cleaned);

    // Reset outgoing display
    constructedMessage = '';
    updateConstructedMessageDisplay('');
  };

  // 6. Initialize Prediction Stabilizer (15-frame window, 80% agreement, 1s hold)
  const stabilizer = new PredictionStabilizer({
    windowSize: 15,
    thresholdRatio: 0.8,
    holdDurationMs: 1000,
    onHoldProgress: (ratio) => {
      updateHoldProgress(ratio);
    },
    onSignAccepted: (label) => {
      if (label === 'SPACE') {
        commitCurrentWord();
      } else if (label === 'DELETE') {
        deleteLastLetter();
      } else {
        // ASL letter A-Z
        currentWordBuffer.push(label);
        updateWordBufferDisplay(currentWordBuffer);
        resetAutoSendTimer();
      }
    }
  });

  // 7. Initialize Hand Tracker (Camera & MediaPipe HandLandmarker)
  const handTracker = new HandTracker({
    videoElement: elements.webcamVideo,
    canvasElement: elements.handCanvas,
    placeholderElement: elements.cameraPlaceholder,
    onModelStatusChange: (statusText) => {
      setStatus(elements.systemStatus, statusText);
    },
    onCameraStatusChange: (statusText) => {
      setStatus(elements.cameraStatus, statusText);
      if (elements.toggleCameraBtn) {
        if (handTracker.isCameraActive) {
          elements.toggleCameraBtn.textContent = 'Camera off';
          elements.toggleCameraBtn.setAttribute('aria-pressed', 'true');
        } else {
          elements.toggleCameraBtn.textContent = 'Camera on';
          elements.toggleCameraBtn.setAttribute('aria-pressed', 'false');
        }
      }
    },
    onHandStatusChange: (statusText) => {
      setStatus(elements.handStatus, statusText);
      if (statusText === 'Hand: not detected') {
        updateDetectedSign(null);
        stabilizer.push(null);
      }
    },
    onLandmarks: (landmarks, normalizedVector) => {
      window._latestLandmarks = landmarks;
      window._latestNormalizedVector = normalizedVector;

      // Live classification only when not actively recording training samples
      if (!recorder.isRecording) {
        if (normalizedVector && normalizedVector.length === 63) {
          const pred = classifier.predict(normalizedVector);
          if (pred && !pred.rejected && pred.label) {
            updateDetectedSign(pred.label, pred.confidence);
            stabilizer.push(pred);
          } else {
            updateDetectedSign(null);
            stabilizer.push(null);
          }
        } else {
          updateDetectedSign(null);
          stabilizer.push(null);
        }
      }
    },
    onError: (title, suggestedFix) => {
      showCameraError(title, suggestedFix);
    }
  });

  handTracker.initModel();

  if (elements.toggleCameraBtn) {
    elements.toggleCameraBtn.addEventListener('click', () => {
      hideCameraError();
      handTracker.toggleCamera();
    });
  }

  // 8. Manual Fallback Word Buffer Controls
  if (elements.manualSpaceBtn) {
    elements.manualSpaceBtn.addEventListener('click', () => {
      commitCurrentWord();
    });
  }

  if (elements.manualDeleteBtn) {
    elements.manualDeleteBtn.addEventListener('click', () => {
      deleteLastLetter();
    });
  }

  if (elements.manualCommitSendBtn) {
    elements.manualCommitSendBtn.addEventListener('click', () => {
      sendOutgoingSignedMessage();
    });
  }

  if (elements.speakOutgoingBtn) {
    elements.speakOutgoingBtn.addEventListener('click', () => {
      sendOutgoingSignedMessage();
    });
  }

  if (elements.clearOutgoingBtn) {
    elements.clearOutgoingBtn.addEventListener('click', () => {
      currentWordBuffer = [];
      updateWordBufferDisplay(currentWordBuffer);
      if (autoSendTimer) clearTimeout(autoSendTimer);
    });
  }

  if (elements.clearMessageBtn) {
    elements.clearMessageBtn.addEventListener('click', () => {
      constructedMessage = '';
      updateConstructedMessageDisplay('');
      if (autoSendTimer) clearTimeout(autoSendTimer);
    });
  }

  // 9. Global "Reset All" Button
  if (elements.resetAllBtn) {
    elements.resetAllBtn.addEventListener('click', () => {
      // 1. Clear fingerspelling queue
      fingerspell.clear();

      // 2. Clear word buffer and constructed outgoing message
      currentWordBuffer = [];
      constructedMessage = '';
      updateWordBufferDisplay(currentWordBuffer);
      updateConstructedMessageDisplay('');
      if (autoSendTimer) clearTimeout(autoSendTimer);

      // 3. Reset stabilizer and hold progress
      stabilizer.reset();
      updateHoldProgress(0);
      updateDetectedSign(null);

      // 4. Clear transcripts and conversation log
      clearTranscripts();
      clearConversationLog();

      // 5. Clear text inputs
      if (elements.testSpellInput) elements.testSpellInput.value = '';
      if (elements.replyTextInput) elements.replyTextInput.value = '';

      setStatus(elements.systemStatus, 'Status: Reset Completed');
    });
  }

  // 10. Training Mode Controls
  if (elements.recordSampleBtn) {
    elements.recordSampleBtn.addEventListener('click', async () => {
      hideTrainingError();

      if (!handTracker.isCameraActive) {
        showTrainingError('Camera is off.', 'Please click "Camera on" in the Outgoing column before recording training samples.');
        return;
      }

      const label = elements.trainingSignSelect ? elements.trainingSignSelect.value : '';
      if (!label) {
        showTrainingError('No label selected.', 'Please select a sign label from the dropdown.');
        return;
      }

      elements.recordSampleBtn.disabled = true;

      await recorder.record(label, {
        onProgress: (statusText) => {
          setStatus(elements.recordingStatusBadge, statusText);
        },
        onComplete: (count, recordedLabel) => {
          elements.recordSampleBtn.disabled = false;
          updateTrainingTable();
          setStatus(elements.recordingStatusBadge, `Recorded ${count} samples for ${recordedLabel}`);
        },
        onError: (title, fix) => {
          elements.recordSampleBtn.disabled = false;
          showTrainingError(title, fix);
        }
      });
    });
  }

  if (elements.clearAllSamplesBtn) {
    elements.clearAllSamplesBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all recorded training samples?')) {
        classifier.clearAll();
        updateTrainingTable();
        setStatus(elements.recordingStatusBadge, 'All samples cleared');
      }
    });
  }

  if (elements.exportModelBtn) {
    elements.exportModelBtn.addEventListener('click', () => {
      const jsonString = classifier.exportJSON();
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `signbridge_model_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatus(elements.recordingStatusBadge, 'Exported JSON file');
    });
  }

  if (elements.importModelInput) {
    elements.importModelInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const count = classifier.importJSON(event.target.result);
          updateTrainingTable();
          setStatus(elements.recordingStatusBadge, `Imported ${count} samples`);
          hideTrainingError();
        } catch (err) {
          console.error('Failed to parse imported model JSON:', err);
          showTrainingError('Invalid JSON file.', 'The selected file is not a valid SignBridge model export.');
        }
        elements.importModelInput.value = '';
      };
      reader.readAsText(file);
    });
  }

  // 11. Global Keyboard Shortcuts (M: Mic, C: Camera, Ctrl+Enter: Send)
  document.addEventListener('keydown', (e) => {
    // Ctrl + Enter: Send message (works anywhere including inputs)
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      if (elements.replyTextInput && elements.replyTextInput.value.trim().length > 0) {
        sendReplyMessage(elements.replyTextInput.value);
        elements.replyTextInput.value = '';
      } else {
        sendOutgoingSignedMessage();
      }
      return;
    }

    // Single-letter shortcuts: only when not typing inside an input or select
    const activeEl = document.activeElement;
    const isEditing = activeEl && (
      activeEl.tagName === 'INPUT' ||
      activeEl.tagName === 'TEXTAREA' ||
      activeEl.tagName === 'SELECT' ||
      activeEl.isContentEditable
    );

    if (isEditing) {
      return;
    }

    if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      hideSpeechError();
      speech.toggle();
    } else if (e.key === 'c' || e.key === 'C') {
      e.preventDefault();
      hideCameraError();
      handTracker.toggleCamera();
    }
  });

  console.log('SignBridge full loop and keyboard shortcuts initialized.');
});
