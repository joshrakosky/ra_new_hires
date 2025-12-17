// Stryker Logo Component
// Displays the Stryker logo image
// Supports multiple formats: .png, .jpg, .svg, .webp

'use client'

import { useState } from 'react'

export default function StrykerLogo({ className = '' }: { className?: string }) {
  const [imageError, setImageError] = useState(false)
  
  // Try different image formats
  const imageFormats = ['png', 'jpg', 'svg', 'webp']
  const [currentFormat, setCurrentFormat] = useState(0)
  
  const imageSrc = `/images/stryker-logo.${imageFormats[currentFormat]}`
  
  const handleError = () => {
    if (currentFormat < imageFormats.length - 1) {
      // Try next format
      setCurrentFormat(currentFormat + 1)
    } else {
      // All formats failed, show text fallback
      setImageError(true)
    }
  }
  
  if (imageError) {
    // Fallback to text if image not found
    return (
      <div className={`font-bold text-black ${className}`} style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', letterSpacing: '-0.02em' }}>
        stryker
      </div>
    )
  }
  
  return (
    <img 
      src={imageSrc}
      alt="Stryker" 
      className={className}
      onError={handleError}
      style={{ maxWidth: '100%', height: 'auto' }}
    />
  )
}

