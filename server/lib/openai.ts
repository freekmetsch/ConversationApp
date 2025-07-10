import OpenAI from "openai";
import fs from 'fs';
import path from 'path';
import os from 'os';
import { storage } from '../storage';

// Function to get OpenAI client with current API key
async function getOpenAIClient(): Promise<OpenAI> {
  // First try to get API key from user preferences
  const preferences = await storage.getUserPreferences();
  const apiKey = preferences?.apiKeys?.openai || process.env.OPENAI_API_KEY || "";
  
  if (!apiKey) {
    throw new Error("MISSING_API_KEY");
  }
  
  return new OpenAI({ apiKey });
}

// Function to check if OpenAI API key is available
export async function hasOpenAIKey(): Promise<boolean> {
  try {
    const preferences = await storage.getUserPreferences();
    const apiKey = preferences?.apiKeys?.openai || process.env.OPENAI_API_KEY || "";
    return !!apiKey;
  } catch (error) {
    return false;
  }
}

// Speech-to-text transcription using Whisper API
export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  try {
    // Check if API key is available before attempting transcription
    const hasKey = await hasOpenAIKey();
    if (!hasKey) {
      throw new Error("OpenAI API key not found. Please set your API key in the application settings or OPENAI_API_KEY environment variable.");
    }
    
    const openai = await getOpenAIClient();
    
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
    if (error instanceof Error && error.message === "MISSING_API_KEY") {
      throw new Error("OpenAI API key not found. Please set your API key in the application settings or OPENAI_API_KEY environment variable.");
    }
    console.error("Error transcribing audio:", error);
    throw new Error(`Failed to transcribe audio: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Text analysis using GPT-4o Mini
export async function analyzeTranscript(transcript: string, prompt: string): Promise<string> {
  try {
    // Check if API key is available before attempting analysis
    const hasKey = await hasOpenAIKey();
    if (!hasKey) {
      throw new Error("OpenAI API key not found. Please set your API key in the application settings or OPENAI_API_KEY environment variable.");
    }
    
    const openai = await getOpenAIClient();
    
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
    if (error instanceof Error && error.message === "MISSING_API_KEY") {
      throw new Error("OpenAI API key not found. Please set your API key in the application settings or OPENAI_API_KEY environment variable.");
    }
    console.error("Error analyzing transcript:", error);
    throw new Error(`Failed to analyze transcript: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Structured analysis with JSON output
export async function analyzeTranscriptStructured(transcript: string, prompt: string): Promise<any> {
  try {
    // Check if API key is available before attempting analysis
    const hasKey = await hasOpenAIKey();
    if (!hasKey) {
      throw new Error("OpenAI API key not found. Please set your API key in the application settings or OPENAI_API_KEY environment variable.");
    }
    
    const openai = await getOpenAIClient();
    
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
    if (error instanceof Error && error.message === "MISSING_API_KEY") {
      throw new Error("OpenAI API key not found. Please set your API key in the application settings or OPENAI_API_KEY environment variable.");
    }
    console.error("Error analyzing transcript with structured output:", error);
    throw new Error(`Failed to analyze transcript: ${error instanceof Error ? error.message : String(error)}`);
  }
}
