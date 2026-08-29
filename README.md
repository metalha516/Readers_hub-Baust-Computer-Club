# 📚 Readers Hub — BAUST Computer Club (BCC)

> A modern, high-performance web application designed for students, teachers, and researchers to explore curated technical articles, academic innovations, and blog posts.

---

## 🌟 Features

- **⚡ Full-Page Constellation Grid Physics Engine**:
  - Interactive 2D particle canvas background with real-time Hooke's Law Spring-Mass-Damping particle physics.
  - Features kinetic cursor velocity tracking, shockwave repulsion on mouse sweep, distance line connections, proximity spatial radar rings, and Hex coordinate readouts.
  - Fully synchronized across **Light** and **Dark** themes.

- **🎨 Modern Glassmorphism UI & Design System**:
  - Dynamic Dark and Light theme toggle with `localStorage` persistence.
  - Frosted glassmorphism overlays (`backdrop-filter: blur(...)`) on headers, cards, control bars, and hero sections.
  - Curated brand accent color: **`#006D3A`** (Deep Emerald Green).
  - Premium Google Fonts pairing: **EB Garamond** (Serif headlines) and **Inter** (Sans-serif UI typography).

- **🔍 Advanced Search & Multi-Criteria Filtering Engine**:
  - **Live Search**: Instant keyword filtering across titles, summaries, tracks, tags, and categories.
  - **Track Switching**: Instant filtering by technical tracks (`All`, `Business`, `Enterprise`, `Engineering`).
  - **Multi-Select Tag Dropdown**: Multi-checkbox tag selector (`Teachers`, `Students`, `Academic`, `ECA`, etc.) floating on an uppermost z-index layer (`z-index: 99999`).
  - **Quick-Try Pills**: One-click filter pills for fast audience discovery (`Teachers`, `Students`, `Academic`, `ECA`).
  - **Dynamic Pagination & Page Size Selector**: Configurable items per page (6, 12, 24, 36).

- **📖 Dedicated Single Article Reader View (`article.html`)**:
  - Clean, distraction-free reading experience without card box borders.
  - Justified body paragraph formatting (`<p>`) with lead summary highlight box.
  - Category badges, tag pills, and 3-column Related Articles recommendation grid.

- **🛡️ CORS-Proof Dual Dataset Loader**:
  - Seamless dataset loader attempting `fetch('data.json')` first.
  - Automatic fallback to `window.DEFAULT_DATA` from `data.js` for local `file://` browser viewing without CORS errors.

- **🧩 Shadcn Project Integration**:
  - TypeScript / React component saved at `components/ui/constellation-grid.tsx`.

---

## 📁 Project Structure

```text
d:/BCC/
├── index.html                      # Main Hub Landing Page with Search & Filters
├── article.html                    # Single Article Reading Page
├── style.css                       # Design System, Theme Variables & Glassmorphism
├── app.js                          # Main Engine, Filtering, Pagination & Canvas Physics
├── article.js                      # Article Reader Script & Related Articles Generator
├── data.json                       # Primary Dataset (36 Curated Technical Articles)
├── data.js                         # Fallback Dataset (window.DEFAULT_DATA)
├── img/
│   └── logo.jpeg                   # BAUST Computer Club Brand Logo
├── components/
│   └── ui/
│       └── constellation-grid.tsx  # React / TypeScript Shadcn Component
├── design/                         # Original Light & Dark Theme Mockups
└── README.md                       # Project Documentation
```

---

## 🚀 Getting Started

### Option 1: Direct File Access (No Server Required)
Simply open `index.html` in any web browser. The app automatically detects `file://` protocol access and falls back to `data.js` (`window.DEFAULT_DATA`) to load all 36 articles seamlessly.

```bash
# On Windows PowerShell
Invoke-Item index.html
```

### Option 2: Local HTTP Server (Recommended)
Run a local server using Python, Node, or VS Code Live Server:

```bash
# Using Python Built-in Server
python -m http.server 8000

# Open http://localhost:8000 in your browser
```

---

## 🎨 Color Palette & Typography

| Element | Color / Font | Hex / Spec |
| :--- | :--- | :--- |
| **Brand Accent** | Deep Emerald Green | `#006D3A` |
| **Light Theme Page BG** | Soft Ice Blue | `#f6f8fd` |
| **Dark Theme Page BG** | Midnight Black | `#0f1015` |
| **Header Fonts** | EB Garamond | `'EB Garamond', serif` |
| **Body & UI Fonts** | Inter | `'Inter', sans-serif` |

---

## 📄 License & Credits

Developed for **BAUST Computer Club (BCC)** — Knowledge For Thinkers.
