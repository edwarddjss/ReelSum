#!/usr/bin/env node

import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';

import { formatTranscript } from './ai.js';
import { DEFAULT_HISTORY_LIMIT, getAppPaths } from './app-paths.js';
import { copyTextToClipboard } from './clipboard.js';
import { resolveApiKey, saveConfig } from './config.js';
import { downloadAudio } from './downloader.js';
import { getErrorMessage, isExitPromptError } from './errors.js';
import { extractTranscript } from './extractor.js';
import { openHistoryBrowser } from './history.js';
import { getPackageVersion } from './package-info.js';
import { promptForApiKey, promptForInstagramUrl, promptForNextAction, type NextAction } from './prompts.js';
import { renderOutputBox } from './output-box.js';
import { saveOutput } from './storage.js';
import { createTempWorkspace } from './temp-workspace.js';
import { formatNotice, palette, renderBrandHeader } from './ui.js';
import { maybeHandleCliUpdate } from './updater.js';
import { assertInstagramUrl } from './validation.js';

const paths = getAppPaths();

function exitGracefully() {
    console.log(`\n${formatNotice('info', 'Goodbye.')}\n`);
    process.exit(0);
}

function handleFatalError(error: unknown): never {
    if (isExitPromptError(error)) {
        exitGracefully();
    }

    console.error('\n' + formatNotice('danger', `An unexpected error occurred: ${getErrorMessage(error)}`));
    process.exit(1);
}

function parseLimit(value: string) {
    const parsed = Number.parseInt(value, 10);

    if (Number.isNaN(parsed) || parsed <= 0) {
        throw new Error('`--limit` must be a positive number.');
    }

    return parsed;
}

async function ensureApiKey() {
    const existingApiKey = resolveApiKey(paths);
    if (existingApiKey) {
        process.env.OPENAI_API_KEY = existingApiKey;
        return existingApiKey;
    }

    console.log(formatNotice('accent', 'API key required'));
    console.log(palette.muted('Your OpenAI API key is missing. This is a one-time local setup.'));
    console.log(palette.muted('It will be stored locally on this device.\n'));

    const apiKey = (await promptForApiKey()).trim();
    if (!apiKey) {
        exitGracefully();
    }

    saveConfig({ OPENAI_API_KEY: apiKey }, paths);
    process.env.OPENAI_API_KEY = apiKey;
    console.log(`${formatNotice('success', 'API key saved.')}\n`);

    return apiKey;
}

async function configureApiKey(optionKey?: string) {
    let apiKey = optionKey?.trim();

    if (apiKey) {
        console.log(formatNotice('warning', 'Passing API keys as command flags can expose them in shell history.'));
    } else {
        console.log(formatNotice('accent', 'Set up your API key'));
        console.log(palette.muted('The key will be stored locally on this device.\n'));
        apiKey = (await promptForApiKey()).trim();
    }

    if (!apiKey) {
        exitGracefully();
    }

    saveConfig({ OPENAI_API_KEY: apiKey }, paths);
    console.log(`\n${formatNotice('success', 'API key saved.')}`);
}

async function processReel(url: string) {
    const tempWorkspace = createTempWorkspace();
    const spinner = ora({ color: 'magenta' });

    try {
        spinner.start(palette.info('Downloading Reel and extracting audio...'));
        const audioPath = await downloadAudio(url, tempWorkspace.dirPath);
        spinner.succeed(palette.success('Download complete.'));

        spinner.start(palette.info('Transcribing audio...'));
        const transcript = await extractTranscript(audioPath);
        spinner.succeed(palette.success('Transcription complete.'));

        spinner.start(palette.info('Formatting transcript...'));
        const formattedTranscript = await formatTranscript(transcript);
        spinner.succeed(palette.success('Processing complete.'));

        console.log('');

        let savedPath: string | undefined;
        try {
            savedPath = saveOutput(url, formattedTranscript, paths);
            console.log(formatNotice('success', 'Added to history.'));
        } catch {
            console.log(formatNotice('warning', 'Could not add this to history.'));
        }

        const clipboardResult = copyTextToClipboard(formattedTranscript);
        if (clipboardResult.copied) {
            console.log(`${formatNotice('success', 'Copied to clipboard!')}\n`);
        } else {
            console.log(`${formatNotice('warning', 'Could not copy to clipboard.')}\n`);
        }

        console.log(renderOutputBox(formattedTranscript, { margin: 1 }));

        return savedPath;
    } catch (error) {
        if (spinner.isSpinning) {
            spinner.fail(palette.danger('Operation failed.'));
        }

        console.error('\n' + formatNotice('danger', `An error occurred: ${getErrorMessage(error)}`));
        return undefined;
    } finally {
        tempWorkspace.cleanup();
    }
}

async function runSummarize(url?: string) {
    let finalUrl = url?.trim();

    if (await maybeHandleCliUpdate(paths)) {
        return;
    }

    if (finalUrl) {
        finalUrl = assertInstagramUrl(finalUrl);
    } else if (process.stdout.isTTY) {
        console.clear();
        console.log(`\n${renderBrandHeader()}\n`);
    }

    await ensureApiKey();
    const isInteractive = !finalUrl;

    while (true) {
        if (!finalUrl) {
            finalUrl = assertInstagramUrl(await promptForInstagramUrl());
        }

        await processReel(finalUrl);

        if (!isInteractive) {
            break;
        }

        console.log('');
        let nextAction: NextAction;

        while (true) {
            nextAction = await promptForNextAction();
            if (nextAction !== 'history') {
                break;
            }

            console.log('');
            await openHistoryBrowser(DEFAULT_HISTORY_LIMIT, paths);
            console.log('');
        }

        if (nextAction === 'exit') {
            exitGracefully();
        }

        finalUrl = undefined;
        console.log('');
    }
}

const program = new Command();

program
    .name('reelsum')
    .description('A CLI tool to download, transcribe, and clean up transcripts from Instagram Reels.')
    .version(getPackageVersion());

program
    .command('config')
    .description('Store your OpenAI API key locally for ReelSum')
    .option('-k, --key <string>', 'Your OpenAI API key')
    .action(async (options: { key?: string }) => {
        try {
            if (await maybeHandleCliUpdate(paths)) {
                return;
            }

            await configureApiKey(options.key);
        } catch (error) {
            handleFatalError(error);
        }
    });

program
    .command('history')
    .description('Browse recently saved Reel outputs')
    .option('-n, --limit <number>', 'Number of saved outputs to load', `${DEFAULT_HISTORY_LIMIT}`)
    .action(async (options: { limit: string }) => {
        try {
            if (await maybeHandleCliUpdate(paths)) {
                return;
            }

            await openHistoryBrowser(parseLimit(options.limit), paths);
        } catch (error) {
            handleFatalError(error);
        }
    });

program
    .command('summarize [url]', { isDefault: true })
    .description('Download, transcribe, and process an Instagram Reel')
    .action(async (url?: string) => {
        try {
            await runSummarize(url);
        } catch (error) {
            handleFatalError(error);
        }
    });

program.parse(process.argv);
