/**
 * Configuration for Kill-Death Ratio charts
 */
export const RatioChartConfig = {
  title: 'Kill-Death Ratio by Character Group',
  metrics: [
    { name: 'K/D Ratio', field: 'ratio', color: '#3366CC' },
    { name: 'Efficiency %', field: 'efficiency', color: '#109618' },
  ],
  chartOptions: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;

            if (label.includes('Ratio')) {
              return `${label}: ${value.toFixed(2)}`;
            } else if (label.includes('Efficiency')) {
              return `${label}: ${value.toFixed(1)}%`;
            }
            return `${label}: ${value}`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Character Group',
        },
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Ratio / Percentage',
        },
      },
    },
  },
};
