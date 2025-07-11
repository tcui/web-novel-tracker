# Web Novel Tracker

An automated web novel chapter tracker with AI-powered daily summaries. Track your favorite web novels and get concise summaries of new chapters delivered daily.

## Features

- 📚 **Book Management**: Add/remove web novels by URL
- 🔍 **Automatic Chapter Detection**: Scans for new chapters every 6 hours
- 🤖 **AI Summarization**: Generates daily summaries using Anthropic Claude
- 📊 **Dashboard Interface**: Clean web interface for managing your library
- 📅 **Scheduling**: Automated daily summary generation
- 💾 **Data Persistence**: JSON-based storage for books and summaries

## Setup

### Prerequisites
- Node.js 16+ installed
- Anthropic API key for summarization features

### Installation

1. **Clone and install dependencies**:
```bash
npm install
```

2. **Configure environment**:
```bash
cp .env.example .env
# Edit .env and add your Anthropic API key
```

3. **Start the server**:
```bash
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
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode

### Scheduling
- **Chapter checks**: Every 6 hours
- **Daily summaries**: 8 AM daily
- **Data cleanup**: Weekly (Sundays at 2 AM)

## File Structure

```
├── server.js          # Main server file
├── scraper.js         # Web scraping logic
├── storage.js         # JSON data storage
├── summarizer.js      # AI summarization
├── scheduler.js       # Automated scheduling
├── public/
│   ├── index.html     # Main dashboard
│   ├── style.css      # Styling
│   └── script.js      # Frontend JavaScript
└── data/              # Generated data files
    ├── books.json     # Tracked books
    ├── summaries.json # Generated summaries
    └── history.json   # Chapter detection history
```

## Development

### Running in Development Mode
```bash
npm run dev
```

### Adding New Novel Sites
1. Update `scraper.js` with site-specific selectors
2. Test chapter detection with sample URLs
3. Adjust content extraction as needed

## Troubleshooting

### Common Issues
- **API Rate Limits**: Adjust delays in scheduler.js
- **Scraping Blocked**: Check User-Agent headers in scraper.js
- **Missing Summaries**: Verify Anthropic API key configuration

### Logs
- Server logs show chapter detection and summary generation
- Check console for detailed error messages

## License

MIT License - See LICENSE file for details