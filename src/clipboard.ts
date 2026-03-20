import clipboardy from 'clipboardy';

import { getErrorMessage } from './errors.js';

export type ClipboardResult = {
    copied: boolean;
    error?: string;
};

export function copyTextToClipboard(text: string): ClipboardResult {
    try {
        clipboardy.writeSync(text);
        return { copied: true };
    } catch (error) {
        return {
            copied: false,
            error: getErrorMessage(error)
        };
    }
}
