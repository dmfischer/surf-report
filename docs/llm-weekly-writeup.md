# Plan: LLM-generated weekly write-up

Status: planned, not started (updated 2026-11-23).

Goal: one short, readable outlook for the coming week covering **all the spots in the region**, e.g. *"Flat until Thursday, when Matunuck is the best bet at dawn before the wind turns onshore."* An LLM writes it from the data the app already has. It's generated when the server starts and refreshed three times a day, at **4 am, 12 pm and 8 pm** local time.

## Main design principles

- **The server builds the entire prompt from our own data, and nobody else can add to it.** No user input ever reaches the model. That keeps the output grounded and rules out prompt injection.
- **Users never trigger a model call.** The write-up is generated on a schedule and stored, and the endpoint only returns the stored result. That fixes the cost and removes the abuse risk for the API key.

## The region

For now there is one region, **South County**, containing **all the spots** in `data/spots.ts` (currently five, in and around Narragansett, RI). It's a single name constant, with no `regionId` on spots yet.

Future addition: a `regionId` on each spot plus a `data/regions.ts` (id, name, time zone) once spots exist outside South County. The generator would then run once per region, and everything below would apply per region unchanged.

## 1. What data to give the model

Send a summary, not the raw arrays. Each spot's conditions are 169 hours × 4 series, which is mostly noise to the model, and it would be doing arithmetic it can get wrong. Reduce the data first in plain, tested code.

**Our code does the judging (ratings, offshore/onshore, tide times); the model only explains it and compares spots.** That plays to what an LLM is good at (a clear summary, choosing between spots) and keeps it away from what it's bad at (arithmetic over long series of numbers).

The server fetches the data itself at generation time, by calling `getSpotConditions` for every spot, so it doesn't depend on any client request.

Contents, as compact JSON. Roughly 2k tokens per spot, so about 10k for five spots:

- **Region framing**
  - region name, today's date, and the time zone
  - how far ahead the forecast goes
  - a short version of the rating rules
- **Per spot**
  - name and break type
  - which way it faces, in words (*"faces E"*)
  - the swell window in words (*"swell from ESE to SW can reach it"*)
  - the latest buoy reading and how old it is (spots that share a buoy share this)
- **Per spot, per day, in local time, in blocks** (dawn / morning / afternoon / evening)
  - the rating and its reasons (already computed by `util/rating.ts`)
  - primary swell: height, period, direction, and whether it's in the window
  - wind: speed, gusts, and the offshore / cross / onshore label (computed by our code, not the model)
- **Tides, per day:** high and low tide times, found from the hourly heights. Spots that share a station share these.

## 2. Guardrails

| Risk | Guardrail |
|---|---|
| Made-up numbers or windows | The system prompt says to use only the data given, never invent values, never override the ratings, and to say plainly when it's flat. Then **check in code**: every "best window" the model names must be a spot and period that's rated fair or good in the data it was **generated from**. If it isn't, discard it. |
| Messy, unpredictable output | Ask for **structured output** (a JSON schema via `output_config.format`), e.g. `{ headline, days: [{ date, summary, bestBets: [{ spotId, period }] }], caveats }`. The client renders it like any other data, and the server can check it field by field, including that each `spotId` is one of ours. |
| Prompt injection | No user-controlled text in the prompt. Everything is our own spot data and numbers we computed. The only free text is spot names, and we write those. |
| Safety claims | The model must not make safety calls ("safe for beginners", rip currents). Say so in the prompt. Show our own fixed disclaimer in the UI instead of relying on the model to include one. |
| Failures and refusals | Check `stop_reason` (including `refusal`) and catch API errors. If generation fails, log it and keep the **previous** write-up if there is one, otherwise none. The rest of the app is unaffected. |
| Out of date between refreshes | The forecasts behind it update several times a day, so the chart beside the write-up can move on during the up to 8 hours between refreshes. Store the time it was generated and show it, e.g. *"Written Mon 12:00 PM"*. Present it as an outlook, not as live data. |
| Honesty with users | Label it "AI-generated outlook", next to the data it summarizes. |

## 3. Generating and refreshing

- **On startup, without blocking it.** Unlike `loadStations()`, generation starts **after** `app.listen()` and isn't awaited. If it fails, the server runs normally, and the endpoint says the write-up isn't available yet.
- **Refresh at fixed local times: 4 am, 12 pm and 8 pm**, in South County's time zone (`America/New_York`).
  - **Why fixed times:** they're predictable, whereas "every 8 hours after the server started" would drift with every restart. 4 am also means a fresh outlook is ready before a dawn session.
  - **The schedule is in local time, not UTC.** Work out the next refresh with `Intl.DateTimeFormat({ timeZone })`, like the tides' station midnight, so 4 am stays 4 am across daylight-saving changes. A plain "every 8 hours" timer would shift by an hour twice a year.
- **Saved to disk:** the latest write-up and its generation time go in a file, e.g. `server/.cache/writeup.json` (gitignored). On startup, the server loads the saved copy and only generates a new one if it's from **before the most recent scheduled time**.
  - For example, after a restart at 1 pm, a copy written at 12:05 pm is kept, but one written at 4:05 am is replaced, because the 12 pm refresh was missed.
  - **Why this matters in development:** `npm run dev` uses `tsx watch`, which restarts the server every time a file is saved. Without the saved copy, every save would call the model.
  - It also helps hosting providers that restart or sleep the server.
- **An on/off setting**, e.g. `WRITEUP_ENABLED=false`, so development doesn't call the model unless you're working on this feature.
- **No overlapping runs:** if a generation is still running when the next one is due, skip the new one.
- **Timer detail:** call `unref()` on the timer, so it doesn't keep the process alive in tests or at shutdown.

## 4. Protecting the API key on a public demo

Because users never trigger a model call, this is mostly about where the key lives and capping the worst case:

1. **The key lives only on the server**, in an environment variable. `.gitignore` already covers `.env`. Never put it in the client: Vite builds any `VITE_`-prefixed variable **into the public JavaScript bundle**.
2. **No endpoint calls the model.** `GET /api/writeup` only returns the stored result, so heavy traffic costs nothing extra.
3. **Use a separate key with a spend limit.** In the Claude Console, create a dedicated workspace for the demo with a monthly spend limit, and give it its own API key. A bug (say, a refresh loop) then has a capped cost, and that one key can be revoked without affecting anything else.

### Rough cost

With Claude Opus 5.5 (`claude-opus-5-5`, $4 / $20 per million input / output tokens), about 10k tokens in and 1k out comes to roughly **6 cents per write-up**. Three times a day, that's about 18 cents a day, or **roughly $5.50 a month**. Restarts don't add to it, thanks to the saved copy.

## 5. Build order

1. **`summarizeWeek(spotConditions[])`** in `server/src/util/`, with tests. It's pure code with no API key, and useful on its own: it shows exactly what the model will see.
2. **Write-up service:** `@anthropic-ai/sdk`, the system prompt, structured output, validation against the snapshot, and the "keep the previous one" fallback.
3. **Scheduling:** generate after startup, refresh at 4 am / 12 pm / 8 pm local, save to disk, plus the on/off setting. "When is the next / most recent scheduled time" is a pure function, so it can be tested with fixed dates, including the daylight-saving days.
4. **Endpoint:** a separate **`GET /api/writeup`** that returns the stored write-up and when it was generated, or a "not available yet" response if there isn't one. It's kept apart from `/api/spots?zip=`, so the spots lookup stays instant and doesn't depend on the write-up. When regions arrive, it becomes `GET /api/regions/:id/writeup`.
5. **Client panel:** fetched alongside the spots, labelled as AI-generated, and showing when it was written.

## Open questions

- **Model:** Claude Opus 5.5 is the starting assumption. Revisit once there are real write-ups to compare and a measured cost.
