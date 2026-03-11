# PixMob Web UI

A web-based interface for controlling PixMob IR wristbands using an Arduino/ESP32 with an IR transmitter.

## Features

- **Original UI** (`index.html`) - Traditional dropdown-based interface for selecting and sending effects
- **🎹 DJ Keyboard Mode** (`dj.html`) - NEW! Map IR commands to keyboard keys for live "DJ-ing" of lights
  - Visual keyboard interface with click or physical key press support
  - Customizable key mappings with localStorage persistence
  - Export/import mappings for backup or sharing
  - Color-coded keys based on mapped effects
  - Two modes: Trigger (play effects) and Mapping (assign effects to keys)

## Quick Start

### Option 1: Python HTTP Server (Recommended for local testing)

Run from this directory:

```bash
py -m http.server 8000
```

Then open: http://localhost:8000

### Option 2: Open directly in browser

Simply open `index.html` in a modern web browser (Chrome, Edge, Firefox).

**Note:** Web Serial API requires HTTPS or localhost, so some features may not work when opening directly as a file.

### Option 3: Live Demo

Test it online at: https://ivanr3d.com/tools/led-wristband/

## Hardware Requirements

1. **Arduino-compatible microcontroller** (Arduino Uno, Mega, ESP32, etc.)
2. **940nm IR transmitter** - Either a raw IR LED or a transmitter module like [this one](https://www.amazon.com/Digital-Receiver-Transmitter-Arduino-Compatible/dp/B01E20VQD8/)

## Setup Instructions

### 1. Upload Arduino Sketch

Upload the appropriate sketch to your board:

- **For Arduino boards**: [PixMob_Transmitter_Arduino.ino](../arduino_sender/PixMob_Transmitter_Arduino/PixMob_Transmitter_Arduino.ino)
- **For ESP32 boards**: [PixMob_Transmitter_ESP32.ino](../arduino_sender/PixMob_Transmitter_ESP32/PixMob_Transmitter_ESP32.ino)

### 2. Connect Hardware

Wire the IR transmitter to your board according to the pin configuration in the sketch.

### 3. Use the Web Interface

#### Original Interface (index.html)

1. Click "Connect to board" button
2. Select your Arduino's serial port from the browser dialog
3. Choose a main effect from the dropdown
4. Optionally select a tail code (for fade effects, probabilistic effects, etc.)
5. Click "Send" to transmit the IR signal

#### DJ Keyboard Interface (dj.html)

The DJ Keyboard mode provides a more interactive way to control PixMob lights in real-time:

**Setup:**

1. Click "Connect to board" and select your Arduino
2. Switch to "Mapping Mode"
3. Click a key on the virtual keyboard
4. Select an effect and optional tail code
5. Click "Save Mapping"
6. Repeat for as many keys as you want to map

**Usage:**

1. Switch to "Trigger Mode"
2. Press keys on your physical keyboard OR click keys on screen
3. Watch your lights respond instantly!

**Features:**

- **37 mappable keys** (numbers 1-0 and letters Q-M)
- **Visual feedback** - Keys are color-coded by effect type
- **Persistent storage** - Mappings saved automatically in localStorage
- **Export/Import** - Save mapping configurations as JSON files
- **Both input methods** - Physical keyboard and on-screen clicks work simultaneously

**Tips:**

- Map your favorite colors to number keys for quick access
- Use letter keys for more complex effects or special effects
- Export your mappings to share with friends or backup your configuration
- Keys show abbreviated effect names for easy reference

## How It Works

See the [How the Web UI Works](#how-the-web-ui-works) section below for detailed technical explanation.

---

## How the Web UI Works

### Architecture Overview

The web UI is a single-page application that communicates with an Arduino via the Web Serial API to control PixMob wristbands using infrared signals.

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐         ┌──────────────┐
│   Browser   │ Serial  │   Arduino    │   IR    │   PixMob    │  Light  │   Audience   │
│   (Web UI)  │ ──────> │  + IR LED    │ ──────> │  Wristband  │ ──────> │              │
└─────────────┘         └──────────────┘         └─────────────┘         └──────────────┘
```

### File Structure

```
www/
├── index.html                    # Original form-based interface
├── dj.html                       # NEW: DJ Keyboard interface
├── css/
│   ├── style.css                 # Styling for original interface
│   └── dj-style.css              # NEW: Styling for DJ keyboard
├── js/
│   ├── script.js                 # Original UI logic & Web Serial communication
│   ├── dj.js                     # NEW: DJ keyboard logic & key mapping
│   └── effects_definitions.js    # All effect codes (shared by both UIs)
└── docs/
    └── arduino_sender/           # Arduino sketches for reference
```

### Key Components

#### 1. **index.html**

- Simple form-based interface
- Effect selector dropdown (populated dynamically from JavaScript)
- Tail code selector for modifying effects
- Connect/disconnect button for Web Serial
- Help modal with instructions
- Notification system for connection status

#### 2. **effects_definitions.js**

Contains three main effect categories coded as binary arrays:

- **`base_color_effects`**: Simple color commands (RED, GREEN, BLUE, YELLOW, etc.)
  - 39-bit binary sequences representing specific colors
  - Can be combined with tail codes for variations
  - Example: `RED: [1, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, ...]`

- **`tail_codes`**: Modifiers that can be appended to base colors
  - `FADE_X`: Various fade in/out patterns
  - `SHARP_PROBABILISTIC_X`: Random activation (creates "twinkling")
  - `FADE_PROBABILISTIC_X`: Random with fade effects
  - 24-bit sequences that modify the base effect behavior

- **`special_effects`**: Pre-programmed complex effects
  - Motion-activated modes (for older bracelets with accelerometers)
  - Multi-color fades, blinks, and sequences
  - Time-based and rate-limited effects
  - Cannot be combined with tail codes

#### 3. **script.js**

Main application logic with several key functions:

##### **Web Serial Communication**

```javascript
async function connectSerial() {
  port = await navigator.serial.requestPort(); // User selects port
  await port.open({ baudRate: 115200 }); // Open at 115200 baud
  writer = port.writable.getWriter(); // Get write stream
  isConnected = true;
}
```

##### **Binary to Run-Length Encoding**

The core conversion happens in two stages:

**Stage 1: Bits to Run Lengths**

```javascript
function bits_to_run_lengths_pulses(bit_list) {
  // Converts: [1,1,0,0,0,1,1,1]
  // Into: [2, 3, 3] (two 1s, three 0s, three 1s)
}
```

**Stage 2: Format for Arduino**

```javascript
function bits_to_arduino_string(bit_list) {
  // Converts: [2, 3, 3]
  // Into: "[3]233,"
  // Format: [length]digits,
}
```

Why run-length encoding? The IR signal alternates between HIGH and LOW states. Instead of sending each bit individually, we send the count of consecutive same bits, which is more efficient for serial transmission.

##### **Sending Effects**

```javascript
async function sendEffect(MAIN_EFFECT, TAIL_CODE) {
  // 1. Look up effect bits from effects_definitions.js
  let effect_bits = base_color_effects[MAIN_EFFECT];

  // 2. Append tail code if provided
  if (TAIL_CODE) {
    effect_bits = effect_bits.concat(tail_codes[TAIL_CODE]);
  }

  // 3. Convert to Arduino format
  const arduino_string = bits_to_arduino_string(effect_bits);

  // 4. Send via serial
  await writer.write(new TextEncoder().encode(arduino_string));
}
```

### Communication Protocol

#### Browser → Arduino

The browser sends strings in this format:

```
[length]runlengths,
```

Example:

- Effect bits: `[1,1,0,0,0,1]`
- Run lengths: `[2,3,1]` (two 1s, three 0s, one 1)
- Sent string: `"[3]231,"`

The Arduino receives this, decodes it back to bits, and generates the IR signal.

#### IR Signal Timing

PixMob wristbands use:

- **Carrier frequency**: 38 kHz (standard IR)
- **Bit timing**: ~694.44 microseconds per bit
- **Start sequence**: `1000000000` (separates commands)

### Effect Categories Explained

#### Base Color Effects

Single-color flashes that can be customized with tail codes:

- Duration variants (e.g., RED, RED_2, RED_3)
- Brightness variants (e.g., DIM_RED, LIGHT_BLUE)
- All 39 bits long

#### Tail Codes

24-bit modifiers:

- **FADE_1 to FADE_6**: Different fade in/out patterns and speeds
- **PROBABILISTIC**: Makes effect appear randomly (for "twinkling" effects)
- Combine fade + probabilistic for complex behaviors

#### Special Effects

Pre-built 63-73 bit effects:

- **Motion modes**: `OLD_RAINBOW_MOTION` (only works on old bracelets with accelerometers)
- **Built-in fades**: `SLOW_WHITE`, `VERY_SLOW_PINK`, etc.
- **Color transitions**: `OLD_TURQUOISE_THEN_YELLOW`
- **Weird effects**: Experimental codes with unpredictable behavior

### Browser Requirements

- **Web Serial API** support (Chrome 89+, Edge 89+, Opera 76+)
- HTTPS or localhost (security requirement for Web Serial)
- Modern JavaScript (ES6+)

### Example Usage Flow

1. User clicks "Connect to board"
   - Browser shows serial port selection dialog
   - User selects Arduino's COM port
   - Connection established at 115200 baud

2. User selects "RED" effect + "FADE_2" tail
   - JavaScript looks up: `base_color_effects['RED']` (39 bits)
   - Appends: `tail_codes['FADE_2']` (24 bits)
   - Total: 63 bits

3. Conversion:

   ```javascript
   Bits: [1,1,0,0,1,0,1,0, ...63 bits... ]
   Run-lengths: [2,2,1,1,1,1, ...variable... ]
   Arduino string: "[28]22111111..." + ","
   ```

4. Send via serial:
   - String encoded to bytes
   - Transmitted over USB serial

5. Arduino receives and processes:
   - Parses the run-length encoded format
   - Converts back to bit timing
   - Generates 38kHz IR pulses with correct timing

6. PixMob wristband receives IR signal:
   - Decodes the command
   - Displays RED color with FADE_2 pattern

### Pre-built Features

#### Blink Colors

```javascript
async function blinkColors() {
    // Cycles through ALL base color effects
    for (let color in base_color_effects) {
        sendEffect(color);
        await sleep(100ms);
    }
}
```

#### Fade Colors

```javascript
async function fadeColors() {
    // Cycles through curated color list with FADE_2
    for (let color of ['RED', 'GREEN', 'BLUE', ...]) {
        sendEffect(color, 'FADE_2');
        await sleep(2000ms);
    }
}
```

### Notification System

User feedback for connection status:

- Green notification: "Device connected successfully!"
- Red notification: "Device disconnected!"
- Auto-dismisses after 3 seconds

### Error Handling

The code includes validation:

- Checks if effect names are valid
- Prevents tail codes on special effects (not compatible)
- Validates run-length encoding (max 9 consecutive same bits)

### Advanced Notes

#### Why 940nm IR?

- Standard frequency for consumer IR devices
- Good balance of range and power consumption
- PixMob confirmed to use this frequency (FCC filings)

#### Signal Discovery

All effect codes were discovered through:

1. Recording real signals at PixMob events (Coldplay, The Weeknd concerts)
2. Analyzing bit patterns and timing
3. Brute-force testing to find working combinations

#### Bracelet Versions

Different PixMob hardware generations respond differently:

- Old bracelets: Have motion sensors, respond to motion effects
- New bracelets: No motion sensor, better at decoding complex effects
- Some effects only work on specific versions

## Troubleshooting

**Browser doesn't show "Connect to board" button:**

- Use Chrome, Edge, or Opera browser
- Ensure you're on HTTPS or localhost

**Can't connect to Arduino:**

- Check Arduino is plugged in
- Verify correct sketch is uploaded
- Try unplugging and replugging the Arduino

**Wristband doesn't respond:**

- Ensure IR LED is wired correctly
- Try different effects (some wristbands respond to different codes)
- Check IR LED is 940nm
- Ensure wristband has battery power

**Effect doesn't work:**

- Try sending the command multiple times
- Some effects are version-specific
- Try without tail code first

## Additional Resources

- Main project README: [../README.md](../README.md)
- Python tools: [../python_tools/](../python_tools/)
- Arduino sketches: [../arduino_sender/](../arduino_sender/)
