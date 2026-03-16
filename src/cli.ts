#!/usr/bin/env node

import { Command } from 'commander';
import ora from 'ora';
import boxen from 'boxen';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import os from 'os';

import { downloadAudio } from './downloader.js';
import { extractTranscript } from './extractor.js';
import { generateSummary } from './ai.js';
import { input, password, confirm } from '@inquirer/prompts';
import clipboardy from 'clipboardy';

const configPath = path.join(os.homedir(), '.reelsumrc');

function getConfig() {
    if (fs.existsSync(configPath)) {
        try {
            return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        } catch (e) {
            return {};
        }
    }
    return {};
}

function saveConfig(config: any) {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

const program = new Command();

program
    .name('reelsum')
    .description('A CLI tool to download, transcribe, and clean up transcripts from Instagram Reels.')
    .version('0.1.0');

program
    .command('config')
    .description('Set your configuration variables')
    .requiredOption('-k, --key <string>', 'Your OpenAI API key')
    .action((options) => {
        const config = getConfig();
        config.OPENAI_API_KEY = options.key;
        saveConfig(config);
        console.log(chalk.green(`\n✔ Configuration saved to ${configPath}`));
    });

program
    .command('summarize [url]', { isDefault: true })
    .description('Download, transcribe, and process an Instagram Reel')
    .action(async (url?: string) => {
        try {
            let finalUrl = url;

            // Validate inline URL if provided
            if (finalUrl) {
                try {
                    const parsed = new URL(finalUrl);
                    if (!parsed.hostname.includes('instagram.com')) {
                        console.error(chalk.red('\n✖ Error: Please provide a valid Instagram URL.'));
                        process.exit(1);
                    }
                } catch {
                    console.error(chalk.red('\n✖ Error: Invalid URL format.'));
                    process.exit(1);
                }
            }

            // Print the header if we are in interactive mode
        if (!finalUrl) {
            console.clear();
            console.log(chalk.magenta.bold('\n✨ ReelSum\n'));
        }

        let apiKey = process.env.OPENAI_API_KEY;

        // Check config file if env var is missing
        if (!apiKey) {
            const config = getConfig();
            apiKey = config.OPENAI_API_KEY;
            if (apiKey) {
                process.env.OPENAI_API_KEY = apiKey;
            }
        }

        // If API key is STILL missing, prompt for it FIRST
        if (!process.env.OPENAI_API_KEY) {
            console.log(chalk.yellow('🔑 Setup Required'));
            console.log(chalk.dim('Your OpenAI API key is missing. This is a one-time setup.'));
            console.log(chalk.dim('It will be securely saved to ~/.reelsumrc\n'));

            apiKey = await password({
                message: 'OpenAI API Key (sk-...):',
                mask: '*',
                theme: { prefix: chalk.yellow('➜') }
            });
            if (!apiKey) process.exit(0);

            const config = getConfig();
            config.OPENAI_API_KEY = apiKey;
            saveConfig(config);

            process.env.OPENAI_API_KEY = apiKey;
            console.log(chalk.green('✔ API Key saved.\n'));
        }

        // Determine if we are in interactive mode (no URL passed via arguments)
        const isInteractive = !finalUrl;

        while (true) {
            // If URL is missing, prompt for it AFTER the key is secured
            if (!finalUrl) {
                finalUrl = await input({
                    message: 'Instagram Reel URL:',
                    theme: { prefix: chalk.magenta('➜') },
                    validate: (value) => {
                        if (!value.trim()) return 'Please enter a URL.';
                        try {
                            const parsed = new URL(value.trim());
                            if (!parsed.hostname.includes('instagram.com')) {
                                return 'Please enter a valid Instagram URL.';
                            }
                            return true;
                        } catch {
                            return 'Please enter a valid URL format (e.g., https://...).';
                        }
                    }
                });
                
                // Trim in case the user pasted with spaces
                finalUrl = finalUrl.trim();
                
                if (!finalUrl) process.exit(0);
            }

            console.log(''); // Add breathing room before spinners
            let audioPath: string | null = null;
            const spinner = ora({ color: 'magenta' });

            try {
                // 1. Download Audio
                spinner.start(chalk.blue('Downloading Reel and extracting audio...'));
                audioPath = await downloadAudio(finalUrl);
                if (!audioPath) throw new Error('Failed to extract audio path from yt-dlp output.');
                spinner.succeed(chalk.green('Download complete.'));

                // 2. Extract Transcript
                spinner.start(chalk.blue('Transcribing audio with Whisper...'));
                const transcript = await extractTranscript(audioPath);
                spinner.succeed(chalk.green('Transcription complete.'));

                // 3. Generate Cleaned Transcript
                spinner.start(chalk.blue('Cleaning and formatting transcript...'));
                const summary = await generateSummary(transcript);
                spinner.succeed(chalk.green('Processing complete.'));

                // 4. Copy to Clipboard
                clipboardy.writeSync(summary);
                console.log(chalk.green('✔ Copied to clipboard!\n'));

                // Output Panel
                console.log(boxen(summary, {
                    title: 'Reel Content',
                    titleAlignment: 'left',
                    padding: 1,
                    margin: 1,
                    borderColor: 'magenta',
                    borderStyle: 'round'
                }));

            } catch (error: any) {
                if (spinner.isSpinning) {
                    spinner.fail(chalk.red('Operation failed.'));
                }
                console.error('\n' + chalk.red(`An error occurred: ${error.message}`));
            } finally {
                if (audioPath && fs.existsSync(audioPath)) {
                    fs.unlinkSync(audioPath);
                }
            }

            // If the user ran a single command (e.g. `reelsum "url"`), exit immediately
            if (!isInteractive) {
                break;
            }

            // If interactive, ask if they want to do another one
            console.log('');
            const doNext = await confirm({ 
                message: 'Process another Reel?', 
                default: true,
                theme: { prefix: chalk.magenta('➜') } 
            });
            
            if (!doNext) {
                console.log(chalk.dim('\nGoodbye! 👋\n'));
                break;
            }
            
            // Clear URL for the next loop iteration
            finalUrl = undefined;
            console.log('');
        }
        } catch (err: any) {
            // Handle the specific error thrown by inquirer when Ctrl+C is pressed
            if (err.name === 'ExitPromptError') {
                console.log(chalk.dim('\nGoodbye! 👋\n'));
                process.exit(0);
            } else {
                console.error('\n' + chalk.red(`An unexpected error occurred: ${err.message}`));
                process.exit(1);
            }
        }
    });

program.parse(process.argv);
