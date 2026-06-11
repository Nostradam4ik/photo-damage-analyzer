// mirrors schema.py — no codegen, keep these in sync by hand

export interface AnalysisResult {
  subject: string;
  determination: boolean; // true = damage found, false = all clear
  confidence: number;
  likely_location: string;
  evidence: string[];
  recommended_action: string;
  needs_more_photos: boolean;
}

// request_id is tacked on by the router — the AI never sees it
export interface AnalysisResponse extends AnalysisResult {
  request_id: string;
}

export interface ApiError {
  error: string;
  detail: string;
}

// four buckets: no connection, request timed out, backend returned an error, got a response but wrong shape
export type AnalyzeErrorKind = "network" | "timeout" | "server" | "validation";

export interface AnalyzeError {
  kind: AnalyzeErrorKind;
  message: string;
  detail: string;
}
