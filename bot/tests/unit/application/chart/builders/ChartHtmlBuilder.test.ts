import { ChartHtmlBuilder, HtmlStylingPresets } from '../../../../../src/application/chart/builders/ChartHtmlBuilder';
import { ChartData } from '../../../../../src/application/chart/ChartService';

describe('ChartHtmlBuilder', () => {
  const mockChartData: ChartData = {
    labels: ['Label 1', 'Label 2'],
    datasets: [
      {
        label: 'Dataset 1',
        data: [10, 20],
        backgroundColor: '#3366CC',
      },
      {
        label: 'Dataset 2', 
        data: [15, 25],
        backgroundColor: '#DC3912',
      },
    ],
  };

  describe('buildDatasetHeaders', () => {
    it('should build basic headers without styling', () => {
      const result = ChartHtmlBuilder.buildDatasetHeaders(mockChartData);
      expect(result).toBe('<th>Dataset 1</th><th>Dataset 2</th>');
    });

    it('should build headers with advanced styling', () => {
      const result = ChartHtmlBuilder.buildDatasetHeaders(mockChartData, HtmlStylingPresets.ADVANCED);
      expect(result).toBe('<th style="padding: 12px; border: 1px solid #ddd;">Dataset 1</th><th style="padding: 12px; border: 1px solid #ddd;">Dataset 2</th>');
    });
  });

  describe('buildDataRows', () => {
    it('should build basic data rows without styling', () => {
      const result = ChartHtmlBuilder.buildDataRows(mockChartData);
      expect(result).toBe('<tr><td>Label 1</td><td>10</td><td>15</td></tr><tr><td>Label 2</td><td>20</td><td>25</td></tr>');
    });

    it('should build data rows with advanced styling', () => {
      const result = ChartHtmlBuilder.buildDataRows(mockChartData, HtmlStylingPresets.ADVANCED);
      expect(result).toContain('style="padding: 8px; border: 1px solid #ddd; font-weight: bold;"');
      expect(result).toContain('style="padding: 8px; border: 1px solid #ddd; text-align: right;"');
    });
  });

  describe('buildLegend', () => {
    it('should build basic legend without styling', () => {
      const result = ChartHtmlBuilder.buildLegend(mockChartData);
      expect(result).toContain('<div class="legend">');
      expect(result).toContain('<h3>Legend</h3>');
      expect(result).toContain('background-color: #3366CC');
      expect(result).toContain('background-color: #DC3912');
      expect(result).toContain('Dataset 1');
      expect(result).toContain('Dataset 2');
    });

    it('should build legend with advanced styling', () => {
      const result = ChartHtmlBuilder.buildLegend(mockChartData, HtmlStylingPresets.ADVANCED);
      expect(result).toContain('style="margin-top: 20px;"');
      expect(result).toContain('style="display: flex; align-items: center; margin: 5px 0;"');
      expect(result).toContain('width: 20px; height: 20px; margin-right: 10px; border-radius: 3px;');
      expect(result).toContain('style="font-weight: 500;"');
    });
  });

  describe('buildErrorHtml', () => {
    it('should build error HTML with default title', () => {
      const result = ChartHtmlBuilder.buildErrorHtml('Test error');
      expect(result).toBe('<html><body><h1>Error rendering chart</h1><p>Test error</p></body></html>');
    });

    it('should build error HTML with custom title', () => {
      const result = ChartHtmlBuilder.buildErrorHtml('Test error', 'Custom Error Title');
      expect(result).toBe('<html><body><h1>Custom Error Title</h1><p>Test error</p></body></html>');
    });
  });
});