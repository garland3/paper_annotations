# Paper Processing and Viewing Application

# goals

Make it so you can upload papers and thenn view them and annotate them. . 

## usage. 

```
sh run_server.sh
```


This repository contains scripts to process PDF papers using the `marker` tool, extract markdown content, and a FastAPI application to view the processed papers.

## Setup

1. Ensure you have Conda installed on your system.
2. Activate the `rom_summary` Conda environment:
   ```
   conda activate rom_summary
   ```
3. Install the required dependencies:
   ```
   pip install -r requirements.txt
   ```

## Usage

1. Process the papers:
   ```
   ./extract_markdown.sh
   ```
2. Run the FastAPI application:
   ```
   uvicorn main:app --reload
   ```
3. Open a web browser and navigate to `http://localhost:8000` to view the processed papers.

## Scripts and Files

### extract_markdown.sh

This script processes PDF papers using the `marker` tool and saves the output in the `processed_papers` directory.

### main.py

The FastAPI application that serves the processed papers. It provides a home page listing all papers and individual pages for viewing each paper's content.

### templates/

Contains HTML templates for the FastAPI application:
- `home.html`: The home page template listing all papers.
- `paper.html`: The template for displaying individual paper content.

### requirements.txt

Lists the Python dependencies required for the FastAPI application.

## Note

Make sure to activate the `rom_summary` Conda environment before running the scripts or the FastAPI application to ensure all necessary dependencies are available.

