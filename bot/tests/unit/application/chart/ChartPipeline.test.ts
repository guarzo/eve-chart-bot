import { ChartPipeline, IChartDataProvider, IChartRenderer } from '../../../../src/application/chart/pipeline/ChartPipeline';
import { ChartData, ChartOptions } from '../../../../src/application/chart/ChartService';

// Mock data provider
class MockDataProvider implements IChartDataProvider {
  async generateChartData(config: any): Promise<ChartData | null> {
    if (config.shouldFail) {
      throw new Error('Mock data provider error');
    }
    
    if (config.returnNull) {
      return null;
    }

    return {
      labels: ['Test 1', 'Test 2'],
      datasets: [{
        label: 'Test Dataset',
        data: [10, 20],
        backgroundColor: '#FF6384',
      }],
    };
  }
}

// Mock renderer
class MockRenderer implements IChartRenderer {
  async renderPNG(chartData: ChartData, options?: Partial<ChartOptions>): Promise<Buffer | null> {
    if (options?.title === 'fail') {
      throw new Error('Mock renderer PNG error');
    }
    
    if (options?.title === 'null') {
      return null;
    }

    return Buffer.from(`PNG:${chartData.labels.join(',')}`);
  }

  async renderHTML(chartData: ChartData, options?: Partial<ChartOptions>): Promise<string> {
    if (options?.title === 'fail') {
      throw new Error('Mock renderer HTML error');
    }

    return `<html><body><h1>${chartData.labels.join(',')}</h1></body></html>`;
  }
}

describe('ChartPipeline', () => {
  let pipeline: ChartPipeline;
  let mockDataProvider: MockDataProvider;
  let mockRenderer: MockRenderer;

  beforeEach(() => {
    mockDataProvider = new MockDataProvider();
    mockRenderer = new MockRenderer();
    pipeline = new ChartPipeline(mockDataProvider, mockRenderer);
  });

  describe('generateData', () => {
    it('should generate chart data successfully', async () => {
      const config = { characterId: 'test-123', days: 30 };
      const result = await pipeline.generateData(config);

      expect(result).toBeDefined();
      expect(result?.labels).toEqual(['Test 1', 'Test 2']);
      expect(result?.datasets[0].data).toEqual([10, 20]);
    });

    it('should return null when data provider returns null', async () => {
      const config = { returnNull: true };
      const result = await pipeline.generateData(config);

      expect(result).toBeNull();
    });

    it('should throw error when data provider fails', async () => {
      const config = { shouldFail: true };
      
      await expect(pipeline.generateData(config)).rejects.toThrow('Mock data provider error');
    });
  });

  describe('renderPNG', () => {
    const mockChartData: ChartData = {
      labels: ['A', 'B'],
      datasets: [{
        label: 'Test',
        data: [1, 2],
        backgroundColor: '#FF0000',
      }],
    };

    it('should render PNG successfully', async () => {
      const result = await pipeline.renderPNG(mockChartData);

      expect(result).toBeDefined();
      expect(result?.toString()).toBe('PNG:A,B');
    });

    it('should return null when renderer returns null', async () => {
      const result = await pipeline.renderPNG(mockChartData, { title: 'null' });

      expect(result).toBeNull();
    });

    it('should throw error when renderer fails', async () => {
      await expect(
        pipeline.renderPNG(mockChartData, { title: 'fail' })
      ).rejects.toThrow('Mock renderer PNG error');
    });
  });

  describe('renderHTML', () => {
    const mockChartData: ChartData = {
      labels: ['X', 'Y'],
      datasets: [{
        label: 'Test',
        data: [5, 10],
        backgroundColor: '#00FF00',
      }],
    };

    it('should render HTML successfully', async () => {
      const result = await pipeline.renderHTML(mockChartData);

      expect(result).toBe('<html><body><h1>X,Y</h1></body></html>');
    });

    it('should throw error when renderer fails', async () => {
      await expect(
        pipeline.renderHTML(mockChartData, { title: 'fail' })
      ).rejects.toThrow('Mock renderer HTML error');
    });
  });

  describe('generateAndRenderPNG', () => {
    it('should complete full pipeline successfully', async () => {
      const config = { characterId: 'test-456', days: 7 };
      const result = await pipeline.generateAndRenderPNG(config);

      expect(result).toBeDefined();
      expect(result?.toString()).toBe('PNG:Test 1,Test 2');
    });

    it('should return null when data generation returns null', async () => {
      const config = { returnNull: true };
      const result = await pipeline.generateAndRenderPNG(config);

      expect(result).toBeNull();
    });

    it('should handle data generation errors', async () => {
      const config = { shouldFail: true };
      
      await expect(pipeline.generateAndRenderPNG(config)).rejects.toThrow('Mock data provider error');
    });

    it('should handle rendering errors', async () => {
      const config = { characterId: 'test-789' };
      const options = { title: 'fail' };
      
      await expect(pipeline.generateAndRenderPNG(config, options)).rejects.toThrow('Mock renderer PNG error');
    });
  });

  describe('generateAndRenderHTML', () => {
    it('should complete full pipeline successfully', async () => {
      const config = { groupId: 'group-123', days: 14 };
      const result = await pipeline.generateAndRenderHTML(config);

      expect(result).toBe('<html><body><h1>Test 1,Test 2</h1></body></html>');
    });

    it('should return null when data generation returns null', async () => {
      const config = { returnNull: true };
      const result = await pipeline.generateAndRenderHTML(config);

      expect(result).toBeNull();
    });

    it('should handle data generation errors', async () => {
      const config = { shouldFail: true };
      
      await expect(pipeline.generateAndRenderHTML(config)).rejects.toThrow('Mock data provider error');
    });

    it('should handle rendering errors', async () => {
      const config = { groupId: 'group-456' };
      const options = { title: 'fail' };
      
      await expect(pipeline.generateAndRenderHTML(config, options)).rejects.toThrow('Mock renderer HTML error');
    });
  });
});