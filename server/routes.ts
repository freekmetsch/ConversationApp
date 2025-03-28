import { Router, type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { fileStorage } from "./lib/fileStorage";
import * as openai from "./lib/openai";
import { insertStudentSchema, insertConversationTypeSchema, insertConversationSchema, insertPromptSchema } from "@shared/schema";
import { randomUUID } from "crypto";
import path from "path";
import { z } from "zod";

// Setup multer for handling file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

export async function registerRoutes(app: Express): Promise<Server> {
  const apiRouter = Router();
  
  // Student Routes
  apiRouter.get("/students", async (req, res) => {
    try {
      // Check if we're searching by name
      if (req.query.name) {
        const name = req.query.name as string;
        const student = await storage.getStudentByName(name);
        // If student with this name exists, return it in an array
        if (student) {
          return res.json([student]);
        }
        // Otherwise, return an empty array
        return res.json([]);
      }
      
      // Otherwise, return all students
      const students = await storage.getStudents();
      res.json(students);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch students" });
    }
  });
  
  apiRouter.post("/students", async (req, res) => {
    try {
      const parseResult = insertStudentSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid student data", details: parseResult.error });
      }
      
      const student = await storage.createStudent(parseResult.data);
      res.status(201).json(student);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create student" });
    }
  });
  
  // Conversation Type Routes
  apiRouter.get("/conversation-types", async (req, res) => {
    try {
      const types = await storage.getConversationTypes();
      res.json(types);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch conversation types" });
    }
  });
  
  apiRouter.post("/conversation-types", async (req, res) => {
    try {
      const parseResult = insertConversationTypeSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid conversation type data", details: parseResult.error });
      }
      
      const type = await storage.createConversationType(parseResult.data);
      res.status(201).json(type);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create conversation type" });
    }
  });
  
  apiRouter.put("/conversation-types/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const parseResult = insertConversationTypeSchema.partial().safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid conversation type data", details: parseResult.error });
      }
      
      const updated = await storage.updateConversationType(id, parseResult.data);
      if (!updated) {
        return res.status(404).json({ error: "Conversation type not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update conversation type" });
    }
  });
  
  apiRouter.delete("/conversation-types/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteConversationType(id);
      if (!success) {
        return res.status(404).json({ error: "Conversation type not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete conversation type" });
    }
  });
  
  // Conversation Routes
  apiRouter.get("/conversations", async (req, res) => {
    try {
      const conversations = await storage.getConversations();
      res.json(conversations);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });
  
  apiRouter.get("/conversations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      res.json(conversation);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });
  
  apiRouter.post("/conversations", upload.single("audio"), async (req, res) => {
    try {
      // Handle audio file
      if (!req.file) {
        return res.status(400).json({ error: "Audio file is required" });
      }
      
      // Generate a unique filename
      const fileName = `${Date.now()}-${randomUUID()}${path.extname(req.file.originalname) || '.wav'}`;
      
      // Save the audio file
      const audioPath = await fileStorage.saveAudioFile(req.file.buffer, fileName);
      
      // Parse the rest of the form data
      const parseResult = insertConversationSchema.omit({ audioPath: true }).safeParse({
        ...req.body,
        studentId: req.body.studentId ? parseInt(req.body.studentId) : undefined,
        typeId: req.body.typeId ? parseInt(req.body.typeId) : undefined,
        date: req.body.date ? new Date(req.body.date) : new Date(),
        metadata: req.body.metadata ? JSON.parse(req.body.metadata) : undefined
      });
      
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid conversation data", details: parseResult.error });
      }
      
      // Create the conversation
      const conversation = await storage.createConversation({
        ...parseResult.data,
        audioPath: fileName
      });
      
      res.status(201).json(conversation);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });
  
  apiRouter.delete("/conversations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get conversation to get the audio file path
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      // Delete the audio file
      try {
        await fileStorage.deleteAudioFile(conversation.audioPath);
      } catch (fileError) {
        console.error("Error deleting audio file:", fileError);
        // Continue with deletion even if file deletion fails
      }
      
      // Delete the conversation and related data from storage
      const success = await storage.deleteConversation(id);
      if (!success) {
        return res.status(404).json({ error: "Failed to delete conversation" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });
  
  // Transcription Routes
  apiRouter.get("/conversations/:id/transcription", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const transcription = await storage.getTranscription(conversationId);
      if (!transcription) {
        return res.status(404).json({ error: "Transcription not found" });
      }
      
      res.json(transcription);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch transcription" });
    }
  });
  
  apiRouter.post("/conversations/:id/transcribe", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      
      // Get the conversation to get the audio file
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      try {
        // Read the audio file
        const audioBuffer = await fileStorage.getAudioFile(conversation.audioPath);
        
        if (!audioBuffer || audioBuffer.length === 0) {
          return res.status(400).json({ error: "Audio file is empty or corrupted" });
        }
        
        console.log(`Processing audio file of size ${audioBuffer.length} bytes from path ${conversation.audioPath}`);
        
        // Transcribe the audio
        const text = await openai.transcribeAudio(audioBuffer);
        
        if (!text) {
          return res.status(500).json({ error: "OpenAI transcription returned empty text" });
        }
        
        console.log(`Successfully transcribed audio, received ${text.length} characters of text`);
        
        // Check if a transcription already exists
        let transcription = await storage.getTranscription(conversationId);
        
        if (transcription) {
          // Update existing transcription
          transcription = await storage.updateTranscription(transcription.id, text);
        } else {
          // Create a new transcription
          transcription = await storage.createTranscription({
            conversationId,
            text
          });
        }
        
        res.json(transcription);
      } catch (fileError) {
        console.error("File processing error:", fileError);
        res.status(500).json({ 
          error: "Failed to process audio file", 
          details: fileError instanceof Error ? fileError.message : String(fileError) 
        });
      }
    } catch (error) {
      console.error("Transcription error:", error);
      res.status(500).json({ 
        error: "Failed to transcribe conversation", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  apiRouter.put("/transcriptions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { text } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: "Text is required" });
      }
      
      const updated = await storage.updateTranscription(id, text);
      if (!updated) {
        return res.status(404).json({ error: "Transcription not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update transcription" });
    }
  });
  
  // Prompt Routes
  apiRouter.get("/prompts", async (req, res) => {
    try {
      const prompts = await storage.getPrompts();
      res.json(prompts);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch prompts" });
    }
  });
  
  apiRouter.post("/prompts", async (req, res) => {
    try {
      const parseResult = insertPromptSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid prompt data", details: parseResult.error });
      }
      
      const prompt = await storage.createPrompt(parseResult.data);
      res.status(201).json(prompt);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create prompt" });
    }
  });
  
  apiRouter.put("/prompts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const parseResult = insertPromptSchema.partial().safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid prompt data", details: parseResult.error });
      }
      
      const updated = await storage.updatePrompt(id, parseResult.data);
      if (!updated) {
        return res.status(404).json({ error: "Prompt not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update prompt" });
    }
  });
  
  apiRouter.delete("/prompts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deletePrompt(id);
      if (!success) {
        return res.status(404).json({ error: "Prompt not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete prompt" });
    }
  });
  
  // Analysis Routes
  apiRouter.get("/conversations/:id/analyses", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const analyses = await storage.getAnalyses(conversationId);
      res.json(analyses);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch analyses" });
    }
  });
  
  apiRouter.post("/conversations/:id/analyze", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { promptIds } = req.body;
      
      if (!promptIds || !Array.isArray(promptIds) || promptIds.length === 0) {
        return res.status(400).json({ error: "At least one prompt ID is required" });
      }
      
      // Get the conversation and transcription
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      const transcription = await storage.getTranscription(conversationId);
      if (!transcription) {
        return res.status(404).json({ error: "Transcription not found" });
      }
      
      if (!transcription.text || transcription.text.trim().length === 0) {
        return res.status(400).json({ error: "Transcription text is empty" });
      }
      
      console.log(`Analyzing transcription for conversation ${conversationId} with ${promptIds.length} prompts`);
      
      // Process each prompt and create analyses
      const analyses = [];
      for (const promptId of promptIds) {
        try {
          const prompt = await storage.getPrompt(parseInt(promptId));
          if (!prompt) {
            return res.status(404).json({ error: `Prompt with ID ${promptId} not found` });
          }
          
          console.log(`Processing prompt ${prompt.id}: "${prompt.name}"`);
          
          // Analyze the transcript
          const result = await openai.analyzeTranscript(transcription.text, prompt.text);
          
          if (!result) {
            console.warn(`Empty analysis result for prompt ${prompt.id}`);
          }
          
          // Create the analysis
          const analysis = await storage.createAnalysis({
            conversationId,
            promptId: prompt.id,
            result: result || "No analysis was generated."
          });
          
          analyses.push(analysis);
          console.log(`Successfully created analysis ${analysis.id} for prompt ${prompt.id}`);
        } catch (promptError) {
          console.error(`Error processing prompt ${promptId}:`, promptError);
          // Continue with other prompts even if one fails
          continue;
        }
      }
      
      if (analyses.length === 0) {
        return res.status(500).json({ error: "Failed to generate any analyses" });
      }
      
      res.status(201).json(analyses);
    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ 
        error: "Failed to analyze transcript",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  apiRouter.delete("/analyses/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteAnalysis(id);
      if (!success) {
        return res.status(404).json({ error: "Analysis not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete analysis" });
    }
  });
  
  // User Preferences Routes
  apiRouter.get("/preferences", async (req, res) => {
    try {
      const preferences = await storage.getUserPreferences();
      if (!preferences) {
        return res.status(404).json({ error: "Preferences not found" });
      }
      
      res.json(preferences);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch preferences" });
    }
  });
  
  apiRouter.put("/preferences", async (req, res) => {
    try {
      const { audioStoragePath, apiKeys } = req.body;
      
      // Update storage path in fileStorage if provided
      if (audioStoragePath) {
        await fileStorage.setBasePath(audioStoragePath);
      }
      
      const updated = await storage.updateUserPreferences({
        audioStoragePath,
        apiKeys
      });
      
      if (!updated) {
        return res.status(404).json({ error: "Preferences not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update preferences" });
    }
  });
  
  // Storage Stats Route
  apiRouter.get("/storage-stats", async (req, res) => {
    try {
      const stats = await fileStorage.getStorageStats();
      res.json(stats);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get storage stats" });
    }
  });
  
  // Serve audio files
  apiRouter.get("/audio/:filename", async (req, res) => {
    try {
      const filename = req.params.filename;
      
      if (!filename) {
        return res.status(400).json({ error: "Filename is required" });
      }
      
      try {
        // Attempt to get the audio file
        const audioBuffer = await fileStorage.getAudioFile(filename);
        
        // Set content type based on file extension
        const ext = path.extname(filename).toLowerCase();
        let contentType = 'audio/wav';
        
        if (ext === '.mp3') {
          contentType = 'audio/mpeg';
        } else if (ext === '.m4a') {
          contentType = 'audio/mp4';
        } else if (ext === '.wav') {
          contentType = 'audio/wav';
        }
        
        // Set appropriate headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Length', audioBuffer.length);
        
        // Send the file
        res.send(audioBuffer);
      } catch (fileError) {
        console.error("Error retrieving audio file:", fileError);
        res.status(404).json({ 
          error: "Audio file not found",
          details: fileError instanceof Error ? fileError.message : String(fileError)
        });
      }
    } catch (error) {
      console.error("Error serving audio:", error);
      res.status(500).json({ 
        error: "Failed to serve audio file", 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Mount the API router
  app.use("/api", apiRouter);
  
  // Create and return the HTTP server
  const httpServer = createServer(app);
  return httpServer;
}
