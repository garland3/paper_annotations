from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pathlib import Path
import json

router = APIRouter()
PROCESSED_PAPERS_DIR = Path("processed_papers")

@router.get("/annotations/{paper_name}")
async def get_annotations(paper_name: str):
    annotation_file = PROCESSED_PAPERS_DIR / paper_name / "annotations.json"
    if annotation_file.exists():
        return JSONResponse(content=json.loads(annotation_file.read_text()))
    return JSONResponse(content=[])

@router.post("/annotations/{paper_name}")
async def save_annotations(paper_name: str, annotations: list):
    annotation_file = PROCESSED_PAPERS_DIR / paper_name / "annotations.json"
    annotation_file.write_text(json.dumps(annotations))
    return JSONResponse(content={"status": "success"})