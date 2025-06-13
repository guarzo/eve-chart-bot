import {
  WebSocketKillmail,
  WebSocketVictim,
  WebSocketAttacker,
} from "../../types/websocket";
import { KillFact } from "@prisma/client";

interface MappedKillData {
  killFact: Omit<KillFact, "killmail_id"> & { killmail_id: bigint };
  victim: {
    character_id?: bigint;
    corporation_id?: bigint;
    alliance_id?: bigint;
    ship_type_id: number;
    damage_taken: number;
  };
  attackers: Array<{
    character_id?: bigint;
    corporation_id?: bigint;
    alliance_id?: bigint;
    damage_done: number;
    final_blow: boolean;
    security_status?: number;
    ship_type_id?: number;
    weapon_type_id?: number;
  }>;
  involvedCharacters: Array<{
    character_id: bigint;
    role: "attacker" | "victim";
  }>;
}

export class WebSocketDataMapper {
  /**
   * Maps a WebSocket killmail to database entities
   */
  mapKillmail(killmail: WebSocketKillmail): MappedKillData {
    // Map the main kill fact
    const killFact: MappedKillData["killFact"] = {
      killmail_id: BigInt(killmail.killmail_id),
      kill_time: new Date(killmail.kill_time),
      npc: killmail.zkb.npc,
      solo: killmail.zkb.solo,
      awox: killmail.zkb.awox,
      ship_type_id: killmail.victim.ship_type_id,
      system_id: killmail.system_id,
      labels: killmail.zkb.labels || [],
      total_value: BigInt(Math.floor(killmail.zkb.total_value)),
      points: killmail.zkb.points,
    };

    // Map victim data
    const victim = this.mapVictim(killmail.victim);

    // Map attackers
    const attackers = killmail.attackers.map((attacker) => this.mapAttacker(attacker));

    // Collect all involved characters
    const involvedCharacters = this.collectInvolvedCharacters(killmail);

    return {
      killFact,
      victim,
      attackers,
      involvedCharacters,
    };
  }

  private mapVictim(victim: WebSocketVictim): MappedKillData["victim"] {
    return {
      character_id: victim.character_id ? BigInt(victim.character_id) : undefined,
      corporation_id: victim.corporation_id ? BigInt(victim.corporation_id) : undefined,
      alliance_id: victim.alliance_id ? BigInt(victim.alliance_id) : undefined,
      ship_type_id: victim.ship_type_id,
      damage_taken: victim.damage_taken,
    };
  }

  private mapAttacker(attacker: WebSocketAttacker): MappedKillData["attackers"][0] {
    return {
      character_id: attacker.character_id ? BigInt(attacker.character_id) : undefined,
      corporation_id: attacker.corporation_id ? BigInt(attacker.corporation_id) : undefined,
      alliance_id: attacker.alliance_id ? BigInt(attacker.alliance_id) : undefined,
      damage_done: attacker.damage_done,
      final_blow: attacker.final_blow,
      security_status: attacker.security_status,
      ship_type_id: attacker.ship_type_id,
      weapon_type_id: attacker.weapon_type_id,
    };
  }

  private collectInvolvedCharacters(
    killmail: WebSocketKillmail
  ): MappedKillData["involvedCharacters"] {
    const characters: MappedKillData["involvedCharacters"] = [];

    // Add victim if it's a character
    if (killmail.victim.character_id) {
      characters.push({
        character_id: BigInt(killmail.victim.character_id),
        role: "victim",
      });
    }

    // Add all attackers that are characters
    for (const attacker of killmail.attackers) {
      if (attacker.character_id) {
        characters.push({
          character_id: BigInt(attacker.character_id),
          role: "attacker",
        });
      }
    }

    return characters;
  }

  /**
   * Extracts loss data for a specific character from a killmail
   */
  extractLossForCharacter(
    killmail: WebSocketKillmail,
    characterId: bigint
  ): {
    killmail_id: bigint;
    character_id: bigint;
    kill_time: Date;
    ship_type_id: number;
    system_id: number;
    total_value: bigint;
    attacker_count: number;
    labels: string[];
  } | null {
    // Check if this character is the victim
    if (killmail.victim.character_id && BigInt(killmail.victim.character_id) === characterId) {
      return {
        killmail_id: BigInt(killmail.killmail_id),
        character_id: characterId,
        kill_time: new Date(killmail.kill_time),
        ship_type_id: killmail.victim.ship_type_id,
        system_id: killmail.system_id,
        total_value: BigInt(Math.floor(killmail.zkb.total_value)),
        attacker_count: killmail.attackers.length,
        labels: killmail.zkb.labels || [],
      };
    }

    return null;
  }

  /**
   * Maps WebSocket position data to database format
   */
  mapPosition(position?: WebSocketKillmail["position"]): any | null {
    if (!position) {
      return null;
    }

    return {
      x: position.x,
      y: position.y,
      z: position.z,
    };
  }

  /**
   * Maps item data from victim (if needed in the future)
   */
  mapItems(victim: WebSocketVictim): any[] | null {
    if (!victim.items || victim.items.length === 0) {
      return null;
    }

    return victim.items.map((item) => ({
      type_id: item.type_id,
      type_name: item.type_name,
      singleton: item.singleton,
      flag: item.flag,
      quantity_dropped: item.quantity_dropped,
      quantity_destroyed: item.quantity_destroyed,
    }));
  }
}