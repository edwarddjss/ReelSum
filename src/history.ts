import chalk from 'chalk';

import { type AppPaths, getAppPaths } from './app-paths.js';
import { copyTextToClipboard } from './clipboard.js';
import { createExitPromptError } from './errors.js';
import { icons } from './icons.js';
import { getOutputBoxContentWidth, OUTPUT_BOX_VERTICAL_OVERHEAD, renderOutputBox } from './output-box.js';
import { formatHeader, palette } from './ui.js';
import {
    formatSavedAt,
    formatSavedAtCompact,
    getEntryTitle,
    getSavedOutputs,
    type SavedOutputEntry
} from './storage.js';

type HistoryBrowserMode = 'list' | 'view';
type TerminalSize = {
    columns: number;
    rows: number;
};
type FooterSegment = {
    text: string;
    style: (text: string) => string;
};

const FOOTER_HEIGHT = 2;

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
    console.log(`${chalk.magenta.bold(`\n${formatHeader(`Saved Reel Outputs (${entries.length})`)}\n`)}`);

    entries.forEach((entry, index) => {
        console.log(chalk.magenta(`${index + 1}.`) + ' ' + chalk.white(`${formatSavedAt(entry.savedAt)} | ${getEntryTitle(entry)}`));

        if (entry.preview) {
            console.log(chalk.white(entry.preview));
        }

        console.log('');
    });
}

function formatStatusLine(statusMessage: string, fallbackMessage: string, width: number) {
    const message = truncateText(statusMessage || fallbackMessage, width);

    if (!statusMessage) {
        return chalk.dim(message);
    }

    if (statusMessage.startsWith('Copied')) {
        return chalk.green(message);
    }

    if (statusMessage.startsWith('Copy failed')) {
        return chalk.yellow(message);
    }

    return chalk.cyan(message);
}

function renderFooterLine(segments: FooterSegment[], width: number) {
    const plainText = segments.map((segment) => segment.text).join('');
    const padding = Math.max(0, width - plainText.length);

    return `${' '.repeat(padding)}${segments.map((segment) => segment.style(segment.text)).join('')}`;
}

function getFooterControls(mode: HistoryBrowserMode, width: number) {
    const compact = width < 54;

    if (mode === 'list') {
        return renderFooterLine(compact
            ? [
                { text: 'Up/Down', style: chalk.cyan.dim },
                { text: '  ', style: chalk.dim },
                { text: 'Enter', style: chalk.cyan.dim },
                { text: '  ', style: chalk.dim },
                { text: 'C', style: chalk.cyan.dim },
                { text: '  ', style: chalk.dim },
                { text: 'Q', style: chalk.cyan.dim }
            ]
            : [
                { text: 'Up/Down', style: chalk.cyan.dim },
                { text: ' move  ', style: chalk.dim },
                { text: 'Enter', style: chalk.cyan.dim },
                { text: ' open  ', style: chalk.dim },
                { text: 'C', style: chalk.cyan.dim },
                { text: ' copy  ', style: chalk.dim },
                { text: 'Q', style: chalk.cyan.dim },
                { text: ' quit', style: chalk.dim }
            ], width);
    }

    return renderFooterLine(compact
        ? [
            { text: 'Up/Down', style: chalk.cyan.dim },
            { text: '  ', style: chalk.dim },
            { text: 'C', style: chalk.cyan.dim },
            { text: '  ', style: chalk.dim },
            { text: 'Esc', style: chalk.cyan.dim },
            { text: '  ', style: chalk.dim },
            { text: 'Q', style: chalk.cyan.dim }
        ]
        : [
            { text: 'Up/Down', style: chalk.cyan.dim },
            { text: ' scroll  ', style: chalk.dim },
            { text: 'C', style: chalk.cyan.dim },
            { text: ' copy  ', style: chalk.dim },
            { text: 'Esc', style: chalk.cyan.dim },
            { text: ' back  ', style: chalk.dim },
            { text: 'Q', style: chalk.cyan.dim },
            { text: ' quit', style: chalk.dim }
        ], width);
}

function renderScreen(contentLines: string[], footerLines: string[], rows: number) {
    const contentHeight = Math.max(0, rows - footerLines.length);
    const visibleContent = contentLines.slice(0, contentHeight);
    const blankLines = Array.from({ length: Math.max(0, contentHeight - visibleContent.length) }, () => '');

    return [...visibleContent, ...blankLines, ...footerLines].join('\n');
}

export function renderHistoryList(
    entries: SavedOutputEntry[],
    selectedIndex: number,
    statusMessage: string,
    terminalSize: TerminalSize = getTerminalSize()
) {
    const cols = terminalSize.columns || 80;
    const rows = terminalSize.rows || 24;
    const bodyRows = Math.max(1, rows - FOOTER_HEIGHT);
    const contentWidth = Math.max(20, cols - 2);
    const previewHeight = Math.max(5, Math.floor(bodyRows / 3));
    const listHeight = Math.max(3, bodyRows - previewHeight - 8);
    const maxStart = Math.max(0, entries.length - listHeight);
    const start = Math.max(0, Math.min(selectedIndex - Math.floor(listHeight / 2), maxStart));
    const end = Math.min(entries.length, start + listHeight);
    const selectedEntry = entries[selectedIndex];
    const lines: string[] = [];

    lines.push(formatHeader('Reel History'));
    lines.push(palette.muted(`${entries.length} saved output${entries.length === 1 ? '' : 's'}`));
    lines.push('');

    for (let index = start; index < end; index += 1) {
        const entry = entries[index];
        const prefix = index === selectedIndex ? chalk.magenta(icons.selected) : ' ';
        const line = `${index + 1}. ${formatSavedAtCompact(entry.savedAt)} | ${getEntryTitle(entry)}`;
        const formatter = index === selectedIndex ? chalk.bold.white : chalk.white;
        lines.push(`${prefix} ${formatter(truncateText(line, contentWidth))}`);
    }

    lines.push('');
    lines.push(palette.accent('Selected'));
    lines.push(chalk.white(truncateText(`${formatSavedAt(selectedEntry.savedAt)} | ${getEntryTitle(selectedEntry)}`, contentWidth)));

    const previewLines = wrapText(selectedEntry.preview || '[No saved text preview available.]', contentWidth)
        .slice(0, Math.max(2, bodyRows - lines.length));
    lines.push(...previewLines.map((line) => chalk.white(line)));

    return renderScreen(lines, [
        formatStatusLine(
            statusMessage,
            entries.length > listHeight
                ? `Showing ${start + 1}-${end} of ${entries.length}`
                : `Entry ${selectedIndex + 1} of ${entries.length}`,
            contentWidth
        ),
        getFooterControls('list', contentWidth)
    ], rows);
}

function getTerminalSize(): TerminalSize {
    return {
        columns: process.stdout.columns || 80,
        rows: process.stdout.rows || 24
    };
}

export function renderHistoryView(
    entries: SavedOutputEntry[],
    selectedIndex: number,
    scrollOffset: number,
    statusMessage: string,
    terminalSize: TerminalSize = getTerminalSize()
) {
    const entry = entries[selectedIndex];
    const cols = terminalSize.columns || 80;
    const rows = terminalSize.rows || 24;
    const bodyRows = Math.max(1, rows - FOOTER_HEIGHT);
    const contentWidth = Math.max(20, cols - 2);
    const lines: string[] = [];

    lines.push(formatHeader(getEntryTitle(entry)));
    lines.push(palette.muted(`${selectedIndex + 1} of ${entries.length}`));
    lines.push('');
    lines.push(chalk.white(truncateText(`Saved ${formatSavedAt(entry.savedAt)}`, contentWidth)));
    lines.push('');

    const boxHeight = Math.max(5, bodyRows - lines.length);
    const visibleBodyLineCount = Math.max(1, boxHeight - OUTPUT_BOX_VERTICAL_OVERHEAD);
    const wrappedBody = wrapText(entry.body || '[No saved text found.]', getOutputBoxContentWidth(cols));
    const maxScroll = Math.max(0, wrappedBody.length - visibleBodyLineCount);
    const clampedScrollOffset = Math.max(0, Math.min(scrollOffset, maxScroll));
    const visibleBody = wrappedBody.slice(clampedScrollOffset, clampedScrollOffset + visibleBodyLineCount);
    const boxedBody = renderOutputBox(visibleBody.join('\n'), {
        margin: 0,
        width: cols,
        height: boxHeight
    });

    lines.push(...boxedBody.split('\n'));

    return {
        output: renderScreen(lines, [
            formatStatusLine(
                statusMessage,
                `Lines ${clampedScrollOffset + 1}-${Math.min(clampedScrollOffset + visibleBodyLineCount, wrappedBody.length)} of ${wrappedBody.length}`,
                contentWidth
            ),
            getFooterControls('view', contentWidth)
        ], rows),
        scrollOffset: clampedScrollOffset
    };
}

export async function openHistoryBrowser(limit: number, paths: AppPaths = getAppPaths()) {
    const entries = getSavedOutputs(limit, paths);

    if (entries.length === 0) {
        console.log(chalk.yellow('\nNo saved outputs found.'));
        console.log(chalk.dim('Run reelsum to save your first transcript.\n'));
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
                stdout.write(renderHistoryList(entries, selectedIndex, statusMessage));
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
