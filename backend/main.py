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

def scrape_tdnet():
    # Placeholder for actual scraping logic
    # Returning empty list to force fallback to mock data for now
    # to avoid errors on first run without internet access verification
    return []

@app.get("/api/disclosures", response_model=List[Disclosure])
def get_disclosures():
    # Try scraping
    real_data = scrape_tdnet()
    
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
