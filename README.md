# ReelSum

Extract the real value from Instagram Reels.

ReelSum is a beautifully simple CLI tool that turns any Instagram Reel into clean, readable text right in your terminal. No more re-watching videos or taking notes by hand. 

Just pass a link, and ReelSum will accurately transcribe the audio and intelligently structure the content into perfect, readable paragraphs, making it effortless to save, read, or share the information you care about.

### Features
- ✨ **Zero-friction TUI**: Interactive, single-command onboarding.
- 📋 **Auto-Copy**: Final text is instantly copied to your system clipboard.
- 🔄 **Continuous Flow**: Process multiple reels back-to-back without restarting.

## Installation

Ensure you have [Node.js](https://nodejs.org/) installed, then install globally via npm:

```bash
npm install -g reelsum
```

## Getting Started

The easiest way to use is to simply run it:

```bash
reelsum
```

The CLI will launch a clean, interactive terminal UI and prompt you for:
1. **The Instagram Reel URL**
2. **Your OpenAI API Key** *(only asked once, securely saved to `~/.reelsumrc`)*

That's it. It will grab the reel, process the speech, and output the clean text right in your terminal for you to read or copy.

---

### Alternative: Inline Usage

If you prefer to drop it into scripts or skip the interactive prompt, you can pass the URL directly:

```bash
reelsum "https://www.instagram.com/reel/DV27yTkkzw7/"
```
> **Tip**: Always wrap the URL in quotes (`" "`) to prevent your terminal from misinterpreting special characters like `?` or `&`.

## Uninstallation
To remove ReelSum from your system, run:
```bash
npm uninstall -g reelsum
```
*(Optional) To securely wipe your API key, delete the configuration file from your home directory:*
```bash
rm ~/.reelsumrc
```

## License
MIT License.
