# SignBridge

**SignBridge** is a real-time, two-way communication bridge designed for seamless conversations between a deaf or non-speaking person who uses American Sign Language (ASL) fingerspelling and a hearing person who does not know sign language.

---

## How It Works

1. **Hearing $\rightarrow$ Signer (Incoming)**:
   - The hearing person speaks into their microphone.
   - The Web Speech API `SpeechRecognition` transcribes speech continuously with real-time interim and final results.
   - Text is displayed in the transcript and queued into an ASL Fingerspelling player, which shows sequential letter signs on a card (with bold & underlined word tracking) alongside speech transcripts.
2. **Signer $\rightarrow$ Hearing (Outgoing)**:
   - The deaf/non-speaking signer signs into their webcam.
   - MediaPipe Tasks Vision (`HandLandmarker`) tracks 21 3D hand landmarks in real-time.
   - A personalized $k$-Nearest Neighbors ($k=5$) classifier matches translation- and scale-invariant normalized landmark vectors against custom recorded samples.
   - A temporal stabilizer (15-frame rolling window with 80% agreement held for 1 second) prevents jitter and accidental repeat triggers.
   - Gestures assemble letters into words (`SPACE` open-palm commits words, `DELETE` fist removes letters).
   - Outgoing messages pass through `cleanupText()` (autocorrect and sentence-casing) and are spoken aloud using `speechSynthesis`, with a typed reply box and 8 quick-reply buttons as fallbacks.
   - **Echo Avoidance**: Speech recognition is automatically paused while TTS is reading messages aloud to prevent audio feedback loops.

---

## Tech Stack & Architecture

- **Core**: Vanilla HTML5, CSS3, and modern JavaScript (ES Modules). No build steps or external bundlers required.
- **Design System**: Strict high-contrast Black (`#000000`) and White (`#FFFFFF`) aesthetic, square corners, zero animations/transitions, min 44px touch targets, full keyboard accessibility, and `aria-live` polite regions.
- **Speech-to-Text**: Web Speech API `SpeechRecognition` (continuous, interim results, auto-restarting).
- **Text-to-Speech**: Web Speech API `speechSynthesis` with system voice selection (preferring `en-IN` by default) and rate scaling.
- **Vision & Hand Tracking**: Google MediaPipe Tasks Vision `HandLandmarker` running in `VIDEO` mode (1 hand) via jsDelivr CDN with local `models/hand_landmarker.task`.
- **Classification**: Custom pure JavaScript $k$-NN classifier ($k=5$) with confidence ($0.60$) and nearest distance ($1.25$) rejection thresholds.
- **Storage**: `localStorage` auto-save/auto-load plus formatted JSON model import and export.

---

## File Structure

```text
signbridge/
├── index.html               # Semantic UI skeleton & layout
├── style.css                # Strict black & white design system (zero animations)
├── README.md                # Comprehensive documentation & demo guide
├── serve.ps1                # Lightweight Windows local HTTP server (localhost:8000)
├── js/
│   ├── main.js              # Application entry point, loop orchestration & keyboard shortcuts
│   ├── ui.js                # UI DOM bindings, alerts, table rendering & status updates
│   ├── speech.js            # SpeechRecognition wrapper with echo-suppression mic pause
│   ├── fingerspell.js       # ASL fingerspelling playback queue with letter fallback & pacing
│   ├── tts.js               # SpeechSynthesis controller with voice detection & rate control
│   ├── handtracking.js      # MediaPipe HandLandmarker controller & 63-vector normalization
│   ├── classifier.js        # KNN classifier (k=5) with rejection thresholds & storage
│   ├── recorder.js          # 3-second text countdown & 80-frame landmark sample recorder
│   └── stabilizer.js        # 15-frame rolling window debouncer & hold progress tracker
├── signs/                   # ASL fingerspelling alphabet images (a.png ... z.png)
│   └── README.md            # Asset instructions
└── models/                  # MediaPipe task models
    ├── hand_landmarker.task # HandLandmarker task model bundle (7.8 MB)
    └── README.md            # Model notes
```

---

## Quick Setup & Running Locally

SignBridge runs directly in modern Chromium browsers (Google Chrome, Microsoft Edge).

### 1. Start the HTTP Server
Run either Python or the provided PowerShell server:

**Using Python**:
```bash
python -m http.server 8000
```

**Using PowerShell (Windows)**:
```powershell
powershell -File serve.ps1
```

### 2. Open in Google Chrome
Navigate to:
```text
http://localhost:8000
```

---

## Model & Asset Sources

### MediaPipe Model (`models/hand_landmarker.task`)
The model is stored locally in `models/hand_landmarker.task`.
If you ever need to re-download the official model bundle:
- Direct Google Cloud Storage URL:
  ```text
  https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
  ```
- Save the file as: `models/hand_landmarker.task`.

### ASL Fingerspelling Images (`signs/a.png` ... `z.png`)
The fingerspelling player looks for `signs/<letter>.png` (e.g. `signs/a.png`, `signs/b.png`, ..., `signs/z.png`).
- **Missing Image Fallback**: If an image is not found, SignBridge gracefully falls back to displaying the large 120px bold letter text without error.
- **Where to obtain image sets**:
  - [Wikimedia Commons American Sign Language Alphabet](https://commons.wikimedia.org/wiki/Category:Sign_language_letter_icons) (Public Domain / CC0).
  - Kaggle ASL Alphabet Datasets (transparent PNGs).
  - Place individual letter images in the `signs/` directory named lowercase `a.png` through `z.png`.

---

## How to Train Signs (Training Mode)

1. Click **"Camera on"** in the Outgoing column to activate your webcam.
2. Click to expand **"Training Mode (KNN Custom Classifier)"** at the bottom of the page.
3. Choose a **Target Label** from the dropdown:
   - Letters `A` through `Z`
   - `SPACE (open palm)`
   - `DELETE (fist)`
4. Hold your hand in position and click **"Record"**:
   - The status badge displays a text countdown: `Counting down: 3` $\rightarrow$ `2` $\rightarrow$ `1`.
   - The recorder captures 80 normalized landmark vectors: `Recording: 12/80` $\rightarrow$ `80/80`.
   - *Tip: Vary your hand angle, distance, and tilt slightly while recording.*
   - If your hand drops out of frame, the recorder pauses and resumes once detected again.
5. Once complete, the letter is added to the **Recorded Samples** table and automatically saved to `localStorage`.
6. **Export / Import**:
   - Click **"Export JSON"** to backup your trained model to a `.json` file.
   - Click **"Import JSON"** to restore your dataset on any machine or browser.

---

## Keyboard Shortcuts

- <kbd>M</kbd> : Toggle microphone listening on / off.
- <kbd>C</kbd> : Toggle webcam camera on / off.
- <kbd>Ctrl</kbd> + <kbd>Enter</kbd> : Send and speak current message.

*(Single-letter shortcuts are automatically disabled while typing in input fields).*

---

## 30-Second Demo Script

Here is an ideal 30-second back-and-forth conversation demonstration:

| Time | Participant | Action | Result |
| :--- | :--- | :--- | :--- |
| **0:00 - 0:05** | Setup | Click **Start Listening** (<kbd>M</kbd>) and **Camera on** (<kbd>C</kbd>). | Both status indicators show `Mic: Listening` and `Camera: On`. |
| **0:05 - 0:12** | Hearing Person | Speaks: *"Hello, how are you today?"* | Spoken text transcribes live; logged as `[HH:MM] They said: Hello how are you today`; ASL card fingerspells letters with bold-underline tracking. |
| **0:12 - 0:22** | Deaf Signer | Signs **"L"** (1s hold) $\rightarrow$ Signs **"V"** (1s hold) $\rightarrow$ Signs **"SPACE"** (1s hold) $\rightarrow$ Clicks **Send** (or <kbd>Ctrl</kbd>+<kbd>Enter</kbd>). | Black progress bar fills; `Word: L V` forms; commits to message; `cleanupText()` formats output; computer speaks *"Lv"* aloud via TTS. |
| **0:22 - 0:26** | System | TTS speaks aloud while mic automatically pauses. | Status briefly shows `Mic: Paused (TTS)` then resumes to `Mic: Listening` without picking up the speaker's audio. |
| **0:26 - 0:30** | Reset | Click **Reset All** in the header. | Transcripts, fingerspelling queue, word buffer, and conversation log clear instantly. |

---

## Known Limitations

1. **Dynamic Motion Signs ($J$ and $Z$)**:
   - In ASL fingerspelling, $J$ requires tracing a downward hook with the pinky, and $Z$ requires tracing a "Z" in the air with the index finger.
   - Because single-frame 3D landmark classification focuses on static hand postures, $J$ and $Z$ cannot be reliably separated without multi-frame temporal trajectory tracking.
2. **Morphologically Similar Fist Postures ($A, S, T, M, N$)**:
   - Signs like $A$ (thumb beside fist), $S$ (thumb over fingers), $T$ (thumb under index), $M$ (thumb under 3 fingers), and $N$ (thumb under 2 fingers) share nearly identical finger curl positions and vary only in subtle thumb occlusions. Camera angle and lighting can make these challenging for single-camera 2D/3D depth estimation.
3. **Single-Handed ASL Scope**:
   - Currently trained for single-hand American Sign Language fingerspelling; two-handed sign systems are not supported in the single-hand pipeline.

---

## Project Roadmap

- [ ] **Indian Sign Language (ISL) Two-Handed Support**: Extend MediaPipe `numHands: 2` to track and classify two-handed fingerspelling alphabets used in ISL and BSL.
- [ ] **Common Word & Phrase Gesture Recognition**: Expand classifier to recognize whole-word signs (e.g. *Hello*, *Thank you*, *Help*, *Water*) beyond fingerspelling.
- [ ] **LLM Natural Language Reconstruction**: Connect the `cleanupText()` hook to the Gemini API or Chrome Built-in AI Prompt API to expand raw sign glosses into grammatically fluent, conversational English sentences.
- [ ] **Chrome Extension for Video Calls**: Package the core modular logic (`speech.js`, `handtracking.js`, `classifier.js`, `tts.js`) into a manifest v3 pop-up overlay for Google Meet, Zoom, and Teams meetings.
