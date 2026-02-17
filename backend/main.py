from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import requests
from bs4 import BeautifulSoup
import datetime
import random
import re

app = FastAPI(title="AlphaTerminal Backend")

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
MOCK_DISCLOSURES = [
    {
        "id": "mock_1",
        "time": "15:30",
        "code": "7203",
        "companyName": "Toyota Motor",
        "title": "Consolidated Financial Results for FY2026 Q3 (Mock Backend Data)",
        "url": "#",
        "aiStatus": "done",
        "importance": "high",
        "sentiment": "positive",
        "summary": "Record revenue and operating profit. FY guidance upgraded.",
        "tags": ["Earnings", "Upward Revision"]
    },
    {
        "id": "mock_2",
        "time": "15:00",
        "code": "9984",
        "companyName": "SoftBank Group",
        "title": "Notice Regarding Share Buyback (Mock Backend Data)",
        "url": "#",
        "aiStatus": "done",
        "importance": "high",
        "sentiment": "positive",
        "summary": "Announced 500 billion yen share buyback program.",
        "tags": ["Buyback"]
    }
]

def scrape_tdnet(date_str):
    # TDnet URL construction
    url = f"https://www.release.tdnet.info/inbs/I_list_001_{date_str}.html"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }

    print(f"Fetching TDnet: {url}")

    try:
        response = requests.get(url, headers=headers, timeout=10)
        # Handle encoding (TDnet is usually Shift_JIS or UTF-8, requests automagic is sometimes off)
        response.encoding = response.apparent_encoding 
        
        if response.status_code != 200:
            print(f"Failed to fetch TDnet: {response.status_code}")
            return []

        soup = BeautifulSoup(response.text, 'html.parser')
        disclosures = []
        
        # Locate the main table rows. 
        # TDnet structure often has rows with specific classes or structure.
        # This selector targets rows in the main list table.
        # Adjust selector based on inspection if needed. 
        # Usually it's inside a table with id="main-list-table" or similar, or just by row structure.
        # Let's try iterating through all TRs and finding robust data.
        
        rows = soup.find_all('tr') 
        
        for row in rows:
            cols = row.find_all('td')
            # Typical row validation: Needs time, code, name, title
            if len(cols) >= 4:
                # TDnet columns are roughly: Time | Code | Name | Title | ...
                # Let's safely extract text
                try:
                    time_str = cols[0].get_text(strip=True)
                    code = cols[1].get_text(strip=True)
                    company_name = cols[2].get_text(strip=True)
                    title_element = cols[3].find('a')
                    
                    if not title_element:
                        # Sometimes title is just text
                        title = cols[3].get_text(strip=True)
                        pdf_link = "#"
                    else:
                        title = title_element.get_text(strip=True)
                        href = title_element.get('href')
                        # Construct full PDF URL
                        # href is relative like "001_20260218_xxxx.pdf"
                        # Base URL for PDFs is https://www.release.tdnet.info/inbs/
                        if href and not href.startswith('http'):
                             pdf_link = f"https://www.release.tdnet.info/inbs/{href}"
                        else:
                             pdf_link = href if href else "#"

                    # Basic format validation (Time should be HH:mm)
                    if not re.match(r"\d{2}:\d{2}", time_str):
                        continue
                        
                    # Generate a unique ID
                    doc_id = f"{date_str}-{code}-{time_str}-{random.randint(1000,9999)}"

                    # Mock AI Analysis (Pending integration)
                    # For now, randomly assign status to simulate mix
                    disclosures.append({
                        "id": doc_id,
                        "time": time_str,
                        "code": code,
                        "companyName": company_name,
                        "title": title,
                        "url": pdf_link,
                        "aiStatus": "pending", 
                        "importance": "low", # Default to low until analyzed
                        "sentiment": "neutral",
                        "summary": "Waiting for AI analysis...",
                        "tags": []
                    })
                except Exception as row_err:
                    print(f"Error parsing row: {row_err}")
                    continue
        
        print(f"Scraped {len(disclosures)} items from TDnet.")
        return disclosures

    except Exception as e:
        print(f"Error scraping TDnet: {e}")
        return []

@app.get("/api/disclosures", response_model=List[Disclosure])
def get_disclosures():
    today = datetime.datetime.now().strftime("%Y%m%d")
    real_data = scrape_tdnet(today)
    
    if not real_data:
        # If no data for today (e.g., early morning), try yesterday
        yesterday = (datetime.datetime.now() - datetime.timedelta(days=1)).strftime("%Y%m%d")
        print(f"No data for {today}, trying {yesterday}...")
        real_data = scrape_tdnet(yesterday)

    if real_data:
        return real_data
    
    # Fallback to mock data
    return MOCK_DISCLOSURES

@app.get("/")
def read_root():
    return {"message": "AlphaTerminal Backend is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
