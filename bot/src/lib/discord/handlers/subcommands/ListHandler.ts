import { BaseChartHandler } from "./BaseChartHandler";
import { CommandInteraction, EmbedBuilder } from "discord.js";
import { logger } from "../../../logger";

/**
 * Handler for the /charts list command
 * Displays a list of all available chart types
 */
export class ListHandler extends BaseChartHandler {
  constructor() {
    super();
  }

  /**
   * Handle the list command interaction
   */
  async handle(interaction: CommandInteraction): Promise<void> {
    try {
      logger.info("Handling list subcommand");

      // Create an embed for the list of charts
      const embed = new EmbedBuilder()
        .setTitle("Available Chart Types")
        .setColor("#0099ff")
        .setDescription("Here are all the available chart types:")
        .addFields(
          {
            name: "📊 /charts kills [time]",
            value:
              "Show kill activity by character group with stacked horizontal bars",
          },
          {
            name: "🗺️ /charts map [time]",
            value:
              "Show map activity by character group with stacked horizontal bars",
          },
          {
            name: "💥 /charts loss [time]",
            value: "Show ship loss activity by character group",
          },
          {
            name: "📈 /charts ratio [time]",
            value: "Show kill-death ratio by character group",
          }
        )
        .setFooter({
          text: "Use the specific command to generate that chart type",
        });

      await interaction.reply({ embeds: [embed] });
      logger.info("Successfully sent list of chart types");
    } catch (error) {
      logger.error("Error handling list command:", error);

      // Send a generic error message to the user
      await interaction
        .reply({
          content:
            "Sorry, there was an error processing your request. Please try again later.",
          ephemeral: true,
        })
        .catch((e) => {
          logger.error("Error sending error response:", e);
        });
    }
  }
}
