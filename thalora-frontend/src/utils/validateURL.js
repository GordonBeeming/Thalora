/**
 * Validates if a URL is properly formatted
 * @param {string} url - The URL string to validate
 * @returns {boolean} - True if valid URL, false otherwise
 */
export const validateURL = (url) => {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // Remove leading/trailing whitespace
  url = url.trim();

  // Check if URL starts with http:// or https://
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    // Add https:// as default protocol
    url = 'https://' + url;
  }

  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Normalizes a URL by adding protocol if missing
 * @param {string} url - The URL string to normalize
 * @returns {string} - Normalized URL with protocol
 */
export const normalizeURL = (url) => {
  if (!url || typeof url !== 'string') {
    return '';
  }

  url = url.trim();

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return 'https://' + url;
  }

  return url;
};