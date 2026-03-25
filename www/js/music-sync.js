// ===== SERIAL CONNECTION VARIABLES =====
let port;
let writer;
let isConnected = false;

// ===== MUSIC SYNC STATE =====
let bpm = 120;
let tapTimestamps = [];
const TAP_HISTORY_SIZE = 4;
let currentMode = "idle"; // 'idle', 'training', 'synced', 'armed'
let beatIntervalMs = 500; // 60000 / 120 BPM
let nextBeatTime = null;
let beatGridVisualizationId = null;

// Sync settings
let quantizeLevel = 1; // 1/4, 1/8, etc.
let preFireMs = 50;
let selectedEffect = null;
let selectedTail = null;

// Rate limiting to prevent effect spam
let lastEffectTriggerTime = 0;
const MIN_EFFECT_INTERVAL = 200; // ms

// ===== MICROPHONE INPUT STATE =====
let micStream = null;
let audioContext = null;
let analyser = null;
let micEnabled = false;
let micSensitivity = 0.5;
let frequencyRange = "bass";
let lastMicBeatTime = 0;
const MIC_BEAT_COOLDOWN = 200; // ms
let previousEnergy = 0;
let energySmoothingFactor = 0.3;
let micAnimationId = null;

// Initialize on page load
document.addEventListener("DOMContentLoaded", function () {
  setupEventListeners();
  populateEffectDropdown();
  updateBPMDisplay();
  generateBeatGrid();
});

// ===== EVENT LISTENERS =====
function setupEventListeners() {
  // Board connection
  document.getElementById("connectBtn").addEventListener("click", function () {
    if (isConnected) {
      disconnectSerial();
    } else {
      connectSerial();
    }
  });

  // Tap button
  document.getElementById("tapButton").addEventListener("click", function () {
    handleTap();
    animateTapButton();
  });

  // Allow spacebar to tap
  document.addEventListener("keydown", function (event) {
    if (event.code === "Space" && event.target === document.body) {
      event.preventDefault();
      handleTap();
      animateTapButton();
    }
  });

  // BPM input
  document.getElementById("bpmInput").addEventListener("change", function () {
    bpm = Math.max(40, Math.min(240, parseInt(this.value) || 120));
    updateBPMDisplay();
    generateBeatGrid();
    resetTaps();
  });

  // Reset taps button
  document.getElementById("resetTapBtn").addEventListener("click", resetTaps);

  // Quantize selector
  document
    .getElementById("quantizeSelect")
    .addEventListener("change", function () {
      quantizeLevel = parseFloat(this.value);
      generateBeatGrid();
    });

  // Effect selector
  document
    .getElementById("effectSelect")
    .addEventListener("change", function () {
      selectedEffect = this.value;
    });

  // Tail code selector
  document.getElementById("tailSelect").addEventListener("change", function () {
    selectedTail = this.value || null;
  });

  // Pre-fire adjustment
  document.getElementById("preFireMs").addEventListener("change", function () {
    preFireMs = Math.max(0, Math.min(200, parseInt(this.value) || 50));
  });

  // Arm Sync button
  document.getElementById("armSyncBtn").addEventListener("click", function () {
    if (currentMode === "armed") {
      disarmSync();
    } else {
      armSync();
    }
  });

  // Test Effect button
  document
    .getElementById("testEffectBtn")
    .addEventListener("click", function () {
      if (!isConnected) {
        showNotification("Connect to board first", "error");
        return;
      }

      if (!selectedEffect) {
        showNotification("Select an effect first", "error");
        return;
      }

      sendEffect(selectedEffect, selectedTail);
      showNotification(
        `Sent: ${selectedEffect}${selectedTail ? " + " + selectedTail : ""}`,
        "success",
      );
    });

  // Microphone input
  document
    .getElementById("micToggleBtn")
    .addEventListener("click", function () {
      if (micEnabled) {
        disableMicrophone();
      } else {
        enableMicrophone();
      }
    });

  document
    .getElementById("micSensitivity")
    .addEventListener("input", function () {
      micSensitivity = parseFloat(this.value);
    });

  document
    .getElementById("frequencyRange")
    .addEventListener("change", function () {
      frequencyRange = this.value;
    });
}

// ===== MICROPHONE INPUT LOGIC =====
async function enableMicrophone() {
  try {
    if (!audioContext) {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) {
        throw new Error("Web Audio API is not supported in this browser");
      }
      audioContext = new AudioContextCtor();
    }

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("getUserMedia is not available in this browser");
    }

    // Request microphone access
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    const createStreamSource =
      typeof audioContext.createMediaStreamSource === "function"
        ? audioContext.createMediaStreamSource.bind(audioContext)
        : typeof audioContext.createMediaStreamAudioSource === "function"
          ? audioContext.createMediaStreamAudioSource.bind(audioContext)
          : null;

    if (!createStreamSource) {
      throw new Error(
        "This browser audio context cannot create a microphone stream source",
      );
    }

    const source = createStreamSource(micStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;

    source.connect(analyser);

    micEnabled = true;
    document.getElementById("micToggleBtn").textContent = "Disable Mic";
    document.getElementById("micStatus").textContent = "Active";
    document.getElementById("micStatus").classList.add("mic-on");

    showNotification("Microphone enabled", "success");

    // Start beat detection loop
    analyzeMicrophoneInput();
  } catch (err) {
    console.error("Microphone access error:", err);
    const details = err && err.message ? `: ${err.message}` : "";
    showNotification(`Failed to access microphone${details}`, "error");
    micEnabled = false;
  }
}

function disableMicrophone() {
  micEnabled = false;

  if (micStream) {
    micStream.getTracks().forEach((track) => track.stop());
    micStream = null;
  }

  if (micAnimationId) {
    cancelAnimationFrame(micAnimationId);
    micAnimationId = null;
  }

  document.getElementById("micToggleBtn").textContent = "Enable Mic";
  document.getElementById("micStatus").textContent = "Off";
  document.getElementById("micStatus").classList.remove("mic-on");

  // Reset energy bar
  document.getElementById("energyBar").style.width = "0%";
  document.getElementById("energyLabel").textContent = "Energy: 0%";

  showNotification("Microphone disabled", "success");
}

function analyzeMicrophoneInput() {
  if (!micEnabled || !analyser) return;

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);

  // Calculate energy based on frequency range
  let energy = 0;
  let rangeStart = 0;
  let rangeEnd = dataArray.length;

  if (frequencyRange === "bass") {
    // 0-250 Hz (kick drums)
    rangeEnd = Math.floor(dataArray.length * 0.15);
  } else if (frequencyRange === "mid") {
    // 250-4000 Hz (drums, vocals)
    rangeStart = Math.floor(dataArray.length * 0.15);
    rangeEnd = Math.floor(dataArray.length * 0.6);
  } else if (frequencyRange === "treble") {
    // 4000+ Hz (cymbals, hi-hats)
    rangeStart = Math.floor(dataArray.length * 0.6);
  }

  // Sum energy in frequency range
  for (let i = rangeStart; i < rangeEnd; i++) {
    energy += dataArray[i];
  }

  // Average energy
  const sampleCount = rangeEnd - rangeStart;
  energy = energy / sampleCount / 255; // Normalize to 0-1

  // Compute energy delta before smoothing update.
  const energyChange = energy - previousEnergy;

  // Apply exponential smoothing
  const smoothedEnergy =
    previousEnergy * (1 - energySmoothingFactor) +
    energy * energySmoothingFactor;
  previousEnergy = smoothedEnergy;

  // Update energy visualization
  const energyPercent = Math.round(smoothedEnergy * 100);
  updateEnergyVisualization(energyPercent);

  // Detect beat onset (rapid energy increase)
  const energyThreshold = 0.4 * (1 - micSensitivity + 0.1); // Adjust by sensitivity

  if (smoothedEnergy > energyThreshold && energyChange > 0.05) {
    const now = Date.now();
    if (now - lastMicBeatTime > MIC_BEAT_COOLDOWN) {
      handleMicrophoneBeat();
      lastMicBeatTime = now;
    }
  }

  micAnimationId = requestAnimationFrame(analyzeMicrophoneInput);
}

function updateEnergyVisualization(percentEnergy) {
  const energyBar = document.getElementById("energyBar");
  energyBar.style.width = percentEnergy + "%";
  document.getElementById("energyLabel").textContent =
    `Energy: ${percentEnergy}%`;
}

function handleMicrophoneBeat() {
  // Feed microphone beat into the tap tempo system
  handleTap();
  animateTapButton();

  // Pulse energy bar
  const energyBar = document.getElementById("energyBar");
  energyBar.classList.remove("beat-detected");
  void energyBar.offsetWidth; // Trigger reflow
  energyBar.classList.add("beat-detected");
}

// ===== TAP TEMPO LOGIC =====
function handleTap() {
  const now = Date.now();
  tapTimestamps.push(now);

  // Keep only last N taps
  if (tapTimestamps.length > TAP_HISTORY_SIZE) {
    tapTimestamps.shift();
  }

  updateTapDisplay();

  // Need at least 3 taps to establish tempo
  if (tapTimestamps.length >= 3) {
    calculateBPMFromTaps();
  }
}

function calculateBPMFromTaps() {
  if (tapTimestamps.length < 2) return;

  // Calculate intervals between taps
  const intervals = [];
  for (let i = 1; i < tapTimestamps.length; i++) {
    intervals.push(tapTimestamps[i] - tapTimestamps[i - 1]);
  }

  // Use median interval for stability
  intervals.sort((a, b) => a - b);
  const medianInterval = intervals[Math.floor(intervals.length / 2)];

  // Smooth the BPM change with exponential moving average
  const newBPM = Math.round(60000 / medianInterval);
  const smoothedBPM = Math.round(bpm * 0.7 + newBPM * 0.3);

  // Validate range
  bpm = Math.max(40, Math.min(240, smoothedBPM));
  beatIntervalMs = 60000 / bpm;

  // Update UI
  updateBPMDisplay();
  generateBeatGrid();
  updateStatusIndicator("synced");
}

function resetTaps() {
  tapTimestamps = [];
  updateTapDisplay();
  updateStatusIndicator("idle");
  currentMode = "idle";
}

function updateTapDisplay() {
  const count = tapTimestamps.length;
  document.getElementById("tapCount").textContent =
    `${count} tap${count !== 1 ? "s" : ""}`;
}

// ===== BPM & DISPLAY =====
function updateBPMDisplay() {
  document.getElementById("bpmInput").value = bpm;
  beatIntervalMs = 60000 / bpm;
}

function updateStatusIndicator(status) {
  const dot = document.getElementById("syncStatus");
  const text = document.getElementById("statusText");

  dot.classList.remove("waiting", "synced", "armed", "error");
  dot.classList.add(status);

  const messages = {
    idle: "No tempo detected. Tap the button or enter BPM.",
    waiting: "Waiting for taps...",
    synced: `Synced to ${bpm} BPM`,
    armed: `Armed @ ${bpm} BPM – standing by`,
    error: "Error connecting to device",
  };

  text.textContent = messages[status] || "Ready";
  currentMode = status;
}

// ===== BEAT GRID =====
function generateBeatGrid() {
  const barsToShow = 2;
  const beatsPerBar = 4;
  const beatsToShow = barsToShow * beatsPerBar;

  const gridElement = document.getElementById("beatGrid");
  gridElement.innerHTML = "";

  // Calculate grid step based on quantize level
  const gridStepMs = beatIntervalMs / quantizeLevel;

  for (let beatIndex = 0; beatIndex < beatsToShow; beatIndex++) {
    const beatElement = document.createElement("div");
    beatElement.className = "beat";

    // Mark downbeats (every 4 beats)
    if (beatIndex % beatsPerBar === 0) {
      beatElement.classList.add("downbeat");
      beatElement.textContent = beatIndex + 1;
    } else if (quantizeLevel > 1) {
      beatElement.classList.add("grid-snap");
      beatElement.textContent = "•";
    } else {
      beatElement.textContent = beatIndex + 1;
    }

    gridElement.appendChild(beatElement);
  }

  // Update grid info
  document.getElementById("gridInfo").textContent =
    `Beat interval: ${beatIntervalMs.toFixed(0)}ms | Grid step: ${gridStepMs.toFixed(0)}ms | Quantize: 1/${quantizeLevel}`;
}

// ===== SYNC MODE =====
function armSync() {
  if (!isConnected) {
    showNotification("Connect to board first", "error");
    return;
  }

  if (!selectedEffect) {
    showNotification("Select an effect first", "error");
    return;
  }

  if (tapTimestamps.length < 1 && bpm === 120) {
    showNotification("Set BPM first (tap or enter manually)", "warning");
    return;
  }

  currentMode = "armed";
  document.getElementById("armSyncBtn").classList.add("armed");
  document.getElementById("armSyncBtn").textContent = "Stop Sync";
  updateStatusIndicator("armed");

  // Start beat clock
  startBeatClock();
  showNotification(`Sync armed @ ${bpm} BPM`, "success");
}

function disarmSync() {
  currentMode = "synced";
  document.getElementById("armSyncBtn").classList.remove("armed");
  document.getElementById("armSyncBtn").textContent = "Arm Sync";
  updateStatusIndicator("synced");

  if (beatGridVisualizationId) {
    cancelAnimationFrame(beatGridVisualizationId);
    beatGridVisualizationId = null;
  }

  showNotification("Sync disarmed", "success");
}

// ===== BEAT CLOCK =====
function startBeatClock() {
  if (beatGridVisualizationId) {
    cancelAnimationFrame(beatGridVisualizationId);
  }

  const startTime = Date.now();
  nextBeatTime = startTime + beatIntervalMs;

  function tick() {
    if (currentMode !== "armed") {
      return;
    }

    const now = Date.now();
    const timeUntilBeat = nextBeatTime - now;

    // Trigger effect slightly before beat arrives (pre-fire)
    if (timeUntilBeat <= preFireMs && timeUntilBeat > -50) {
      triggerEffectOnBeat();
      nextBeatTime += beatIntervalMs;
    }

    // If we've overshot a beat, skip to next
    if (now > nextBeatTime + 100) {
      nextBeatTime = now + beatIntervalMs;
    }

    // Visual feedback: highlight beat grid
    updateBeatGridVisualization(now, startTime);

    beatGridVisualizationId = requestAnimationFrame(tick);
  }

  tick();
}

function triggerEffectOnBeat() {
  const now = Date.now();

  // Rate limit to prevent spam
  if (now - lastEffectTriggerTime < MIN_EFFECT_INTERVAL) {
    return;
  }

  lastEffectTriggerTime = now;

  if (selectedEffect && isConnected) {
    sendEffect(selectedEffect, selectedTail);
    showNotification(
      `Beat: ${selectedEffect}${selectedTail ? " + " + selectedTail : ""}`,
      "success",
    );
  }
}

function updateBeatGridVisualization(now, startTime) {
  const beats = document.querySelectorAll(".beat");
  const elapsedMs = now - startTime;
  const gridStepMs = beatIntervalMs / quantizeLevel;

  let currentBeatIndex = Math.floor(elapsedMs / gridStepMs);

  // Remove all active classes
  beats.forEach((beat) => beat.classList.remove("active"));

  // Highlight current/next beat
  if (currentBeatIndex < beats.length) {
    beats[currentBeatIndex % beats.length].classList.add("active");
  }
}

// ===== EFFECT TRIGGERING =====
function populateEffectDropdown() {
  const selectElement = document.getElementById("effectSelect");
  selectElement.innerHTML = '<option value="">-- Select Effect --</option>';

  // Add base color effects
  for (const key in base_color_effects) {
    const option = document.createElement("option");
    option.value = key;
    option.text = key;
    selectElement.appendChild(option);
  }

  // Add special effects
  for (const key in special_effects) {
    const option = document.createElement("option");
    option.value = key;
    option.text = key + " (special)";
    selectElement.appendChild(option);
  }
}

function animateTapButton() {
  const button = document.getElementById("tapButton");
  button.classList.remove("tap-pulse");
  // Trigger reflow to restart animation
  void button.offsetWidth;
  button.classList.add("tap-pulse");
}

// ===== SERIAL COMMUNICATION =====
async function disconnectSerial() {
  if (writer) {
    writer.releaseLock();
  }
  showNotification("Device disconnected!", "disconnected");
  isConnected = false;
  const connectBtn = document.getElementById("connectBtn");
  connectBtn.classList.remove("btn-disconnect");
  connectBtn.classList.add("btn-connect");
  connectBtn.innerText = "Connect to board";

  if (currentMode === "armed") {
    disarmSync();
  }

  if (micEnabled) {
    disableMicrophone();
  }

  if (port) {
    await port.close();
  }
}

async function connectSerial() {
  if (!navigator.serial) {
    alert("Web Serial API not supported. Please use Chrome, Edge, or Opera.");
    return;
  }

  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
    writer = port.writable.getWriter();
    isConnected = true;
    showNotification("Device connected successfully!", "connected");
    const connectBtn = document.getElementById("connectBtn");
    connectBtn.classList.remove("btn-connect");
    connectBtn.classList.add("btn-disconnect");
    connectBtn.innerText = "Disconnect from board";
  } catch (err) {
    console.error("Connection error:", err);
    showNotification("Failed to connect to device", "error");
    disconnectSerial();
  }
}

function bits_to_run_lengths_pulses(bit_list) {
  let run_lengths = [];
  let currentCount = 0;
  let currentBit = null;

  for (let i = 0; i < bit_list.length; i++) {
    if (bit_list[i] !== currentBit) {
      if (currentBit !== null) {
        run_lengths.push(currentCount);
      }
      currentCount = 1;
      currentBit = bit_list[i];
    } else {
      currentCount++;
    }
  }

  if (currentBit !== null) {
    run_lengths.push(currentCount);
  }

  return run_lengths;
}

function bits_to_arduino_string(bit_list) {
  let run_lengths = bits_to_run_lengths_pulses(bit_list);
  if (Math.max.apply(null, run_lengths) > 9) {
    throw new Error(
      `Board can't accept over 9 of the same bit in a row.\n${bit_list}`,
    );
  }

  let out = "[" + run_lengths.length + "]";
  out += run_lengths.map((i) => parseInt(i)).join("");
  return out + ",";
}

async function sendEffect(MAIN_EFFECT, TAIL_CODE) {
  let effect_bits;

  if (base_color_effects.hasOwnProperty(MAIN_EFFECT)) {
    effect_bits = base_color_effects[MAIN_EFFECT];
    if (TAIL_CODE) {
      if (tail_codes.hasOwnProperty(TAIL_CODE)) {
        effect_bits = effect_bits.concat(tail_codes[TAIL_CODE]);
      } else {
        throw new Error("Invalid tail code name.");
      }
    }
  } else if (special_effects.hasOwnProperty(MAIN_EFFECT)) {
    effect_bits = special_effects[MAIN_EFFECT];
    if (TAIL_CODE) {
      throw new Error(
        "Tail code effects only supported on base color effects.",
      );
    }
  } else {
    throw new Error("Invalid MAIN_EFFECT.");
  }

  const arduino_string_ver = bits_to_arduino_string(effect_bits);
  await writer.write(new TextEncoder().encode(arduino_string_ver));
  await new Promise((resolve) => setTimeout(resolve, 100));
}

// ===== NOTIFICATION SYSTEM =====
function showNotification(message, type) {
  const notification = document.getElementById("notification");

  notification.textContent = message;
  if (type === "connected" || type === "success") {
    notification.style.backgroundColor = "#4CAF50";
  } else if (type === "disconnected" || type === "error") {
    notification.style.backgroundColor = "#f44336";
  } else if (type === "warning") {
    notification.style.backgroundColor = "#ff9800";
  } else {
    notification.style.backgroundColor = "#29b6f6";
  }

  notification.classList.remove("hide");
  notification.classList.add("show");
  notification.style.display = "block";

  setTimeout(() => {
    notification.classList.remove("show");
    notification.classList.add("hide");
    setTimeout(() => {
      notification.style.display = "none";
    }, 300);
  }, 3000);
}
