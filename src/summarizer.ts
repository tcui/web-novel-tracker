import * as Anthropic from '@anthropic-ai/sdk';
import logger from './logger';
import { Chapter, Language } from './types';

class AISummarizer {
    private anthropic: any;

    constructor() {
        this.anthropic = new (Anthropic as any).default({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
    }

    async summarizeChapter(chapterContent: string, chapterTitle: string, bookTitle: string): Promise<string> {
        try {
            if (!process.env.ANTHROPIC_API_KEY) {
                throw new Error('Anthropic API key not configured');
            }

            // Detect language of the content
            const language = this.detectLanguage(chapterContent);
            const languageInstruction = language === 'chinese' ? 
                'Please respond in Chinese (中文)' : 
                'Please respond in English';

            const prompt = `${languageInstruction}. Provide a concise summary of this story/chapter:

Book: ${bookTitle}
Chapter: ${chapterTitle}

Content:
${chapterContent}

Please provide:
1. A brief summary (2-3 sentences) of the main events
2. Key character developments or interactions
3. Important plot points or revelations

Keep the summary clear and engaging for readers. ${languageInstruction}.`;

            const response = await this.anthropic.messages.create({
                model: 'claude-3-haiku-20240307',
                max_tokens: 500,
                temperature: 0.7,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            });

            return (response.content[0] as any).text.trim();

        } catch (error: any) {
            logger.error('Error summarizing chapter:', error);
            throw new Error(`Failed to summarize chapter: ${error.message}`);
        }
    }

    async summarizeMultipleChapters(chapters: Chapter[], bookTitle: string): Promise<string> {
        try {
            if (!process.env.ANTHROPIC_API_KEY) {
                throw new Error('Anthropic API key not configured');
            }

            const chaptersText = chapters.map(chapter => 
                `Chapter ${chapter.number}: ${chapter.title}\n${chapter.content}`
            ).join('\n\n---\n\n');

            // Detect language from the combined content
            const language = this.detectLanguage(chaptersText);
            const languageInstruction = language === 'chinese' ? 
                'Please respond in Chinese (中文)' : 
                'Please respond in English';

            const prompt = `${languageInstruction}. Provide a daily summary of these new chapters from "${bookTitle}":

${chaptersText}

Please provide:
1. Overall story progression across all chapters
2. Major character developments
3. Key plot points and revelations
4. Cliffhangers or important developments to look forward to

Keep the summary engaging and informative for daily reading updates. ${languageInstruction}.`;

            const response = await this.anthropic.messages.create({
                model: 'claude-3-haiku-20240307',
                max_tokens: 800,
                temperature: 0.7,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            });

            return (response.content[0] as any).text.trim();

        } catch (error: any) {
            logger.error('Error summarizing multiple chapters:', error);
            throw new Error(`Failed to summarize chapters: ${error.message}`);
        }
    }

    async generateDailySummary(allBookUpdates: any[]): Promise<string> {
        try {
            if (!process.env.ANTHROPIC_API_KEY) {
                throw new Error('Anthropic API key not configured');
            }

            const summariesText = allBookUpdates.map(update => 
                `${update.bookTitle} (${update.newChaptersCount} new chapters):\n${update.summary}`
            ).join('\n\n---\n\n');

            const prompt = `Create a daily reading summary for these web novel updates in the same language as the original content:

${summariesText}

Please provide (in the same language as the content):
1. A brief overview of today's updates
2. Highlight the most interesting developments
3. Any recommendations for priority reading

Keep it concise and engaging for a daily reading digest. Use the same language as the original text.`;

            const response = await this.anthropic.messages.create({
                model: 'claude-3-haiku-20240307',
                max_tokens: 600,
                temperature: 0.7,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            });

            return (response.content[0] as any).text.trim();

        } catch (error: any) {
            logger.error('Error generating daily summary:', error);
            throw new Error(`Failed to generate daily summary: ${error.message}`);
        }
    }

    public detectLanguage(text: string): Language {
        // Simple language detection based on character patterns
        const chineseCharCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
        const totalChars = text.length;
        const percentage = (chineseCharCount / totalChars) * 100;
        
        logger.info(`Language detection: ${chineseCharCount} Chinese chars out of ${totalChars} total (${percentage.toFixed(1)}%)`);
        
        // If more than 30% of characters are Chinese, consider it Chinese
        if (chineseCharCount / totalChars > 0.3) {
            logger.info('Detected language: Chinese');
            return 'chinese';
        }
        
        // Default to English for other cases
        logger.info('Detected language: English');
        return 'english';
    }
}

export { AISummarizer };