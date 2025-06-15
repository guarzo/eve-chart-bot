import { WebSocketKillmail, WebSocketVictim, WebSocketAttacker } from '../../types/websocket';
import { mapWebSocketKillmailToDomain } from '../../shared/mappers/dto.mapper';
import { KillmailDto } from '../../shared/dto/domain.dto';

interface MappedKillData {
  killFact: {
    killmailId: bigint;
    killTime: Date;
    npc: boolean;
    solo: boolean;
    awox: boolean;
    shipTypeId: number;
    systemId: number;
    labels: string[];
    totalValue: bigint;
    points: number;
  };
  victim: {
    characterId?: bigint;
    corporationId?: bigint;
    allianceId?: bigint;
    shipTypeId: number;
    damageTaken: number;
  };
  attackers: Array<{
    characterId?: bigint;
    corporationId?: bigint;
    allianceId?: bigint;
    damageDone: number;
    finalBlow: boolean;
    securityStatus?: number;
    shipTypeId?: number;
    weaponTypeId?: number;
  }>;
  involvedCharacters: Array<{
    characterId: bigint;
    role: 'attacker' | 'victim';
  }>;
}

export class WebSocketDataMapper {
  /**
   * Maps a WebSocket killmail to database entities
   */
  mapKillmail(killmail: WebSocketKillmail): MappedKillData {
    // Map the main kill fact (using camelCase now)
    const killFact: MappedKillData['killFact'] = {
      killmailId: BigInt(killmail.killmail_id),
      killTime: new Date(killmail.kill_time),
      npc: killmail.zkb.npc,
      solo: killmail.zkb.solo,
      awox: killmail.zkb.awox,
      shipTypeId: killmail.victim.ship_type_id,
      systemId: killmail.system_id,
      labels: killmail.zkb.labels ?? [],
      totalValue: BigInt(Math.floor(killmail.zkb.total_value)),
      points: killmail.zkb.points,
    };

    // Map victim data (using camelCase)
    const victim = this.mapVictim(killmail.victim);

    // Map attackers (using camelCase)
    const attackers = killmail.attackers.map(attacker => this.mapAttacker(attacker));

    // Collect all involved characters (using camelCase)
    const involvedCharacters = this.collectInvolvedCharacters(killmail);

    return {
      killFact,
      victim,
      attackers,
      involvedCharacters,
    };
  }

  private mapVictim(victim: WebSocketVictim): MappedKillData['victim'] {
    return {
      characterId: victim.character_id ? BigInt(victim.character_id) : undefined,
      corporationId: victim.corporation_id ? BigInt(victim.corporation_id) : undefined,
      allianceId: victim.alliance_id ? BigInt(victim.alliance_id) : undefined,
      shipTypeId: victim.ship_type_id,
      damageTaken: victim.damage_taken,
    };
  }

  private mapAttacker(attacker: WebSocketAttacker): MappedKillData['attackers'][0] {
    return {
      characterId: attacker.character_id ? BigInt(attacker.character_id) : undefined,
      corporationId: attacker.corporation_id ? BigInt(attacker.corporation_id) : undefined,
      allianceId: attacker.alliance_id ? BigInt(attacker.alliance_id) : undefined,
      damageDone: attacker.damage_done,
      finalBlow: attacker.final_blow,
      securityStatus: attacker.security_status,
      shipTypeId: attacker.ship_type_id,
      weaponTypeId: attacker.weapon_type_id,
    };
  }

  private collectInvolvedCharacters(killmail: WebSocketKillmail): MappedKillData['involvedCharacters'] {
    const characters: MappedKillData['involvedCharacters'] = [];

    // Add victim if it's a character
    if (killmail.victim.character_id) {
      characters.push({
        characterId: BigInt(killmail.victim.character_id),
        role: 'victim',
      });
    }

    // Add all attackers that are characters
    for (const attacker of killmail.attackers) {
      if (attacker.character_id) {
        characters.push({
          characterId: BigInt(attacker.character_id),
          role: 'attacker',
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
    killmailId: bigint;
    characterId: bigint;
    killTime: Date;
    shipTypeId: number;
    systemId: number;
    totalValue: bigint;
    attackerCount: number;
    labels: string[];
  } | null {
    // Check if this character is the victim
    if (killmail.victim.character_id && BigInt(killmail.victim.character_id) === characterId) {
      return {
        killmailId: BigInt(killmail.killmail_id),
        characterId: characterId,
        killTime: new Date(killmail.kill_time),
        shipTypeId: killmail.victim.ship_type_id,
        systemId: killmail.system_id,
        totalValue: BigInt(Math.floor(killmail.zkb.total_value)),
        attackerCount: killmail.attackers.length,
        labels: killmail.zkb.labels ?? [],
      };
    }

    return null;
  }

  /**
   * Maps WebSocket position data to database format
   */
  mapPosition(position?: WebSocketKillmail['position']): any | null {
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

    return victim.items.map(item => ({
      typeId: item.type_id,
      typeName: item.type_name,
      singleton: item.singleton,
      flag: item.flag,
      quantityDropped: item.quantity_dropped,
      quantityDestroyed: item.quantity_destroyed,
    }));
  }
}