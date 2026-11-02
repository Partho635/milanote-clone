# Milanote Clone (Next.js)

A self-hosted Milanote-style visual board. It runs on your own computer, and all data stays on your own disk.

---

## Kivabe chalaben (How to run)

**Requirement:** [Node.js 20 or newer](https://nodejs.org) (download the LTS version).

### Easiest way
- **Windows:** double-click `start-windows.bat`
- **Mac / Linux:** run `./start-mac-linux.sh` in a terminal

The first run installs packages and builds the app (2–3 minutes). Then it opens **http://localhost:3000** automatically.

### Manual
```bash
npm install
npm run build
npm start          # → http://localhost:3000
```
If you're changing the code, use `npm run dev` for hot-reload.

> Data is saved to `data/workspace.json`, and uploads go to `data/uploads/`. **Back up the `data` folder** to keep your boards safe. You can also use Export → "Backup everything (JSON)".

---

## Live on GitHub Pages

Every push to `main` builds a static version of the app and publishes it with GitHub Actions (`.github/workflows/deploy.yml`).

- One-time setup: in the repo, go to **Settings → Pages → Build and deployment → Source: GitHub Actions**.
- The site is at `https://<your-username>.github.io/<repo-name>/`.
- In the live version, boards and uploads are saved **in your browser** (IndexedDB), so each browser or device has its own workspace. To move boards, use Export → *Backup everything (JSON)*, then *Restore from backup* on the other device.
- Link previews use free public services (noembed / Microlink), and image search uses Openverse.
- To test the Pages build locally, run `npm run build:pages`, then serve the `out/` folder.

The local version (`npm run dev`, or `start-windows.bat`) still saves to the `data/` folder as before.

## Features

### Milanote-style workflow
- **Context-aware left toolbar.** When you select a card, the toolbar switches to that card's tools (Color, Labels, Reactions, Comment, Due date, Assign…). While you edit text it shows text tools, and when you select a line it shows line tools.
- **Smooth drag & drop.** Cards move with GPU transforms and are saved once when you drop them, so dragging stays at 60fps even with hundreds of cards. Lines follow the cards live.
- **Alt + drag** drags out a copy of a card.
- **Unsorted drawer** (top-right). Drag cards onto it to park them, then drag them back onto the board.
- **Lock position**, Bring to front / Send to back, Move to board, and **Convert column → board** (its cards go into the new board's Unsorted drawer).

### Cards
| Card | What it does |
|---|---|
| Note | Text styles: Large heading, Normal heading, Normal text, Small text, Code block, Callout, Quote. Also text colour, highlight, B/I/S/U, lists, align, inline code, links |
| To-do | Click a task, then use **Due date** (shows "Due today"), **Assign** (@name), **Labels**, **Reactions**. Optional title and progress bar |
| Link / Video | Preview card. YouTube and Vimeo play inline. Preview on/off, Rename, Caption, Refresh |
| Image | Upload, drag in, or paste a screenshot. **Add image** panel with free image search (Openverse) or add from a link. Caption, lightbox, download |
| Upload / Audio | Any file. Audio and video play inline, and PDFs open in a new tab |
| Board | Nested boards with emoji icon and colour, showing the card count |
| Column | Shows "N cards", colour as **Background or Top strip**, collapse, convert to board |
| Table | **Spreadsheet**: A/B/C columns, 1/2/3 rows, drag to select a range, cell colour, text colour, bold, align, add/delete rows and columns, **formulas** (`=A1+B1`, `=SUM(A1:A5)`, AVERAGE, MIN, MAX, COUNT) |
| Document | Icon or **Card view** (page preview) with word count. Full editor with its own toolbar; export to Word, Markdown or text |
| Color | Swatch that **names the colour automatically** (e.g. "Malibu"). Editable hex |
| Heading | Large serif heading text in three sizes |
| Map | Google Maps embed for any place |
| Draw / Sketch | Freehand pen with colours, sizes, eraser, undo |
| Comment | Comment card. Any card can also have **comment pins** (blue bubble) with threads |
| Line / Arrow | Colour, start/end arrows, label, dashed, weight. Drag the middle to curve it |

Every card can have **labels** (create your own, coloured) and **emoji reactions** (full picker with categories and search).

### Header & menus
- **Export:** PDF (standard or high quality), PNG image, Word document, Markdown, Plain text (sub-boards optional), **ZIP of all images and files**, JSON backup/restore
- **View:** zoom slider, Scale to fit, dot grid, snap to grid, dark mode, **Presentation mode** (full screen, toolbars hidden)
- **Share:** copy a link that works on your Wi-Fi network
- Search across all boards (Ctrl K), Templates, Trash with restore, undo/redo, autosave

### Look & performance
- Fonts are bundled with the app (Inter for the interface, Source Serif for titles), so text looks the same and stays sharp on every computer, even offline.
- The board stays sharp at every zoom level: pan and zoom snap to whole screen pixels, and cards are never cached as blurry bitmaps.
- Drag, pan and zoom run at a steady 60fps with 300+ cards; zooming with the buttons or "fit" animates smoothly.

## Keyboard shortcuts
Press **?** in the app to see the full list. Common ones: `N` note · `T` to-do · `L` link · `B` board · `C` column · `D` draw · `Ctrl Z` undo · `Ctrl D` duplicate · `Del` delete · `Esc` go up a board.

## Not included
Milanote's cloud features (real-time multi-user collaboration, sharing links, mobile apps, accounts) are not included, because this is a local single-user app. You can still reach it from other devices on your Wi-Fi at `http://<your-PC-IP>:3000` while it's running.

## Project structure
```
src/app/api/        workspace save/load, uploads, file serving, link preview, image proxy
src/lib/            store (zustand + undo), actions, drag/drop interactions, templates
src/components/     Canvas, cards/, lines, toolbar, sidebar, modals
```
