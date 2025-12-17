/**
 * Helper functions for image path generation
 * Images are named: SYKEDT_{item#}_{color}.jpg
 * Example: SYKEDT_NKFQ4762_Black.jpg
 */

/**
 * Normalize color name to match image filename format
 * Pattern: No spaces, proper capitalization (e.g., "Dark Grey Heather" -> "DarkGreyHeather")
 * Based on actual filenames: SYKEDT_NKFQ4762_DarkGreyHeather.jpg
 */
export function normalizeColorForImage(color: string): string {
  // Handle specific known mappings
  const colorMap: Record<string, string> = {
    'Anthracite Heather': 'AnthraciteHeather',
    'Dark Grey Heather': 'DarkGreyHeather', // No spaces, proper capitalization
    'Dark Grey': 'DarkGrey',
    'Graphite Heather': 'GraphiteHeather',
    'TNF Black': 'TNFBlack',
    'Cape Taupe': 'CapeTaupe',
  }
  
  // Check if we have a direct mapping
  if (colorMap[color]) {
    return colorMap[color]
  }
  
  // Default: capitalize first letter of each word and remove spaces
  // Example: "Cape Taupe" -> "CapeTaupe"
  return color
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

/**
 * Generate image path for a product color
 * @param customerItemNumber - The customer item number (e.g., "SYKEDT-AP-NKFQ4762")
 * @param color - The color name (e.g., "Anthracite Heather")
 * @param size - Optional size for YETI Kit (e.g., "8oz", "26oz", "35oz")
 * @returns Image path (e.g., "/images/SYKEDT_NKFQ4762_AnthraciteHeather.jpg" or "/images/SYKEDT-YETI-08-Black.jpg")
 */
export function getProductImagePath(
  customerItemNumber: string | null | undefined, 
  color: string,
  size?: string
): string | null {
  if (!customerItemNumber || !color) return null
  
  // Special handling for YETI Kit - uses size-specific naming
  if (customerItemNumber === 'SYKEDT-KIT-YETI-08' && size) {
    // Convert size to number format: "8oz" -> "08", "26oz" -> "26", "35oz" -> "35"
    const sizeNumber = size.replace('oz', '').padStart(2, '0') // "8oz" -> "08", "26oz" -> "26"
    const normalizedColor = normalizeColorForImage(color)
    return `/images/SYKEDT-YETI-${sizeNumber}-${normalizedColor}.jpg`
  }
  
  // Extract the item number part (e.g., "NKFQ4762" from "SYKEDT-AP-NKFQ4762")
  let itemNumber = customerItemNumber
  
  // If it contains dashes, extract everything after "SYKEDT-"
  if (customerItemNumber.startsWith('SYKEDT-')) {
    // Remove "SYKEDT-" prefix and keep the rest
    itemNumber = customerItemNumber.replace('SYKEDT-', '')
    // If there are more dashes, extract the last part
    if (itemNumber.includes('-')) {
      const parts = itemNumber.split('-')
      itemNumber = parts[parts.length - 1] // Get last part (e.g., "NKFQ4762")
    }
  }
  
  // Normalize color for filename (no spaces, proper capitalization)
  const normalizedColor = normalizeColorForImage(color)
  
  // Generate path: /images/SYKEDT_{item#}_{color}.jpg
  return `/images/SYKEDT_${itemNumber}_${normalizedColor}.jpg`
}

/**
 * Generate image paths for all colors of a product
 * Returns a map of color name -> image path
 */
export function generateColorThumbnails(
  customerItemNumber: string | null | undefined,
  colors: string[] | null | undefined
): Record<string, string> | null {
  if (!customerItemNumber || !colors || colors.length === 0) return null
  
  const thumbnails: Record<string, string> = {}
  
  colors.forEach(color => {
    const path = getProductImagePath(customerItemNumber, color)
    if (path) {
      thumbnails[color] = path
    }
  })
  
  return thumbnails
}

