export interface AnalysisResult {
  subject: string;
  determination: boolean;
  confidence: number;
  likely_location: string;
  evidence: string[];
  recommended_action: string;
  needs_more_photos: boolean;
}

export interface AnalysisResponse extends AnalysisResult {
  request_id: string;
}

export interface ApiError {
  error: string;
  detail: string;
}

export type AnalyzeErrorKind = "network" | "server" | "validation";

export interface AnalyzeError {
  kind: AnalyzeErrorKind;
  message: string;
  detail: string;
}
