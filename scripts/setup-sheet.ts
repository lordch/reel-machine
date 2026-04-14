import "dotenv/config";
import { google } from "googleapis";

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || "17N4MpqYfd8rbJAfyDohiehATYFDug00ZlZ6ch3yR9XI";
const KEY_FILE = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "./reel-machine-492612-b8601a4a2d33.json";

// ── Config: vertical key-value pairs (A = key, B = value) ──

const CONFIG_ROWS: [string, string][] = [
  // ── PRODUCT ──
  ["## PRODUCT", ""],
  ["product_name", "Go2EV"],
  ["website", "go2ev.com"],
  ["product_description", `Go2EV is an AI-powered monitoring and management platform for EV charging infrastructure. It connects to any charger brand and gives operators a single dashboard to monitor uptime, session success rates, energy usage, and revenue — in real time.

It's built for businesses that installed EV chargers but don't have the tools or staff to keep them running reliably. Hotels, parking operators, retail chains, property managers, CPOs with mixed-vendor fleets.

Go2EV doesn't manufacture chargers. It sits on top of existing hardware and makes it visible, predictable, and manageable.`],

  ["product_features", `• Real-time monitoring — live status of every charger, session success/failure, energy flow
• Multi-vendor support — works with any charger brand (ABB, Easee, Wallbox, Zaptec, etc.), one dashboard for all
• Predictive alerts — AI detects patterns before failures happen, alerts you before the charger goes offline
• Remote diagnostics — see error codes, restart chargers, update firmware from your phone
• Session analytics — revenue per station, usage patterns by time of day, occupancy rates
• Automated reporting — weekly/monthly reports for management, compliance, or investors
• Multi-site management — manage 5 or 500 locations from one account
• Open API — integrates with existing property management, billing, or energy systems`],

  ["target_audience", `• CPO operators (Charge Point Operators) managing 50+ chargers across locations — need fleet-wide visibility and SLA tracking
• Hotels and hospitality — installed chargers as a guest amenity, but can't afford downtime or bad reviews ("charger didn't work")
• Parking lot operators — chargers generate revenue, downtime = lost income, need usage analytics
• Retail and shopping centers — EV charging as foot traffic driver, need uptime and session data
• Property managers and real estate — managing chargers across buildings, need centralized control
• Fleet operators — depot charging for electric vans/trucks, need scheduling and reliability`],

  ["pain_points", `• Charger downtime is invisible — operators don't know a charger is down until a customer complains
• No cross-vendor visibility — most operators have 2-3 charger brands, each with its own app, no unified view
• Reactive maintenance — fixing after failure instead of preventing it, costly truck rolls
• Revenue leakage — broken chargers don't generate income but still cost electricity and parking space
• Manual monitoring — someone physically checks chargers or waits for complaints
• Scaling pain — managing 5 chargers is fine, managing 50+ across sites without tooling is chaos
• Guest/customer experience — a broken charger at a hotel means a bad review, not just lost revenue`],

  ["key_messages", `• "See every charger, one dashboard" — unified view regardless of hardware brand
• "Know before it breaks" — predictive alerts, not reactive firefighting
• "Fix from your phone" — remote diagnostics and restart, no truck roll needed
• "Every session, every dollar" — full analytics on usage, revenue, and performance
• "Works with what you have" — vendor-agnostic, no hardware lock-in
• "5 minutes to connect" — fast onboarding, no complex integration`],

  ["competitors_diff", `What makes Go2EV different:
• Vendor-agnostic — competitors are usually tied to one hardware brand. Go2EV works with ANY charger.
• AI-powered predictions — not just monitoring (what happened) but predictions (what's about to happen)
• Built for non-technical operators — hotel managers, parking operators, not just EV specialists
• Fast time to value — connect chargers in minutes, not weeks of integration work
• Affordable at any scale — pricing that works for 10 chargers or 1000`],

  ["brand_voice", `Professional but energetic. Data-driven but human. Peer-to-peer, like a fellow business owner sharing a solution — not a vendor pitching a product.

Confident without being arrogant. Empathetic — we understand the pain because we've seen it.

Language level: accessible to a hotel manager who is not technical. No jargon unless it's industry-standard (like "CPO" or "uptime").

Concrete over abstract — specific numbers, specific actions, specific outcomes. "Shows success rate for every station" not "provides comprehensive analytics".`],

  ["language", "en"],

  // ── VIDEO SETTINGS ──
  ["## VIDEO SETTINGS", ""],
  ["caption_style", "bold-pop"],
  ["broll_model", "veo-3.1-lite"],
  ["tts_replacements", "Go2EV → go to EV\ngo2ev.com → go to e v dot com"],

  // ── GENERATION ──
  ["## GENERATION", ""],
  ["batch_size", "5"],
  ["batch_prompt", ""],

  // ── NOTIFICATIONS ──
  ["## NOTIFICATIONS", ""],
  ["alert_email", ""],
  ["alert_slack_webhook", ""],
];

const SCENARIO_HEADERS = [
  "id", "batch_id", "title", "framework", "script", "scenes_json",
  "duration_sec", "status", "reel_url", "publish_urls", "cost",
  "scenario_cost", "created_at", "generated_at", "published_at", "error",
];

const LOG_HEADERS = ["timestamp", "action", "scenario_id", "message", "cost"];

const AVATAR_ROWS = [
  ["Name", "HeyGen Avatar ID", "Voice ID", "Description", "Active"],
  ["skyler", "69ae797df8f44394a8c770464902a5d2", "FLj50PrMa40MhGHappOt", "Skyler — young woman", "yes"],
  ["zenon", "e870559250824765baf179c19cb64469", "uju3wxzG5OhpWcoi3SMy", "Zenon — 40s man", "yes"],
];

const MODEL_ROWS = [
  ["Model ID", "Cost/sec", "Min", "Max", "Resolution", "Status", "Description"],
  ["veo-3.1-lite", "$0.030", "4s", "8s", "720p", "untested", "Veo 3.1 Lite 720p no audio — BEST VALUE"],
  ["ltx-2.3-fast", "$0.040", "6s", "20s", "1080p", "untested", "LTX 2.3 Fast — cheapest 1080p"],
  ["hailuo-02-std", "$0.045", "6s", "10s", "768p", "tested", "Hailuo-02 Std — fixed 6/10s"],
  ["kling-3.0-std", "$0.084", "3s", "15s", "1080p", "tested", "Kling 3.0 Std no audio — proven"],
  ["veo-3.1-lite-1080", "$0.050", "4s", "8s", "1080p", "untested", "Veo 3.1 Lite 1080p no audio"],
];

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  // 1. Get existing sheet tabs
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existingTabs = spreadsheet.data.sheets?.map((s) => s.properties?.title) || [];
  console.log("Existing tabs:", existingTabs);

  // 2. Create missing tabs
  const requiredTabs = ["Config", "Scenarios", "Log", "Avatars", "Models"];
  const requests: any[] = [];

  for (const tab of requiredTabs) {
    if (!existingTabs.includes(tab)) {
      requests.push({ addSheet: { properties: { title: tab } } });
    }
  }

  // Delete default "Sheet1" if present
  if (existingTabs.includes("Sheet1")) {
    const sheet1 = spreadsheet.data.sheets?.find((s) => s.properties?.title === "Sheet1");
    if (sheet1?.properties?.sheetId !== undefined) {
      requests.push({ deleteSheet: { sheetId: sheet1.properties.sheetId } });
    }
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests },
    });
    console.log("Created tabs:", requiredTabs.filter((t) => !existingTabs.includes(t)));
  }

  // 3. Clear Config tab (in case of re-run)
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: "Config!A:B",
  });

  // 4. Write vertical Config
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Config!A1:B${CONFIG_ROWS.length}`,
    valueInputOption: "RAW",
    requestBody: { values: CONFIG_ROWS },
  });

  // 5. Write Scenarios + Log headers
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: "RAW",
      data: [
        { range: "Scenarios!A1:P1", values: [SCENARIO_HEADERS] },
        { range: "Log!A1:E1", values: [LOG_HEADERS] },
      ],
    },
  });

  // 6. Format Config tab — widen column B
  const configSheet = (await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID }))
    .data.sheets?.find((s) => s.properties?.title === "Config");

  if (configSheet?.properties?.sheetId !== undefined) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            updateDimensionProperties: {
              range: {
                sheetId: configSheet.properties.sheetId,
                dimension: "COLUMNS",
                startIndex: 0,
                endIndex: 1,
              },
              properties: { pixelSize: 200 },
              fields: "pixelSize",
            },
          },
          {
            updateDimensionProperties: {
              range: {
                sheetId: configSheet.properties.sheetId,
                dimension: "COLUMNS",
                startIndex: 1,
                endIndex: 2,
              },
              properties: { pixelSize: 800 },
              fields: "pixelSize",
            },
          },
        ],
      },
    });
  }

  // 7. Write Avatars + Models
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: "RAW",
      data: [
        { range: `Avatars!A1:E${AVATAR_ROWS.length}`, values: AVATAR_ROWS },
        { range: `Models!A1:G${MODEL_ROWS.length}`, values: MODEL_ROWS },
      ],
    },
  });

  console.log(`✓ Config tab: ${CONFIG_ROWS.length} rows (vertical key-value)`);
  console.log("✓ Scenarios + Log headers written");
  console.log(`✓ Avatars: ${AVATAR_ROWS.length - 1} avatars`);
  console.log(`✓ Models: ${MODEL_ROWS.length - 1} b-roll models`);
  console.log(`\nSheet: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`);
}

main().catch(console.error);
