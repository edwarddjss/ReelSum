import OpenAI from 'openai';

import { getErrorMessage } from './errors.js';

/**
 * Cleans up and formats the transcript using OpenAI's GPT-4o model.
 * 
 * @param transcript The raw text output from Whisper.
 * @returns A clean, highly readable, and coherent version of the transcript.
 */
export async function formatTranscript(transcript: string): Promise<string> {
    if (!transcript || !transcript.trim()) {
        return 'No transcript could be extracted.';
    }

    const openai = new OpenAI(); // Automatically uses process.env.OPENAI_API_KEY

    const prompt = `
You are an AI assistant designed to process fast-paced video transcripts.
Below is the raw, unedited speech transcript of a short-form video (e.g., an Instagram Reel).

Please rewrite this into a clean, highly readable, and coherent paragraph or two.
- Fix any grammatical errors, stutters, or incomplete sentences from the raw speech.
- Ensure it retains the original meaning and conversational tone of the creator.
- DO NOT write a high-level summary (e.g., "The speaker talks about..."). Instead, rewrite the transcript as if it were a polished blog post or article written by the speaker.

Raw Transcript:
"""${transcript}"""

Cleaned Transcript:
`;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", "content": "You are a helpful assistant that cleans up and polishes raw speech transcripts into readable articles without summarizing them." },
                { role: "user", "content": prompt }
            ],
            temperature: 0.7,
            max_tokens: 600
        });

        return response.choices[0]?.message?.content?.trim() || 'Failed to generate clean transcript.';
    } catch (error) {
        throw new Error(`OpenAI generation failed: ${getErrorMessage(error)}`);
    }
}
