# Product Requirements Document: Discord Chart Generator

## Goals & Objectives

1. **Deliver Relevant Summaries**

   - Provide kill-activity summary charts at both the individual-pilot and overall-group level via Discord.
   - Provide map-activity summary charts at the group level via Discord.
   - Support on-demand generation through simple slash commands.

2. **Success Metrics** (all within three months of launch)
   1. **Reduce manual zKillboard visits by 50%**, as measured by user survey feedback and bot usage logs.
   2. **Increase average weekly map-app engagement by 10%**, as measured by map API usage metrics.
   3. **Increase solo kills (single-pilot engagements) by 10%**, as measured by zKillboard stats.

---

## User Stories

1. **Casual Pilot Carla**

   - As **Carla**, I want to use `/charts kills` to quickly see how my group performed in the recent past.

2. **Fleet Commander Frank**

   - As **Frank**, I want to use `/charts map` to pull real-time activity data so that I can understand where the team has been active.

3. **Logistics Officer Lily**

   - As **Lily**, I want to get a weekly corp-wide solo-kills summary via `/charts kills` so that I can identify top independent pilots and recognize them.

4. **All Roles (On-Demand)**
   - As a **Discord user**, I want simple, consistent commands that are easy to remember and use.
   - As a **Discord user**, I want to be notified if there's no data for a requested period so that I'm not left waiting.

---

## Simplified Command Structure

Our commands follow a "one command, one chart" principle with minimal options:

- **`/charts kills [time]`** - Shows kills by character group (total and solo)
- **`/charts map [time]`** - Shows map activity by character group

Where `time` is an optional parameter that can be either `7` (default) or `24` days.

### Future Commands

- **`/charts deaths [time]`** - Shows deaths by character group (total and solo)
- **`/charts ratio [time]`** - Shows kill-to-death ratio by character group
- **`/charts shiptypes [time]`** - Shows top ship types destroyed
- **`/charts distribution [time]`** - Shows solo vs. small-group vs. large-group kills
- **`/charts hourly [time]`** - Shows kills by hour of day
- **`/charts corps [time]`** - Shows kills by enemy corporation

---

## Functional Requirements

#### FR-1: Data Ingestion & Caching

1. **FR-1.1** Connect to zKillboard API to fetch kill-activity stats for character groups.
2. **FR-1.2** Connect to the Wanderer Map API to fetch:
   - Group map-activity data (jumps, system visits).
   - User→character mappings and the list of tracked characters.
3. **FR-1.3** Cache all API responses for a configurable TTL (5–15 minutes).

#### FR-2: Chart Generation

1. **FR-2.1** Generate stacked horizontal bar charts for kills (total and solo) by character group.
2. **FR-2.2** Generate stacked horizontal bar charts for map activities by character group.
3. **FR-2.3** Export charts as PNG images suitable for Discord embeds.

#### FR-3: Discord Bot Interface

1. **FR-3.1** `/charts kills [time]` → generates kill chart for the specified time period.
2. **FR-3.2** `/charts map [time]` → generates map activity chart for the specified time period.
3. **FR-3.3** Handle invalid inputs or empty datasets with friendly error messages.

---

## Non-Functional Requirements

#### Performance

- **NFR-1.1** Chart generation and delivery must complete within **5 seconds** under typical load.
- **NFR-1.2** Slash-command response time must be under **3 seconds**.

#### Scalability

- **NFR-2.1** Support at least **50 concurrent** on-demand chart requests without degradation.

#### Reliability & Availability

- **NFR-3.1** The bot must maintain **99.9% uptime**.

#### Security

- **NFR-4.1** Store API keys and tokens in environment variables (e.g., `.env`); do not display or log them.
- **NFR-4.2** Validate and sanitize all command inputs to prevent injection attacks.

#### Usability

- **NFR-5.1** Provide clear, concise error messages for every slash command.
- **NFR-5.2** Ensure charts are legible at standard Discord embed sizes (≤ 640 × 360 px).

#### Maintainability

- **NFR-6.1** Codebase should follow a modular structure with unit coverage ≥ 80%.
- **NFR-6.2** Provide CI/CD pipeline with automated linting, tests, and deployment.

#### Monitoring & Logging

- **NFR-7.1** Emit structured logs for every API call, chart-render, command invocation, and delivery event.
- **NFR-7.2** Alert administrators of failures via a designated Discord channel (e.g., `bot-alerts`).

#### Compliance & Rate-Limiting

- **NFR-8.1** Adhere to zKillboard and ESI rate limits (back off on 429s).

---

## Design Considerations

- **Chart Design**

  - Stacked horizontal bar charts for all group comparison views
  - Consistent color scheme (blue for primary metrics, red for secondary)
  - Clear labels and legends
  - Responsive sizing for Discord embeds

- **Discord Embed Design**
  - Max embed size: 640 × 360 px
  - Consistent corporate color palette
  - Footer with generation timestamp & data window

---

## Success Metrics

- **SM-1: zKillboard Visits** – 50% reduction in manual visits within 3 months (compare page views vs. `/charts` usage).
- **SM-2: Map Engagement** – 10% increase in weekly map-app API calls within 3 months.
- **SM-3: Solo Kills** – 10% increase in solo kills within 3 months (zKillboard data).
- **SM-4: Bot Adoption** – 75% of active members invoke `/charts` weekly in first 3 months.

---

## Future Considerations

- **Loss Tracking**: Implement detailed tracking of character losses.
- **Scheduled Reports**: Allow weekly scheduled delivery of charts to designated channels.
- **Additional Chart Types**: Implement the future commands listed above.
- **User Preferences**: Allow users to set default time periods or preferred chart types.
- **Advanced Analytics**: Provide deeper insights through additional metrics and visualizations.
