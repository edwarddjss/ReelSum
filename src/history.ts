import chalk from 'chalk';

import { type AppPaths, getAppPaths } from './app-paths.js';
import { copyTextToClipboard } from './clipboard.js';
import { createExitPromptError } from './errors.js';
import {
    formatSavedAt,
    formatSavedAtCompact,
    getEntryTitle,
    getSavedOutputs,
    type SavedOutputEntry
} from './storage.js';

type HistoryBrowserMode = 'list' | 'view';

function truncateText(text: string, width: number) {
    const safeWidth = Math.max(4, width);

    if (text.length <= safeWidth) {
        return text;
    }

    if (safeWidth <= 3) {
        return text.slice(0, safeWidth);
    }

    return `${text.slice(0, safeWidth - 3)}...`;
}

function chunkLongToken(token: string, width: number) {
    const chunks: string[] = [];

    for (let index = 0; index < token.length; index += width) {
        chunks.push(token.slice(index, index + width));
    }

    return chunks;
}

function wrapText(text: string, width: number) {
    const safeWidth = Math.max(20, width);

    return text.split('\n').flatMap((line) => {
        const normalized = line.trim();

        if (!normalized) {
            return [''];
        }

        const tokens = normalized.split(/\s+/);
        const lines: string[] = [];
        let currentLine = '';

        for (const token of tokens) {
            const parts = token.length > safeWidth ? chunkLongToken(token, safeWidth) : [token];

            for (const part of parts) {
                if (!currentLine) {
                    currentLine = part;
                    continue;
                }

                const nextLine = `${currentLine} ${part}`;
                if (nextLine.length <= safeWidth) {
                    currentLine = nextLine;
                } else {
                    lines.push(currentLine);
                    currentLine = part;
                }
            }
        }

        if (currentLine) {
            lines.push(currentLine);
        }

        return lines;
    });
}

function printHistoryList(entries: SavedOutputEntry[]) {
    console.log(chalk.magenta.bold(`\nSaved Reel Outputs (${entries.length})\n`));

    entries.forEach((entry, index) => {
        console.log(chalk.magenta(`${index + 1}.`) + ' ' + chalk.white(`${formatSavedAt(entry.savedAt)} | ${getEntryTitle(entry)}`));
        console.log(chalk.dim(entry.sourceUrl));
        console.log(chalk.dim(entry.filePath));

        if (entry.preview) {
            console.log(chalk.white(entry.preview));
        }

        console.log('');
    });
}

function renderHistoryList(entries: SavedOutputEntry[], selectedIndex: number, statusMessage: string, paths: AppPaths) {
    const cols = process.stdout.columns || 80;
    const rows = process.stdout.rows || 24;
    const contentWidth = Math.max(20, cols - 2);
    const previewHeight = Math.max(5, Math.floor(rows / 3));
    const listHeight = Math.max(3, rows - previewHeight - 8);
    const maxStart = Math.max(0, entries.length - listHeight);
    const start = Math.max(0, Math.min(selectedIndex - Math.floor(listHeight / 2), maxStart));
    const end = Math.min(entries.length, start + listHeight);
    const selectedEntry = entries[selectedIndex];
    const lines: string[] = [];

    lines.push(chalk.magenta.bold('Reel History'));
    lines.push(chalk.dim('Up/Down or J/K: move  Enter: view  C: copy  Q: exit'));
    lines.push(statusMessage || chalk.dim(`Showing ${entries.length} saved outputs from ${paths.outputDir}`));
    lines.push('');

    for (let index = start; index < end; index += 1) {
        const entry = entries[index];
        const prefix = index === selectedIndex ? chalk.magenta('>') : ' ';
        const line = `${index + 1}. ${formatSavedAtCompact(entry.savedAt)} | ${getEntryTitle(entry)}`;
        const formatter = index === selectedIndex ? chalk.bold.white : chalk.white;
        lines.push(`${prefix} ${formatter(truncateText(line, contentWidth))}`);
    }

    if (entries.length > listHeight) {
        lines.push(chalk.dim(`Showing ${start + 1}-${end} of ${entries.length}`));
    }

    lines.push('');
    lines.push(chalk.magenta('Selected'));
    lines.push(chalk.white(truncateText(`${formatSavedAt(selectedEntry.savedAt)} | ${getEntryTitle(selectedEntry)}`, contentWidth)));
    lines.push(chalk.dim(truncateText(selectedEntry.sourceUrl, contentWidth)));
    lines.push(chalk.dim(truncateText(selectedEntry.filePath, contentWidth)));

    const previewLines = wrapText(selectedEntry.preview || '[No saved text preview available.]', contentWidth)
        .slice(0, Math.max(2, rows - lines.length - 1));
    lines.push(...previewLines.map((line) => chalk.white(line)));

    return lines.slice(0, rows).join('\n');
}

function renderHistoryView(entries: SavedOutputEntry[], selectedIndex: number, scrollOffset: number, statusMessage: string) {
    const entry = entries[selectedIndex];
    const cols = process.stdout.columns || 80;
    const rows = process.stdout.rows || 24;
    const contentWidth = Math.max(20, cols - 2);
    const lines: string[] = [];
    const wrappedBody = wrapText(entry.body || '[No saved text found.]', contentWidth);

    lines.push(chalk.magenta.bold(`Saved Output ${selectedIndex + 1}/${entries.length}`));
    lines.push(chalk.dim('Up/Down or J/K: scroll  B: back  C: copy  Q: exit'));
    lines.push(statusMessage || chalk.dim(getEntryTitle(entry)));
    lines.push('');
    lines.push(chalk.white(truncateText(`Saved: ${formatSavedAt(entry.savedAt)}`, contentWidth)));
    lines.push(chalk.dim(truncateText(entry.sourceUrl, contentWidth)));
    lines.push(chalk.dim(truncateText(entry.filePath, contentWidth)));
    lines.push('');

    const bodyHeight = Math.max(3, rows - lines.length - 1);
    const maxScroll = Math.max(0, wrappedBody.length - bodyHeight);
    const clampedScrollOffset = Math.max(0, Math.min(scrollOffset, maxScroll));
    const visibleBody = wrappedBody.slice(clampedScrollOffset, clampedScrollOffset + bodyHeight);

    lines.push(...visibleBody.map((line) => chalk.white(line)));
    lines.push(chalk.dim(`Lines ${clampedScrollOffset + 1}-${Math.min(clampedScrollOffset + bodyHeight, wrappedBody.length)} of ${wrappedBody.length}`));

    return {
        output: lines.slice(0, rows).join('\n'),
        scrollOffset: clampedScrollOffset
    };
}

export async function openHistoryBrowser(limit: number, paths: AppPaths = getAppPaths()) {
    const entries = getSavedOutputs(limit, paths);

    if (entries.length === 0) {
        console.log(chalk.yellow(`\nNo saved outputs found in ${paths.outputDir}`));
        console.log(chalk.dim('Run reelsum to create your first saved output.\n'));
        return;
    }

    if (!process.stdin.isTTY || !process.stdout.isTTY || typeof process.stdin.setRawMode !== 'function') {
        printHistoryList(entries);
        return;
    }

    await new Promise<void>((resolve, reject) => {
        const stdin = process.stdin;
        const stdout = process.stdout;
        const wasRaw = stdin.isRaw;
        let selectedIndex = 0;
        let scrollOffset = 0;
        let mode: HistoryBrowserMode = 'list';
        let statusMessage = '';

        const cleanup = () => {
            stdout.off('resize', render);
            stdin.off('data', onData);
            stdout.write('\x1b[?25h');
            stdout.write('\x1b[?1049l');
            stdin.setRawMode(wasRaw ?? false);
            stdin.pause();
        };

        const exitBrowser = () => {
            cleanup();
            resolve();
        };

        const failBrowser = () => {
            cleanup();
            reject(createExitPromptError());
        };

        const copySelectedOutput = () => {
            const result = copyTextToClipboard(entries[selectedIndex].body);
            statusMessage = result.copied
                ? `Copied entry ${selectedIndex + 1} to clipboard.`
                : `Copy failed: ${result.error}`;
        };

        const render = () => {
            stdout.write('\x1b[2J\x1b[H');

            if (mode === 'list') {
                stdout.write(renderHistoryList(entries, selectedIndex, statusMessage, paths));
                return;
            }

            const view = renderHistoryView(entries, selectedIndex, scrollOffset, statusMessage);
            scrollOffset = view.scrollOffset;
            stdout.write(view.output);
        };

        const onData = (key: Buffer | string) => {
            const value = key.toString();
            const normalized = value.toLowerCase();

            if (value === '\u0003') {
                failBrowser();
                return;
            }

            if (normalized === 'q') {
                exitBrowser();
                return;
            }

            if (mode === 'list') {
                if (value === '\u001b[A' || normalized === 'k') {
                    selectedIndex = Math.max(0, selectedIndex - 1);
                    statusMessage = '';
                    render();
                    return;
                }

                if (value === '\u001b[B' || normalized === 'j') {
                    selectedIndex = Math.min(entries.length - 1, selectedIndex + 1);
                    statusMessage = '';
                    render();
                    return;
                }

                if (value === '\r') {
                    mode = 'view';
                    scrollOffset = 0;
                    statusMessage = '';
                    render();
                    return;
                }

                if (normalized === 'c') {
                    copySelectedOutput();
                    render();
                }

                return;
            }

            if (value === '\u001b[A' || normalized === 'k') {
                scrollOffset = Math.max(0, scrollOffset - 1);
                statusMessage = '';
                render();
                return;
            }

            if (value === '\u001b[B' || normalized === 'j') {
                scrollOffset += 1;
                statusMessage = '';
                render();
                return;
            }

            if (normalized === 'b' || value === '\u001b') {
                mode = 'list';
                statusMessage = '';
                render();
                return;
            }

            if (normalized === 'c') {
                copySelectedOutput();
                render();
            }
        };

        stdout.write('\x1b[?1049h');
        stdout.write('\x1b[?25l');
        stdin.setRawMode(true);
        stdin.resume();
        stdin.on('data', onData);
        stdout.on('resize', render);
        render();
    });
}
