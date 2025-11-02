# Kitty Printer

Web App for Bluetooth "Kitty Printers"! Print text, pictures, and much more.

Let's leverage full power of your kitty printer!

## About

This is a web application that allows you to print text and images to Bluetooth-enabled thermal printers (commonly known as "Cat Printers" or "Kitty Printers").

Sister Project of [Cat-Printer](https://github.com/NaitLee/Cat-Printer). Read more about "Cat Printers" there.

## Features

- 📝 Print custom text with various fonts and sizes
- 🖼️ Print images with different dithering algorithms
- 🔧 Adjustable print settings (speed, energy, feed)
- 🎨 Text styling options (alignment, font weight, line spacing)
- 🔄 Image transformations (rotate, flip, brightness)
- 💾 Auto-save your print queue to localStorage

## Tech Stack

- **Astro** - Modern static site generator
- **React** - UI components
- **TailwindCSS** - Utility-first CSS framework
- **TypeScript** - Type safety
- **Web Bluetooth API** - Direct printer communication

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- A Bluetooth-enabled thermal printer
- A browser that supports Web Bluetooth API (Chrome, Edge, Opera)

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Usage

1. Open the app in a Web Bluetooth compatible browser
2. Add text or image elements to your print queue
3. Customize each element with the available options
4. Click the Print button and select your printer
5. Enjoy your prints!

## License

This project as a whole is licensed under **GNU Affero General Public License, version 3.0 or later** (AGPL-3.0-or-later), respecting your computing freedom.

Some parts have associated rights waived with CC0-1.0:
- Code in `src/lib/cat-protocol.ts`
- The artwork `public/kitty.svg` and its derivatives

Individual libraries used have their own licenses.

## Credits

This project is a fork/migration of the original [Kitty Printer](https://github.com/NaitLee/kitty-printer) by NaitLee, migrated from Deno + Fresh to Node + Astro.

Made with [Astro](https://astro.build) 🚀
