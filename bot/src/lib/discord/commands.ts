import { SlashCommandBuilder } from 'discord.js';

export const commands = [
  // Add the charts command with simplified subcommands
  new SlashCommandBuilder()
    .setName('charts')
    .setDescription('Generate EVE analytics charts')
    .addSubcommand(subcommand => subcommand.setName('list').setDescription('List all available chart types'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('kills')
        .setDescription('Show kill activity by character group with stacked horizontal bars')
        .addStringOption(option =>
          option
            .setName('time')
            .setDescription('Time period')
            .setRequired(false)
            .addChoices(
              { name: '7 Days', value: '7' },
              { name: '14 Days', value: '14' },
              { name: '30 Days', value: '30' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('map')
        .setDescription('Show map activity by character group with stacked horizontal bars')
        .addStringOption(option =>
          option
            .setName('time')
            .setDescription('Time period')
            .setRequired(false)
            .addChoices(
              { name: '7 Days', value: '7' },
              { name: '24 Days', value: '24' },
              { name: '30 Days', value: '30' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('loss')
        .setDescription('Show ship loss activity by character group')
        .addStringOption(option =>
          option
            .setName('time')
            .setDescription('Time period')
            .setRequired(false)
            .addChoices(
              { name: '7 Days', value: '7' },
              { name: '24 Days', value: '24' },
              { name: '30 Days', value: '30' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('ratio')
        .setDescription('Show kill-death ratio by character group')
        .addStringOption(option =>
          option
            .setName('time')
            .setDescription('Time period')
            .setRequired(false)
            .addChoices(
              { name: '7 Days', value: '7' },
              { name: '24 Days', value: '24' },
              { name: '30 Days', value: '30' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('shipkill')
        .setDescription('Show top ship types destroyed by your group(s)')
        .addStringOption(option =>
          option
            .setName('time')
            .setDescription('Time period')
            .setRequired(false)
            .addChoices(
              { name: '7 Days', value: '7' },
              { name: '24 Days', value: '24' },
              { name: '30 Days', value: '30' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('shiploss')
        .setDescription('Show top ship types lost by your group(s)')
        .addStringOption(option =>
          option
            .setName('time')
            .setDescription('Time period')
            .setRequired(false)
            .addChoices(
              { name: '7 Days', value: '7' },
              { name: '24 Days', value: '24' },
              { name: '30 Days', value: '30' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('distribution')
        .setDescription('Show distribution of solo vs. small-group vs. large-group kills')
        .addStringOption(option =>
          option
            .setName('time')
            .setDescription('Time period')
            .setRequired(false)
            .addChoices(
              { name: '7 Days', value: '7' },
              { name: '24 Days', value: '24' },
              { name: '30 Days', value: '30' }
            )
        )
        .addStringOption(option =>
          option
            .setName('view')
            .setDescription('Chart visualization type')
            .setRequired(false)
            .addChoices(
              { name: 'Pie Chart', value: 'pie' },
              { name: 'Bar Chart', value: 'bar' },
              { name: 'Box Plot', value: 'boxplot' },
              { name: 'Violin Plot', value: 'violin' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('corps')
        .setDescription('Show horizontal bar chart of top enemy corporations')
        .addStringOption(option =>
          option
            .setName('time')
            .setDescription('Time period')
            .setRequired(false)
            .addChoices(
              { name: '7 Days', value: '7' },
              { name: '24 Days', value: '24' },
              { name: '30 Days', value: '30' }
            )
        )
        .addStringOption(option =>
          option
            .setName('view')
            .setDescription('Chart visualization type')
            .setRequired(false)
            .addChoices(
              { name: 'Horizontal Bar', value: 'horizontalBar' },
              { name: 'Vertical Bar', value: 'verticalBar' },
              { name: 'Pie Chart', value: 'pie' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('heatmap')
        .setDescription('Show heatmap of kill activity by hour and day of week')
        .addStringOption(option =>
          option
            .setName('time')
            .setDescription('Time period')
            .setRequired(false)
            .addChoices(
              { name: '7 Days', value: '7' },
              { name: '24 Days', value: '24' },
              { name: '30 Days', value: '30' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('efficiency')
        .setDescription('Show efficiency metrics with gauge charts')
        .addStringOption(option =>
          option
            .setName('time')
            .setDescription('Time period')
            .setRequired(false)
            .addChoices(
              { name: '7 Days', value: '7' },
              { name: '24 Days', value: '24' },
              { name: '30 Days', value: '30' }
            )
        )
    ),
];
