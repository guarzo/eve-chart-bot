import { TemplateEngine } from '../../../../src/shared/utilities/template';
import { promises as fs } from 'fs';
import * as path from 'path';
import { logger } from '../../../../src/lib/logger';

// Mock dependencies
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
  },
}));
jest.mock('path');
jest.mock('../../../../src/lib/logger');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;

describe('TemplateEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    TemplateEngine.clearCache();
    mockPath.resolve.mockImplementation((...args) => args.join('/'));
  });

  describe('loadTemplate', () => {
    it('should load template from filesystem', async () => {
      // Arrange
      const templatePath = 'test-template.html';
      const templateContent = '<html><body>{{title}}</body></html>';
      mockFs.readFile.mockResolvedValue(templateContent);

      // Act
      const result = await TemplateEngine.loadTemplate(templatePath);

      // Assert
      expect(result).toBe(templateContent);
      expect(mockFs.readFile).toHaveBeenCalledWith(
        expect.stringContaining(templatePath),
        'utf8'
      );
    });

    it('should cache loaded templates', async () => {
      // Arrange
      const templatePath = 'test-template.html';
      const templateContent = '<html><body>{{title}}</body></html>';
      mockFs.readFile.mockResolvedValue(templateContent);

      // Act
      const result1 = await TemplateEngine.loadTemplate(templatePath);
      const result2 = await TemplateEngine.loadTemplate(templatePath);

      // Assert
      expect(result1).toBe(templateContent);
      expect(result2).toBe(templateContent);
      expect(mockFs.readFile).toHaveBeenCalledTimes(1); // Should only read once due to caching
    });

    it('should handle concurrent template loading', async () => {
      // Arrange
      const templatePath = 'test-template.html';
      const templateContent = '<html><body>{{title}}</body></html>';
      let resolveReadFile: (value: string) => void;
      const readFilePromise = new Promise<string>((resolve) => {
        resolveReadFile = resolve;
      });
      mockFs.readFile.mockReturnValue(readFilePromise);

      // Act
      const promise1 = TemplateEngine.loadTemplate(templatePath);
      const promise2 = TemplateEngine.loadTemplate(templatePath);
      
      // Resolve after both promises are created
      resolveReadFile!(templateContent);
      
      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Assert
      expect(result1).toBe(templateContent);
      expect(result2).toBe(templateContent);
      expect(mockFs.readFile).toHaveBeenCalledTimes(1); // Should only read once even with concurrent requests
    });

    it('should throw error when template file not found', async () => {
      // Arrange
      const templatePath = 'non-existent.html';
      const error = new Error('ENOENT: no such file or directory');
      mockFs.readFile.mockRejectedValue(error);

      // Act & Assert
      await expect(TemplateEngine.loadTemplate(templatePath)).rejects.toThrow('Template not found: non-existent.html');
      expect(logger.error).toHaveBeenCalledWith(
        `Failed to load template: ${templatePath}`,
        error
      );
    });

    it('should resolve correct template path', async () => {
      // Arrange
      const templatePath = 'charts/killboard.html';
      const templateContent = '<html></html>';
      mockFs.readFile.mockResolvedValue(templateContent);

      // Act
      await TemplateEngine.loadTemplate(templatePath);

      // Assert
      expect(mockPath.resolve).toHaveBeenCalledWith(
        expect.any(String),
        '../../application/chart/templates',
        templatePath
      );
    });
  });

  describe('render', () => {
    it('should render template with variables', async () => {
      // Arrange
      const templatePath = 'test-template.html';
      const templateContent = '<html><head><title>{{title}}</title></head><body><h1>{{heading}}</h1><p>{{content}}</p></body></html>';
      const variables = {
        title: 'Test Page',
        heading: 'Welcome',
        content: 'This is test content'
      };
      const expectedOutput = '<html><head><title>Test Page</title></head><body><h1>Welcome</h1><p>This is test content</p></body></html>';
      
      mockFs.readFile.mockResolvedValue(templateContent);

      // Act
      const result = await TemplateEngine.render(templatePath, variables);

      // Assert
      expect(result).toBe(expectedOutput);
    });

    it('should handle multiple occurrences of same placeholder', async () => {
      // Arrange
      const templatePath = 'test-template.html';
      const templateContent = '<html><title>{{name}}</title><body><h1>{{name}}</h1><p>Hello, {{name}}!</p></body></html>';
      const variables = {
        name: 'John Doe'
      };
      const expectedOutput = '<html><title>John Doe</title><body><h1>John Doe</h1><p>Hello, John Doe!</p></body></html>';
      
      mockFs.readFile.mockResolvedValue(templateContent);

      // Act
      const result = await TemplateEngine.render(templatePath, variables);

      // Assert
      expect(result).toBe(expectedOutput);
    });

    it('should leave unreplaced placeholders as-is', async () => {
      // Arrange
      const templatePath = 'test-template.html';
      const templateContent = '<html><title>{{title}}</title><body>{{unreplaced}}</body></html>';
      const variables = {
        title: 'Test Page'
      };
      const expectedOutput = '<html><title>Test Page</title><body>{{unreplaced}}</body></html>';
      
      mockFs.readFile.mockResolvedValue(templateContent);

      // Act
      const result = await TemplateEngine.render(templatePath, variables);

      // Assert
      expect(result).toBe(expectedOutput);
    });

    it('should handle empty variables object', async () => {
      // Arrange
      const templatePath = 'test-template.html';
      const templateContent = '<html><title>Static Title</title><body>No placeholders here</body></html>';
      const variables = {};
      
      mockFs.readFile.mockResolvedValue(templateContent);

      // Act
      const result = await TemplateEngine.render(templatePath, variables);

      // Assert
      expect(result).toBe(templateContent);
    });

    it('should handle special characters in variables', async () => {
      // Arrange
      const templatePath = 'test-template.html';
      const templateContent = '<html><body>{{message}}</body></html>';
      const variables = {
        message: 'Hello & welcome! This costs $100.'
      };
      const expectedOutput = '<html><body>Hello & welcome! This costs $100.</body></html>';
      
      mockFs.readFile.mockResolvedValue(templateContent);

      // Act
      const result = await TemplateEngine.render(templatePath, variables);

      // Assert
      expect(result).toBe(expectedOutput);
    });

    it('should handle regex special characters in placeholder names', async () => {
      // Arrange
      const templatePath = 'test-template.html';
      const templateContent = '<html><body>{{test.value}}</body></html>';
      const variables = {
        'test.value': 'Replaced!'
      };
      const expectedOutput = '<html><body>Replaced!</body></html>';
      
      mockFs.readFile.mockResolvedValue(templateContent);

      // Act
      const result = await TemplateEngine.render(templatePath, variables);

      // Assert
      expect(result).toBe(expectedOutput);
    });

    it('should propagate template loading errors', async () => {
      // Arrange
      const templatePath = 'non-existent.html';
      const error = new Error('Template not found');
      mockFs.readFile.mockRejectedValue(error);

      // Act & Assert
      await expect(TemplateEngine.render(templatePath, {})).rejects.toThrow('Template not found');
      expect(logger.error).toHaveBeenCalledWith(
        `Failed to render template: ${templatePath}`,
        expect.any(Error)
      );
    });
  });

  describe('clearCache', () => {
    it('should clear template cache', async () => {
      // Arrange
      const templatePath = 'test-template.html';
      const templateContent = '<html></html>';
      mockFs.readFile.mockResolvedValue(templateContent);
      
      // Load template to cache it
      await TemplateEngine.loadTemplate(templatePath);
      expect(mockFs.readFile).toHaveBeenCalledTimes(1);
      
      // Load again to verify cache is working
      await TemplateEngine.loadTemplate(templatePath);
      expect(mockFs.readFile).toHaveBeenCalledTimes(1); // Still only called once due to cache
      
      // Act
      TemplateEngine.clearCache();
      
      // Load again after clearing cache
      await TemplateEngine.loadTemplate(templatePath);
      
      // Assert
      expect(mockFs.readFile).toHaveBeenCalledTimes(2); // Should be called again after cache clear
    });
  });
});