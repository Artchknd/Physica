# Physica

[![Built with Claude](https://commons.wikimedia.org/wiki/Special:FilePath/Claude_AI_symbol.svg?width=24)](https://claude.ai/) [![Built with Claude](https://img.shields.io/badge/Built%20with-Claude-D97757?logo=anthropic&logoColor=white)](https://anthropic.com)

### Explore. Experiment. Discover.

**Physica** is an interactive 3D physics laboratory designed to make exploring physical phenomena more intuitive, visual, and engaging.

Built for experimentation and discovery, Physica brings multiple areas of physics into a unified browser-based environment. Users can interact with a three-dimensional laboratory, explore physical systems, adjust experimental parameters, and observe their behavior in real time.

**Live Demo:** [physica-sooty.vercel.app](https://physica-sooty.vercel.app)

**Repository:** [Artchknd/Physica](https://github.com/Artchknd/Physica)

---

## Overview

Physica combines real-time 3D rendering, physics simulation, and scientific visualization into a single interactive application.

Rather than presenting physics as a collection of static diagrams and equations, Physica provides a space where users can manipulate objects, experiment with different conditions, and observe the resulting behavior.

The application currently brings together five major areas of physics:

- Mechanics
- Optics
- Waves
- Electromagnetism
- Thermodynamics

The interface supports both Traditional Chinese and English, making the laboratory accessible to a wider range of users.

## Features

### Interactive 3D Environment

- Real-time 3D rendering powered by Three.js.
- Interactive camera controls and scene navigation.
- Three-dimensional objects and experimental environments.
- Configurable physical properties.
- Visual feedback during simulation.

### Physics Simulation

- Rigid-body simulation powered by Rapier.
- Gravity and collision handling.
- Mechanical interactions and motion.
- Adjustable simulation parameters.
- Real-time physical state updates.

### Physics Modules

| Module | Description |
|---|---|
| Mechanics | Motion, forces, collisions, and mechanical systems. |
| Optics | Light propagation, reflection, refraction, and optical phenomena. |
| Waves | Wave behavior, interference, and related phenomena. |
| Electromagnetism | Electric and magnetic phenomena, including basic circuits. |
| Thermodynamics | Temperature, heat transfer, and thermal behavior. |

Each module provides an interactive environment for exploring its respective physical concepts.

### Scientific Visualization

- Real-time measurement displays.
- Interactive scientific charts.
- Physical parameter inspection.
- Visual representation of experimental behavior.

### Bilingual Interface

Physica supports two interface languages:

- Traditional Chinese (`zh-TW`)
- English (`en`)

Users can switch languages through the application interface.

### Scene Persistence

Experimental scenes are stored locally using browser `localStorage`, allowing configurations to remain available across page reloads in the same browser.

No external database is required.

---
## Mobile Compatibility

Physica can be accessed on mobile devices through desktop-site mode in a mobile browser. The interface remains usable in portrait orientation, although the experience is optimized for desktop screens and may require more precise touch input.


## Technology Stack

| Technology | Purpose |
|---|---|
| Next.js 16 | Application framework |
| React 19 | User interface |
| TypeScript | Type safety and application logic |
| Three.js | 3D rendering |
| Rapier.js | Physics simulation |
| Chart.js | Scientific data visualization |
| Tailwind CSS 4 | Styling |

The application is designed to run entirely on the client side for its core interactive experience.

---

## Getting Started

### Prerequisites

Make sure you have the following installed:

- Node.js
- npm

### Installation

Clone the repository:

```bash
git clone https://github.com/Artchknd/Physica.git
cd Physica
```

Install dependencies:

```bash
npm install
```

### Development

Start the local development server:

```bash
npm run dev
```

Open the following address in your browser:

```text
http://localhost:3000
```

### Production Build

Build the application:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

### Additional Commands

Run ESLint:

```bash
npm run lint
```

Run TypeScript type checking:

```bash
npm run typecheck
```

No environment variables or external database configuration are required for the default setup.

---

## Project Structure

```text
Physica/
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── components/
│   │   ├── LabApp.tsx
│   │   ├── LabLoader.tsx
│   │   ├── LeftPanel.tsx
│   │   ├── RightPanel.tsx
│   │   ├── ChartPanel.tsx
│   │   ├── Dialogs.tsx
│   │   └── ui.tsx
│   │
│   └── lab/
│       ├── modules/
│       │   ├── em.ts
│       │   ├── optics.ts
│       │   ├── thermo.ts
│       │   ├── waves.ts
│       │   └── util.ts
│       │
│       ├── dict.ts
│       ├── engine.ts
│       ├── i18n.tsx
│       ├── materials.ts
│       ├── physics.ts
│       ├── presets.ts
│       ├── scenes.ts
│       ├── shapes.ts
│       └── types.ts
│
├── package.json
└── README.md
```

---

## Design Philosophy

Physica is built around three simple ideas:

**Explore.** Discover physical concepts through an interactive three-dimensional environment.

**Experiment.** Change parameters, manipulate objects, and investigate different conditions.

**Discover.** Observe results and develop a better understanding of how physical systems behave.

The goal is to make physics something users can interact with, rather than something they can only read about.

---

## Notes

Physica is an interactive educational and experimental project.

Its simulations may use simplified mathematical models and numerical approximations. Results should be interpreted within the assumptions and limitations of each model.

Physica is not intended to replace professional scientific simulation or engineering software.

---

## License

Physica is released under the [MIT License](LICENSE).

You are free to use, copy, modify, merge, publish, distribute, sublicense, and sell copies of the software, subject to the conditions of the MIT License.
