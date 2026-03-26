# ReelSum

Extract the real value from Instagram Reels.

ReelSum is a beautifully simple CLI tool that turns any Instagram Reel into clean, readable text right in your terminal. No more re-watching videos or taking notes by hand. 

Just pass a link, and ReelSum will accurately transcribe the audio and intelligently structure the content into perfect, readable paragraphs, making it effortless to save, read, or share the information you care about.

### Features
-  **Zero-friction TUI**: Interactive, single-command onboarding.
-  **Auto-Copy**: Final text is instantly copied to your system clipboard.
-  **Auto-Save**: Every generated result is saved to `~/.reelsum/outputs/`.
-  **History Browser**: Run `reelsum history` to browse, preview, and copy saved outputs.
-  **Continuous Flow**: Process multiple reels back-to-back without restarting.
- ⬆ **Update Prompt**: When a newer npm version is available, ReelSum can prompt you to update with a single `Y` or `N` keypress.
-  **Local-First Config**: Your OpenAI API key can live in `~/.reelsum/config.json`, with restricted file permissions where supported.

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
2. **Your OpenAI API Key** *(only asked once, stored locally in `~/.reelsum/config.json`)*

That's it. It will grab the reel, process the speech, copy the clean text to your clipboard, save it under `~/.reelsum/outputs/`, and output it right in your terminal for you to read or reuse.

When processing reels interactively, the final prompt reacts immediately to `Y`, `H`, or `N` without waiting for Enter:
- `Y` processes another reel
- `H` opens your saved history browser
- `N` exits

If a newer version of ReelSum is published on npm, the CLI can also prompt you at startup to update immediately:
- `Y` runs `npm install -g reelsum@latest`
- `N` skips the update for now

---

### Alternative: Inline Usage

If you prefer to drop it into scripts or skip the interactive prompt, you can pass the URL directly:

```bash
reelsum "https://www.instagram.com/reel/DV27yTkkzw7/"
```
> **Tip**: Always wrap the URL in quotes (`" "`) to prevent your terminal from misinterpreting special characters like `?` or `&`.

If you do not want ReelSum to store your API key locally, set it in your shell instead:

```bash
export OPENAI_API_KEY="sk-..."
reelsum
```

You can also save or update the key later with:

```bash
reelsum config
```

### View Saved History

To open the saved history browser:

```bash
reelsum history
```

Inside the history browser:
- `Up/Down` or `J/K` moves through saved entries
- `Enter` opens the full saved output
- `C` copies the selected saved output
- `B` goes back from the full view
- `Q` exits

To limit how many entries are loaded into the browser:

```bash
reelsum history --limit 20
```

## Privacy & Security

- ReelSum is a local CLI: your API key and saved outputs stay on your machine.
- ReelSum stores configuration in `~/.reelsum/config.json` and saved outputs in `~/.reelsum/outputs/`.
- On systems that support POSIX file permissions, ReelSum restricts its config and saved output files to the current user.
- Your API key is only used for the OpenAI requests needed to transcribe and format the reel you chose.
- Reel URLs are fetched through `yt-dlp`, audio is processed locally with `ffmpeg`, and transcript/formatting requests are sent to OpenAI.
- Passing `reelsum config --key ...` works, but it can expose the key in shell history. `reelsum config` or `OPENAI_API_KEY` is safer.

## Uninstallation
To remove ReelSum from your system, run:
```bash
npm uninstall -g reelsum
```
*(Optional) To remove your stored API key and saved outputs, delete the local ReelSum data directory from your home directory:*
```bash
rm -rf ~/.reelsum
```

## License
MIT License.
