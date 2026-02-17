export type Importance = "High" | "Medium" | "Low";
export type Sentiment = "Positive" | "Negative" | "Neutral";

export interface Disclosure {
  id: string;
  timestamp: string; // HH:mm
  ticker: string;
  companyName: string;
  title: string;
  summary: string; // AI summary
  importance: Importance;
  sentiment: Sentiment;
  tags: string[]; // e.g., "MBO", "Revision", "Dividend"
  pdfUrl: string;
  isRead: boolean;
}
