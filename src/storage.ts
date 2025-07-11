import { promises as fs } from 'fs';
import * as path from 'path';
import logger from './logger';
import { Book, Summary, HistoryEntry, SummaryData, CleanupResult } from './types';

export class JSONStorage {
    private dataDir: string;
    private booksFile: string;
    private summariesFile: string;
    private historyFile: string;

    constructor() {
        this.dataDir = path.join(__dirname, '..', 'data');
        this.booksFile = path.join(this.dataDir, 'books.json');
        this.summariesFile = path.join(this.dataDir, 'summaries.json');
        this.historyFile = path.join(this.dataDir, 'history.json');
        this.init();
    }

    async init(): Promise<void> {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
            
            // Initialize files if they don't exist
            await this.ensureFile(this.booksFile, []);
            await this.ensureFile(this.summariesFile, []);
            await this.ensureFile(this.historyFile, []);
        } catch (error) {
            logger.error('Error initializing storage:', error);
        }
    }

    async ensureFile(filePath: string, defaultData: any): Promise<void> {
        try {
            await fs.access(filePath);
        } catch {
            await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2));
        }
    }

    async readJSON(filePath: string): Promise<any[]> {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            logger.error(`Error reading ${filePath}:`, error);
            return [];
        }
    }

    async writeJSON(filePath: string, data: any): Promise<void> {
        try {
            await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        } catch (error) {
            logger.error(`Error writing ${filePath}:`, error);
            throw error;
        }
    }

    // Books management
    async getBooks(): Promise<Book[]> {
        return await this.readJSON(this.booksFile);
    }

    async addBook(book: Partial<Book>): Promise<Book> {
        const books = await this.getBooks();
        const newBook: Book = {
            id: this.generateId(),
            url: book.url!,
            title: book.title!,
            lastChapter: book.lastChapter || 0,
            totalChapters: book.totalChapters || 0,
            dateAdded: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            lastChecked: new Date().toISOString()
        };
        
        books.push(newBook);
        await this.writeJSON(this.booksFile, books);
        return newBook;
    }

    async updateBook(bookId: string, updates: Partial<Book>): Promise<Book> {
        const books = await this.getBooks();
        const bookIndex = books.findIndex(book => book.id === bookId);
        
        if (bookIndex === -1) {
            throw new Error('Book not found');
        }

        books[bookIndex] = {
            ...books[bookIndex],
            ...updates,
            lastUpdated: new Date().toISOString()
        };

        await this.writeJSON(this.booksFile, books);
        return books[bookIndex];
    }

    async removeBook(bookId: string): Promise<boolean> {
        const books = await this.getBooks();
        const filteredBooks = books.filter(book => book.id !== bookId);
        
        if (filteredBooks.length === books.length) {
            throw new Error('Book not found');
        }

        await this.writeJSON(this.booksFile, filteredBooks);
        return true;
    }

    async getBookById(bookId: string): Promise<Book | undefined> {
        const books = await this.getBooks();
        return books.find(book => book.id === bookId);
    }

    // Summaries management
    async getSummaries(date: string | null = null): Promise<Summary[]> {
        const summaries = await this.readJSON(this.summariesFile);
        
        if (date) {
            const targetDate = new Date(date).toDateString();
            return summaries.filter(summary => 
                new Date(summary.date).toDateString() === targetDate
            );
        }

        return summaries;
    }

    async addSummary(summary: SummaryData): Promise<Summary> {
        logger.info('Storage.addSummary called with:', summary);
        const summaries = await this.getSummaries();
        logger.info('Existing summaries count:', summaries.length);
        
        const newSummary: Summary = {
            id: this.generateId(),
            bookId: summary.bookId,
            bookTitle: summary.bookTitle,
            chapters: summary.chapters,
            summary: summary.summary,
            date: new Date().toISOString(),
            imageUrl: summary.imageUrl || undefined
        };

        logger.info('New summary to store:', newSummary);
        summaries.push(newSummary);
        
        try {
            await this.writeJSON(this.summariesFile, summaries);
            logger.info('Summary written to file successfully');
        } catch (error) {
            logger.error('Error writing summary to file:', error);
            throw error;
        }
        
        return newSummary;
    }

    async getTodaySummaries(): Promise<Summary[]> {
        const today = new Date().toDateString();
        return await this.getSummaries(today);
    }

    async removeSummariesByBookId(bookId: string): Promise<void> {
        logger.info(`Removing summaries for book ID: ${bookId}`);
        const summaries = await this.getSummaries();
        const filteredSummaries = summaries.filter(summary => summary.bookId !== bookId);
        
        logger.info(`Removed ${summaries.length - filteredSummaries.length} summaries for book ${bookId}`);
        await this.writeJSON(this.summariesFile, filteredSummaries);
    }

    // History management
    async getHistory(bookId: string | null = null): Promise<HistoryEntry[]> {
        const history = await this.readJSON(this.historyFile);
        
        if (bookId) {
            return history.filter(entry => entry.bookId === bookId);
        }

        return history;
    }

    async addHistoryEntry(entry: Partial<HistoryEntry>): Promise<HistoryEntry> {
        const history = await this.getHistory();
        const newEntry: HistoryEntry = {
            id: this.generateId(),
            bookId: entry.bookId!,
            chapterNumber: entry.chapterNumber!,
            chapterTitle: entry.chapterTitle!,
            chapterUrl: entry.chapterUrl!,
            action: entry.action!,
            date: new Date().toISOString()
        };

        history.push(newEntry);
        await this.writeJSON(this.historyFile, history);
        return newEntry;
    }

    // Utility methods
    generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    async cleanup(daysOld: number = 30): Promise<CleanupResult> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        // Clean old summaries
        const summaries = await this.getSummaries();
        const filteredSummaries = summaries.filter(summary => 
            new Date(summary.date) > cutoffDate
        );
        await this.writeJSON(this.summariesFile, filteredSummaries);

        // Clean old history
        const history = await this.getHistory();
        const filteredHistory = history.filter(entry => 
            new Date(entry.date) > cutoffDate
        );
        await this.writeJSON(this.historyFile, filteredHistory);

        return {
            summariesRemoved: summaries.length - filteredSummaries.length,
            historyRemoved: history.length - filteredHistory.length
        };
    }
}