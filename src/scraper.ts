import * as axios from 'axios';
import * as cheerio from 'cheerio';
import { EncodingUtils } from './encoding-utils';
import logger from './logger';
import { BookInfo, Chapter, ChapterCheckResult } from './types';

export class WebNovelScraper {
    private userAgent: string;

    constructor() {
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    }

    async scrapeBookInfo(url: string): Promise<BookInfo> {
        try {
            const response = await (axios as any).default.get(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,ja;q=0.7,ko;q=0.6,*;q=0.5',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                },
                responseType: 'arraybuffer'
            });

            // Handle international character encoding
            const html = EncodingUtils.decodeBuffer(response.data);
            const $ = cheerio.load(html);
            
            // Extract book title - try multiple selectors
            let title = '';
            const titleSelectors = [
                'h1',
                '.book-title',
                '.title',
                'title',
                '.novel-title',
                '#title'
            ];

            for (const selector of titleSelectors) {
                const element = $(selector).first();
                if (element.length && element.text().trim()) {
                    title = element.text().trim();
                    break;
                }
            }

            // If no title found, extract from URL or use default
            if (!title) {
                const urlParts = url.split('/');
                title = urlParts[urlParts.length - 2] || 'Unknown Book';
            }

            // Normalize the title for proper display
            title = EncodingUtils.normalizeText(title);

            // Extract chapters
            const chapters = this.extractChapters($, url);

            // If no chapters found, treat as single-page story
            if (chapters.length === 0) {
                logger.info('No chapters found, treating as single-page story');
                chapters.push({
                    number: 1,
                    title: title,
                    url: url
                });
            }

            return {
                title,
                url,
                chapters,
                lastChapter: chapters.length > 0 ? chapters[chapters.length - 1].number : 0,
                totalChapters: chapters.length
            };

        } catch (error: any) {
            logger.error('Error scraping book info:', error.message);
            throw new Error(`Failed to scrape book: ${error.message}`);
        }
    }

    extractChapters($: cheerio.CheerioAPI, baseUrl: string): Chapter[] {
        const chapters: Chapter[] = [];
        const chapterSelectors = [
            'a[href*=".html"]',
            '.chapter-link',
            '.chapter a',
            'ul li a',
            'div a[href]'
        ];

        for (const selector of chapterSelectors) {
            const links = $(selector);
            if (links.length > 0) {
                links.each((i, element) => {
                    const $link = $(element);
                    const href = $link.attr('href');
                    const text = $link.text().trim();

                    if (href && text) {
                        // Extract chapter number from text
                        const chapterMatch = text.match(/(\d+)/);
                        const chapterNumber = chapterMatch ? parseInt(chapterMatch[1]) : i + 1;

                        // Build full URL
                        const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).toString();

                        chapters.push({
                            number: chapterNumber,
                            title: text,
                            url: fullUrl
                        });
                    }
                });
                break; // Use first selector that finds chapters
            }
        }

        // Sort chapters by number
        chapters.sort((a, b) => a.number - b.number);

        return chapters;
    }

    async scrapeChapterContent(chapterUrl: string): Promise<string> {
        try {
            logger.info('Scraping chapter content from:', chapterUrl);
            const response = await (axios as any).default.get(chapterUrl, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,ja;q=0.7,ko;q=0.6,*;q=0.5',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                },
                responseType: 'arraybuffer'
            });

            logger.info('Response received, status:', response.status);
            
            // Handle international character encoding
            const html = EncodingUtils.decodeBuffer(response.data);
            logger.info('HTML decoded, length:', html.length);
            const $ = cheerio.load(html);
            
            // Remove script and style elements
            $('script, style, nav, header, footer, .ad, .advertisement').remove();

            // Extract chapter content - try multiple selectors
            let content = '';
            const contentSelectors = [
                '.content',
                '.chapter-content',
                '.novel-content',
                '#content',
                '.text',
                'main',
                '.post-content',
                '.entry-content',
                'article',
                '.story-content',
                '.story-text',
                '.article-content',
                '.post-body'
            ];

            for (const selector of contentSelectors) {
                const element = $(selector).first();
                if (element.length && element.text().trim().length > 100) {
                    content = element.text().trim();
                    break;
                }
            }

            // If no content found with specific selectors, try piaotia.com specific extraction
            if (!content) {
                logger.info('No content found with main selectors, trying piaotia.com specific extraction...');
                
                // For piaotia.com, the content is often in the body as plain text
                const bodyText = $('body').text();
                
                // Try to extract the main content by looking for Chinese text blocks
                const lines = bodyText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
                
                let contentStarted = false;
                const contentLines: string[] = [];
                
                for (const line of lines) {
                    // Skip navigation and metadata lines
                    if (line.includes('上一章') || line.includes('下一章') || line.includes('目录') || 
                        line.includes('书签') || line.includes('推荐') || line.includes('收藏') ||
                        line.includes('piaotia') || line.includes('飘天') || line.includes('首页')) {
                        continue;
                    }
                    
                    // Look for substantial Chinese text content
                    if (line.length > 10 && /[\u4e00-\u9fff]/.test(line)) {
                        contentStarted = true;
                        contentLines.push(line);
                    } else if (contentStarted && line.length < 5) {
                        // Stop at short lines after content started (likely end of chapter)
                        break;
                    }
                }
                
                content = contentLines.join('\n\n');
            }

            // If still no content, try broader extraction
            if (!content) {
                logger.info('Trying broader body extraction...');
                
                // First try to find paragraphs with substantial text
                const paragraphs: string[] = [];
                $('body').find('p').each((i, element) => {
                    const text = $(element).text().trim();
                    if (text.length > 30) {
                        paragraphs.push(text as string);
                    }
                });
                
                if (paragraphs.length > 0) {
                    content = paragraphs.join('\n\n');
                } else {
                    // Fallback to any substantial text blocks
                    $('body').find('div, section, article').each((i, element) => {
                        const text = $(element).text().trim();
                        if (text.length > 100 && !text.includes('navigation') && !text.includes('menu')) {
                            content += text + '\n\n';
                        }
                    });
                }
            }

            logger.info('Final content length:', content.length);
            logger.info('Content preview:', content.substring(0, 200) + '...');
            
            return content.trim();

        } catch (error: any) {
            logger.error('Error scraping chapter content:', error.message);
            throw new Error(`Failed to scrape chapter: ${error.message}`);
        }
    }

    async checkForNewChapters(url: string, lastKnownChapter: number): Promise<ChapterCheckResult> {
        try {
            const bookInfo = await this.scrapeBookInfo(url);
            const newChapters = bookInfo.chapters.filter(chapter => 
                chapter.number > lastKnownChapter
            );

            return {
                hasNewChapters: newChapters.length > 0,
                newChapters,
                totalChapters: bookInfo.totalChapters,
                lastChapter: bookInfo.lastChapter
            };

        } catch (error: any) {
            logger.error('Error checking for new chapters:', error.message);
            return {
                hasNewChapters: false,
                newChapters: [],
                totalChapters: 0,
                lastChapter: 0,
                error: error.message
            };
        }
    }
}