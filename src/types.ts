export interface Chapter {
  number: number;
  title: string;
  url: string;
  content?: string;
}

export interface Book {
  id: string;
  url: string;
  title: string;
  lastChapter: number;
  totalChapters: number;
  dateAdded: string;
  lastUpdated: string;
  lastChecked: string;
  chapters?: Chapter[];
}

export interface Summary {
  id: string;
  bookId: string;
  bookTitle: string;
  chapters: Chapter[];
  summary: string;
  date: string;
  imageUrl?: string;
}

export interface HistoryEntry {
  id: string;
  bookId: string;
  chapterNumber: number;
  chapterTitle: string;
  chapterUrl: string;
  action: 'detected' | 'processed' | 'summarized';
  date: string;
}

export interface BookInfo {
  title: string;
  url: string;
  chapters: Chapter[];
  lastChapter: number;
  totalChapters: number;
}

export interface ChapterCheckResult {
  hasNewChapters: boolean;
  newChapters: Chapter[];
  totalChapters: number;
  lastChapter: number;
  error?: string;
}

export interface ChapterSummary {
  chapterNumber: number;
  chapterTitle: string;
  summary: string;
  imageUrl?: string;
}

export interface BookUpdateResult {
  bookId: string;
  bookTitle: string;
  hasNewChapters: boolean;
  newChaptersCount: number;
  newChapters: Chapter[];
  error?: string;
}

export interface SummaryData {
  bookId: string;
  bookTitle: string;
  chapters: Chapter[];
  summary: string;
  imageUrl?: string | null;
}

export interface CleanupResult {
  summariesRemoved: number;
  historyRemoved: number;
}

export type Language = 'chinese' | 'english';

export interface AddBookRequest {
  url: string;
}

export interface AddBookResponse extends Book {
  initialSummaries?: ChapterSummary[];
  summaryError?: string;
}

export interface ErrorResponse {
  message: string;
}

export interface ImageGenerationOptions {
  prompt: string;
  size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
}

export interface GeneratedImage {
  url: string;
  localPath?: string;
}