# Web Novel Chapter Tracker - Requirements

## Overview
A web application to automatically track new chapters from web novel sites and provide daily AI-generated summaries.

## Core Features

### 1. Book Registration
- Users provide URL to book's home/table of contents page
- System extracts book title automatically
- Tracks last known chapter number for each book

### 2. Chapter Detection
- Scans book home pages for new chapter links
- Compares against last known chapter to detect new content
- Handles sequential chapter numbering patterns

### 3. Content Extraction
- Follows chapter links to fetch full chapter content
- Extracts text from chapter pages
- Supports Chinese text content

### 4. AI Summarization
- Daily summaries of all new chapters across tracked books
- Uses AI to generate concise summaries
- Supports Chinese language summarization

### 5. Dashboard Interface
- View all tracked books
- See recent chapter updates
- Display daily summaries
- Add/remove books from tracking

## Technical Implementation

### Frontend
- HTML/CSS/JavaScript dashboard
- Responsive design for desktop/mobile
- Real-time updates of chapter status

### Backend
- Node.js with Express framework
- Web scraping for chapter detection
- Content extraction from chapter pages
- JSON file storage for book data and history

### AI Integration
- OpenAI API for text summarization
- Chinese language support
- Daily batch processing of new chapters

### Storage
- JSON files for book registry
- Chapter history and metadata
- User preferences and settings

## Example Site Structure
- Site: https://www.piaotia.com/html/13/13191/
- Book: "武神之王" (Martial God King)
- Chapter pattern: Sequential numbering with HTML links
- Detection method: Compare highest chapter number

## User Workflow
1. Register book by providing home page URL
2. System automatically detects book title and current chapters
3. Daily automated checking for new chapters
4. New chapters are fetched and summarized
5. User reviews daily summary report