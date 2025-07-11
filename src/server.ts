import * as dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import * as path from 'path';
import logger from './logger';
import { WebNovelScraper } from './scraper';
import { JSONStorage } from './storage';
import { AISummarizer } from './summarizer';
import { NovelScheduler } from './scheduler';
import { ImageGenerator } from './image-generator';
import { AddBookRequest, AddBookResponse, BookUpdateResult, ErrorResponse } from './types';

dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize services
const scraper = new WebNovelScraper();
const storage = new JSONStorage();
const summarizer = new AISummarizer();
const scheduler = new NovelScheduler();
const imageGenerator = new ImageGenerator();

// Middleware
app.use(logger.requestLogger);
app.use(express.json());
app.use(express.static('public'));
app.use('/images', express.static('generated/images'));

// Routes
app.get('/api/books', async (req: Request, res: Response) => {
    try {
        const books = await storage.getBooks();
        res.json(books);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch books' });
    }
});

app.post('/api/books', async (req: Request<{}, AddBookResponse | ErrorResponse, AddBookRequest>, res: Response<AddBookResponse | ErrorResponse>) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({ message: 'URL is required' });
        }

        // Check if book already exists
        const existingBooks = await storage.getBooks();
        const existingBook = existingBooks.find(book => book.url === url);
        
        if (existingBook) {
            return res.status(400).json({ message: 'Book already exists' });
        }

        // Scrape book information
        const bookInfo = await scraper.scrapeBookInfo(url);
        
        // Add to storage
        const newBook = await storage.addBook(bookInfo);
        
        // Fetch and summarize the most recent 3 chapters
        try {
            logger.info('Starting chapter processing...');
            logger.info('Book info chapters:', bookInfo.chapters.length);
            
            // For single-page stories, just get the one chapter; for multi-chapter, get last 3
            const recentChapters = bookInfo.chapters.length === 1 ? 
                bookInfo.chapters : 
                bookInfo.chapters.slice(-3); // Get last 3 chapters
            logger.info('Recent chapters to process:', recentChapters.length, recentChapters);
            
            const summaries: any[] = [];
            
            for (const chapter of recentChapters) {
                try {
                    logger.info(`Fetching chapter ${chapter.number}: ${chapter.title}`);
                    logger.info(`Chapter URL: ${chapter.url}`);
                    
                    // Get chapter content
                    const content = await scraper.scrapeChapterContent(chapter.url);
                    logger.info(`Chapter content length: ${content ? content.length : 0}`);
                    
                    if (content && content.length > 100) {
                        logger.info(`Generating summary for chapter ${chapter.number}...`);
                        
                        // Generate summary
                        const summary = await summarizer.summarizeChapter(
                            content, 
                            chapter.title, 
                            bookInfo.title
                        );
                        
                        logger.info(`Generated summary for chapter ${chapter.number}:`, summary.substring(0, 100) + '...');
                        
                        // Generate chapter sketch from summary
                        logger.info(`Generating sketch for chapter ${chapter.number}...`);
                        const language = summarizer.detectLanguage(content);
                        const generatedImage = await imageGenerator.generateSketchFromSummary(
                            summary,
                            chapter.title,
                            bookInfo.title,
                            language
                        );
                        
                        if (generatedImage) {
                            logger.info(`Generated sketch for chapter ${chapter.number}: ${generatedImage.localPath}`);
                        }
                        
                        summaries.push({
                            chapterNumber: chapter.number,
                            chapterTitle: chapter.title,
                            summary: summary,
                            imageUrl: generatedImage?.localPath || null
                        });
                        
                        // Add to history
                        await storage.addHistoryEntry({
                            bookId: newBook.id,
                            chapterNumber: chapter.number,
                            chapterTitle: chapter.title,
                            chapterUrl: chapter.url,
                            action: 'summarized'
                        });
                        
                        logger.info(`Successfully processed chapter ${chapter.number}`);
                    } else {
                        logger.info(`Chapter ${chapter.number} content too short or empty`);
                    }
                    
                    // Add delay between requests
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (chapterError) {
                    logger.error(`Error processing chapter ${chapter.number}:`, chapterError);
                }
            }
            
            logger.info(`Total summaries generated: ${summaries.length}`);
            
            // Store the initial summaries if any were generated
            if (summaries.length > 0) {
                const summaryData = {
                    bookId: newBook.id,
                    bookTitle: bookInfo.title,
                    chapters: summaries.map(s => ({
                        number: s.chapterNumber,
                        title: s.chapterTitle,
                        url: recentChapters.find(c => c.number === s.chapterNumber)?.url || ''
                    })),
                    summary: `Initial summaries for "${bookInfo.title}":\n\n` + 
                            summaries.map(s => `Chapter ${s.chapterNumber}: ${s.chapterTitle}\n\n${s.summary}`).join('\n\n'),
                    imageUrl: summaries.find(s => s.imageUrl)?.imageUrl || null
                };
                
                logger.info('Storing summary data:', summaryData);
                const storedSummary = await storage.addSummary(summaryData);
                logger.info('Summary stored successfully:', storedSummary);
            } else {
                logger.info('No summaries to store');
            }
            
            // Return book info with summaries
            res.status(201).json({
                ...newBook,
                initialSummaries: summaries
            });
            
        } catch (summaryError) {
            logger.error('Error generating initial summaries:', summaryError);
            // Still return the book even if summaries failed
            res.status(201).json({
                ...newBook,
                summaryError: 'Failed to generate initial summaries, but book was added successfully'
            });
        }
        
    } catch (error: any) {
        logger.error('Error adding book:', error);
        res.status(500).json({ message: error?.message || 'Failed to add book' });
    }
});

app.delete('/api/books/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await storage.removeBook(id);
        
        // Also remove associated summaries
        await storage.removeSummariesByBookId(id);
        
        res.json({ message: 'Book and associated summaries removed successfully' });
    } catch (error) {
        res.status(404).json({ message: 'Book not found' });
    }
});

app.get('/api/books/:id/check', async (req, res) => {
    try {
        const { id } = req.params;
        const book = await storage.getBookById(id);
        
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }

        const result = await scraper.checkForNewChapters(book.url, book.lastChapter);
        
        if (result.hasNewChapters) {
            // Update book with new chapter count
            await storage.updateBook(id, {
                lastChapter: result.lastChapter,
                totalChapters: result.totalChapters,
                lastChecked: new Date().toISOString()
            });
        }

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'Failed to check for new chapters' });
    }
});

app.get('/api/summary', async (req, res) => {
    try {
        // Get all summaries for debugging
        const allSummaries = await storage.getSummaries();
        logger.info('All summaries:', allSummaries.length, allSummaries);
        
        // Get today's summaries
        const todaySummaries = await storage.getTodaySummaries();
        logger.info('Today\'s summaries:', todaySummaries.length, todaySummaries);
        logger.info('Today\'s date:', new Date().toDateString());
        
        // For now, return all summaries to see them in the UI
        const summariesToShow = allSummaries.length > 0 ? allSummaries : todaySummaries;
        
        // Format summaries for frontend display
        const formattedSummaries = summariesToShow.map(summary => ({
            bookTitle: summary.bookTitle,
            summary: summary.summary,
            date: summary.date,
            chapterCount: summary.chapters ? summary.chapters.length : 0,
            imageUrl: summary.imageUrl
        }));
        
        logger.info('Formatted summaries with images:', formattedSummaries);
        res.json(formattedSummaries);
    } catch (error) {
        logger.error('Error fetching summaries:', error);
        res.status(500).json({ message: 'Failed to fetch summaries' });
    }
});

app.post('/api/check-all', async (req, res) => {
    try {
        const books = await storage.getBooks();
        const results: any[] = [];

        for (const book of books) {
            try {
                const result = await scraper.checkForNewChapters(book.url, book.lastChapter);
                
                if (result.hasNewChapters) {
                    await storage.updateBook(book.id, {
                        lastChapter: result.lastChapter,
                        totalChapters: result.totalChapters,
                        lastChecked: new Date().toISOString()
                    });

                    // Add to history
                    for (const chapter of result.newChapters) {
                        await storage.addHistoryEntry({
                            bookId: book.id,
                            chapterNumber: chapter.number,
                            chapterTitle: chapter.title,
                            chapterUrl: chapter.url,
                            action: 'detected'
                        });
                    }
                }

                results.push({
                    bookId: book.id,
                    bookTitle: book.title,
                    hasNewChapters: result.hasNewChapters,
                    newChaptersCount: result.newChapters.length,
                    newChapters: result.newChapters
                });

            } catch (error: any) {
                logger.error(`Error checking book ${book.title}:`, error);
                results.push({
                    bookId: book.id,
                    bookTitle: book.title,
                    error: error.message
                });
            }
        }

        res.json(results);
    } catch (error) {
        res.status(500).json({ message: 'Failed to check all books' });
    }
});

app.post('/api/summarize', async (req, res) => {
    try {
        const books = await storage.getBooks();
        const summaries: any[] = [];

        for (const book of books) {
            try {
                const result = await scraper.checkForNewChapters(book.url, book.lastChapter);
                
                if (result.hasNewChapters) {
                    // Get content for new chapters
                    const chaptersWithContent: any[] = [];
                    for (const chapter of result.newChapters) {
                        try {
                            const content = await scraper.scrapeChapterContent(chapter.url);
                            chaptersWithContent.push({
                                ...chapter,
                                content
                            });
                        } catch (error: any) {
                            logger.error(`Error scraping chapter ${chapter.number}:`, error);
                        }
                    }

                    if (chaptersWithContent.length > 0) {
                        // Generate summary
                        const summary = await summarizer.summarizeMultipleChapters(chaptersWithContent, book.title);
                        
                        // Store summary
                        await storage.addSummary({
                            bookId: book.id,
                            bookTitle: book.title,
                            chapters: chaptersWithContent.map(c => ({
                                number: c.number,
                                title: c.title,
                                url: c.url
                            })),
                            summary
                        });

                        summaries.push({
                            bookId: book.id,
                            bookTitle: book.title,
                            newChaptersCount: chaptersWithContent.length,
                            summary
                        });

                        // Update book status
                        await storage.updateBook(book.id, {
                            lastChapter: result.lastChapter,
                            totalChapters: result.totalChapters,
                            lastChecked: new Date().toISOString()
                        });
                    }
                }
            } catch (error: any) {
                logger.error(`Error processing book ${book.title}:`, error);
            }
        }

        res.json(summaries);
    } catch (error) {
        res.status(500).json({ message: 'Failed to generate summaries' });
    }
});

app.get('/api/history/:bookId?', async (req, res) => {
    try {
        const { bookId } = req.params;
        const history = await storage.getHistory(bookId);
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch history' });
    }
});

// Serve index.html for all non-API routes
app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Error handling middleware
app.use((error: Error, req: Request, res: Response, next: any) => {
    logger.error('Server error:', error);
    res.status(500).json({ message: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    logger.info(`Web Novel Tracker running on http://localhost:${PORT}`);
    logger.info('Press Ctrl+C to stop the server');
    
    // Debug: Check if API keys are loaded
    if (process.env.ANTHROPIC_API_KEY) {
        logger.info('Anthropic API key loaded successfully');
    } else {
        logger.error('WARNING: Anthropic API key not found in environment variables');
    }
    
    if (process.env.TOGETHER_API_KEY) {
        logger.info('Together API key loaded successfully');
    } else {
        logger.warn('WARNING: Together API key not found - image generation will be disabled');
    }
    
    // Start the scheduler
    scheduler.start();
    
    // Test image generation on startup
    setTimeout(async () => {
        try {
            logger.info('Running Together AI image generation test...');
            await imageGenerator.testImageGeneration();
        } catch (error) {
            logger.error('Startup image generation test failed:', error);
        }
    }, 2000);
});

export default app;