from fastapi import FastAPI, Request, HTTPException, BackgroundTasks
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import markdown
import markdown.extensions.fenced_code
import re
import json
import subprocess
from annotations import router as annotations_router  # Import the annotations router

app = FastAPI()
templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")

PROCESSED_PAPERS_DIR = Path("processed_papers")

# Include the annotations router
app.include_router(annotations_router)

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    papers = [paper.name for paper in PROCESSED_PAPERS_DIR.iterdir() if paper.is_dir()]
    return templates.TemplateResponse("home.html", {"request": request, "papers": papers})

def process_pdf_to_markdown(file_path: str):
    # Run the extract_markdown.sh script
    subprocess.run(["bash", "extract_markdown.sh"], check=True)

@app.post("/upload_paper")
async def upload_paper(request: Request, background_tasks: BackgroundTasks):
    form = await request.form()
    file = form['file']
    
    # Save the uploaded file
    file_location = f"./papers/{file.filename}"
    with open(file_location, "wb") as f:
        f.write(await file.read())
    
    # Add the processing task to the background
    background_tasks.add_task(process_pdf_to_markdown, file_location)
    
    return JSONResponse(content={"status": "success", "filename": file.filename})

@app.get("/paper/{paper_name}", response_class=HTMLResponse)
async def view_paper(request: Request, paper_name: str):
    paper_dir = PROCESSED_PAPERS_DIR / paper_name
    markdown_files = list(paper_dir.glob("*.md"))
    
    if not markdown_files:
        return HTMLResponse("No markdown file found for this paper.")
    
    markdown_content = markdown_files[0].read_text()
    
    # Convert markdown to HTML
    html_content = markdown.markdown(markdown_content, extensions=['fenced_code', 'tables'])
    
    # Replace image paths in the HTML content
    def replace_image_path(match):
        image_path = match.group(1)
        return f'src="/{paper_name}/image/{image_path}"'

    html_content = re.sub(r'src="(.*?\.(?:png|jpg|jpeg|gif))"', replace_image_path, html_content)
    
    return templates.TemplateResponse("paper.html", {
        "request": request,
        "paper_name": paper_name,
        "content": html_content
    })

@app.get("/{paper_name}/image/{image_path:path}")
async def serve_image(paper_name: str, image_path: str):
    image_file = PROCESSED_PAPERS_DIR / paper_name / image_path
    if image_file.exists():
        return FileResponse(image_file)
    return HTMLResponse("Image not found", status_code=404)