import boxen, { type Options } from 'boxen';

import { formatHeader } from './ui.js';

export const OUTPUT_BOX_CONTENT_WIDTH_OFFSET = 4;
export const OUTPUT_BOX_VERTICAL_OVERHEAD = 4;

const OUTPUT_BOX_OPTIONS: Options = {
    title: formatHeader('Reel Content'),
    titleAlignment: 'left',
    padding: 1,
    borderColor: 'magenta',
    borderStyle: 'round'
};

export function getOutputBoxContentWidth(totalWidth: number) {
    return Math.max(1, totalWidth - OUTPUT_BOX_CONTENT_WIDTH_OFFSET);
}

export function renderOutputBox(text: string, options: Partial<Options> = {}) {
    return boxen(text, {
        ...OUTPUT_BOX_OPTIONS,
        ...options
    });
}
