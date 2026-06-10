import { useCallback, useState } from "react";
import { ImagePickerAsset } from "expo-image-picker";

import { API_BASE_URL } from "../constants/config";
import { AnalysisResponse, AnalyzeError } from "../types/api";

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

export type AnalyzeState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "result"; data: AnalysisResponse }
  | { phase: "needs_photos"; data: AnalysisResponse }
  | { phase: "error"; error: AnalyzeError };

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

function classifyError(err: unknown): AnalyzeError {
  // React Native throws TypeError("Network request failed"); browsers throw
  // TypeError("Failed to fetch"). Both are network-level failures from fetch().
  // Any TypeError reaching here must have come from fetch() itself — the
  // response.json() path is already caught and re-thrown as ServerError below.
  if (err instanceof TypeError) {
    return {
      kind: "network",
      message: "Cannot reach the server",
      detail:
        "Make sure the backend is running and that EXPO_PUBLIC_API_BASE_URL " +
        "points to your machine's IP address, not localhost, when using a physical device.",
    };
  }
  if (err instanceof ServerError) {
    return { kind: "server", message: err.title, detail: err.detail };
  }
  return {
    kind: "validation",
    message: "Unexpected response",
    detail: "The server returned an unrecognised format. Please try again.",
  };
}

class ServerError extends Error {
  constructor(public title: string, public detail: string) {
    super(title);
  }
}

// ---------------------------------------------------------------------------
// API call
// ---------------------------------------------------------------------------

async function postAnalyze(assets: ImagePickerAsset[]): Promise<AnalysisResponse> {
  const form = new FormData();

  for (const asset of assets) {
    const uri = asset.uri;
    const ext = uri.split(".").pop()?.toLowerCase() ?? "jpg";
    const mime =
      ext === "png" ? "image/png" :
      ext === "webp" ? "image/webp" :
      ext === "heic" ? "image/heic" :
      ext === "heif" ? "image/heif" :
      "image/jpeg";

    form.append("images", {
      uri,
      name: `photo.${ext}`,
      type: mime,
    } as unknown as Blob);
  }

  const response = await fetch(`${API_BASE_URL}/analyze`, {
    method: "POST",
    body: form,
  });

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new ServerError(
      "Invalid response",
      `Server returned a non-JSON body (HTTP ${response.status}).`,
    );
  }

  const body = json as Record<string, unknown>;

  if (!response.ok) {
    throw new ServerError(
      typeof body?.error === "string" ? body.error : "Server error",
      typeof body?.detail === "string" ? body.detail : `HTTP ${response.status}`,
    );
  }

  return body as unknown as AnalysisResponse;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAnalyze() {
  const [state, setState] = useState<AnalyzeState>({ phase: "idle" });

  const analyze = useCallback(async (assets: ImagePickerAsset[]) => {
    setState({ phase: "loading" });
    try {
      const data = await postAnalyze(assets);
      if (data.needs_more_photos) {
        setState({ phase: "needs_photos", data });
      } else {
        setState({ phase: "result", data });
      }
    } catch (err) {
      setState({ phase: "error", error: classifyError(err) });
    }
  }, []);

  const reset = useCallback(() => setState({ phase: "idle" }), []);

  return { state, analyze, reset };
}
