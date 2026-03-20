import fs from 'fs';
import path from 'path';

import { type AppPaths, getAppPaths } from './app-paths.js';
import { ensurePrivateDir, writePrivateFile } from './filesystem.js';

export type SavedOutputEntry = {
    filePath: string;
    sourceUrl: string;
    savedAt: string;
    preview: string;
    body: string;
};

function getOutputFileName(url: string, savedAt: Date) {
    const timestamp = savedAt.toISOString().replace(/[:.]/g, '-');

    try {
        const parsed = new URL(url);
        const reelId = parsed.pathname
            .split('/')
            .filter(Boolean)
            .pop()
            ?.replace(/[^a-zA-Z0-9_-]/g, '') || 'reel';

        return `${timestamp}-${reelId}.txt`;
    } catch {
        return `${timestamp}-reel.txt`;
    }
}

function previewFromBody(body: string) {
    return body.replace(/\s+/g, ' ').slice(0, 160);
}

export function saveOutput(url: string, body: string, paths: AppPaths = getAppPaths(), savedAt: Date = new Date()) {
    ensurePrivateDir(paths.appDir);

    const filePath = path.join(paths.outputDir, getOutputFileName(url, savedAt));
    const content = [
        `Source: ${url}`,
        `Saved: ${savedAt.toISOString()}`,
        '',
        body
    ].join('\n');

    writePrivateFile(filePath, content);
    return filePath;
}

export function parseSavedOutput(filePath: string): SavedOutputEntry {
    const content = fs.readFileSync(filePath, 'utf-8');
    const [sourceLine = '', savedLine = '', , ...bodyLines] = content.split('\n');

    if (!sourceLine.startsWith('Source:')) {
        throw new Error('Malformed saved output: missing source metadata.');
    }

    const stats = fs.statSync(filePath);
    const sourceUrl = sourceLine.replace(/^Source:\s*/, '').trim() || 'Unknown source';
    const savedAt = savedLine.replace(/^Saved:\s*/, '').trim() || new Date(stats.mtimeMs).toISOString();
    const body = bodyLines.join('\n').trim();

    return {
        filePath,
        sourceUrl,
        savedAt,
        preview: previewFromBody(body),
        body
    };
}

function sortEntriesDescending(entries: SavedOutputEntry[]) {
    return entries.sort((left, right) => {
        const leftTime = Date.parse(left.savedAt);
        const rightTime = Date.parse(right.savedAt);

        if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
            return rightTime - leftTime;
        }

        return right.filePath.localeCompare(left.filePath);
    });
}

export function getSavedOutputs(limit: number, paths: AppPaths = getAppPaths()) {
    if (!fs.existsSync(paths.outputDir)) {
        return [];
    }

    const entries: SavedOutputEntry[] = [];

    for (const fileName of fs.readdirSync(paths.outputDir)) {
        if (!fileName.endsWith('.txt')) {
            continue;
        }

        try {
            entries.push(parseSavedOutput(path.join(paths.outputDir, fileName)));
        } catch {
            // Ignore malformed output files so history remains usable.
        }
    }

    return sortEntriesDescending(entries).slice(0, limit);
}

export function formatSavedAt(savedAt: string) {
    const parsed = new Date(savedAt);

    if (Number.isNaN(parsed.getTime())) {
        return savedAt;
    }

    return parsed.toLocaleString();
}

export function formatSavedAtCompact(savedAt: string) {
    const parsed = new Date(savedAt);

    if (Number.isNaN(parsed.getTime())) {
        return savedAt;
    }

    return parsed.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

export function getEntryTitle(entry: SavedOutputEntry) {
    try {
        const parsed = new URL(entry.sourceUrl);
        return parsed.pathname.split('/').filter(Boolean).pop() || path.basename(entry.filePath, '.txt');
    } catch {
        return path.basename(entry.filePath, '.txt');
    }
}
