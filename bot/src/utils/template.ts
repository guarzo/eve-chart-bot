import fs from "fs";
import path from "path";
import { logger } from "../lib/logger";

/**
 * Simple template engine for rendering HTML templates
 */
export class TemplateEngine {
  private static templateCache: Map<string, string> = new Map();

  /**
   * Load a template from file
   */
  private static loadTemplate(templateName: string): string {
    // Check cache first
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }

    try {
      const templatePath = path.join(
        __dirname,
        "..",
        "application",
        "chart",
        "templates",
        templateName
      );
      const template = fs.readFileSync(templatePath, "utf-8");

      // Cache the template
      this.templateCache.set(templateName, template);

      return template;
    } catch (error) {
      logger.error(`Failed to load template ${templateName}:`, error);
      throw new Error(`Template ${templateName} not found`);
    }
  }

  /**
   * Replace placeholders in template with values
   */
  private static replacePlaceholders(
    template: string,
    values: Record<string, string>
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return values[key] !== undefined ? values[key] : match;
    });
  }

  /**
   * Render a template with the given values
   */
  static render(templateName: string, values: Record<string, string>): string {
    const template = this.loadTemplate(templateName);
    return this.replacePlaceholders(template, values);
  }

  /**
   * Clear the template cache (useful for development)
   */
  static clearCache(): void {
    this.templateCache.clear();
  }
}
