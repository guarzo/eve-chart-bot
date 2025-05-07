# Product Requirements Document: Discord Chart Generator

## Goals & Objectives
1. **Deliver Relevant Summaries**  
   - Provide kill-activity summary charts at both the individual-pilot and overall-group level via Discord.  
   - Provide map-activity summary charts at the individual-pilot level via Discord.  
   - Support both scheduled delivery (daily or weekly) and on-demand generation through slash commands.

2. **Success Metrics** (all within three months of launch)  
   1. **Reduce manual zKillboard visits by 50%**, as measured by user survey feedback and bot usage logs.  
   2. **Increase average weekly map-app engagement by 10%**, as measured by map API usage metrics.  
   3. **Increase solo kills (single-pilot engagements) by 10%**, as measured by zKillboard stats.

---

## User Stories

1. **Casual Pilot Carla**  
   - As **Carla**, I want to receive a weekly personal kill-activity chart via Discord so that I can track my progress and celebrate milestones.  
   - As **Carla**, I want to use `/charts kills --pilot <myID> --period 24h` to get on-demand stats so that I can quickly see how I performed in the last day.

2. **Fleet Commander Frank**  
   - As **Frank**, I want to receive a daily group kill-count overview so that I can brief the fleet before ops.  
   - As **Frank**, I want to use `/charts map-activity --pilot all --period <range>` to pull real-time activity heatmaps so that I can spot chokepoints and optimize routing.

3. **Logistics Officer Lily**  
   - As **Lily**, I want to get a weekly corp-wide solo-kills summary so that I can identify top independent pilots and recognize them.  
   - As **Lily**, I want to receive a weekly map-engagement chart showing new vs. veteran pilot activity so that I can measure onboarding success.

4. **All Roles (On-Demand)**  
   - As a **Discord user**, I want to use `/charts list` to see available chart types and their parameters so that I know how to request the right report.  
   - As a **Discord user**, I want to be notified if there’s no data for a requested period so that I’m not left waiting.

5. **App Administrator**  
   - As the **App Admin**, I want to configure which chart types support scheduling and define default send times so that users get consistent, automated reports.  
   - As the **App Admin**, I want to manage scheduling permissions so that only authorized roles can set up scheduled deliveries.  
   - As the **App Admin**, I want to control which Discord channels receive each chart type so that information reaches the right audience.

---

## Functional Requirements

#### FR-1: Data Ingestion & Caching  
1. **FR-1.1** Connect to zKillboard API to fetch kill-activity stats for one or more character IDs.  
2. **FR-1.2** Connect to the Wanderer Map API to fetch:  
   - Pilot map-activity data (jumps, system visits).  
   - User→character mappings and the list of tracked characters.  
3. **FR-1.3** Optionally fall back to EVE ESI for missing metadata (pilot names, ship types).  
4. **FR-1.4** Cache all API responses for a configurable TTL (5–15 minutes).

#### FR-2: Chart Generation  
1. **FR-2.1** Generate time-series charts (via Chart.js) for kill counts per pilot over arbitrary windows (24 h, 7 days, etc.).  
2. **FR-2.2** Generate aggregate group-level kill summary charts (total kills per day).  
3. **FR-2.3** Generate time-series charts for pilot-centric map activity (jumps over time, system visits).  
4. **FR-2.4** Export charts as PNG images suitable for Discord embeds.

#### FR-3: Discord Bot Interface  
1. **FR-3.1** `/charts list` → returns available chart types, required parameters, and examples.  
2. **FR-3.2** `/charts <type> [--pilot <id>|all] [--period <range>]` → generates the requested chart.  
3. **FR-3.3** For scheduled charts, send embeds to pre-configured channels or DMs.  
4. **FR-3.4** Handle invalid inputs or empty datasets with friendly error messages.

#### FR-4: Scheduling & Automation (Admin-Controlled)  
1. **FR-4.1** Allow the App Admin to schedule any chart type on a daily or weekly cadence.  
2. **FR-4.2** Persist admin-defined schedules (including target channel per chart).  
3. **FR-4.3** Execute scheduled jobs automatically at the configured times and deliver charts to target channels or DMs.  
4. **FR-4.4** Allow the App Admin to list, update, or cancel scheduled jobs via Admin UI or bot commands.

#### FR-5: Administration & Configuration  
1. **FR-5.1** Admin UI or config file to:  
   - Enable/disable specific chart types for scheduling.  
   - Define global default send times for each chart.  
2. **FR-5.2** Control which Discord channels receive each chart type.  
3. **FR-5.3** View logs of recent scheduled deliveries and failures.

---

## Non-Functional Requirements

#### Performance  
- **NFR-1.1** Chart generation and delivery must complete within **5 seconds** under typical load.  
- **NFR-1.2** Slash-command response time must be under **3 seconds**.

#### Scalability  
- **NFR-2.1** Support at least **50 concurrent** on-demand chart requests without degradation.  
- **NFR-2.2** Handle scheduling of up to **500 daily** and **200 weekly** jobs.

#### Reliability & Availability  
- **NFR-3.1** The bot and scheduling service must maintain **99.9% uptime**.  
- **NFR-3.2** Scheduled jobs must retry once on failure, then alert admins.

#### Security  
- **NFR-4.1** Store API keys and tokens in environment variables (e.g., `.env`); do not display or log them.  
- **NFR-4.2** Validate and sanitize all command inputs to prevent injection attacks.  
- **NFR-4.3** Restrict admin commands to authorized Discord roles.

#### Usability  
- **NFR-5.1** Provide clear, concise error messages and help text for every slash command.  
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

## Design Considerations / Mockups
- **Technology Stack**  
  - Frontend: React + Vite for Admin UI; Chart.js for rendering.  
  - Bot Backend: Node.js with discord.js for commands, scheduling, embeds.  
  - Caching: In-memory or Redis for API TTL.  
  - Config: 12-factor app pattern using `.env`.

- **UX & Wireframes**  
  1. `/charts list` → embed listing charts & parameters  
  2. `/charts <type> --pilot all --period 7d` → loading indicator, then chart embed  
  - **Admin UI**:  
    - Schedule Management: table of jobs with Edit/Cancel  
    - Chart Configuration: toggles, default times, channel selectors  
  - **Mockups Needed**: slash-command help embed; admin schedule list; chart config form.

- **Discord Embed Design**  
  - Max embed size: 640 × 360 px  
  - Consistent corporate color palette  
  - Footer with generation timestamp & data window

- **Extensibility**  
  - Plugin-style chart definitions (data fetch, chart options, command mapping)  
  - Scalable Admin UI components

---

## Success Metrics
- **SM-1: zKillboard Visits** – 50% reduction in manual visits within 3 months (compare page views vs. `/charts` usage).  
- **SM-2: Map Engagement** – 10% increase in weekly map-app API calls within 3 months.  
- **SM-3: Solo Kills** – 10% increase in solo kills within 3 months (zKillboard data).  
- **SM-4: Bot Adoption** – 75% of active members invoke `/charts` weekly in first 3 months.  
- **SM-5: Scheduling Uptake** – 80% of Admins set up scheduled reports within 1 month of launch.

---

## Open Questions / Future Considerations
- **Multi-Corp Support**: Out of scope; focus on character groups now.  
- **Data Retention**: No raw data retention; rely on source APIs.  
- **Timezones**: Use GMT only.  
- **Advanced Charts**: Plan support for dual-axis, heatmaps, streaming in future.  
- **ESI Fallback**: TBD per chart need.  
- **Permissions**: More granularity in future.  
- **CDN**: No CDN planned at launch.  
- **i18n**: No multi-language support planned.  
