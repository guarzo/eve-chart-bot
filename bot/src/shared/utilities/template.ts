import { promises as fs } from 'fs';
import * as path from 'path';
import { logger } from '../../lib/logger';

/**
 * Template utility for loading and rendering HTML templates
 */
export class TemplateEngine {
  private static templateCache: Map<string, string> = new Map();
  private static loadingPromises: Map<string, Promise<string>> = new Map();

  /**
   * Load a template from the filesystem
   * @param templatePath Path to the template file relative to the templates directory
   * @returns Template content as string
   */
  static async loadTemplate(templatePath: string): Promise<string> {
    // Check if template is already cached
    const cached = this.templateCache.get(templatePath);
    if (cached !== undefined) {
      return cached;
    }

    // Check if template is currently being loaded
    const existingLoadingPromise = this.loadingPromises.get(templatePath);
    if (existingLoadingPromise !== undefined) {
      return existingLoadingPromise;
    }

    // Create loading promise to prevent duplicate reads
    const loadingPromise = (async () => {
      try {
        const fullPath = path.resolve(__dirname, '../../application/chart/templates', templatePath);
        const template = await fs.readFile(fullPath, 'utf8');
        this.templateCache.set(templatePath, template);
        return template;
      } catch (error) {
        logger.error(`Failed to load template: ${templatePath}`, error);
        throw new Error(`Template not found: ${templatePath}`);
      } finally {
        // Clean up loading promise
        this.loadingPromises.delete(templatePath);
      }
    })();

    this.loadingPromises.set(templatePath, loadingPromise);
    return loadingPromise;
  }

  /**
   * Render a template with placeholders replaced
   * @param templatePath Path to the template file
   * @param variables Object containing variables to replace in the template
   * @returns Rendered HTML string
   */
  static async render(templatePath: string, variables: Record<string, string>): Promise<string> {
    try {
      let template = await this.loadTemplate(templatePath);

      // Replace all {{placeholder}} with corresponding values
      for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{{${key}}}`;
        template = template.replace(new RegExp(placeholder, 'g'), value);
      }

      return template;
    } catch (error) {
      logger.error(`Failed to render template: ${templatePath}`, error);
      throw error;
    }
  }

  /**
   * Clear the template cache (useful for development)
   */
  static clearCache(): void {
    this.templateCache.clear();
  }
}
