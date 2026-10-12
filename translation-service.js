/**
 * Servizio per la traduzione del testo tramite Google Cloud Translation API.
 */
export default class TranslationService {
  /**
   * Traduce un testo usando Google Cloud Translation API v2.
   * @param {string} text - Testo da tradurre.
   * @param {string} sourceLang - Lingua d'origine ("AUTO" per rilevamento automatico).
   * @param {string} targetLang - Lingua di destinazione.
   * @param {string} apiKey - Google Cloud API Key.
   * @returns {Promise<string>} Testo tradotto.
   */
  static async translateText(text, sourceLang, targetLang, apiKey) {
    let url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}&q=${encodeURIComponent(text)}&target=${targetLang.toLowerCase()}`;

    if (sourceLang !== 'AUTO') {
      url += `&source=${sourceLang.toLowerCase()}`;
    }

    const response = await fetch(url, { method: 'POST' });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || response.statusText;
      throw new Error(`Errore Google Translate API: ${errorMessage}`);
    }

    const data = await response.json();
    return data.data?.translations[0]?.translatedText || text;
  }
}