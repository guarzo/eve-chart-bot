# EVE Chart Bot Diagnostic Tools

This directory contains diagnostic tools to help troubleshoot issues with the EVE Chart Bot.

## Available Tools

### 1. Check Character Kills

This tool checks kill data for a specific character directly against the database, bypassing the normal chart aggregation logic.

```bash
# Run with default character (Shivon)
npm run check-character-kills

# Run with a specific character ID and time period (in days)
npm run check-character-kills 91522811 30
```

This tool will:

- Check direct kill counts where the character is the main killer
- Check kill counts where the character is in the attackers list
- Query kill data using both the direct database access and repository methods
- Show group information and per-character breakdown within the group

### 2. Check Kills Chart Generation

This tool simulates the kill chart generation process with detailed logging:

```bash
# Run with default group (shivon)
npm run check-kills-chart

# Run with a specific group slug and time period
npm run check-kills-chart "shivon" 14
```

This tool will:

- Find the specified character group
- Count raw kill data directly from the database
- Run the chart generation process with additional logging
- Compare raw database counts with what appears in the chart

### 3. Check Kill Ingestion

This tool tests the kill data ingestion process for a specific character:

```bash
# Run with default character (Shivon)
npm run check-kill-ingestion

# Run with a specific character ID and time period (in days)
npm run check-kill-ingestion 91522811 14
```

This tool will:

- Test direct access to the zKillboard API to see what data is available
- Try multiple API endpoints to determine which ones work
- Run the backfill process for the character
- Compare kill counts before and after ingestion
- Show the most recent kills for the character

### 4. Basic Kill Check (Simpler Alternative)

This tool provides a simplified version of the kill check that only uses direct database queries:

```bash
# Run with default character (Shivon)
npm run basic-kill-check

# Run with a specific character ID and time period (in days)
npm run basic-kill-check 91522811 30
```

This tool will:

- Get direct kill counts from the database without using repository methods
- Show total kills as main killer and as attacker
- Display the most recent kills
- Count unique kills for the character's group
- Skip any repository methods that might be causing errors

Use this tool if the standard check-character-kills script encounters errors.

## Troubleshooting Tips

If you're seeing discrepancies between expected and reported kill counts:

1. **Time Window Issues:** Check if the time windows match between what you're expecting and what the system is using
2. **Kill Attribution:** The system counts kills both as main killer and as participant attacker
3. **Unique Kill Counting:** Look for how unique kills are being counted (the same kill involving multiple characters should only count once per group)
4. **Group Association:** Verify that characters are properly associated with their groups

## Common Problems & Solutions

- **Missing Kills:** If kills are missing, check if data ingest is working correctly
- **Double Counting:** If kills are being double-counted, check for duplicate killmail processing
- **Group Assignment:** If kills are showing up under the wrong group, check character-to-group mappings
