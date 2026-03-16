import youtubedl from 'youtube-dl-exec';
import ffmpeg from 'ffmpeg-static';
import path from 'path';
import os from 'os';

/**
 * Downloads the audio track from the given Instagram Reel URL.
 * 
 * @param url The Instagram Reel URL.
 * @param outputDir Directory to save the temporary audio file.
 * @returns The path to the downloaded audio file, or null if failed.
 */
export async function downloadAudio(url: string, outputDir: string = os.tmpdir()): Promise<string | null> {
    const outTmpl = path.join(outputDir, '%(id)s.%(ext)s');
    
    try {
        // @ts-ignore: Bypass ESM/CJS interop typing issues for youtube-dl-exec
        const ytExec = (youtubedl as any).default || youtubedl;
        // @ts-ignore: Bypass ESM/CJS interop typing issues for ffmpeg-static
        const ffmpegPath = (ffmpeg as any).default || ffmpeg;

        const result: any = await ytExec(url, {
            extractAudio: true,
            audioFormat: 'mp3',
            audioQuality: '192',
            ffmpegLocation: ffmpegPath,
            output: outTmpl,
            noWarnings: true,
            quiet: true,
            noSimulate: true,
            dumpJson: true
        });
        
        const videoId = result.id || 'audio';
        return path.join(outputDir, `${videoId}.mp3`);
    } catch (error: any) {
        throw new Error(`Failed to download video. Ensure the URL is public and correct. Details: ${error.message}`);
    }
}
