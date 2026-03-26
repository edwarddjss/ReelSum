import boxen from 'boxen';
import chalk from 'chalk';

import { iconLabel, icons } from './icons.js';

export type PromptTone = 'accent' | 'info' | 'warning';

export type KeyHint = {
    key: string;
    label: string;
};

type NoticeTone = 'accent' | 'danger' | 'info' | 'success' | 'warning';

export const palette = {
    accent: chalk.cyanBright,
    brand: chalk.magentaBright.bold,
    danger: chalk.redBright,
    info: chalk.blueBright,
    key: chalk.cyanBright.bold,
    muted: chalk.dim,
    plain: chalk.white,
    success: chalk.greenBright,
    warning: chalk.yellowBright
} as const;

const noticeIcons: Record<NoticeTone, string> = {
    accent: icons.accent,
    danger: icons.error,
    info: icons.info,
    success: icons.success,
    warning: icons.warning
};

const noticeStyles: Record<NoticeTone, (text: string) => string> = {
    accent: palette.brand,
    danger: palette.danger,
    info: palette.info,
    success: palette.success,
    warning: palette.warning
};

const promptStyles: Record<PromptTone, (text: string) => string> = {
    accent: palette.brand,
    info: palette.info,
    warning: palette.warning
};

export function formatHeader(label: string) {
    return palette.brand(iconLabel(icons.brand, label));
}

export function formatNotice(tone: NoticeTone, message: string) {
    return noticeStyles[tone](iconLabel(noticeIcons[tone], message));
}

export function getPromptPrefix(tone: PromptTone = 'accent') {
    return promptStyles[tone](icons.prompt);
}

export function renderChoiceHints(hints: KeyHint[]) {
    return hints
        .map((hint) => `${palette.key(hint.key.toUpperCase())} ${palette.muted(hint.label)}`)
        .join(palette.muted('  ·  '));
}

export function renderPrompt(message: string, hints: KeyHint[], tone: PromptTone = 'accent') {
    return [
        `${getPromptPrefix(tone)} ${palette.plain(message)}`,
        `  ${renderChoiceHints(hints)}`
    ].join('\n');
}

export function renderBrandHeader() {
    return formatHeader('ReelSum');
}

export function renderUpdateNotice(currentVersion: string, latestVersion: string) {
    return boxen([
        palette.plain('A new version is available.'),
        '',
        `${palette.muted('You have')}  ${palette.plain(currentVersion)}`,
        `${palette.muted('Available')} ${palette.success(latestVersion)}`,
        '',
        renderChoiceHints([
            { key: 'y', label: 'update now' },
            { key: 'n', label: 'keep working' }
        ])
    ].join('\n'), {
        title: iconLabel(icons.accent, 'Update Available'),
        titleAlignment: 'left',
        padding: { top: 0, right: 1, bottom: 0, left: 1 },
        margin: { top: 1, bottom: 0, left: 0, right: 0 },
        borderColor: 'cyan',
        borderStyle: 'round'
    });
}
