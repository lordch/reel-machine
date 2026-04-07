/**
 * Product configuration loader.
 *
 * Each product (client) has a directory under products/ with:
 * - product.json — branding, TTS rules, defaults
 * - knowledge.md — product knowledge for LLM scenario generation
 * - assets/ — logo, screenshots
 * - broll-library.json — proven b-roll prompts per category
 */

import fs from "fs";
import path from "path";
import { z } from "zod";

const TtsReplacementSchema = z.object({
  pattern: z.string(),
  replacement: z.string(),
  flags: z.string().default("g"),
});

const ProductConfigSchema = z.object({
  name: z.string(),
  website: z.string(),
  logo: z.string(),
  brandColor: z.string().optional(),
  language: z.string().default("en"),
  avatar: z.string().default("skyler"),
  captionStyle: z.string().default("bold-pop"),
  ttsReplacements: z.array(TtsReplacementSchema).default([]),
  publish: z.object({
    instagram: z.object({ accountId: z.string() }).optional(),
    youtube: z.object({ channelId: z.string(), playlistId: z.string().optional() }).optional(),
  }).optional(),
  approval: z.object({
    clientEmail: z.string(),
    alertEmail: z.string(),
  }).optional(),
});

export type ProductConfig = z.infer<typeof ProductConfigSchema>;

const PRODUCTS_DIR = path.join(process.cwd(), "products");

let _currentProduct: ProductConfig | null = null;
let _currentProductId: string | null = null;

export function loadProduct(productId: string): ProductConfig {
  if (_currentProductId === productId && _currentProduct) return _currentProduct;

  const configPath = path.join(PRODUCTS_DIR, productId, "product.json");
  if (!fs.existsSync(configPath)) {
    throw new Error(`Product config not found: ${configPath}`);
  }
  const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  _currentProduct = ProductConfigSchema.parse(raw);
  _currentProductId = productId;
  return _currentProduct;
}

export function productDir(productId: string): string {
  return path.join(PRODUCTS_DIR, productId);
}

export function productAssetsDir(productId: string): string {
  return path.join(PRODUCTS_DIR, productId, "assets");
}

/**
 * Build RegExp-based TTS replacements from product config.
 */
export function getTtsReplacements(productId: string): [RegExp, string][] {
  const config = loadProduct(productId);
  return config.ttsReplacements.map((r) => [
    new RegExp(r.pattern, r.flags),
    r.replacement,
  ]);
}

/**
 * Load b-roll prompt library for a product.
 * Returns category → prompt[] map.
 */
export function loadBrollLibrary(productId: string): Record<string, string[]> {
  const libPath = path.join(PRODUCTS_DIR, productId, "broll-library.json");
  if (!fs.existsSync(libPath)) return {};
  return JSON.parse(fs.readFileSync(libPath, "utf-8"));
}

/**
 * Resolve the logo path for a product (absolute path to the asset file).
 */
export function resolveLogoPath(productId: string): string {
  const config = loadProduct(productId);
  return path.join(productAssetsDir(productId), config.logo);
}
