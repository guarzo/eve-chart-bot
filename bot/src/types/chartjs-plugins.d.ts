declare module "chartjs-chart-matrix" {
  type ChartComponent = import("chart.js", { with: { "resolution-mode": "import" } }).ChartComponent;

  export const MatrixController: ChartComponent;
  export const MatrixElement: ChartComponent;
}

declare module "chartjs-plugin-datalabels" {
  type Plugin = import("chart.js", { with: { "resolution-mode": "import" } }).Plugin;

  const plugin: Plugin;
  export default plugin;
}
