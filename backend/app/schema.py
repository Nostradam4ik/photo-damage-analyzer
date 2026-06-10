from typing import List

from pydantic import BaseModel, Field


# this is the contract between the AI response and the HTTP response —
# both sides validate against the same shape
class AnalysisResult(BaseModel):
    subject: str = Field(..., description="What the main object being analyzed is")
    determination: bool = Field(..., description="True if damage or wear is present")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Model confidence 0–1")
    likely_location: str = Field(..., description="Where in the image the damage/wear is located")
    evidence: List[str] = Field(..., min_length=1, description="Observations supporting the determination")
    recommended_action: str = Field(..., description="Suggested next step")
    # service layer flips this to True when confidence < threshold; model can also set it directly
    needs_more_photos: bool = Field(default=False, description="True when images are insufficient for confident analysis")


# request_id is added by the router, the AI never sees it
class AnalysisResponse(AnalysisResult):
    request_id: str


class ErrorDetail(BaseModel):
    error: str
    detail: str
