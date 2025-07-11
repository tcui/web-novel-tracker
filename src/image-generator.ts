import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import logger from './logger';
import { ImageGenerationOptions, GeneratedImage, Language } from './types';

class ImageGenerator {
    private apiKey: string;
    private imagesDir: string;

    constructor() {
        this.apiKey = process.env.TOGETHER_API_KEY || '';
        if (!this.apiKey) {
            logger.error('Together API key is not configured');
        } else {
            logger.info('Together API key found, initializing client');
        }
        
        this.imagesDir = path.join(__dirname, '..', 'public', 'images');
        this.ensureImagesDirectory();
    }

    // Test method to verify Together AI client works
    async testImageGeneration(): Promise<void> {
        try {
            logger.info('Testing Together AI image generation with simple request...');
            logger.info('API Key Status:', this.apiKey ? 'Present' : 'Missing');
            if (this.apiKey) {
                logger.info('API Key Length:', this.apiKey.length);
                logger.info('API Key starts with:', this.apiKey.substring(0, 10) + '...');
            }
            
            const response = await axios.post('https://api.together.xyz/v1/images/generations', {
                model: "black-forest-labs/FLUX.1-schnell-Free",
                prompt: "A cute baby sea otter",
                width: 1024,
                height: 1024,
                steps: 4,
                n: 1,
                response_format: "b64_json"
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            // Log success without the large base64 image data
            const responseInfo = {
                status: response.status,
                dataLength: response.data?.data?.length || 0,
                hasImages: response.data?.data?.length > 0,
                imageFormat: response.data?.data?.[0]?.b64_json ? 'base64' : 'unknown'
            };
            logger.info('Test successful! Response info:', responseInfo);
        } catch (error: any) {
            logger.error('Test failed:', error);
            if (error.response) {
                logger.error('Error response:', error.response.data);
            }
            throw error;
        }
    }

    private ensureImagesDirectory(): void {
        if (!fs.existsSync(this.imagesDir)) {
            fs.mkdirSync(this.imagesDir, { recursive: true });
            logger.info('Created images directory:', this.imagesDir);
        }
    }

    private isNonStoryContent(content: string, title: string): boolean {
        const lowercaseTitle = title.toLowerCase();
        const lowercaseContent = content.toLowerCase();
        
        logger.info(`Checking content for "${title}" - Length: ${content.length} chars`);
        
        // Check for common non-story content patterns
        const nonStoryPatterns = [
            'refund policy',
            'privacy policy',
            'terms of service',
            'disclaimer',
            'about us',
            'contact us',
            'copyright',
            'legal notice',
            'table of contents',
            'index',
            'bibliography',
            'acknowledgments',
            'author note',
            'advertisement',
            'subscription',
            'paywall'
        ];
        
        // Check if title contains non-story keywords
        for (const pattern of nonStoryPatterns) {
            if (lowercaseTitle.includes(pattern)) {
                logger.info(`Skipping - title matches non-story pattern: ${pattern}`);
                return true;
            }
        }
        
        // Check if content is too short - reduced threshold for testing
        if (content.length < 200) {
            logger.info(`Skipping - content too short: ${content.length} chars`);
            return true;
        }
        
        // Check for policy/legal content indicators
        const legalIndicators = [
            'effective date',
            'terms and conditions',
            'privacy policy',
            'refund policy',
            'intellectual property',
            'license agreement',
            'limitation of liability',
            'governing law'
        ];
        
        let legalIndicatorCount = 0;
        for (const indicator of legalIndicators) {
            if (lowercaseContent.includes(indicator)) {
                legalIndicatorCount++;
                logger.info(`Found legal indicator: ${indicator}`);
            }
        }
        
        // If content contains multiple legal indicators, it's likely not a story
        if (legalIndicatorCount >= 2) {
            logger.info(`Skipping - too many legal indicators: ${legalIndicatorCount}`);
            return true;
        }
        
        logger.info(`Content validation passed - proceeding with image generation`);
        return false;
    }

    async generateChapterSketch(
        chapterContent: string,
        chapterTitle: string,
        bookTitle: string,
        language: Language
    ): Promise<GeneratedImage | null> {
        try {
            if (!process.env.OPENAI_API_KEY) {
                logger.warn('OpenAI API key not configured, skipping image generation');
                return null;
            }

            // Only skip if content is extremely short or obviously non-story
            if (chapterContent.length < 100 || chapterTitle.toLowerCase().includes('refund policy')) {
                logger.info(`Skipping image generation for: ${chapterTitle} (length: ${chapterContent.length})`);
                return null;
            }

            // Extract key visual elements from the chapter content
            const visualPrompt = await this.createVisualPrompt(chapterContent, chapterTitle, bookTitle, language);
            
            logger.info(`Generating image for chapter: ${chapterTitle}`);
            logger.info(`Full visual prompt: ${visualPrompt}`);

            const response = await axios.post('https://api.together.xyz/v1/images/generations', {
                model: "black-forest-labs/FLUX.1-schnell-Free",
                prompt: visualPrompt,
                width: 1024,
                height: 1024,
                steps: 4,
                n: 1,
                response_format: "b64_json"
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const imageData = response.data.data?.[0];
            if (!imageData?.b64_json) {
                logger.error('No image data returned from Together AI');
                return null;
            }

            // Save the base64 image locally
            const filename = `${bookTitle.replace(/[^a-zA-Z0-9]/g, '_')}_ch${chapterTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.png`;
            const localPath = path.join(this.imagesDir, filename);
            
            // Convert base64 to buffer and save
            const imageBuffer = Buffer.from(imageData.b64_json, 'base64');
            fs.writeFileSync(localPath, imageBuffer);
            
            const publicPath = `/images/${filename}`;
            logger.info(`Image generated and saved: ${publicPath}`);
            logger.info(`🖼️  IMAGE URL: ${publicPath}`);

            return {
                url: '',
                localPath: publicPath
            };

        } catch (error: any) {
            logger.error('Error generating chapter sketch:', error);
            if (error.response) {
                logger.error('API Response Error:', error.response.data);
            }
            if (error.message) {
                logger.error('Error message:', error.message);
            }
            return null;
        }
    }

    private async createVisualPrompt(
        chapterContent: string,
        chapterTitle: string,
        bookTitle: string,
        language: Language
    ): Promise<string> {
        // Extract key visual elements from the chapter content (first 1500 characters)
        const excerpt = chapterContent.substring(0, 1500);
        
        // Clean excerpt to remove problematic content
        const cleanExcerpt = excerpt
            .replace(/[^\w\s\.,!?'"()-]/g, ' ') // Remove special characters
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
        
        // Determine the setting and style based on language/content
        const isChineseContent = language === 'chinese';
        const styleModifier = isChineseContent 
            ? 'traditional Chinese ink painting style with flowing robes and mystical elements'
            : 'fantasy adventure art style with detailed characters and environments';

        // Create a focused visual prompt that's safe for image generation
        const prompt = `Create a beautiful illustration inspired by "${chapterTitle}" from the story "${bookTitle}".

Style: ${styleModifier}, digital art, dramatic lighting, cinematic composition.

Create a scene that captures the essence of the chapter with characters, setting, and mood.
Focus on creating an atmospheric and engaging visual that represents the story's themes.
Use rich colors and detailed artwork suitable for a book illustration.

Avoid: Any text, words, or written content in the image.

Make it visually striking and suitable as a chapter illustration.`;

        logger.info(`Generated visual prompt for "${chapterTitle}": ${prompt.substring(0, 150)}...`);
        return prompt;
    }

    async generateSketchFromSummary(
        summary: string,
        chapterTitle: string,
        bookTitle: string,
        language: Language
    ): Promise<GeneratedImage | null> {
        try {
            logger.info(`=== generateSketchFromSummary called for: ${chapterTitle} ===`);
            logger.info(`Summary length: ${summary.length} characters`);
            logger.info(`Summary content: ${summary.substring(0, 300)}...`);
            
            if (!this.apiKey) {
                logger.warn('Together API key not configured, skipping image generation');
                return null;
            }

            // Skip only if summary is very short
            if (summary.length < 50) {
                logger.info(`Skipping image generation - summary too short: ${summary.length} chars`);
                return null;
            }

            // Create prompt from summary
            const visualPrompt = await this.createVisualPromptFromSummary(summary, chapterTitle, bookTitle, language);
            
            logger.info(`Generating image from summary for chapter: ${chapterTitle}`);
            logger.info(`Full visual prompt: "${visualPrompt}"`);
            logger.info(`Prompt length: ${visualPrompt.length} characters`);

            const requestPayload = {
                model: "black-forest-labs/FLUX.1-schnell-Free",
                prompt: visualPrompt,
                width: 1024,
                height: 1024,
                steps: 4,
                n: 1,
                response_format: "b64_json"
            };
            
            logger.info(`Together AI Image Generation Request JSON:`);
            logger.info(JSON.stringify(requestPayload, null, 2));
            
            try {
                const response = await axios.post('https://api.together.xyz/v1/images/generations', requestPayload, {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                logger.info(`Together AI Image Generation Response Status: Success`);
                logger.info(`Response structure JSON:`);
                logger.info(JSON.stringify(response.data, null, 2));
                
                const imageData = response.data.data?.[0];
                if (!imageData?.b64_json) {
                    logger.error('No image data returned from Together AI');
                    return null;
                }

                // Save the base64 image locally
                const filename = `${bookTitle.replace(/[^a-zA-Z0-9]/g, '_')}_ch${chapterTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.png`;
                const localPath = path.join(this.imagesDir, filename);
                
                // Convert base64 to buffer and save
                const imageBuffer = Buffer.from(imageData.b64_json, 'base64');
                fs.writeFileSync(localPath, imageBuffer);
                
                const publicPath = `/images/${filename}`;
                logger.info(`Image generated from summary and saved: ${publicPath}`);
                logger.info(`🖼️  IMAGE URL: ${publicPath}`);

                return {
                    url: '', // Together AI returns base64, not URL
                    localPath: publicPath
                };

            } catch (promptError: any) {
                logger.error(`Image generation failed with error:`, promptError);
                if (promptError.response) {
                    logger.error('Error response:', promptError.response.data);
                }
                
                // Try a fallback with a simpler prompt
                logger.warn(`Trying fallback prompt for: ${chapterTitle}`);
                const fallbackPrompt = `fantasy landscape, digital art, vibrant colors`;
                
                const fallbackPayload = {
                    model: "black-forest-labs/FLUX.1-schnell-Free",
                    prompt: fallbackPrompt,
                    width: 1024,
                    height: 1024,
                    steps: 4,
                    n: 1,
                    response_format: "b64_json"
                };
                
                logger.info(`Together AI Fallback Request:`, JSON.stringify(fallbackPayload, null, 2));
                const fallbackResponse = await axios.post('https://api.together.xyz/v1/images/generations', fallbackPayload, {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                logger.info(`Together AI Fallback Response Status: Success`);
                
                const fallbackImageData = fallbackResponse.data.data?.[0];
                if (!fallbackImageData?.b64_json) {
                    logger.error('No fallback image data returned from Together AI');
                    return null;
                }

                // Save the fallback image
                const filename = `${bookTitle.replace(/[^a-zA-Z0-9]/g, '_')}_ch${chapterTitle.replace(/[^a-zA-Z0-9]/g, '_')}_fallback_${Date.now()}.png`;
                const localPath = path.join(this.imagesDir, filename);
                
                const imageBuffer = Buffer.from(fallbackImageData.b64_json, 'base64');
                fs.writeFileSync(localPath, imageBuffer);
                
                const publicPath = `/images/${filename}`;
                logger.info(`Fallback image generated and saved: ${publicPath}`);
                logger.info(`🖼️  IMAGE URL: ${publicPath}`);

                return {
                    url: '',
                    localPath: publicPath
                };
            }

        } catch (error: any) {
            logger.error('Error generating sketch from summary:', error);
            if (error.response) {
                logger.error('API Response Error:', error.response.data);
            }
            if (error.message) {
                logger.error('Error message:', error.message);
            }
            return null;
        }
    }

    private async createVisualPromptFromSummary(
        summary: string,
        chapterTitle: string,
        bookTitle: string,
        language: Language
    ): Promise<string> {
        // Determine the setting and style based on language
        const isChineseContent = language === 'chinese';
        const styleModifier = isChineseContent 
            ? 'traditional Chinese watercolor painting style'
            : 'fantasy digital art style';

        // Create a very simple, safe prompt that avoids any content that might be rejected
        const prompt = `A magical fantasy landscape with mystical characters, ${styleModifier}, digital art, vibrant colors, no text`;

        logger.info(`Safe prompt created for "${chapterTitle}": ${prompt}`);
        return prompt;
    }

    private async downloadImage(url: string, localPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(localPath);
            https.get(url, (response) => {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            }).on('error', (error) => {
                fs.unlink(localPath, () => {}); // Delete the file on error
                reject(error);
            });
        });
    }

    async generateMultipleChapterSketches(
        chapters: Array<{number: number, title: string, content: string}>,
        bookTitle: string,
        language: Language
    ): Promise<GeneratedImage[]> {
        const images: GeneratedImage[] = [];
        
        for (const chapter of chapters) {
            try {
                const image = await this.generateChapterSketch(
                    chapter.content,
                    chapter.title,
                    bookTitle,
                    language
                );
                
                if (image) {
                    images.push(image);
                }
                
                // Add delay between API calls to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 2000));
                
            } catch (error: any) {
                logger.error(`Error generating image for chapter ${chapter.number}:`, error);
            }
        }
        
        return images;
    }

    async cleanupOldImages(daysOld: number = 30): Promise<number> {
        try {
            const files = fs.readdirSync(this.imagesDir);
            const now = Date.now();
            const maxAge = daysOld * 24 * 60 * 60 * 1000; // Convert days to milliseconds
            let deletedCount = 0;

            for (const file of files) {
                const filePath = path.join(this.imagesDir, file);
                const stats = fs.statSync(filePath);
                
                if (now - stats.mtime.getTime() > maxAge) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                    logger.info(`Deleted old image: ${file}`);
                }
            }

            return deletedCount;
        } catch (error: any) {
            logger.error('Error cleaning up old images:', error);
            return 0;
        }
    }
}

export { ImageGenerator };