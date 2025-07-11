# Web Novel Tracker

An automated web novel chapter tracker with AI-powered daily summaries. Track your favorite web novels and get concise summaries of new chapters delivered daily.

## Features

- 📚 **Book Management**: Add/remove web novels by URL
- 🔍 **Automatic Chapter Detection**: Scans for new chapters every 6 hours
- 🤖 **AI Summarization**: Generates daily summaries using Anthropic Claude
- 🎨 **AI Image Generation**: Creates chapter sketches using Together AI FLUX.1
- 📊 **Dashboard Interface**: Clean two-column web interface for managing your library
- 📅 **Scheduling**: Automated daily summary generation
- 🌐 **Multi-language Support**: Chinese and English content detection
- 💾 **Data Persistence**: JSON-based storage for books and summaries

## Setup

### Prerequisites
- Node.js 16+ installed
- Anthropic API key for summarization features
- Together AI API key for image generation

### Installation

1. **Clone and install dependencies**:
```bash
npm install
```

2. **Configure environment**:
```bash
cp .env.example .env
# Edit .env and add your API keys:
# ANTHROPIC_API_KEY=your_anthropic_key_here
# TOGETHER_API_KEY=your_together_key_here
```

3. **Build and start the server**:
```bash
npm run build
npm start
```

4. **Open in browser**:
```
http://localhost:3000
```

## Usage

### Adding Books
1. Copy the URL of a web novel's table of contents page
2. Paste it into the "Add New Book" field
3. Click "Add Book"

### Example URLs
- Piaotia.com: `https://www.piaotia.com/html/13/13191/`
- Other novel sites with similar chapter listing formats

### Daily Summaries
- Summaries are generated automatically at 8 AM daily
- Manual summary generation available via API: `POST /api/summarize`

## API Endpoints

### Books
- `GET /api/books` - Get all tracked books
- `POST /api/books` - Add a new book
- `DELETE /api/books/:id` - Remove a book
- `GET /api/books/:id/check` - Check for new chapters

### Summaries
- `GET /api/summary` - Get today's summaries
- `POST /api/summarize` - Generate summaries for all books

### Utilities
- `POST /api/check-all` - Check all books for new chapters
- `GET /api/history/:bookId?` - Get chapter detection history

## Configuration

### Environment Variables
- `ANTHROPIC_API_KEY` - Required for AI summarization
- `TOGETHER_API_KEY` - Required for AI image generation
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode

### Scheduling
- **Chapter checks**: Every 6 hours
- **Daily summaries**: 8 AM daily
- **Data cleanup**: Weekly (Sundays at 2 AM)

## File Structure

```
├── src/                    # TypeScript source files
│   ├── server.ts           # Main Express server
│   ├── scraper.ts          # Web scraping logic
│   ├── storage.ts          # JSON data storage
│   ├── summarizer.ts       # AI summarization (Anthropic Claude)
│   ├── image-generator.ts  # AI image generation (Together AI)
│   ├── scheduler.ts        # Automated scheduling
│   ├── types.ts           # TypeScript type definitions
│   └── logger.ts          # Winston-based logging
├── dist/                   # Compiled JavaScript output
├── public/                 # Static web assets
│   ├── index.html         # Main dashboard (two-column layout)
│   ├── style.css          # Responsive styling
│   └── script.js          # Frontend JavaScript
├── generated/             # AI-generated content (gitignored)
│   └── images/            # Generated chapter sketches
├── data/                  # JSON data files
│   ├── books.json         # Tracked books
│   ├── summaries.json     # Generated summaries with image URLs
│   └── history.json       # Chapter detection history
├── logs/                  # Application logs
└── CLAUDE.md              # Documentation for Claude Code
```

## Development

### Running in Development Mode
```bash
npm run dev
```

### Adding New Novel Sites
1. Update `src/scraper.ts` with site-specific selectors
2. Test chapter detection with sample URLs
3. Adjust content extraction as needed
4. Run `npm run build` to compile TypeScript changes

## Troubleshooting

### Common Issues
- **API Rate Limits**: Adjust delays in `src/scheduler.ts`
- **Scraping Blocked**: Check User-Agent headers in `src/scraper.ts`
- **Missing Summaries**: Verify Anthropic API key configuration
- **Image Generation Errors**: Check Together AI API key and logs
- **TypeScript Compilation**: Run `npm run build` after code changes

### Logs
- Application logs are stored in `logs/` directory
- **combined.log**: All application logs
- **error.log**: Error-only logs
- Look for `🖼️ IMAGE URL:` entries to verify image generation
- Check console for detailed error messages

## License

MIT License - See LICENSE file for details