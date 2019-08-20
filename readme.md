# Gaming Buddy

This tool aims to provide an interface to easily create helpers for various games.
It is planned to provide the following functionality:
- Detect game state by image recognition (image comparison, pixel color) e.g.:
  - Main screen / multiplayer lobby / loading screen
  - Open dialogs or menus (when ingame)
  - Progressbars (e.g. life/mana/energy/experience/...)
  - Buttons (e.g. skills including cooldown/disabled state)
  - Minimaps (enemy location, fog of war)
  - Text elements (player names, scores, ammo, ...)
  - Game files (autosaves, temporary files, ...)
- Provide feedback according to the detected information
  - Generic notification windows (e.g. talent tips, attack warnings for rts, enemy information)
  - Context specific overlays (e.g. advanced tooltips for items)
  - Audio feedback (e.g. attack warnings for rts)
  - Advanced HTML-Based content (e.g. guides, wikis, ... for dual-screen setups)
- Provide a unified interface for various RGB led devices (enabling advanced RGB profiles for offically unsupported games)
  - Aurora (Logitech/Razor on Windows)
  - Logitech keyboards and mice (Linux implementation, maybe found a project like aurora for linux?)
  
Feel free to provide tips and suggestions :)

## Developer information

### Default application workflow

- `/main.js` Initialize electron and create the main window
- `/main.js` Create the backend-process (seperate thread)
  - `/src/backend.js` Initialize backend class (`GamingBuddyApp` / `/src/gaming-buddy/app.js`)
  - `/src/backend.js` Load config from `/config.xml` (structure and defaults) and `/config.json` (values, if existing)
- `/main.js` Load main frontend page (`/gui/index.html`)
  - `/src/frontend.js` Initialize frontend class (`GamingBuddyGui` / `/src/gaming-buddy/gui.js`)
  - `/src/gaming-buddy/gui.js` Render default content template (`/gui/pages/index.twig`)
  - `/src/gaming-buddy/gui.js` Send ipc "ready" message to the backend 
- `/src/gaming-buddy/app.js` On frontend "ready"
  - `/src/gaming-buddy/app.js` Send config structure and values to the frontend
  - `/src/gaming-buddy/app.js` Load all available plugins
  - `/src/gaming-buddy/app.js` Start update ticks (calls `GamingBuddyApp.update` every second)
    - `/src/gaming-buddy/app.js` Update the currently active plugin (`GamingBuddyApp.updateWindows` - will update every 10sec)
    - `GamingBuddyPluginBackend.update` For the active plugin will be called every second (Updates should be throttled within the plugin)