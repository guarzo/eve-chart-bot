import { Worker, isMainThread, parentPort } from 'worker_threads';
import { createCanvas } from 'canvas';
import { ChartData, ChartOptions } from '../../../types/chart';
import { logger } from '../../../lib/logger';

// Use require() for CommonJS modules with ESM dependencies
// @ts-ignore - Ignoring type checking for Chart.js imports
const chartJS = require('chart.js');
const { Chart, registerables } = chartJS;

export interface ChartWorkerRequest {
  id: string;
  data: ChartData;
  options: ChartOptions;
  width: number;
  height: number;
}

export interface ChartWorkerResponse {
  id: string;
  buffer?: Buffer;
  error?: string;
}

class ChartWorkerManager {
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private pendingTasks = new Map<
    string,
    {
      resolve: (value: Buffer) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  >();
  private workerCount: number;
  private maxWorkers = process.env.CHART_WORKER_COUNT ? parseInt(process.env.CHART_WORKER_COUNT) : 2;

  constructor() {
    this.workerCount = Math.min(this.maxWorkers, require('os').cpus().length);
    this.initializeWorkers();
  }

  private initializeWorkers(): void {
    for (let i = 0; i < this.workerCount; i++) {
      this.createWorker();
    }
  }

  private createWorker(): Worker {
    const worker = new Worker(__filename);

    worker.on('message', (response: ChartWorkerResponse) => {
      const task = this.pendingTasks.get(response.id);
      if (!task) return;

      clearTimeout(task.timeout);
      this.pendingTasks.delete(response.id);
      this.availableWorkers.push(worker);

      if (response.error) {
        task.reject(new Error(response.error));
      } else if (response.buffer) {
        task.resolve(response.buffer);
      } else {
        task.reject(new Error('No buffer received from worker'));
      }
    });

    worker.on('error', error => {
      logger.error('Chart worker error:', error);
      this.handleWorkerError(worker);
    });

    worker.on('exit', code => {
      if (code !== 0) {
        logger.error(`Chart worker exited with code ${code}`);
        this.handleWorkerError(worker);
      }
    });

    this.workers.push(worker);
    this.availableWorkers.push(worker);
    return worker;
  }

  private handleWorkerError(worker: Worker): void {
    // Remove worker from available workers
    const index = this.availableWorkers.indexOf(worker);
    if (index > -1) {
      this.availableWorkers.splice(index, 1);
    }

    // Remove from workers array
    const workerIndex = this.workers.indexOf(worker);
    if (workerIndex > -1) {
      this.workers.splice(workerIndex, 1);
    }

    // Create new worker to replace it
    this.createWorker();
  }

  async renderChart(data: ChartData, options: ChartOptions = {}): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const id = `chart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const timeout = setTimeout(() => {
        this.pendingTasks.delete(id);
        reject(new Error('Chart rendering timeout'));
      }, 30000); // 30 second timeout

      this.pendingTasks.set(id, { resolve, reject, timeout });

      const request: ChartWorkerRequest = {
        id,
        data,
        options,
        width: options.width ?? 800,
        height: options.height ?? 400,
      };

      // Get available worker or wait for one
      if (this.availableWorkers.length > 0) {
        const worker = this.availableWorkers.pop()!;
        worker.postMessage(request);
      } else {
        // All workers busy, queue the request
        setTimeout(() => {
          if (this.availableWorkers.length > 0) {
            const worker = this.availableWorkers.pop()!;
            worker.postMessage(request);
          } else {
            // If still no workers available, reject
            clearTimeout(timeout);
            this.pendingTasks.delete(id);
            reject(new Error('No available workers for chart rendering'));
          }
        }, 1000);
      }
    });
  }

  async destroy(): Promise<void> {
    await Promise.all(this.workers.map(worker => worker.terminate()));
    this.workers = [];
    this.availableWorkers = [];
    this.pendingTasks.clear();
  }
}

// Worker thread code
if (!isMainThread && parentPort) {
  // Register Chart.js components in worker
  Chart.register(...registerables);

  parentPort.on('message', async (request: ChartWorkerRequest) => {
    try {
      const { id, data, options, width, height } = request;

      // Create canvas in worker thread
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      // Set background color
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Create chart configuration
      const config = {
        type: data.displayType || 'bar',
        data: {
          labels: data.labels,
          datasets: data.datasets,
        },
        options: {
          responsive: false,
          maintainAspectRatio: false,
          animation: false, // Disable animations for performance
          plugins: {
            legend: {
              position: 'top' as const,
              labels: {
                color: '#333',
                font: { size: 12 },
              },
            },
            tooltip: {
              backgroundColor: '#ffffff',
              titleColor: '#333',
              bodyColor: '#333',
              borderColor: '#ccc',
              borderWidth: 1,
            },
          },
          scales: {
            x: {
              grid: { color: '#e0e0e0' },
              ticks: { color: '#333', font: { size: 12 } },
            },
            y: {
              grid: { color: '#e0e0e0' },
              ticks: { color: '#333', font: { size: 12 } },
            },
          },
          ...options,
        },
      };

      // Render chart
      const chart = new Chart(canvas as unknown as HTMLCanvasElement, config);
      await chart.render();

      // Convert to buffer
      const buffer = canvas.toBuffer();

      const response: ChartWorkerResponse = { id, buffer };
      parentPort!.postMessage(response);

      // Cleanup
      chart.destroy();
    } catch (error) {
      const response: ChartWorkerResponse = {
        id: request.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      parentPort!.postMessage(response);
    }
  });
}

// Lazy-loaded instance to reduce startup memory usage
let chartWorkerManager: ChartWorkerManager | null = null;

/**
 * Get the chart worker manager instance (lazy initialization)
 * This prevents worker threads from being created during module import
 */
export function getChartWorkerManager(): ChartWorkerManager {
  if (!chartWorkerManager) {
    chartWorkerManager = new ChartWorkerManager();
  }
  return chartWorkerManager;
}

/**
 * Destroy the chart worker manager if it exists
 */
export async function destroyChartWorkerManager(): Promise<void> {
  if (chartWorkerManager) {
    await chartWorkerManager.destroy();
    chartWorkerManager = null;
  }
}
