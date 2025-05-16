import { Command } from "commander";
import checkMainCharacters from "./check-main-characters";

const program = new Command();

program.name("character").description("Character management commands");

program.addCommand(checkMainCharacters);

export default program;
