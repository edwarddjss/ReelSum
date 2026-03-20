import { youtubeDl, type Payload } from 'youtube-dl-exec';
import ffmpeg from 'ffmpeg-static';
import path from 'path';
import os from 'os';

import { getErrorMessage } from './errors.js';

/**
 * Downloads the audio track from the given Instagram Reel URL.
 * 
 * @param url The Instagram Reel URL.
 * @param outputDir Directory to save the temporary audio file.
 * @returns The path to the downloaded audio file.
 */
export async function downloadAudio(url: string, outputDir: string = os.tmpdir()): Promise<string> {
    const outTmpl = path.join(outputDir, '%(id)s.%(ext)s');
    
    try {
        // `ffmpeg-static` is CJS; under NodeNext its runtime value is the path string.
        const ffmpegPath = ffmpeg as unknown as string | null;
        if (!ffmpegPath) {
            throw new Error('ffmpeg binary is unavailable.');
        }

        const result = await youtubeDl(url, {
            extractAudio: true,
            audioFormat: 'mp3',
            audioQuality: 192,
            ffmpegLocation: ffmpegPath,
            output: outTmpl,
            noWarnings: true,
            quiet: true,
            simulate: false,
            dumpJson: true
        }) as Payload | string;

        if (typeof result === 'string') {
            throw new Error('yt-dlp did not return download metadata.');
        }
        
        const videoId = result.id || 'audio';
        return path.join(outputDir, `${videoId}.mp3`);
    } catch (error) {
        throw new Error(`Failed to download video. Ensure the URL is public and correct. Details: ${getErrorMessage(error)}`);
    }
}
