# DJ Keyboard Quick Start Guide

Welcome to the PixMob DJ Keyboard! This interface lets you trigger light effects by pressing keys on your keyboard.

## 🚀 Quick Start (5 minutes)

### 1. Connect Your Hardware

1. Open `dj.html` in Chrome, Edge, or Opera (Web Serial API required)
2. Click **"Connect to board"**
3. Select your Arduino/ESP32 from the popup

### 2. Map Your First Key

1. Select **"Mapping Mode"**
2. Click the **Q** key on screen
3. Choose **RED** from the Effect dropdown
4. Choose **FADE_2** from the Tail Code dropdown
5. Click **"Save Mapping"**

### 3. Try It Out!

1. Switch to **"Trigger Mode"**
2. Press the **Q** key on your keyboard (or click it on screen)
3. Watch your PixMob lights glow red! 🔴

## 🎹 Recommended Key Layout

Here's a suggested mapping to get started fast:

### Top Row (Numbers) - Quick Colors

- `1` = Fast White
- `2` = Slow White
- `3` = RED + FADE_2
- `4` = GREEN + FADE_2
- `5` = BLUE + FADE_2
- `6` = YELLOW + FADE_2
- `7` = ORANGE + FADE_2
- `8` = PINK + FADE_2
- `9` = MAGENTA + FADE_2
- `0` = TURQUOISE + FADE_2

### Q-P Row - Fading Colors

- `Q` = RED + FADE_2
- `W` = GREEN + FADE_2
- `E` = BLUE + FADE_2
- `R` = YELLOW + FADE_2
- `T` = ORANGE + FADE_2
- `Y` = PINK + FADE_2
- `U` = MAGENTA + FADE_2
- `I` = TURQUOISE + FADE_2
- `O` = WHITISH + FADE_2

### A-L Row - Sharp Colors (No Fade)

- `A` = RED (sharp)
- `S` = GREEN (sharp)
- `D` = BLUE (sharp)
- `F` = YELLOW (sharp)
- `G` = ORANGE (sharp)
- `H` = PINK (sharp)

### Z-M Row - Special Effects

- `Z` = SLOW_TURQUOISE
- `X` = SLOW_GREEN
- `C` = SLOW_YELLOW
- `V` = SLOW_ORANGE
- `B` = VERY_SLOW_WHITE

## 📥 Using Example Mappings

We've included an example mapping file:

1. Open `dj.html`
2. Click **"Import Mappings"**
3. Select `example-mappings.json`
4. All keys are now pre-configured!

## 💾 Saving & Sharing

### Auto-Save

Your mappings are automatically saved to your browser's localStorage.

### Manual Export

1. Click **"Export Mappings"**
2. Save the JSON file
3. Send to friends or keep as backup!

### Import

1. Click **"Import Mappings"**
2. Choose a JSON file
3. Your keys are now mapped!

## 🎮 DJ Tips

1. **Practice Mode**: Map simple colors first, then add tail codes
2. **Performance Setup**: Map your most-used effects to number keys for quick access
3. **Color Transitions**: Alternate between fading and sharp effects for dynamic shows
4. **Effect Chains**: Press keys in sequence for light choreography

## ⚡ Pro Tips

- **Physical keyboard** works even if you click away from the browser!
- **Color coding** - Keys automatically show the effect color
- **Quick clear** - Use "Clear All Mappings" to start fresh
- **Test first** - Try effects in the Original UI before mapping to keys

## 🔧 Troubleshooting

**Keys not working?**

- Make sure you're in "Trigger Mode"
- Check that the board is connected (green notification)
- Verify the key has a mapping (check for color border)

**Effect not triggering?**

- Some effects work better with certain wristband models
- Try sending the same effect 2-3 times
- Check your IR LED is properly connected

**Can't connect?**

- Use Chrome, Edge, or Opera (Firefox doesn't support Web Serial yet)
- Make sure your Arduino sketch is uploaded
- Try a different USB cable

## 🌟 Have Fun!

You're now ready to DJ your lights! Experiment with different combinations and create amazing light shows.

Happy DJing! 🎉
