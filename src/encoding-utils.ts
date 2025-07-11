// Utility functions for handling international character encoding

export class EncodingUtils {
    static detectEncoding(buffer: ArrayBuffer): string {
        // Simple heuristic to detect encoding
        const sample = buffer.slice(0, 1024);
        const text = new TextDecoder('utf-8', { fatal: true });
        
        try {
            text.decode(sample);
            return 'utf-8';
        } catch (error) {
            // Check for common Chinese encoding patterns
            const gbkPattern = /[\x81-\xfe][\x40-\xfe]/;
            if (gbkPattern.test(String.fromCharCode(...Array.from(new Uint8Array(sample))))) {
                return 'gbk';
            }
            
            // Check for Japanese encoding patterns
            const shiftJisPattern = /[\x81-\x9f\xe0-\xfc][\x40-\x7e\x80-\xfc]/;
            if (shiftJisPattern.test(String.fromCharCode(...Array.from(new Uint8Array(sample))))) {
                return 'shift_jis';
            }
            
            // Default to latin-1 for other cases
            return 'latin-1';
        }
    }
    
    static decodeBuffer(buffer: ArrayBuffer): string {
        const encoding = this.detectEncoding(buffer);
        
        try {
            return new TextDecoder(encoding).decode(buffer);
        } catch (error) {
            // Fallback chain
            const fallbacks = ['utf-8', 'gbk', 'shift_jis', 'latin-1'];
            
            for (const fallback of fallbacks) {
                try {
                    return new TextDecoder(fallback).decode(buffer);
                } catch (e) {
                    continue;
                }
            }
            
            // Last resort: force UTF-8 with replacement characters
            return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
        }
    }
    
    static normalizeText(text: string): string {
        // Normalize unicode characters for consistent display
        return text.normalize('NFC');
    }
    
    static isValidUTF8(buffer: ArrayBuffer): boolean {
        try {
            new TextDecoder('utf-8', { fatal: true }).decode(buffer);
            return true;
        } catch (error) {
            return false;
        }
    }
}