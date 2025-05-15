import { Chart, ChartConfiguration, registerables } from "chart.js";
import { ChartData, ChartOptions } from "../types/chart";
import { createCanvas } from "canvas";
import { logger } from "../lib/logger";

// Register Chart.js components - conditionally to handle tests
if (typeof Chart.register === "function") {
  Chart.register(...registerables);
}

export class ChartRenderer {
  private width: number;
  private height: number;
  private colors: string[] = [
    "#FF5733", // bright red/orange
    "#33A8FF", // bright blue
    "#33FF57", // bright green
    "#B033FF", // purple
    "#FF33A8", // pink
    "#FFD133", // yellow
    "#33FFD1", // teal
    "#3361FF", // royal blue
    "#FF3361", // rose
    "#61FF33", // lime green
    "#D1FF33", // chartreuse
    "#FF6B33", // orange
    "#33FFA8", // seafoam
    "#A833FF", // violet
    "#FF33D1", // magenta
    "#33D1FF", // light blue
  ];

  constructor(width: number = 1200, height: number = 800) {
    // Larger canvas for more detail
    this.width = width;
    this.height = height;
  }

  async renderToBuffer(
    data: ChartData,
    options: ChartOptions
  ): Promise<Buffer> {
    logger.info(
      `Rendering chart with ${data.datasets.length} datasets and ${data.labels.length} labels`
    );

    // Log the datasets and labels for debugging
    logger.info(`Labels: ${JSON.stringify(data.labels)}`);
    data.datasets.forEach((ds, i) => {
      logger.info(`Dataset ${i} (${ds.label}): ${JSON.stringify(ds.data)}`);
    });

    // Create canvas
    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext("2d");

    // Set background color - dark theme for better visibility
    ctx.fillStyle = "#222222"; // Dark gray background
    ctx.fillRect(0, 0, this.width, this.height);

    // Format y-axis values with K/M/B suffixes
    const formatValue = (value: number): string => {
      if (value >= 1_000_000_000) {
        return (value / 1_000_000_000).toFixed(1) + "B";
      } else if (value >= 1_000_000) {
        return (value / 1_000_000).toFixed(1) + "M";
      } else if (value >= 1_000) {
        return (value / 1_000).toFixed(1) + "K";
      }
      return value.toString();
    };

    // Handle specific colors for horizontal bar chart types
    const isHorizontalBar =
      data.displayType === "horizontalBar" || options.indexAxis === "y";

    if (isHorizontalBar) {
      // For kill charts, ensure solo kills are rendered properly
      if (
        data.datasets.length >= 2 &&
        data.datasets[0].label === "Total Kills" &&
        data.datasets[1].label === "Solo Kills"
      ) {
        // Ensure solo kills data is visible by offsetting it slightly in the chart
        for (let i = 0; i < data.datasets[1].data.length; i++) {
          const value = data.datasets[1].data[i];
          if (typeof value === "number" && value > 0) {
            // Make sure solo kills are at least 1 if they exist, to ensure visibility
            data.datasets[1].data[i] = Math.max(value, 0.5);
          }
        }

        // Use solid colors for clarity in Discord
        // Override any previous colors for simplicity and readability
        data.datasets[0].backgroundColor = "#3366CC"; // Blue for total kills
        data.datasets[1].backgroundColor = "#DC3912"; // Red for solo kills
      }

      // Make sure we don't try to modify color arrays that were already set by generators
      if (
        data.datasets.length > 0 &&
        !Array.isArray(data.datasets[0].backgroundColor)
      ) {
        // Generate alternating colors for datasets
        if (data.datasets.length >= 1) {
          const dataset = data.datasets[0];
          if (dataset.label === "Total Kills") {
            // Generate alternating colors for total kills
            const blueColors = [
              "#3366CC", // primary blue
              "#5588DD", // lighter blue
              "#4477BB", // medium blue
              "#6699EE", // sky blue
            ];

            // Create an array of alternating colors for each data point
            const alternatingColors = dataset.data.map(
              (_, i) => blueColors[i % blueColors.length]
            );

            // Assign the array of colors to the dataset
            dataset.backgroundColor = alternatingColors;
          }
        }

        if (data.datasets.length >= 2) {
          const dataset = data.datasets[1];
          if (dataset.label === "Solo Kills") {
            // Generate alternating colors for solo kills
            const redColors = [
              "#DC3912", // primary red
              "#FF5432", // bright red
              "#CC3311", // dark red
              "#EE4422", // orange-red
            ];

            // Create an array of alternating colors for each data point
            const alternatingColors = dataset.data.map(
              (_, i) => redColors[i % redColors.length]
            );

            // Assign the array of colors to the dataset
            dataset.backgroundColor = alternatingColors;
          }
        }
      }

      if (
        data.datasets.length >= 3 &&
        data.datasets[0].label === "Signatures"
      ) {
        // Map activity chart - use alternating colors for each dataset
        const blueColors = ["#3366CC", "#5588DD", "#4477BB", "#6699EE"];
        const redColors = ["#DC3912", "#FF5432", "#CC3311", "#EE4422"];
        const orangeColors = ["#FF9900", "#FFBB33", "#EE8800", "#FFAA22"];

        // Create arrays of alternating colors for each dataset
        const dataLength = data.datasets[0].data.length;
        const signatureColors = Array(dataLength)
          .fill(0)
          .map((_, i) => blueColors[i % blueColors.length]);
        const anomalyColors = Array(dataLength)
          .fill(0)
          .map((_, i) => redColors[i % redColors.length]);
        const wormholeColors = Array(dataLength)
          .fill(0)
          .map((_, i) => orangeColors[i % orangeColors.length]);

        // Assign the color arrays to the datasets
        data.datasets[0].backgroundColor = signatureColors;
        data.datasets[1].backgroundColor = anomalyColors;
        data.datasets[2].backgroundColor = wormholeColors;
      }
    } else {
      // For other chart types, use the color array with good contrast
      data.datasets = data.datasets.map((dataset, index) => {
        const color = this.colors[index % this.colors.length];
        return {
          ...dataset,
          borderColor: color,
          backgroundColor:
            data.displayType === "bar" || data.displayType === "horizontalBar"
              ? color + "CC"
              : color + "33", // More opacity for bars
          borderWidth: 4, // Even thicker lines for better visibility
          pointRadius: 6, // Larger points
          pointHoverRadius: 9, // Larger hover points
          pointBorderWidth: 2, // Add border to points
          pointBackgroundColor: "#FFFFFF", // White center for points
          pointBorderColor: color, // Color border for points
        };
      });
    }

    // Determine if we should use logarithmic scale
    const flattenedData = data.datasets
      .flatMap((d) => {
        // Handle both number[] and ComplexDataPoint[]
        if (Array.isArray(d.data)) {
          // Check if this is an array of ComplexDataPoint objects
          if (
            d.data.length > 0 &&
            typeof d.data[0] === "object" &&
            d.data[0] !== null
          ) {
            // Extract numeric values from ComplexDataPoint objects
            return d.data.map((item) =>
              typeof item === "object" && item !== null ? (item as any).v : 0
            );
          } else {
            // It's a regular number array
            return d.data.filter((val) => typeof val === "number") as number[];
          }
        }
        return [];
      })
      .filter(Boolean);

    const maxValue =
      flattenedData.length > 0 ? Math.max(...(flattenedData as number[])) : 0;
    const minValue =
      flattenedData.length > 0
        ? Math.min(...(flattenedData.filter((v) => v > 0) as number[]))
        : 0;
    const useLogarithmicScale = maxValue / Math.max(minValue, 1) > 100;

    // For non-horizontal charts (like time series), trim empty data points
    if (!isHorizontalBar) {
      // Trim empty dates - find the first and last indices with data
      let firstIndex = data.labels.length - 1;
      let lastIndex = 0;

      data.datasets.forEach((dataset) => {
        dataset.data.forEach((value, index) => {
          // For complex data points, check for the 'v' property; for numbers, use the value directly
          const hasValue =
            typeof value === "object"
              ? value !== null && (value as any).v
              : Boolean(value);

          if (hasValue) {
            firstIndex = Math.min(firstIndex, index);
            lastIndex = Math.max(lastIndex, index);
          }
        });
      });

      // Add padding of one slot on each side if available
      firstIndex = Math.max(0, firstIndex - 1);
      lastIndex = Math.min(data.labels.length - 1, lastIndex + 1);

      // Trim the data to only show relevant timeframe
      data.labels = data.labels.slice(firstIndex, lastIndex + 1);
      data.datasets = data.datasets.map((dataset) => ({
        ...dataset,
        data: dataset.data.slice(firstIndex, lastIndex + 1),
      }));
    }

    // Set chart type based on displayType
    const chartType =
      data.displayType === "bar" || data.displayType === "horizontalBar"
        ? "bar"
        : "line";

    const config: ChartConfiguration = {
      type: chartType as "line" | "bar", // Force type to be either line or bar
      data: {
        labels: data.labels,
        datasets: data.datasets as any, // Type assertion to bypass strict typing
      },
      options: {
        ...options,
        // For horizontal bar charts, set indexAxis to y if requested
        indexAxis: isHorizontalBar ? "y" : "x",
        animation: false, // Disable animations for server-side rendering
        devicePixelRatio: 2, // Higher resolution
        layout: {
          padding: {
            top: 60,
            right: 80,
            bottom: 60,
            left: isHorizontalBar ? 300 : 80, // Much wider left padding for horizontal bar charts to show labels
          },
        },
        plugins: {
          ...options.plugins,
          legend: {
            position: "top",
            labels: {
              padding: 30,
              boxWidth: 50,
              boxHeight: 10,
              font: {
                size: 32, // Much larger font for legend
                weight: "bold",
              },
              color: "#FFFFFF", // Brighter color for better visibility
              usePointStyle: true,
              filter: (legendItem, data) => {
                // Limit the number of items in the legend to maximum 10
                const index = legendItem.datasetIndex!;
                return index < 10;
              },
            },
            ...options.plugins?.legend,
          },
          title: {
            display: true,
            text: data.title || "",
            font: {
              size: 40, // Much larger title
              weight: "bold",
            },
            color: "#FFFFFF", // Brighter color for better visibility
            padding: { bottom: 40 },
            ...options.plugins?.title,
          },
          tooltip: {
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            titleFont: {
              size: 16,
              weight: "bold",
            },
            bodyFont: {
              size: 14,
            },
            padding: 15,
            ...options.plugins?.tooltip,
          },
        },
        scales: {
          x: {
            ...(options.scales?.x || {}),
            type: isHorizontalBar ? "linear" : "category",
            grid: {
              color: "rgba(255, 255, 255, 0.2)", // Brighter grid lines
              lineWidth: 1.5,
            },
            ticks: {
              ...(options.scales?.x?.ticks || {}),
              font: {
                size: 28, // Larger ticks
                weight: "bold",
              },
              maxRotation: isHorizontalBar ? 0 : 45, // No rotation for horizontal bars
              minRotation: isHorizontalBar ? 0 : 45,
              padding: 20,
              color: "#FFFFFF", // Brighter color for better visibility
              callback:
                options.scales?.x?.ticks?.callback ||
                (isHorizontalBar
                  ? function (value) {
                      return formatValue(Number(value));
                    }
                  : undefined),
            },
            title: {
              display: true,
              text:
                options.scales?.x?.title?.text ||
                (isHorizontalBar ? "Value" : "Date/Time"),
              font: {
                size: 32, // Larger axis title
                weight: "bold",
              },
              color: "#FFFFFF", // Brighter color for better visibility
              padding: { top: 25, bottom: 15 },
            },
          },
          y: {
            ...(options.scales?.y || {}),
            beginAtZero: true,
            type: isHorizontalBar
              ? "category"
              : useLogarithmicScale
              ? "logarithmic"
              : "linear",
            grid: {
              color: "rgba(255, 255, 255, 0.2)", // Brighter grid lines
              lineWidth: 1.5,
            },
            ticks: {
              font: {
                size: isHorizontalBar ? 30 : 24, // Much larger font for horizontal bar labels
                weight: isHorizontalBar ? "bold" : "normal", // Bold for horizontal bar labels
              },
              padding: isHorizontalBar ? 30 : 20, // More padding for horizontal bar labels
              color: "#FFFFFF", // Brighter color for better visibility
              // For horizontal bar charts, limit the number of ticks to avoid overcrowding
              autoSkip: !isHorizontalBar, // Don't skip labels for horizontal bars
              maxTicksLimit: isHorizontalBar ? 50 : 10, // Show more labels for horizontal bars

              // Use actual label text for horizontal bar charts
              callback: isHorizontalBar
                ? function (value) {
                    const index = Number(value);
                    // Use the actual label text, truncate if too long
                    const label = data.labels[index];
                    return label;
                  }
                : undefined,
            },
            title: {
              display: true,
              text:
                options.scales?.y?.title?.text ||
                this.getYAxisLabel(isHorizontalBar),
              font: {
                size: 32,
                weight: "bold",
              },
              color: "#FFFFFF", // Brighter color for better visibility
              padding: { top: 15, bottom: 15 },
            },
          },
        },
      },
    };

    // Create chart
    try {
      const chart = new Chart(ctx as any, config);

      // Render the chart
      logger.info("Rendering chart to buffer");

      // Convert to buffer
      return canvas.toBuffer("image/png");
    } catch (error) {
      logger.error("Error rendering chart:", error);
      // Create a simple error image
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.font = "30px Arial";
      ctx.fillStyle = "#FF0000";
      ctx.textAlign = "center";
      ctx.fillText("Error rendering chart", this.width / 2, this.height / 2);
      return canvas.toBuffer("image/png");
    }
  }

  private getYAxisLabel(isHorizontalBar: boolean): string {
    if (isHorizontalBar) {
      return "Character Group";
    }
    return "Value";
  }

  async renderToBase64(
    data: ChartData,
    options: ChartOptions
  ): Promise<string> {
    const buffer = await this.renderToBuffer(data, options);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  }
}
