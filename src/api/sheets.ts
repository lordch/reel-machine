import { google, type sheets_v4 } from "googleapis";

let sheetsClient: sheets_v4.Sheets | null = null;

function getSheets(): sheets_v4.Sheets {
  if (sheetsClient) return sheetsClient;

  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "./google-sa-key.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

function spreadsheetId(): string {
  const id = process.env.GOOGLE_SHEETS_ID;
  if (!id) throw new Error("GOOGLE_SHEETS_ID not set");
  return id;
}

// ── Config tab ──

export interface SheetConfig {
  product_name: string;
  website: string;
  product_description: string;
  target_audience: string;
  brand_voice: string;
  language: string;
  avatar: string;
  caption_style: string;
  broll_model: string;
  batch_size: number;
  batch_prompt: string;
  alert_email: string;
  alert_slack_webhook: string;
}

export async function readConfig(): Promise<SheetConfig> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: "Config!A1:M2",
  });

  const [headers, values] = res.data.values || [[], []];
  const config: Record<string, string> = {};
  headers.forEach((h: string, i: number) => {
    config[h] = values[i] || "";
  });

  return {
    ...config,
    batch_size: parseInt(config.batch_size, 10) || 20,
  } as unknown as SheetConfig;
}

// ── Scenarios tab ──

export interface ScenarioRow {
  id: string;
  batch_id: string;
  title: string;
  framework: string;
  script: string;
  scenes_json: string;
  duration_sec: number;
  status: string;
  reel_url: string;
  publish_urls: string;
  cost: number;
  created_at: string;
  generated_at: string;
  published_at: string;
  error: string;
}

const SCENARIO_HEADERS = [
  "id", "batch_id", "title", "framework", "script", "scenes_json",
  "duration_sec", "status", "reel_url", "publish_urls", "cost",
  "created_at", "generated_at", "published_at", "error",
];

export async function readScenarios(): Promise<ScenarioRow[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: "Scenarios!A1:O1000",
  });

  const rows = res.data.values || [];
  if (rows.length < 2) return [];

  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h: string, i: number) => {
      obj[h] = row[i] || "";
    });
    return {
      ...obj,
      duration_sec: parseFloat(obj.duration_sec) || 0,
      cost: parseFloat(obj.cost) || 0,
    } as unknown as ScenarioRow;
  });
}

export async function writeScenarios(scenarios: Partial<ScenarioRow>[]): Promise<void> {
  const sheets = getSheets();
  const values = scenarios.map((s) =>
    SCENARIO_HEADERS.map((h) => String((s as Record<string, unknown>)[h] ?? ""))
  );

  await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId(),
    range: "Scenarios!A1",
    valueInputOption: "RAW",
    requestBody: { values },
  });
}

export async function updateScenarioStatus(
  id: string,
  updates: Partial<ScenarioRow>
): Promise<void> {
  const sheets = getSheets();

  // Find the row by ID
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: "Scenarios!A:A",
  });

  const rows = res.data.values || [];
  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      rowIndex = i + 1; // 1-based for Sheets API
      break;
    }
  }

  if (rowIndex === -1) throw new Error(`Scenario ${id} not found`);

  // Read current row
  const current = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: `Scenarios!A${rowIndex}:O${rowIndex}`,
  });

  const currentValues = current.data.values?.[0] || [];
  const updatedRow = SCENARIO_HEADERS.map((h, i) => {
    const val = (updates as Record<string, unknown>)[h];
    return val !== undefined ? String(val) : (currentValues[i] || "");
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheetId(),
    range: `Scenarios!A${rowIndex}:O${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [updatedRow] },
  });
}

// ── Log tab ──

export async function appendLog(entry: {
  action: string;
  scenario_id?: string;
  message: string;
  cost?: number;
}): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId(),
    range: "Log!A1",
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        new Date().toISOString(),
        entry.action,
        entry.scenario_id || "",
        entry.message,
        entry.cost?.toString() || "",
      ]],
    },
  });
}
