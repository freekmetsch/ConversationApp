import { 
  students, Student, InsertStudent,
  conversationTypes, ConversationType, InsertConversationType,
  conversations, Conversation, InsertConversation,
  transcriptions, Transcription, InsertTranscription,
  prompts, Prompt, InsertPrompt,
  analyses, Analysis, InsertAnalysis,
  userPreferences, UserPreference, InsertUserPreference,
  ConversationWithDetails
} from "@shared/schema";

export interface IStorage {
  // Student Operations
  getStudents(): Promise<Student[]>;
  getStudent(id: number): Promise<Student | undefined>;
  getStudentByName(name: string): Promise<Student | undefined>;
  createStudent(student: InsertStudent): Promise<Student>;
  
  // Conversation Type Operations
  getConversationTypes(): Promise<ConversationType[]>;
  getConversationType(id: number): Promise<ConversationType | undefined>;
  createConversationType(type: InsertConversationType): Promise<ConversationType>;
  updateConversationType(id: number, type: Partial<InsertConversationType>): Promise<ConversationType | undefined>;
  deleteConversationType(id: number): Promise<boolean>;
  
  // Conversation Operations
  getConversations(): Promise<ConversationWithDetails[]>;
  getConversation(id: number): Promise<ConversationWithDetails | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: number, conversation: Partial<InsertConversation>): Promise<Conversation | undefined>;
  deleteConversation(id: number): Promise<boolean>;
  
  // Transcription Operations
  getTranscription(conversationId: number): Promise<Transcription | undefined>;
  createTranscription(transcription: InsertTranscription): Promise<Transcription>;
  updateTranscription(id: number, text: string): Promise<Transcription | undefined>;
  
  // Prompt Operations
  getPrompts(): Promise<Prompt[]>;
  getPrompt(id: number): Promise<Prompt | undefined>;
  createPrompt(prompt: InsertPrompt): Promise<Prompt>;
  updatePrompt(id: number, prompt: Partial<InsertPrompt>): Promise<Prompt | undefined>;
  deletePrompt(id: number): Promise<boolean>;
  
  // Analysis Operations
  getAnalyses(conversationId: number): Promise<Analysis[]>;
  getAnalysis(id: number): Promise<Analysis | undefined>;
  createAnalysis(analysis: InsertAnalysis): Promise<Analysis>;
  deleteAnalysis(id: number): Promise<boolean>;
  
  // User Preferences Operations
  getUserPreferences(): Promise<UserPreference | undefined>;
  updateUserPreferences(prefs: Partial<InsertUserPreference>): Promise<UserPreference | undefined>;
}

export class MemStorage implements IStorage {
  private students: Map<number, Student>;
  private conversationTypes: Map<number, ConversationType>;
  private conversations: Map<number, Conversation>;
  private transcriptions: Map<number, Transcription>;
  private prompts: Map<number, Prompt>;
  private analyses: Map<number, Analysis>;
  private userPreferences: UserPreference | undefined;
  
  private studentId: number;
  private typeId: number;
  private conversationId: number;
  private transcriptionId: number;
  private promptId: number;
  private analysisId: number;
  private prefId: number;

  constructor() {
    this.students = new Map();
    this.conversationTypes = new Map();
    this.conversations = new Map();
    this.transcriptions = new Map();
    this.prompts = new Map();
    this.analyses = new Map();
    
    this.studentId = 1;
    this.typeId = 1;
    this.conversationId = 1;
    this.transcriptionId = 1;
    this.promptId = 1;
    this.analysisId = 1;
    this.prefId = 1;
    
    // No default conversation types as per user request
    
    // Initialize with default user preferences
    this.userPreferences = {
      id: this.prefId++,
      audioStoragePath: "./audio_files",
      apiKeys: { 
        openai: process.env.OPENAI_API_KEY || ""
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  // Student Operations
  async getStudents(): Promise<Student[]> {
    return Array.from(this.students.values());
  }

  async getStudent(id: number): Promise<Student | undefined> {
    return this.students.get(id);
  }

  async getStudentByName(name: string): Promise<Student | undefined> {
    return Array.from(this.students.values()).find(
      (student) => student.name.toLowerCase() === name.toLowerCase()
    );
  }

  async createStudent(student: InsertStudent): Promise<Student> {
    const id = this.studentId++;
    const newStudent = { 
      ...student, 
      id, 
      createdAt: new Date() 
    };
    this.students.set(id, newStudent);
    return newStudent;
  }

  // Conversation Type Operations
  async getConversationTypes(): Promise<ConversationType[]> {
    return Array.from(this.conversationTypes.values());
  }

  async getConversationType(id: number): Promise<ConversationType | undefined> {
    return this.conversationTypes.get(id);
  }

  async createConversationType(type: InsertConversationType): Promise<ConversationType> {
    const id = this.typeId++;
    const newType = { 
      ...type, 
      id, 
      createdAt: new Date() 
    };
    this.conversationTypes.set(id, newType);
    return newType;
  }

  async updateConversationType(id: number, type: Partial<InsertConversationType>): Promise<ConversationType | undefined> {
    const existing = this.conversationTypes.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...type };
    this.conversationTypes.set(id, updated);
    return updated;
  }

  async deleteConversationType(id: number): Promise<boolean> {
    return this.conversationTypes.delete(id);
  }

  // Conversation Operations
  async getConversations(): Promise<ConversationWithDetails[]> {
    const result: ConversationWithDetails[] = [];
    
    for (const conversation of this.conversations.values()) {
      const conversationWithDetails: ConversationWithDetails = { ...conversation };
      
      if (conversation.studentId) {
        conversationWithDetails.student = this.students.get(conversation.studentId);
      }
      
      if (conversation.typeId) {
        conversationWithDetails.type = this.conversationTypes.get(conversation.typeId);
      }
      
      // Find transcription
      conversationWithDetails.transcription = Array.from(this.transcriptions.values()).find(
        t => t.conversationId === conversation.id
      );
      
      // Find analyses
      conversationWithDetails.analyses = Array.from(this.analyses.values()).filter(
        a => a.conversationId === conversation.id
      );
      
      result.push(conversationWithDetails);
    }
    
    return result;
  }

  async getConversation(id: number): Promise<ConversationWithDetails | undefined> {
    const conversation = this.conversations.get(id);
    if (!conversation) return undefined;
    
    const result: ConversationWithDetails = { ...conversation };
    
    if (conversation.studentId) {
      result.student = this.students.get(conversation.studentId);
    }
    
    if (conversation.typeId) {
      result.type = this.conversationTypes.get(conversation.typeId);
    }
    
    // Find transcription
    result.transcription = Array.from(this.transcriptions.values()).find(
      t => t.conversationId === conversation.id
    );
    
    // Find analyses
    result.analyses = Array.from(this.analyses.values()).filter(
      a => a.conversationId === conversation.id
    );
    
    return result;
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const id = this.conversationId++;
    const newConversation = { 
      ...conversation, 
      id, 
      createdAt: new Date() 
    };
    this.conversations.set(id, newConversation);
    return newConversation;
  }

  async updateConversation(id: number, conversation: Partial<InsertConversation>): Promise<Conversation | undefined> {
    const existing = this.conversations.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...conversation };
    this.conversations.set(id, updated);
    return updated;
  }

  async deleteConversation(id: number): Promise<boolean> {
    // Also delete associated transcriptions and analyses
    for (const [tId, transcription] of this.transcriptions.entries()) {
      if (transcription.conversationId === id) {
        this.transcriptions.delete(tId);
      }
    }
    
    for (const [aId, analysis] of this.analyses.entries()) {
      if (analysis.conversationId === id) {
        this.analyses.delete(aId);
      }
    }
    
    return this.conversations.delete(id);
  }

  // Transcription Operations
  async getTranscription(conversationId: number): Promise<Transcription | undefined> {
    return Array.from(this.transcriptions.values()).find(
      t => t.conversationId === conversationId
    );
  }

  async createTranscription(transcription: InsertTranscription): Promise<Transcription> {
    const id = this.transcriptionId++;
    const now = new Date();
    const newTranscription = { 
      ...transcription, 
      id, 
      isEdited: false,
      createdAt: now,
      updatedAt: now
    };
    this.transcriptions.set(id, newTranscription);
    return newTranscription;
  }

  async updateTranscription(id: number, text: string): Promise<Transcription | undefined> {
    const existing = this.transcriptions.get(id);
    if (!existing) return undefined;
    
    const updated = { 
      ...existing, 
      text, 
      isEdited: true,
      updatedAt: new Date() 
    };
    this.transcriptions.set(id, updated);
    return updated;
  }

  // Prompt Operations
  async getPrompts(): Promise<Prompt[]> {
    return Array.from(this.prompts.values());
  }

  async getPrompt(id: number): Promise<Prompt | undefined> {
    return this.prompts.get(id);
  }

  async createPrompt(prompt: InsertPrompt): Promise<Prompt> {
    const id = this.promptId++;
    const now = new Date();
    const newPrompt = { 
      ...prompt, 
      id, 
      createdAt: now,
      updatedAt: now 
    };
    this.prompts.set(id, newPrompt);
    return newPrompt;
  }

  async updatePrompt(id: number, prompt: Partial<InsertPrompt>): Promise<Prompt | undefined> {
    const existing = this.prompts.get(id);
    if (!existing) return undefined;
    
    const updated = { 
      ...existing, 
      ...prompt, 
      updatedAt: new Date() 
    };
    this.prompts.set(id, updated);
    return updated;
  }

  async deletePrompt(id: number): Promise<boolean> {
    return this.prompts.delete(id);
  }

  // Analysis Operations
  async getAnalyses(conversationId: number): Promise<Analysis[]> {
    return Array.from(this.analyses.values()).filter(
      a => a.conversationId === conversationId
    );
  }

  async getAnalysis(id: number): Promise<Analysis | undefined> {
    return this.analyses.get(id);
  }

  async createAnalysis(analysis: InsertAnalysis): Promise<Analysis> {
    const id = this.analysisId++;
    const newAnalysis = { 
      ...analysis, 
      id, 
      createdAt: new Date() 
    };
    this.analyses.set(id, newAnalysis);
    return newAnalysis;
  }

  async deleteAnalysis(id: number): Promise<boolean> {
    return this.analyses.delete(id);
  }

  // User Preferences Operations
  async getUserPreferences(): Promise<UserPreference | undefined> {
    return this.userPreferences;
  }

  async updateUserPreferences(prefs: Partial<InsertUserPreference>): Promise<UserPreference | undefined> {
    if (!this.userPreferences) return undefined;
    
    this.userPreferences = { 
      ...this.userPreferences, 
      ...prefs, 
      updatedAt: new Date()
    };
    
    return this.userPreferences;
  }
}

export const storage = new MemStorage();
