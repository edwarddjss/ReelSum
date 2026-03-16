import fs from 'fs';
import OpenAI from 'openai';

/**
 * Transcribes the audio file using OpenAI's Whisper model.
 * 
 * @param audioPath The absolute path to the local audio file.
 * @returns The raw transcribed text.
 */
export async function extractTranscript(audioPath: string): Promise<string> {
    if (!fs.existsSync(audioPath)) {
        throw new Error(`Audio file not found at path: ${audioPath}`);
    }

    const openai = new OpenAI(); // Automatically uses process.env.OPENAI_API_KEY

    try {
        const transcription = await openai.audio.transcriptions.create({
            model: "whisper-1",
            file: fs.createReadStream(audioPath),
            response_format: "text"
        });

        // The response format text returns a string
        return (transcription as unknown as string).trim();
    } catch (error: any) {
        throw new Error(`OpenAI transcription failed: ${error.message}`);
    }
}
