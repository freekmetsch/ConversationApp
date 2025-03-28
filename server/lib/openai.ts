import OpenAI from "openai";
import fs from 'fs';
import path from 'path';
import os from 'os';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || "" 
});

// Speech-to-text transcription using Whisper API
export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  try {
    // Create a temporary file on disk that the OpenAI API can access
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `audio-${Date.now()}.wav`);
    
    // Write the buffer to a temporary file
    fs.writeFileSync(tempFilePath, audioBuffer);
    
    try {
      // Use the file path to create a readable stream for OpenAI
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: "whisper-1",
      });
      
      return transcription.text;
    } finally {
      // Clean up: remove the temporary file
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.warn(`Failed to clean up temporary file ${tempFilePath}:`, cleanupError);
      }
    }
  } catch (error) {
    console.error("Error transcribing audio:", error);
    throw new Error(`Failed to transcribe audio: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Text analysis using GPT-4o Mini
export async function analyzeTranscript(transcript: string, prompt: string): Promise<string> {
  try {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert coach and educational analyst. Analyze the coaching conversation based exactly on the provided prompt without adding additional analysis categories unless explicitly requested. Follow the prompt instructions precisely."
        },
        {
          role: "user",
          content: `${prompt}\n\nTranscription:\n${transcript}`
        }
      ],
    });

    return response.choices[0].message.content || "No analysis generated.";
  } catch (error) {
    console.error("Error analyzing transcript:", error);
    throw new Error(`Failed to analyze transcript: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Structured analysis with JSON output
export async function analyzeTranscriptStructured(transcript: string, prompt: string): Promise<any> {
  try {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert coach and educational analyst. Analyze the coaching conversation based exactly on the provided prompt without adding additional analysis categories unless explicitly requested. Follow the prompt instructions precisely. Return your response as a JSON object with appropriate structure."
        },
        {
          role: "user",
          content: `${prompt}\n\nPlease output your analysis as a structured JSON object.\n\nTranscription:\n${transcript}`
        }
      ],
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  } catch (error) {
    console.error("Error analyzing transcript with structured output:", error);
    throw new Error(`Failed to analyze transcript: ${error instanceof Error ? error.message : String(error)}`);
  }
}
