import "dotenv/config";
import { google } from "googleapis";

const SPREADSHEET_ID = "17N4MpqYfd8rbJAfyDohiehATYFDug00ZlZ6ch3yR9XI";
const KEY_FILE = "./reel-machine-492612-b8601a4a2d33.json";

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
  const requiredTabs = ["Config", "Scenarios", "Log"];
  const requests: any[] = [];

  for (const tab of requiredTabs) {
    if (!existingTabs.includes(tab)) {
      requests.push({
        addSheet: { properties: { title: tab } },
      });
    }
  }

  // Delete default "Sheet1" if it exists and we're adding our tabs
  if (existingTabs.includes("Sheet1") && requests.length > 0) {
    const sheet1 = spreadsheet.data.sheets?.find((s) => s.properties?.title === "Sheet1");
    if (sheet1?.properties?.sheetId !== undefined) {
      requests.push({
        deleteSheet: { sheetId: sheet1.properties.sheetId },
      });
    }
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests },
    });
    console.log("Created tabs:", requiredTabs.filter((t) => !existingTabs.includes(t)));
  }

  // 3. Write headers
  const CONFIG_HEADERS = [
    "product_name", "website", "product_description", "target_audience",
    "brand_voice", "language", "avatar", "caption_style", "broll_model",
    "batch_size", "batch_prompt", "alert_email", "alert_slack_webhook",
  ];

  const CONFIG_TEST_ROW = [
    "Go2EV", "go2ev.com", "AI monitoring for EV chargers",
    "CPO operators, hotels, parking lots", "Professional but energetic",
    "en", "skyler", "bold-pop", "ltx-2", "5", "", "test@example.com", "",
  ];

  const SCENARIO_HEADERS = [
    "id", "batch_id", "title", "framework", "script", "scenes_json",
    "duration_sec", "status", "reel_url", "publish_urls", "cost",
    "created_at", "generated_at", "published_at", "error",
  ];

  const LOG_HEADERS = ["timestamp", "action", "scenario_id", "message", "cost"];

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: "RAW",
      data: [
        { range: "Config!A1:M1", values: [CONFIG_HEADERS] },
        { range: "Config!A2:M2", values: [CONFIG_TEST_ROW] },
        { range: "Scenarios!A1:O1", values: [SCENARIO_HEADERS] },
        { range: "Log!A1:E1", values: [LOG_HEADERS] },
      ],
    },
  });

  console.log("✓ Headers written to Config, Scenarios, Log");
  console.log("✓ Test config row added to Config tab");
  console.log(`\nSheet ready: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`);
}

main().catch(console.error);
