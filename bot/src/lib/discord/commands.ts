import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export const commands = [
  // Add the charts command with simplified subcommands
  new SlashCommandBuilder()
    .setName("charts")
    .setDescription("Generate EVE analytics charts")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("List all available chart types")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("kills")
        .setDescription(
          "Show kill activity by character group with stacked horizontal bars"
        )
        .addStringOption((option) =>
          option
            .setName("time")
            .setDescription("Time period")
            .setRequired(false)
            .addChoices(
              { name: "7 Days", value: "7" },
              { name: "24 Days", value: "24" },
              { name: "30 Days", value: "30" }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("map")
        .setDescription(
          "Show map activity by character group with stacked horizontal bars"
        )
        .addStringOption((option) =>
          option
            .setName("time")
            .setDescription("Time period")
            .setRequired(false)
            .addChoices(
              { name: "7 Days", value: "7" },
              { name: "24 Days", value: "24" },
              { name: "30 Days", value: "30" }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("loss")
        .setDescription("Show ship loss activity by character group")
        .addStringOption((option) =>
          option
            .setName("time")
            .setDescription("Time period")
            .setRequired(false)
            .addChoices(
              { name: "7 Days", value: "7" },
              { name: "24 Days", value: "24" },
              { name: "30 Days", value: "30" }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("ratio")
        .setDescription("Show kill-death ratio by character group")
        .addStringOption((option) =>
          option
            .setName("time")
            .setDescription("Time period")
            .setRequired(false)
            .addChoices(
              { name: "7 Days", value: "7" },
              { name: "24 Days", value: "24" },
              { name: "30 Days", value: "30" }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("shiptypes")
        .setDescription("Show top ship types destroyed (by count)")
        .addStringOption((option) =>
          option
            .setName("time")
            .setDescription("Time period")
            .setRequired(false)
            .addChoices(
              { name: "7 Days", value: "7" },
              { name: "24 Days", value: "24" },
              { name: "30 Days", value: "30" }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("distribution")
        .setDescription(
          "Show distribution of solo vs. small-group vs. large-group kills"
        )
        .addStringOption((option) =>
          option
            .setName("time")
            .setDescription("Time period")
            .setRequired(false)
            .addChoices(
              { name: "7 Days", value: "7" },
              { name: "24 Days", value: "24" },
              { name: "30 Days", value: "30" }
            )
        )
        .addStringOption((option) =>
          option
            .setName("view")
            .setDescription("Chart visualization type")
            .setRequired(false)
            .addChoices(
              { name: "Pie Chart", value: "pie" },
              { name: "Doughnut Chart", value: "doughnut" },
              { name: "Bar Chart", value: "bar" }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("corps")
        .setDescription("Show horizontal bar chart of top enemy corporations")
        .addStringOption((option) =>
          option
            .setName("time")
            .setDescription("Time period")
            .setRequired(false)
            .addChoices(
              { name: "7 Days", value: "7" },
              { name: "24 Days", value: "24" },
              { name: "30 Days", value: "30" }
            )
        )
        .addStringOption((option) =>
          option
            .setName("view")
            .setDescription("Chart visualization type")
            .setRequired(false)
            .addChoices(
              { name: "Horizontal Bar", value: "horizontalBar" },
              { name: "Vertical Bar", value: "verticalBar" },
              { name: "Pie Chart", value: "pie" }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("trend")
        .setDescription("Show line chart of kills over time")
        .addStringOption((option) =>
          option
            .setName("time")
            .setDescription("Time period")
            .setRequired(false)
            .addChoices(
              { name: "7 Days", value: "7" },
              { name: "24 Days", value: "24" },
              { name: "30 Days", value: "30" }
            )
        )
        .addStringOption((option) =>
          option
            .setName("view")
            .setDescription("Chart visualization type")
            .setRequired(false)
            .addChoices(
              { name: "Line Chart", value: "line" },
              { name: "Area Chart", value: "area" },
              { name: "Dual-Axis (Kills & Value)", value: "dual" }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("heatmap")
        .setDescription("Show heatmap of kill activity by hour and day of week")
        .addStringOption((option) =>
          option
            .setName("time")
            .setDescription("Time period")
            .setRequired(false)
            .addChoices(
              { name: "7 Days", value: "7" },
              { name: "24 Days", value: "24" },
              { name: "30 Days", value: "30" }
            )
        )
        .addStringOption((option) =>
          option
            .setName("view")
            .setDescription("Chart visualization type")
            .setRequired(false)
            .addChoices(
              { name: "Matrix View", value: "matrix" },
              { name: "Calendar View", value: "calendar" }
            )
        )
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.SendMessages | PermissionFlagsBits.ViewChannel
    ),
];
