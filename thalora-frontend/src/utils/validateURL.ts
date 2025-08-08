/**
 * Validates if a URL is properly formatted and uses HTTPS
 */
export const validateURL = (url: string): boolean => {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // Remove leading/trailing whitespace
  url = url.trim();

  // Reject HTTP URLs explicitly - we only support HTTPS
  if (url.startsWith('http://')) {
    return false;
  }

  // Add https:// as default protocol if no protocol is specified
  if (!url.startsWith('https://')) {
    url = 'https://' + url;
  }

  try {
    const parsedURL = new URL(url);
    // Double-check that the URL uses HTTPS protocol
    return parsedURL.protocol === 'https:';
  } catch (error) {
    return false;
  }
};

/**
 * Normalizes a URL by adding HTTPS protocol if missing
 * Rejects HTTP URLs as we only support HTTPS
 */
export const normalizeURL = (url: string): string => {
  if (!url || typeof url !== 'string') {
    return '';
  }

  url = url.trim();

  // If URL starts with http://, we cannot normalize it - return empty string
  // This will cause validation to fail
  if (url.startsWith('http://')) {
    return '';
  }

  // Add https:// if no protocol is specified
  if (!url.startsWith('https://')) {
    return 'https://' + url;
  }

  return url;
};