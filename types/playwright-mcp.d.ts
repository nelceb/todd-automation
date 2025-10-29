import { Page } from 'playwright';

declare module 'playwright' {
  interface Page {
    /**
     * Click with LLM fallback (Self-Healing Locator)
     * @param primaryQuery - Primary CSS selector to try first
     * @param intent - Natural language description for LLM fallback
     */
    clickWithLLM(primaryQuery: string, intent?: string): Promise<void>;
    
    /**
     * Fill with LLM fallback (Self-Healing Locator)
     * @param primaryQuery - Primary CSS selector to try first
     * @param value - Value to fill
     * @param intent - Natural language description for LLM fallback
     */
    fillWithLLM(primaryQuery: string, value: string, intent?: string): Promise<void>;
    
    /**
     * Get text content with LLM fallback (Self-Healing Locator)
     * @param primaryQuery - Primary CSS selector to try first
     * @param intent - Natural language description for LLM fallback
     */
    textContentWithLLM(primaryQuery: string, intent?: string): Promise<string | null>;
  }
}


