import * as cron from 'node-cron';
import logger from './logger';
import { WebNovelScraper } from './scraper';
import { JSONStorage } from './storage';
import { AISummarizer } from './summarizer';
import { ImageGenerator } from './image-generator';

class NovelScheduler {
    private scraper: WebNovelScraper;
    private storage: JSONStorage;
    private summarizer: AISummarizer;
    private imageGenerator: ImageGenerator;
    private isRunning: boolean;

    constructor() {
        this.scraper = new WebNovelScraper();
        this.storage = new JSONStorage();
        this.summarizer = new AISummarizer();
        this.imageGenerator = new ImageGenerator();
        this.isRunning = false;
    }

    start(): void {
        logger.info('Starting novel scheduler...');
        
        // Check for new chapters every 6 hours
        cron.schedule('0 */6 * * *', async () => {
            logger.info('Running scheduled chapter check...');
            await this.checkAllBooks();
        });

        // Generate daily summaries at 8 AM
        cron.schedule('0 8 * * *', async () => {
            logger.info('Running daily summary generation...');
            await this.generateDailySummaries();
        });

        // Cleanup old data weekly on Sunday at 2 AM
        cron.schedule('0 2 * * 0', async () => {
            logger.info('Running weekly cleanup...');
            await this.cleanupOldData();
        });

        logger.info('Scheduler started successfully');
    }

    async checkAllBooks(): Promise<any> {
        if (this.isRunning) {
            logger.info('Check already in progress, skipping...');
            return;
        }

        this.isRunning = true;
        
        try {
            const books = await this.storage.getBooks();
            logger.info(`Checking ${books.length} books for new chapters...`);

            let totalNewChapters = 0;
            const updatedBooks: any[] = [];

            for (const book of books) {
                try {
                    const result = await this.scraper.checkForNewChapters(book.url, book.lastChapter);
                    
                    if (result.hasNewChapters) {
                        logger.info(`Found ${result.newChapters.length} new chapters for "${book.title}"`);
                        
                        await this.storage.updateBook(book.id, {
                            lastChapter: result.lastChapter,
                            totalChapters: result.totalChapters,
                            lastChecked: new Date().toISOString()
                        });

                        // Add to history
                        for (const chapter of result.newChapters) {
                            await this.storage.addHistoryEntry({
                                bookId: book.id,
                                chapterNumber: chapter.number,
                                chapterTitle: chapter.title,
                                chapterUrl: chapter.url,
                                action: 'detected'
                            });
                        }

                        updatedBooks.push({
                            ...book,
                            newChapters: result.newChapters
                        });

                        totalNewChapters += result.newChapters.length;
                    } else {
                        // Update last checked time even if no new chapters
                        await this.storage.updateBook(book.id, {
                            lastChecked: new Date().toISOString()
                        });
                    }

                    // Add delay between requests to be respectful
                    await this.sleep(2000);

                } catch (error: any) {
                    logger.error(`Error checking book "${book.title}":`, error.message);
                }
            }

            logger.info(`Chapter check completed. Found ${totalNewChapters} new chapters across ${updatedBooks.length} books.`);
            
            return {
                totalNewChapters,
                updatedBooks: updatedBooks.length
            };

        } catch (error: any) {
            logger.error('Error in scheduled check:', error);
        } finally {
            this.isRunning = false;
        }
    }

    async generateDailySummaries(): Promise<any> {
        try {
            logger.info('Generating daily summaries...');
            
            const books = await this.storage.getBooks();
            const summaries: any[] = [];

            for (const book of books) {
                try {
                    const result = await this.scraper.checkForNewChapters(book.url, book.lastChapter);
                    
                    if (result.hasNewChapters) {
                        // Get content for new chapters
                        const chaptersWithContent: any[] = [];
                        for (const chapter of result.newChapters) {
                            try {
                                const content = await this.scraper.scrapeChapterContent(chapter.url);
                                chaptersWithContent.push({
                                    ...chapter,
                                    content
                                });
                                
                                // Add delay between chapter scrapes
                                await this.sleep(1000);
                            } catch (error: any) {
                                logger.error(`Error scraping chapter ${chapter.number}:`, error);
                            }
                        }

                        if (chaptersWithContent.length > 0) {
                            // Generate summary
                            const summary = await this.summarizer.summarizeMultipleChapters(chaptersWithContent, book.title);
                            
                            // Store summary
                            await this.storage.addSummary({
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

                            logger.info(`Generated summary for "${book.title}" (${chaptersWithContent.length} chapters)`);
                        }
                    }

                    // Add delay between books
                    await this.sleep(3000);

                } catch (error: any) {
                    logger.error(`Error processing book "${book.title}":`, error);
                }
            }

            logger.info(`Daily summary generation completed. Generated ${summaries.length} summaries.`);
            return summaries;

        } catch (error: any) {
            logger.error('Error generating daily summaries:', error);
        }
    }

    async cleanupOldData(): Promise<any> {
        try {
            logger.info('Running data cleanup...');
            
            const result = await this.storage.cleanup(30); // Keep 30 days of data
            
            // Also cleanup old generated images
            const deletedImages = await this.imageGenerator.cleanupOldImages(30);
            
            logger.info(`Cleanup completed. Removed ${result.summariesRemoved} old summaries, ${result.historyRemoved} old history entries, and ${deletedImages} old images.`);
            
            return {
                ...result,
                imagesRemoved: deletedImages
            };
        } catch (error: any) {
            logger.error('Error during cleanup:', error);
        }
    }

    async runManualCheck(): Promise<any> {
        logger.info('Running manual check...');
        return await this.checkAllBooks();
    }

    async runManualSummary(): Promise<any> {
        logger.info('Running manual summary generation...');
        return await this.generateDailySummaries();
    }

    sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export { NovelScheduler };