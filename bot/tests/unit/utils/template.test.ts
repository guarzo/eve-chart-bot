import { TemplateEngine } from "../../../src/utils/template";
import { promises as fs } from "fs";
import * as path from "path";

// Mock the logger
jest.mock("../../../src/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe("TemplateEngine", () => {
  const testTemplatePath = "test.html";
  const mockTemplateContent = "<h1>{{title}}</h1><p>{{content}}</p>";
  const mockFullPath = path.resolve(
    __dirname,
    "../../../src/application/chart/templates",
    testTemplatePath
  );

  beforeEach(() => {
    // Clear cache before each test
    TemplateEngine.clearCache();
    jest.clearAllMocks();
  });

  describe("loadTemplate", () => {
    it("should load template from filesystem", async () => {
      jest.spyOn(fs, "readFile").mockResolvedValue(mockTemplateContent);

      const result = await TemplateEngine.loadTemplate(testTemplatePath);

      expect(result).toBe(mockTemplateContent);
      expect(fs.readFile).toHaveBeenCalledWith(mockFullPath, "utf8");
    });

    it("should cache loaded templates", async () => {
      jest.spyOn(fs, "readFile").mockResolvedValue(mockTemplateContent);

      // First load
      await TemplateEngine.loadTemplate(testTemplatePath);
      // Second load
      const result = await TemplateEngine.loadTemplate(testTemplatePath);

      expect(result).toBe(mockTemplateContent);
      expect(fs.readFile).toHaveBeenCalledTimes(1); // Only called once due to caching
    });

    it("should handle concurrent loads of the same template", async () => {
      let resolveRead: (value: string) => void;
      const readPromise = new Promise<string>((resolve) => {
        resolveRead = resolve;
      });
      jest.spyOn(fs, "readFile").mockReturnValue(readPromise as any);

      // Start two concurrent loads
      const load1 = TemplateEngine.loadTemplate(testTemplatePath);
      const load2 = TemplateEngine.loadTemplate(testTemplatePath);

      // Resolve the read
      resolveRead!(mockTemplateContent);

      const [result1, result2] = await Promise.all([load1, load2]);

      expect(result1).toBe(mockTemplateContent);
      expect(result2).toBe(mockTemplateContent);
      expect(fs.readFile).toHaveBeenCalledTimes(1); // Only one actual read
    });

    it("should throw error for non-existent template", async () => {
      const error = new Error("ENOENT: no such file or directory");
      jest.spyOn(fs, "readFile").mockRejectedValue(error);

      await expect(
        TemplateEngine.loadTemplate("nonexistent.html")
      ).rejects.toThrow("Template not found: nonexistent.html");
    });
  });

  describe("render", () => {
    it("should render template with variables", async () => {
      jest.spyOn(fs, "readFile").mockResolvedValue(mockTemplateContent);

      const variables = {
        title: "Test Title",
        content: "Test Content",
      };

      const result = await TemplateEngine.render(testTemplatePath, variables);

      expect(result).toBe("<h1>Test Title</h1><p>Test Content</p>");
    });

    it("should handle missing variables by leaving placeholders", async () => {
      jest.spyOn(fs, "readFile").mockResolvedValue(mockTemplateContent);

      const variables = {
        title: "Test Title",
        // content is missing
      };

      const result = await TemplateEngine.render(testTemplatePath, variables);

      expect(result).toBe("<h1>Test Title</h1><p>{{content}}</p>");
    });

    it("should replace multiple occurrences of the same variable", async () => {
      const templateWithDuplicates = "<p>{{name}}</p><p>Hello {{name}}!</p>";
      jest.spyOn(fs, "readFile").mockResolvedValue(templateWithDuplicates);

      const variables = {
        name: "World",
      };

      const result = await TemplateEngine.render(testTemplatePath, variables);

      expect(result).toBe("<p>World</p><p>Hello World!</p>");
    });
  });

  describe("clearCache", () => {
    it("should clear the template cache", async () => {
      jest.spyOn(fs, "readFile").mockResolvedValue(mockTemplateContent);

      // Load template to populate cache
      await TemplateEngine.loadTemplate(testTemplatePath);
      expect(fs.readFile).toHaveBeenCalledTimes(1);

      // Clear cache
      TemplateEngine.clearCache();

      // Load again - should read from filesystem
      await TemplateEngine.loadTemplate(testTemplatePath);
      expect(fs.readFile).toHaveBeenCalledTimes(2);
    });
  });
});