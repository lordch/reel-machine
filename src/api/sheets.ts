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
  // Product
  product_name: string;
  website: string;
  product_description: string;
  product_features: string;
  target_audience: string;
  pain_points: string;
  key_messages: string;
  brand_voice: string;
  // Video settings
  caption_style: string;
  broll_model: string;
  avatar_version: string;
  last_avatar_used: string;
  tts_replacements: string;
  // Generation
  batch_size: number;
  batch_prompt: string;
  target_duration: number;
  // Notifications
  alert_email: string;
}

export async function readConfig(): Promise<SheetConfig> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: "Config!A:B",
  });

  const rows = res.data.values || [];
  const config: Record<string, string> = {};
  for (const [key, value] of rows) {
    // Skip section headers (## PRODUCT, etc.)
    if (!key || key.startsWith("##")) continue;
    config[key] = value || "";
  }

  return {
    ...config,
    batch_size: parseInt(config.batch_size, 10) || 20,
    target_duration: parseInt(config.target_duration, 10) || 30,
  } as unknown as SheetConfig;
}

export async function updateConfigValue(key: string, value: string): Promise<void> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: "Config!A:A",
  });

  const rows = res.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === key) {
      rowIndex = i + 1; // 1-based for Sheets API
      break;
    }
  }

  if (rowIndex === -1) throw new Error(`Config key "${key}" not found`);

  await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheetId(),
    range: `Config!B${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [[value]] },
  });
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
  scenario_cost: number;
  created_at: string;
  generated_at: string;
  published_at: string;
  error: string;
  yt_description: string;
  meta_caption: string;
}

const SCENARIO_HEADERS = [
  "id", "batch_id", "title", "framework", "script", "scenes_json",
  "duration_sec", "status", "reel_url", "publish_urls", "cost",
  "scenario_cost", "created_at", "generated_at", "published_at", "error",
  "yt_description", "meta_caption",
];

export async function readScenarios(): Promise<ScenarioRow[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: "Scenarios!A1:R1000",
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
    range: `Scenarios!A${rowIndex}:R${rowIndex}`,
  });

  const currentValues = current.data.values?.[0] || [];
  const updatedRow = SCENARIO_HEADERS.map((h, i) => {
    const val = (updates as Record<string, unknown>)[h];
    return val !== undefined ? String(val) : (currentValues[i] || "");
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheetId(),
    range: `Scenarios!A${rowIndex}:R${rowIndex}`,
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

// ── Avatars tab ──

export interface AvatarRow {
  name: string;
  heygenAvatarId: string;
  voiceId: string;
  description: string;
  active: boolean;
}

export async function readAvatars(): Promise<AvatarRow[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: "Avatars!A1:E100",
  });

  const rows = res.data.values || [];
  if (rows.length < 2) return [];

  return rows.slice(1).map((row) => ({
    name: row[0] || "",
    heygenAvatarId: row[1] || "",
    voiceId: row[2] || "",
    description: row[3] || "",
    active: (row[4] || "").toLowerCase() === "yes",
  }));
}

export function pickNextAvatar(avatars: AvatarRow[], lastUsed: string): AvatarRow {
  const active = avatars.filter((a) => a.active);
  if (active.length === 0) throw new Error("No active avatars in Avatars tab");
  if (active.length === 1) return active[0];

  const lastIndex = active.findIndex((a) => a.name === lastUsed);
  const nextIndex = (lastIndex + 1) % active.length;
  return active[nextIndex];
}
