import os
import json
import logging
import io
from typing import Dict, Any, Optional
from openai import OpenAI
from pypdf import PdfReader
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AIAgent:
    def __init__(self):
        # LM Studio local server default
        self.client = OpenAI(base_url="http://localhost:1234/v1", api_key="lm-studio")
        self.model_name = "model-identifier" # LM Studio uses the loaded model regardless of this name usually

    def extract_text_from_pdf(self, pdf_bytes: bytes) -> str:
        """Extracts text from PDF bytes."""
        try:
            reader = PdfReader(io.BytesIO(pdf_bytes))
            text = ""
            for page in reader.pages:
                text += page.extract_text()
            return text
        except Exception as e:
            logger.error(f"Error extracting text from PDF: {e}")
            return ""

    def analyze_disclosure(self, text: str) -> Dict[str, Any]:
        """Analyzes disclosure text using Local LLM and returns structured data."""
        if not text:
             return {
                "summary": "No text extracted from PDF.",
                "sentiment": "neutral",
                "importance": "low",
                "aiStatus": "error",
                "tags": []
            }

        prompt = f"""
        You are a financial analyst. Analyze the following Japanese financial disclosure text.
        Extract the following information and output ONLY valid JSON.

        1. summary: A concise summary of the key points (max 100 characters, in Japanese).
        2. sentiment: "positive", "neutral", or "negative" based on the financial results or news.
        3. importance: "high", "medium", or "low".
           - "high": Earnings revisions (up/down), Dividend changes (hike/cut), Share buybacks, M&A, Stock splits, or significant strategic alliances.
           - "medium": Quarterly earnings reports (without major surprises), Management changes, New product announcements.
           - "low": Routine notices, minor corrections, or administrative announcements.
        4. tags: A list of relevant tags (e.g., "Earnings", "Revision", "Dividend", "M&A", "Buyback"). Max 3 tags.

        Text:
        {text[:10000]} 

        Output JSON format:
        {{
          "summary": "...",
          "sentiment": "...",
          "importance": "...",
          "tags": ["..."]
        }}
        """
        # Note: Truncated text to 10000 chars for local LLM performance

        try:
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": "You are a helpful financial analyst assistant that outputs only JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                stream=False
            )
            
            response_text = response.choices[0].message.content.strip()
            
            # Clean up code blocks if present
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            
            data = json.loads(response_text)
            data["aiStatus"] = "done"
            return data

        except Exception as e:
            logger.error(f"Error analyzing with Local LLM: {e}")
            return {
                "summary": "Analysis failed.",
                "sentiment": "neutral",
                "importance": "low",
                "aiStatus": "error",
                "tags": []
            }
