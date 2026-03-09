import fs from 'fs/promises';
import path from 'path';

const LOCALE_PATH = process.env.I18N_LOCALES_PATH || './locales';

function getMetaFilePath() {
  return path.join(LOCALE_PATH, 'meta.json');
}

function getConfigFilePath() {
  return path.join(LOCALE_PATH, 'config.json');
}

async function getConfig() {
  try {
    const configPath = getConfigFilePath();
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    // Return default config if file doesn't exist
    return {
      sourceLocale: 'en',
    };
  }
}

async function saveConfig(config) {
  try {
    await fs.access(LOCALE_PATH);
  } catch {
    await fs.mkdir(LOCALE_PATH, { recursive: true });
  }
  const configPath = getConfigFilePath();
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

export async function getSourceLocale() {
  const config = await getConfig();
  return config.sourceLocale || 'en';
}

export async function setSourceLocale(locale) {
  const config = await getConfig();
  config.sourceLocale = locale;
  await saveConfig(config);
}

async function getMetadata() {
  try {
    const metaPath = getMetaFilePath();
    const content = await fs.readFile(metaPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return {};
  }
}

async function saveMetadata(metadata) {
  try {
    await fs.access(LOCALE_PATH);
  } catch {
    await fs.mkdir(LOCALE_PATH, { recursive: true });
  }
  const metaPath = getMetaFilePath();
  await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));
}

export async function getKeyMetadata(key) {
  const metadata = await getMetadata();
  return metadata[key] || null;
}

export async function updateKeyMetadata(key, metaData) {
  const metadata = await getMetadata();
  const now = new Date().toISOString();
  
  const existing = metadata[key] || {};
  
  metadata[key] = {
    notes: '',
    tags: [],
    status: 'active',
    ...existing, // Preserve existing data
    ...metaData, // Override with new data
    created_at: existing.created_at || now, // Preserve created_at or set if new
    updated_at: now, // Always update timestamp
  };
  
  // Remove source from metadata if it exists (migrated to config.json)
  if (metadata[key].source !== undefined) {
    delete metadata[key].source;
  }
  
  // Ensure tags is always an array
  if (!Array.isArray(metadata[key].tags)) {
    metadata[key].tags = [];
  }
  
  await saveMetadata(metadata);
}

export async function deleteKeyMetadata(key) {
  const metadata = await getMetadata();
  if (metadata[key]) {
    delete metadata[key];
    await saveMetadata(metadata);
  }
}

export async function renameKeyMetadata(oldKey, newKey) {
  const metadata = await getMetadata();
  if (metadata[oldKey]) {
    metadata[newKey] = {
      ...metadata[oldKey],
      updated_at: new Date().toISOString(),
    };
    delete metadata[oldKey];
    await saveMetadata(metadata);
  }
}

export async function getAllMetadata() {
  return await getMetadata();
}

export async function getLocales() {
  try {
    try {
        await fs.access(LOCALE_PATH);
    } catch {
        return [];
    }

    const files = await fs.readdir(LOCALE_PATH);
    return files
      .filter(f => f.endsWith('.json') && f !== 'meta.json' && f !== 'config.json')
      .map(f => f.replace('.json', ''));
  } catch (error) {
    console.error("Error reading locales directory:", error);
    return [];
  }
}

export async function getTranslations(locale) {
  try {
    const filePath = path.join(LOCALE_PATH, `${locale}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return {};
  }
}

export async function saveTranslations(locale, data) {
  try {
    await fs.access(LOCALE_PATH);
  } catch {
    await fs.mkdir(LOCALE_PATH, { recursive: true });
  }
  const filePath = path.join(LOCALE_PATH, `${locale}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

export async function getAllData() {
    const locales = await getLocales();
    const data = {};
    for (const locale of locales) {
        data[locale] = await getTranslations(locale);
    }
    const metadata = await getAllMetadata();
    const sourceLocale = await getSourceLocale();
    return { locales, data, metadata, sourceLocale };
}

function deleteDeep(obj, path) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key] || typeof current[key] !== 'object') {
      return obj; // Path doesn't exist
    }
    current = current[key];
  }
  delete current[keys[keys.length - 1]];
  
  // Clean up empty objects
  let parent = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (Object.keys(parent[key]).length === 0) {
      delete parent[key];
      break;
    }
    parent = parent[key];
  }
  
  return obj;
}

function setDeep(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
  return obj;
}

export async function addKeyToAllLocales(key, defaultValue = '') {
  const locales = await getLocales();
  for (const locale of locales) {
    const translations = await getTranslations(locale);
    const updated = setDeep(JSON.parse(JSON.stringify(translations)), key, defaultValue);
    await saveTranslations(locale, updated);
  }
  // Initialize metadata for the new key
  const metadata = await getMetadata();
  if (!metadata[key]) {
    const now = new Date().toISOString();
    metadata[key] = {
      notes: '',
      tags: [],
      status: 'active',
      created_at: now,
      updated_at: now,
    };
    await saveMetadata(metadata);
  }
}

export async function deleteKeyFromAllLocales(key) {
  const locales = await getLocales();
  for (const locale of locales) {
    const translations = await getTranslations(locale);
    const updated = deleteDeep(JSON.parse(JSON.stringify(translations)), key);
    await saveTranslations(locale, updated);
  }
  // Delete metadata for the key
  await deleteKeyMetadata(key);
}

function getDeep(obj, path) {
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

export async function renameKeyInAllLocales(oldKey, newKey) {
  const locales = await getLocales();
  for (const locale of locales) {
    const translations = await getTranslations(locale);
    const value = getDeep(translations, oldKey);
    
    if (value !== undefined) {
      // Set the new key with the old value
      const updated = setDeep(JSON.parse(JSON.stringify(translations)), newKey, value);
      // Delete the old key
      const final = deleteDeep(updated, oldKey);
      await saveTranslations(locale, final);
    }
  }
  // Rename metadata
  await renameKeyMetadata(oldKey, newKey);
}

export async function createLocale(locale) {
  try {
    await fs.access(LOCALE_PATH);
  } catch {
    await fs.mkdir(LOCALE_PATH, { recursive: true });
  }
  const filePath = path.join(LOCALE_PATH, `${locale}.json`);
  
  // Check if file already exists
  try {
    await fs.access(filePath);
    throw new Error(`Locale "${locale}" already exists`);
  } catch (error) {
    if (error.message.includes('already exists')) {
      throw error;
    }
    // File doesn't exist, create it
  }
  
  // Get existing locales to copy structure from
  const existingLocales = await getLocales();
  let initialData = {};
  
  if (existingLocales.length > 0) {
    // Copy structure from first existing locale
    const templateLocale = existingLocales[0];
    const templateData = await getTranslations(templateLocale);
    
    // Create empty values for all keys
    function createEmptyStructure(obj) {
      if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
        const result = {};
        for (const key in obj) {
          result[key] = createEmptyStructure(obj[key]);
        }
        return result;
      }
      return '';
    }
    initialData = createEmptyStructure(templateData);
  }
  
  await fs.writeFile(filePath, JSON.stringify(initialData, null, 2));
}

export async function deleteLocale(locale) {
  try {
    const filePath = path.join(LOCALE_PATH, `${locale}.json`);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      throw new Error(`Locale "${locale}" does not exist`);
    }
    
    // Delete the file
    await fs.unlink(filePath);
  } catch (error) {
    if (error.message.includes('does not exist')) {
      throw error;
    }
    throw new Error(`Failed to delete locale "${locale}": ${error.message}`);
  }
}

