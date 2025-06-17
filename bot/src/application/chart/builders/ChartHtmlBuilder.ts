import { ChartData } from '../ChartService';

/**
 * Centralized HTML builder for chart components
 * Eliminates duplication by providing a single source for HTML generation
 */
export class ChartHtmlBuilder {
  /**
   * Build dataset headers for table
   */
  static buildDatasetHeaders(chartData: ChartData, styling?: HtmlStyling): string {
    const headerStyle = styling?.table?.header;
    const styleAttr = headerStyle ? ` style="${headerStyle}"` : '';
    
    return chartData.datasets
      .map(dataset => `<th${styleAttr}>${dataset.label}</th>`)
      .join('');
  }

  /**
   * Build data rows for table
   */
  static buildDataRows(chartData: ChartData, styling?: HtmlStyling): string {
    const cellStyle = styling?.table?.cell;
    const labelStyle = styling?.table?.labelCell ?? cellStyle;
    
    const cellStyleAttr = cellStyle ? ` style="${cellStyle}"` : '';
    const labelStyleAttr = labelStyle ? ` style="${labelStyle}"` : '';

    return chartData.labels
      .map((label, index) => {
        let row = `<tr><td${labelStyleAttr}>${label}</td>`;
        chartData.datasets.forEach(dataset => {
          row += `<td${cellStyleAttr}>${dataset.data[index]}</td>`;
        });
        row += `</tr>`;
        return row;
      })
      .join('');
  }

  /**
   * Build legend section
   */
  static buildLegend(chartData: ChartData, styling?: HtmlStyling): string {
    const containerStyle = styling?.legend?.container;
    const itemStyle = styling?.legend?.item;
    const colorBoxStyle = styling?.legend?.colorBox;
    const labelStyle = styling?.legend?.label;

    const containerStyleAttr = containerStyle ? ` style="${containerStyle}"` : '';
    const itemStyleAttr = itemStyle ? ` style="${itemStyle}"` : '';
    const colorBoxBaseStyle = colorBoxStyle || '';
    const labelStyleAttr = labelStyle ? ` style="${labelStyle}"` : '';

    let legendSection = `<div class="legend"${containerStyleAttr}><h3>Legend</h3>`;

    chartData.datasets.forEach(dataset => {
      const colors = Array.isArray(dataset.backgroundColor) 
        ? dataset.backgroundColor 
        : [dataset.backgroundColor];

      const colorBoxFullStyle = colorBoxBaseStyle 
        ? `background-color: ${colors[0]}; ${colorBoxBaseStyle}`
        : `background-color: ${colors[0]}`;

      legendSection += `<div class="legend-item"${itemStyleAttr}>
        <div class="color-box" style="${colorBoxFullStyle}"></div>
        <span${labelStyleAttr}>${dataset.label}</span>
      </div>`;
    });

    legendSection += '</div>';
    return legendSection;
  }

  /**
   * Build error HTML
   */
  static buildErrorHtml(error: unknown, title?: string): string {
    const errorTitle = title || 'Error rendering chart';
    return `<html><body><h1>${errorTitle}</h1><p>${error}</p></body></html>`;
  }
}

/**
 * Configuration for HTML styling
 */
export interface HtmlStyling {
  table?: {
    header?: string;
    cell?: string;
    labelCell?: string;
  };
  legend?: {
    container?: string;
    item?: string;
    colorBox?: string;
    label?: string;
  };
}

/**
 * Predefined styling configurations
 */
export class HtmlStylingPresets {
  /**
   * Basic styling (minimal CSS)
   */
  static readonly BASIC: HtmlStyling = {};

  /**
   * Advanced styling (enhanced CSS with borders, padding, etc.)
   */
  static readonly ADVANCED: HtmlStyling = {
    table: {
      header: 'padding: 12px; border: 1px solid #ddd;',
      cell: 'padding: 8px; border: 1px solid #ddd; text-align: right;',
      labelCell: 'padding: 8px; border: 1px solid #ddd; font-weight: bold;',
    },
    legend: {
      container: 'margin-top: 20px;',
      item: 'display: flex; align-items: center; margin: 5px 0;',
      colorBox: 'width: 20px; height: 20px; margin-right: 10px; border-radius: 3px;',
      label: 'font-weight: 500;',
    },
  };
}