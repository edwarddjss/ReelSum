#!/usr/bin/env node

import boxen from 'boxen';
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
import { saveOutput } from './storage.js';
import { createTempWorkspace } from './temp-workspace.js';
import { assertInstagramUrl } from './validation.js';

const paths = getAppPaths();

function exitGracefully() {
    console.log(chalk.dim('\nGoodbye! 👋\n'));
    process.exit(0);
}

function handleFatalError(error: unknown): never {
    if (isExitPromptError(error)) {
        exitGracefully();
    }

    console.error('\n' + chalk.red(`An unexpected error occurred: ${getErrorMessage(error)}`));
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

    console.log(chalk.yellow('🔑 Setup Required'));
    console.log(chalk.dim('Your OpenAI API key is missing. This is a one-time local setup.'));
    console.log(chalk.dim(`It will be stored locally in ${paths.configFile} with restricted permissions where supported.\n`));

    const apiKey = (await promptForApiKey()).trim();
    if (!apiKey) {
        exitGracefully();
    }

    saveConfig({ OPENAI_API_KEY: apiKey }, paths);
    process.env.OPENAI_API_KEY = apiKey;
    console.log(chalk.green(`✔ API Key saved to ${paths.configFile}.\n`));

    return apiKey;
}

async function configureApiKey(optionKey?: string) {
    let apiKey = optionKey?.trim();

    if (apiKey) {
        console.log(chalk.yellow('Warning: passing API keys as command flags can expose them in shell history.'));
    } else {
        console.log(chalk.yellow('🔑 OpenAI API Key Setup'));
        console.log(chalk.dim(`The key will be stored locally in ${paths.configFile} with restricted permissions where supported.\n`));
        apiKey = (await promptForApiKey()).trim();
    }

    if (!apiKey) {
        exitGracefully();
    }

    saveConfig({ OPENAI_API_KEY: apiKey }, paths);
    console.log(chalk.green(`\n✔ Configuration saved to ${paths.configFile}`));
}

async function processReel(url: string) {
    const tempWorkspace = createTempWorkspace();
    const spinner = ora({ color: 'magenta' });

    try {
        spinner.start(chalk.blue('Downloading Reel and extracting audio...'));
        const audioPath = await downloadAudio(url, tempWorkspace.dirPath);
        spinner.succeed(chalk.green('Download complete.'));

        spinner.start(chalk.blue('Transcribing audio with Whisper...'));
        const transcript = await extractTranscript(audioPath);
        spinner.succeed(chalk.green('Transcription complete.'));

        spinner.start(chalk.blue('Cleaning and formatting transcript...'));
        const formattedTranscript = await formatTranscript(transcript);
        spinner.succeed(chalk.green('Processing complete.'));

        console.log('');

        let savedPath: string | undefined;
        try {
            savedPath = saveOutput(url, formattedTranscript, paths);
            console.log(chalk.green(`✔ Saved output to ${savedPath}`));
        } catch (error) {
            console.log(chalk.yellow(`⚠ Output could not be saved locally: ${getErrorMessage(error)}`));
        }

        const clipboardResult = copyTextToClipboard(formattedTranscript);
        if (clipboardResult.copied) {
            console.log(chalk.green('✔ Copied to clipboard!\n'));
        } else {
            console.log(chalk.yellow(`⚠ Clipboard unavailable: ${clipboardResult.error}\n`));
        }

        console.log(boxen(formattedTranscript, {
            title: 'Reel Content',
            titleAlignment: 'left',
            padding: 1,
            margin: 1,
            borderColor: 'magenta',
            borderStyle: 'round'
        }));

        return savedPath;
    } catch (error) {
        if (spinner.isSpinning) {
            spinner.fail(chalk.red('Operation failed.'));
        }

        console.error('\n' + chalk.red(`An error occurred: ${getErrorMessage(error)}`));
        return undefined;
    } finally {
        tempWorkspace.cleanup();
    }
}

async function runSummarize(url?: string) {
    let finalUrl = url?.trim();

    if (finalUrl) {
        finalUrl = assertInstagramUrl(finalUrl);
    } else if (process.stdout.isTTY) {
        console.clear();
        console.log(chalk.magenta.bold('\n✨ ReelSum\n'));
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
