from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import requests
from bs4 import BeautifulSoup
import datetime
import random
import re
import json
import os
import time
from ai_agent import AIAgent  # Import AI Agent

app = FastAPI(title="AlphaTerminal Backend")

# Initialize AI Agent
ai_agent = AIAgent()

# CORS setup
origins = [
    "http://localhost:3000",
    "http://localhost:3001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data Models
class Disclosure(BaseModel):
    id: str
    time: str
    code: str
    companyName: str
    title: str
    url: str
    aiStatus: str # "pending", "done", "error"
    importance: str # "high", "medium", "low"
    sentiment: str # "positive", "neutral", "negative"
    summary: str
    tags: List[str]

# Mock Data
# Persistence Setup
DATA_FILE = "disclosures.json"

def load_data():
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading data: {e}")
    return []

def save_data(data):
    try:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving data: {e}")

# In-memory store (initialized from file)
DISCLOSURE_STORE = load_data()

def process_analysis_queue():
    """Background task to process pending analyses sequentially."""
    global DISCLOSURE_STORE
    
    print("Starting background analysis...")
    
    # Simple queue processing: iterate and find pending items
    # In a real app, use a proper queue (Celery/Redis), but loop is fine here for local
    
    updated = False
    for item in DISCLOSURE_STORE:
        if item.get("aiStatus") == "pending" and item.get("url") != "#":
            print(f"Analyzing {item['code']} {item['companyName']}...")
            try:
                # Add delay to be nice to local machine if needed, but user said "go fast"
                # time.sleep(1) 
                
                pdf_response = requests.get(item["url"], headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
                if pdf_response.status_code == 200:
                    pdf_text = ai_agent.extract_text_from_pdf(pdf_response.content)
                    if pdf_text:
                        ai_result = ai_agent.analyze_disclosure(pdf_text)
                        
                        # Update item
                        item.update(ai_result)
                        item["aiStatus"] = ai_result.get("aiStatus", "done")
                        updated = True
                        
                        # Save progress immediately so we don't lose it on crash
                        save_data(DISCLOSURE_STORE)
                        
            except Exception as e:
                print(f"Error analyzing {item['code']}: {e}")
                item["aiStatus"] = "error"
                item["summary"] = "Analysis failed."
                save_data(DISCLOSURE_STORE)
    
    if updated:
        print("Batch analysis complete.")

def scrape_tdnet(date_str):
    global DISCLOSURE_STORE
    
    url = f"https://www.release.tdnet.info/inbs/I_list_001_{date_str}.html"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }

    print(f"Fetching TDnet: {url}")

    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.encoding = response.apparent_encoding 
        
        if response.status_code != 200:
            return []

        soup = BeautifulSoup(response.text, 'html.parser')
        rows = soup.find_all('tr') 
        
        new_items = []
        
        # Check existing IDs to avoid duplicates
        existing_ids = {item["id"].split("-")[0] + "-" + item["code"] + "-" + item["time"] for item in DISCLOSURE_STORE}

        for row in rows:
            cols = row.find_all('td')
            if len(cols) >= 4:
                try:
                    time_str = cols[0].get_text(strip=True)
                    code = cols[1].get_text(strip=True)
                    company_name = cols[2].get_text(strip=True)
                    title_element = cols[3].find('a')
                    
                    pdf_link = "#"
                    if not title_element:
                        title = cols[3].get_text(strip=True)
                    else:
                        title = title_element.get_text(strip=True)
                        href = title_element.get('href')
                        if href and not href.startswith('http'):
                             pdf_link = f"https://www.release.tdnet.info/inbs/{href}"
                        else:
                             pdf_link = href if href else "#"

                    if not re.match(r"\d{2}:\d{2}", time_str):
                        continue
                     
                    # Simple unique check key
                    unique_key = f"{date_str}-{code}-{time_str}"
                    
                    if unique_key in existing_ids:
                        continue

                    doc_id = f"{unique_key}-{random.randint(1000,9999)}"

                    new_item = {
                        "id": doc_id,
                        "time": time_str,
                        "code": code,
                        "companyName": company_name,
                        "title": title,
                        "url": pdf_link,
                        "aiStatus": "pending", # Default to pending
                        "importance": "low",
                        "sentiment": "neutral",
                        "summary": "Pending analysis...",
                        "tags": []
                    }
                    
                    new_items.append(new_item)
                    existing_ids.add(unique_key)
                    
                except Exception as row_err:
                    print(f"Error parsing row: {row_err}")
                    continue
        
        if new_items:
            print(f"Found {len(new_items)} new items.")
            # Prepend new items to store
            DISCLOSURE_STORE = new_items + DISCLOSURE_STORE
            save_data(DISCLOSURE_STORE)
            return True # Indicates new data found
            
        return False

    except Exception as e:
        print(f"Error scraping TDnet: {e}")
        return False

@app.get("/api/disclosures", response_model=List[Disclosure])
def get_disclosures(background_tasks: BackgroundTasks):
    global DISCLOSURE_STORE
    
    today = datetime.datetime.now().strftime("%Y%m%d")
    
    # Trigger scrape (lightweight)
    has_new_data = scrape_tdnet(today)
    
    # If store is empty, try yesterday
    if not DISCLOSURE_STORE:
         yesterday = (datetime.datetime.now() - datetime.timedelta(days=1)).strftime("%Y%m%d")
         has_new_data = scrape_tdnet(yesterday) or has_new_data
    
    # Trigger background analysis if new data found OR if there are pending items
    pending_count = sum(1 for item in DISCLOSURE_STORE if item.get("aiStatus") == "pending")
    if has_new_data or pending_count > 0:
        background_tasks.add_task(process_analysis_queue)
    
    return DISCLOSURE_STORE

@app.get("/")
def read_root():
    return {"message": "AlphaTerminal Backend is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
