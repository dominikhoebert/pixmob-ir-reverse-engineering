// Serial connection variables (reused from script.js)
let port;
let writer;
let isConnected = false;

// Keyboard mapping storage
let keyMappings = {};
let currentMode = "trigger"; // 'trigger' or 'map'
let selectedKeyForMapping = null;
const MAPPINGS_STORAGE_KEY = "pixmob_dj_mappings";

// Initialize on page load
document.addEventListener("DOMContentLoaded", async function () {
  await loadMappings();
  setupEventListeners();
  populateEffectDropdown();
  updateKeyLabels();
});

// Setup all event listeners
function setupEventListeners() {
  // Connect button
  document.getElementById("connectBtn").addEventListener("click", function () {
    if (isConnected) {
      disconnectSerial();
    } else {
      connectSerial();
    }
  });

  // Mode selector
  document.querySelectorAll('input[name="mode"]').forEach((radio) => {
    radio.addEventListener("change", function () {
      currentMode = this.value;
      document.getElementById("mappingPanel").style.display = "none";
      selectedKeyForMapping = null;
      clearKeySelection();
    });
  });

  // Key clicks
  document.querySelectorAll(".key").forEach((keyElement) => {
    keyElement.addEventListener("click", function () {
      handleKeyClick(this.dataset.key);
    });
  });

  // Physical keyboard presses
  document.addEventListener("keydown", function (event) {
    // Ignore if typing in input fields
    if (event.target.tagName === "INPUT" || event.target.tagName === "SELECT") {
      return;
    }

    const key = event.key.toLowerCase();

    // Check if this key exists in our keyboard
    const keyElement = document.querySelector(`.key[data-key="${key}"]`);
    if (keyElement) {
      event.preventDefault();
      handleKeyPress(key, keyElement);
    }
  });

  // Mapping controls
  document
    .getElementById("saveMapping")
    .addEventListener("click", saveCurrentMapping);
  document
    .getElementById("cancelMapping")
    .addEventListener("click", cancelMapping);
  document
    .getElementById("clearKeyMapping")
    .addEventListener("click", clearCurrentKeyMapping);

  // Utility buttons
  document
    .getElementById("clearMappingsBtn")
    .addEventListener("click", clearAllMappings);
  document
    .getElementById("exportMappingsBtn")
    .addEventListener("click", exportMappings);
  document
    .getElementById("importMappingsBtn")
    .addEventListener("click", function () {
      document.getElementById("importFileInput").click();
    });
  document
    .getElementById("importFileInput")
    .addEventListener("change", importMappings);

  // Help modal
  const helpBtn = document.getElementById("helpBtn");
  const helpModal = document.getElementById("helpModal");
  const closeModal = document.getElementsByClassName("close")[0];

  helpBtn.onclick = function () {
    helpModal.style.display = "block";
  };

  closeModal.onclick = function () {
    helpModal.style.display = "none";
  };

  window.onclick = function (event) {
    if (event.target == helpModal) {
      helpModal.style.display = "none";
    }
  };
}

// Handle key click
function handleKeyClick(key) {
  if (currentMode === "map") {
    enterMappingMode(key);
  } else {
    triggerEffect(key);
  }
}

// Handle physical keyboard press
function handleKeyPress(key, keyElement) {
  if (currentMode === "trigger") {
    // Visual feedback
    keyElement.classList.add("key-pressed");
    setTimeout(() => keyElement.classList.remove("key-pressed"), 200);

    triggerEffect(key);
  } else {
    handleKeyClick(key);
  }
}

// Enter mapping mode for a specific key
function enterMappingMode(key) {
  selectedKeyForMapping = key;
  document.getElementById("selectedKey").textContent = key.toUpperCase();
  document.getElementById("mappingPanel").style.display = "block";

  // Highlight selected key
  clearKeySelection();
  const keyElement = document.querySelector(`.key[data-key="${key}"]`);
  if (keyElement) {
    keyElement.classList.add("key-selected");
  }

  // Load existing mapping if any
  if (keyMappings[key]) {
    document.getElementById("effectSelect").value = keyMappings[key].effect;
    document.getElementById("tailSelect").value = keyMappings[key].tail || "";
  } else {
    document.getElementById("effectSelect").selectedIndex = 0;
    document.getElementById("tailSelect").selectedIndex = 0;
  }
}

// Save current mapping
function saveCurrentMapping() {
  if (!selectedKeyForMapping) return;

  const effect = document.getElementById("effectSelect").value;
  const tail = document.getElementById("tailSelect").value;

  if (!effect) {
    showNotification("Please select an effect", "error");
    return;
  }

  keyMappings[selectedKeyForMapping] = {
    effect: effect,
    tail: tail || null,
  };

  saveMappings();
  updateKeyLabels();
  cancelMapping();
  showNotification(
    `Key ${selectedKeyForMapping.toUpperCase()} mapped to ${effect}`,
    "success",
  );
}

// Cancel mapping
function cancelMapping() {
  document.getElementById("mappingPanel").style.display = "none";
  selectedKeyForMapping = null;
  clearKeySelection();
}

// Clear current key mapping
function clearCurrentKeyMapping() {
  if (!selectedKeyForMapping) return;

  delete keyMappings[selectedKeyForMapping];
  saveMappings();
  updateKeyLabels();
  cancelMapping();
  showNotification(
    `Key ${selectedKeyForMapping.toUpperCase()} mapping cleared`,
    "success",
  );
}

// Clear all mappings
function clearAllMappings() {
  if (confirm("Are you sure you want to clear all key mappings?")) {
    keyMappings = {};
    saveMappings();
    updateKeyLabels();
    showNotification("All mappings cleared", "success");
  }
}

// Clear key selection visual
function clearKeySelection() {
  document
    .querySelectorAll(".key")
    .forEach((k) => k.classList.remove("key-selected"));
}

// Trigger effect for a key
function triggerEffect(key) {
  const mapping = keyMappings[key];

  if (!mapping) {
    showNotification(`Key ${key.toUpperCase()} has no mapping`, "error");
    return;
  }

  if (!isConnected) {
    showNotification("Please connect to the board first", "error");
    return;
  }

  sendEffect(mapping.effect, mapping.tail);
  showNotification(
    `Sending ${mapping.effect}${mapping.tail ? " + " + mapping.tail : ""}`,
    "success",
  );
}

// Update key labels with mapped effects
function updateKeyLabels() {
  document.querySelectorAll(".key").forEach((keyElement) => {
    const key = keyElement.dataset.key;
    const label = keyElement.querySelector(".key-label");

    if (keyMappings[key]) {
      const mapping = keyMappings[key];
      let labelText = mapping.effect;

      // Shorten long effect names
      if (labelText.length > 12) {
        labelText = labelText.substring(0, 10) + "...";
      }

      label.textContent = labelText;
      keyElement.classList.add("key-mapped");

      // Add color based on effect name
      const color = getColorFromEffectName(mapping.effect);
      if (color) {
        keyElement.style.borderColor = color;
        keyElement.style.backgroundColor = color + "15"; // 15 for slight transparency
      }
    } else {
      label.textContent = "";
      keyElement.classList.remove("key-mapped");
      keyElement.style.borderColor = "";
      keyElement.style.backgroundColor = "";
    }
  });
}

// Get color from effect name for visual feedback
function getColorFromEffectName(effectName) {
  const name = effectName.toUpperCase();
  if (name.includes("RED")) return "#ff0000";
  if (name.includes("GREEN")) return "#00ff00";
  if (name.includes("BLUE")) return "#0000ff";
  if (name.includes("YELLOW")) return "#ffff00";
  if (name.includes("ORANGE")) return "#ff8800";
  if (name.includes("PINK")) return "#ff00ff";
  if (name.includes("MAGENTA")) return "#ff00aa";
  if (name.includes("TURQUOISE")) return "#00ffff";
  if (name.includes("WHITE")) return "#ffffff";
  if (name.includes("PURPLE")) return "#8800ff";
  return null;
}

// Populate effect dropdown
function populateEffectDropdown() {
  const selectElement = document.getElementById("effectSelect");

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

// Save mappings to localStorage
function saveMappings() {
  localStorage.setItem(MAPPINGS_STORAGE_KEY, JSON.stringify(keyMappings));
}

// Load mappings from localStorage
async function loadMappings() {
  const saved = localStorage.getItem(MAPPINGS_STORAGE_KEY);

  if (saved !== null) {
    try {
      keyMappings = JSON.parse(saved);
      return;
    } catch (e) {
      console.error("Failed to load mappings:", e);
      keyMappings = {};
      return;
    }
  }

  // First visit in this browser: seed mappings from bundled example file.
  try {
    const response = await fetch("example-mappings.json", {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch example mappings: ${response.status}`);
    }

    const defaults = await response.json();
    if (defaults && typeof defaults === "object") {
      keyMappings = defaults;
      saveMappings();
      showNotification("Loaded default key mappings", "success");
      return;
    }
  } catch (e) {
    console.error("Failed to load default mappings:", e);
  }

  keyMappings = {};
}

// Export mappings as JSON file
function exportMappings() {
  const dataStr = JSON.stringify(keyMappings, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "pixmob-dj-mappings.json";
  link.click();
  URL.revokeObjectURL(url);
  showNotification("Mappings exported", "success");
}

// Import mappings from JSON file
function importMappings(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const imported = JSON.parse(e.target.result);
      keyMappings = imported;
      saveMappings();
      updateKeyLabels();
      showNotification("Mappings imported successfully", "success");
    } catch (error) {
      showNotification("Failed to import mappings", "error");
      console.error("Import error:", error);
    }
  };
  reader.readAsText(file);

  // Reset file input
  event.target.value = "";
}

// ===== SERIAL COMMUNICATION (reused from script.js) =====

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

// Show notification
function showNotification(message, type) {
  const notification = document.getElementById("notification");

  notification.textContent = message;
  if (type === "connected" || type === "success") {
    notification.style.backgroundColor = "#4CAF50";
  } else if (type === "disconnected" || type === "error") {
    notification.style.backgroundColor = "#f44336";
  } else {
    notification.style.backgroundColor = "#2196F3";
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
