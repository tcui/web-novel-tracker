# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI-powered web novel tracker that automatically monitors Chinese web novels for new chapters and generates intelligent summaries with AI-generated images. The system combines web scraping, AI summarization (Anthropic Claude), and image generation (Together AI FLUX.1) into a unified tracking platform.

## Key Commands

### Development
```bash
npm run dev          # Start development server with hot reload
npm run build        # Compile TypeScript to JavaScript
npm start           # Build and start production server
```

### Server Management
- Server runs on port 3000 by default
- Use `pkill -f "node.*server"` to stop running servers
- Check server status with `curl -s http://localhost:3000`

### API Testing
```bash
# Test key endpoints
curl -X GET http://localhost:3000/api/books
curl -X GET http://localhost:3000/api/summary
curl -X POST http://localhost:3000/api/books -H "Content-Type: application/json" -d '{"url": "https://www.piaotia.com/html/13/13191/"}'
```

## Architecture Overview

### Core Service Classes (src/)
- **WebNovelScraper**: Handles web scraping from novel sites (primarily piaotia.com)
- **AISummarizer**: Integrates with Anthropic Claude for intelligent chapter summarization
- **ImageGenerator**: Together AI integration for generating chapter sketches using FLUX.1 model  
- **JSONStorage**: File-based persistence for books, summaries, and history
- **NovelScheduler**: Automated scheduling for chapter checking and daily summaries

### Data Flow
1. **Book Registration**: User provides URL → Scraper extracts book info → Storage persists
2. **Chapter Detection**: Scheduler triggers scraper → Compares current vs last known chapter
3. **Content Processing**: New chapters → Scraper fetches content → Summarizer generates summary → ImageGenerator creates sketch
4. **Summary Generation**: Daily batch processing → AI summarization → Storage with image URLs

### API Architecture
- RESTful endpoints in `src/server.ts`
- TypeScript interfaces in `src/types.ts` define data contracts
- Middleware handles logging, JSON parsing, and static file serving

## Environment Configuration

### Required Environment Variables
```bash
ANTHROPIC_API_KEY=    # Required for AI summarization
TOGETHER_API_KEY=     # Required for image generation
PORT=3000             # Server port (optional)
NODE_ENV=development  # Environment mode (optional)
```

### API Integration Details
- **Anthropic Claude**: Uses claude-3-haiku-20240307 model for fast, cost-effective summarization
- **Together AI**: Uses black-forest-labs/FLUX.1-schnell-Free model for image generation
- Both services support Chinese language processing

## Frontend Architecture

### Two-Column Layout
- **Left Column (1fr)**: Book management (Add New Book + Tracked Books)
- **Right Column (2fr)**: Daily Summary display with more space for content
- CSS Grid responsive design with mobile breakpoints at 768px

### Key UI Components
- `public/index.html`: Main dashboard with two-column grid layout
- `public/style.css`: Responsive styling with image hover effects
- `public/script.js`: Frontend JavaScript for book management and API calls

## Data Storage

### JSON Files (data/)
- `books.json`: Book registry with metadata
- `summaries.json`: Generated summaries with imageUrl references
- `history.json`: Chapter detection history

### Image Storage
- Generated images stored in `generated/images/` (excluded from git)
- Filename pattern: `{bookTitle}_ch{chapterTitle}_{timestamp}.png`
- Images served statically via Express at `/images/` endpoint
- **Important**: `generated/` folder is gitignored to prevent committing AI-generated content

## Web Scraping Strategy

### Supported Sites
- **Primary**: piaotia.com (飘天文学网)
- **Pattern**: Sequential chapter numbering with HTML link detection
- **Detection Method**: Compare highest chapter number found vs stored last chapter

### Scraping Architecture
- User-Agent rotation and request delays to avoid blocking
- Cheerio for HTML parsing and content extraction
- Encoding utilities for Chinese text handling

## AI Integration Patterns

### Summarization Pipeline
1. **Language Detection**: Automatic Chinese/English detection based on character patterns
2. **Prompt Engineering**: Structured prompts for consistent summary format
3. **Content Processing**: Handles both single chapters and batch processing

### Image Generation Pipeline
1. **Prompt Generation**: Creates visual prompts from chapter summaries
2. **Content Filtering**: Removes non-story content (DMCA, privacy policy, etc.)
3. **Base64 Processing**: Converts API responses to local PNG files
4. **URL Management**: Generates public URLs for frontend display

## Logging and Monitoring

### Enhanced Logging
- Winston-based logging to files and console
- **Image Generation**: Look for `🖼️ IMAGE URL:` logs for easy verification
- **API Responses**: Optimized to avoid logging large base64 image data

### Log Locations
- `logs/combined.log`: All application logs
- `logs/error.log`: Error-only logs

## Common Development Patterns

### Adding New Novel Sites
1. Update `WebNovelScraper` class with site-specific selectors
2. Add URL pattern matching in `scrapeBookInfo` method
3. Test chapter detection with sample URLs

### API Endpoint Development
- Follow existing patterns in `src/server.ts`
- Use TypeScript interfaces from `src/types.ts`
- Include proper error handling and logging

### Summary Cleanup
- When removing books, associated summaries are automatically cleaned up
- Use `storage.removeSummariesByBookId()` pattern for data consistency

## Development History

### 2025-07-11 - Image Storage Restructuring
**Completed Major Refactor**: Moved generated images from `public/images/` to `generated/images/` for better git management.

**Changes Made:**
- **ImageGenerator**: Updated `imagesDir` path to `generated/images/` 
- **Express Server**: Added new static route `app.use('/images', express.static('generated/images'))`
- **Git Configuration**: Updated `.gitignore` to exclude `generated/` folder instead of `public/images/`
- **File Migration**: Moved existing images to new location structure

**Benefits:**
- Prevents accidental commits of AI-generated content
- Cleaner separation between source code and generated assets
- Maintains proper serving of images via `/images/` endpoint
- Preserves existing image URLs in summaries.json

**Technical Details:**
- Image generation uses Together AI FLUX.1-schnell-Free model
- Base64 responses converted to PNG files with timestamp-based naming
- Images properly served and displayed in two-column web layout
- All existing functionality preserved during migration