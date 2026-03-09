'use server'

import OpenAI from 'openai'
import {
	saveTranslations,
	deleteKeyFromAllLocales,
	addKeyToAllLocales,
	createLocale,
	deleteLocale,
	renameKeyInAllLocales,
	getKeyMetadata,
	updateKeyMetadata,
	getAllMetadata,
	getSourceLocale,
	setSourceLocale,
} from '@/lib/fs-utils'

export async function updateTranslation(locale, translations) {
	if (!locale || !translations) {
		throw new Error('Missing locale or translations')
	}
	await saveTranslations(locale, translations)
	return { success: true }
}

export async function createTranslationKey(key, defaultValue = '') {
	if (!key) {
		throw new Error('Missing key')
	}
	await addKeyToAllLocales(key, defaultValue)
	return { success: true }
}

export async function deleteTranslationKey(key) {
	if (!key) {
		throw new Error('Missing key')
	}
	await deleteKeyFromAllLocales(key)
	return { success: true }
}

export async function renameTranslationKey(oldKey, newKey) {
	if (!oldKey || !newKey) {
		throw new Error('Missing old key or new key')
	}
	if (oldKey === newKey) {
		return { success: true } // No change needed
	}
	await renameKeyInAllLocales(oldKey, newKey)
	return { success: true }
}

export async function createNewLocale(locale) {
	if (!locale) {
		throw new Error('Missing locale')
	}
	await createLocale(locale)
	return { success: true }
}

export async function deleteLocaleAction(locale) {
	if (!locale) {
		throw new Error('Missing locale')
	}
	await deleteLocale(locale)
	return { success: true }
}

export async function getMetadataAction(key) {
	if (!key) {
		throw new Error('Missing key')
	}
	const metadata = await getKeyMetadata(key)
	return { success: true, metadata }
}

export async function updateMetadataAction(key, metadata) {
	if (!key) {
		throw new Error('Missing key')
	}
	await updateKeyMetadata(key, metadata)
	return { success: true }
}

export async function getAllMetadataAction() {
	const metadata = await getAllMetadata()
	return { success: true, metadata }
}

export async function getSourceLocaleAction() {
	const sourceLocale = await getSourceLocale()
	return { success: true, sourceLocale }
}

export async function setSourceLocaleAction(locale) {
	if (!locale) {
		throw new Error('Missing locale')
	}
	await setSourceLocale(locale)
	return { success: true }
}

export async function generateTranslation(
	key,
	targetLocale,
	existingTranslations,
) {
	if (!key || !targetLocale) {
		throw new Error('Missing key or target locale')
	}

	const apiKey = process.env.OPENAI_API_KEY
	if (!apiKey) {
		throw new Error('OPENAI_API_KEY environment variable is not set')
	}

	const nonEmptyTranslations = Object.entries(existingTranslations)
		.filter(([_, value]) => value && value.trim().length > 0)
		.slice(0, 3)

	if (nonEmptyTranslations.length === 0) {
		throw new Error(
			'No existing translations available to use as reference',
		)
	}

	const examples = nonEmptyTranslations
		.map(([locale, value]) => `${locale.toUpperCase()}: ${value}`)
		.join('\n')

	const prompt = `
You are a professional translator internationalizing text for apps and websites.

# Rules
- Preserve meaning, intent, and tone. Avoid unnecessary verbosity
- Preserve placeholders and (e.g. {username}, %s, {{count}}, etc)
- Use established translations for common UI terms (e.g. “Save”, etc)

# Output
- Return only the translated text
- Do not include quotes or explanations
- Respect the casing style of the text
- Translate only in the target locale

# Examples
EN: I love Apple products
FR: J'aime les produits Apple
`.trim()

	const input = `
${examples}
${targetLocale.toUpperCase()}:`.trim()

	try {
		const openai = new OpenAI({
			apiKey: apiKey,
		})

		const response = await openai.chat.completions.create({
			model: 'gpt-5-mini',
			messages: [
				{
					role: 'system',
					content: prompt,
				},
				{
					role: 'user',
					content: input,
				},
			],
      reasoning_effort: 'minimal'
		})

		const translation = response.choices?.[0]?.message?.content?.trim()

		if (!translation) {
			throw new Error('No translation received from OpenAI')
		}

		return { success: true, translation }
	} catch (error) {
		throw new Error(`Failed to generate translation: ${error.message}`)
	}
}
