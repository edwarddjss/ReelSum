import { input, password } from '@inquirer/prompts';

import { createExitPromptError } from './errors.js';
import { palette, getPromptPrefix, renderPrompt, renderUpdateNotice, type PromptTone } from './ui.js';
import { validateInstagramUrlInput } from './validation.js';

export type NextAction = 'continue' | 'exit' | 'history';
export type UpdateAction = 'update' | 'skip';

type SingleKeyOption<T extends string> = {
    key: string;
    label: string;
    value: T;
};

function ensureTty(message: string) {
    if (!process.stdin.isTTY) {
        throw new Error(message);
    }
}

async function promptForSingleKeyChoice<T extends string>(
    message: string,
    options: SingleKeyOption<T>[],
    tone: PromptTone = 'accent'
) {
    ensureTty('Interactive input requires a TTY.');

    const optionMap = new Map(options.map((option) => [option.key.toLowerCase(), option]));
    const promptHint = options.map((option) => `${option.key.toUpperCase()}=${option.label}`).join(', ');

    if (typeof process.stdin.setRawMode !== 'function') {
        const response = await input({
            message: `${message} (${promptHint}):`,
            theme: { prefix: getPromptPrefix(tone) },
            validate: (value) => optionMap.has(value.trim().toLowerCase()) ? true : `Press ${options.map((option) => option.key.toUpperCase()).join(', ')}.`
        });

        return optionMap.get(response.trim().toLowerCase())!.value;
    }

    return await new Promise<T>((resolve, reject) => {
        const stdin = process.stdin;
        const wasRaw = stdin.isRaw;

        console.log(renderPrompt(message, options, tone));

        const cleanup = () => {
            stdin.removeListener('data', onData);
            stdin.setRawMode(wasRaw ?? false);
            stdin.pause();
        };

        const onData = (key: Buffer | string) => {
            const value = key.toString();

            if (value === '\u0003') {
                cleanup();
                reject(createExitPromptError());
                return;
            }

            const selectedOption = optionMap.get(value.toLowerCase());
            if (!selectedOption) {
                return;
            }

            cleanup();
            console.log(palette.key(selectedOption.key.toUpperCase()));
            resolve(selectedOption.value);
        };

        stdin.setRawMode(true);
        stdin.resume();
        stdin.on('data', onData);
    });
}

export async function promptForApiKey() {
    ensureTty('Interactive input requires a TTY. Set OPENAI_API_KEY or run `reelsum config --key <key>` instead.');

    return await password({
        message: 'OpenAI API Key (sk-...):',
        mask: '*',
        theme: { prefix: getPromptPrefix('warning') }
    });
}

export async function promptForInstagramUrl() {
    ensureTty('Interactive input requires a TTY. Pass an Instagram Reel URL as an argument.');

    const response = await input({
        message: 'Instagram Reel URL:',
        theme: { prefix: getPromptPrefix('accent') },
        validate: validateInstagramUrlInput
    });

    return response.trim();
}

export async function promptForNextAction(): Promise<NextAction> {
    return await promptForSingleKeyChoice('What next?', [
        { key: 'y', label: 'run again', value: 'continue' },
        { key: 'h', label: 'history', value: 'history' },
        { key: 'n', label: 'quit', value: 'exit' }
    ]);
}

export async function promptForUpdateAction(currentVersion: string, latestVersion: string): Promise<UpdateAction> {
    console.log(renderUpdateNotice(currentVersion, latestVersion));

    return await promptForSingleKeyChoice('Update now?', [
        { key: 'y', label: 'update now', value: 'update' },
        { key: 'n', label: 'keep working', value: 'skip' }
    ], 'info');
}
