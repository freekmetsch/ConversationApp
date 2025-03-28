import { apiRequest } from "./queryClient";

// Interface for transcription
export interface TranscriptionRequest {
  conversationId: number;
}

export interface TranscriptionResponse {
  id: number;
  conversationId: number;
  text: string;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
}

// Interface for analysis
export interface AnalysisRequest {
  conversationId: number;
  promptIds: number[];
}

export interface AnalysisResponse {
  id: number;
  conversationId: number;
  promptId: number;
  result: string;
  createdAt: string;
}

// Client-side API calls
export async function transcribeConversation(conversationId: number): Promise<TranscriptionResponse> {
  const response = await apiRequest(
    "POST",
    `/api/conversations/${conversationId}/transcribe`,
    {}
  );
  return await response.json();
}

export async function updateTranscription(id: number, text: string): Promise<TranscriptionResponse> {
  const response = await apiRequest(
    "PUT",
    `/api/transcriptions/${id}`,
    { text }
  );
  return await response.json();
}

export async function analyzeConversation(conversationId: number, promptIds: number[]): Promise<AnalysisResponse[]> {
  const response = await apiRequest(
    "POST",
    `/api/conversations/${conversationId}/analyze`,
    { promptIds }
  );
  return await response.json();
}
