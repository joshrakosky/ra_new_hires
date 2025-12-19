'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Product } from '@/types'
import StrykerLogo from '@/components/StrykerLogo'
import AdminExportButton from '@/components/AdminExportButton'
import HelpIcon from '@/components/HelpIcon'
import { getProductImagePath } from '@/lib/imageUtils'

export default function ProductPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [selectedColor, setSelectedColor] = useState<string>('')
  const [selectedSize, setSelectedSize] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // YETI Kit specific state
  const [activeYetiSize, setActiveYetiSize] = useState<string>('8oz') // Which size button is active
  const [yeti8ozColor, setYeti8ozColor] = useState<string>('')
  const [yeti26ozColor, setYeti26ozColor] = useState<string>('')
  const [yeti35ozColor, setYeti35ozColor] = useState<string>('')

  const selectedProduct = products.find(p => p.id === selectedProductId)
  const isYetiKit = selectedProduct?.name === 'YETI Kit'
  
  // Get the appropriate thumbnail based on selected color
  const getThumbnailUrl = () => {
    if (!selectedProduct) return null
    
    const productWithColors = selectedProduct as any
    
    // For YETI Kit, use the active size's selected color with size-specific naming
    if (isYetiKit) {
      const activeColor = activeYetiSize === '8oz' ? yeti8ozColor : 
                         activeYetiSize === '26oz' ? yeti26ozColor : 
                         yeti35ozColor
      
      if (activeColor) {
        // Generate path using size-specific naming: SYKEDT-YETI-08-Black.jpg
        const generatedPath = getProductImagePath(
          productWithColors.customer_item_number, 
          activeColor,
          activeYetiSize // Pass the size (e.g., "8oz", "26oz", "35oz")
        )
        if (generatedPath) {
          return generatedPath
        }
      }
      
      // Fallback: if no color selected yet, show first available color for 8oz
      if (selectedProduct.available_colors && selectedProduct.available_colors.length > 0) {
        const firstColor = selectedProduct.available_colors[0]
        return getProductImagePath(
          productWithColors.customer_item_number,
          firstColor,
          '8oz' // Default to 8oz
        )
      }
      
      return null
    }
    
    // Regular product logic - try color_thumbnails first, then generate from naming convention
    if (selectedColor) {
      // First check if color_thumbnails JSONB has it
      if (productWithColors.color_thumbnails && productWithColors.color_thumbnails[selectedColor]) {
        return productWithColors.color_thumbnails[selectedColor]
      }
      
      // Otherwise, generate path from naming convention: SYKEDT_{item#}_{color}.jpg
      const generatedPath = getProductImagePath(productWithColors.customer_item_number, selectedColor)
      if (generatedPath) {
        return generatedPath
      }
    }
    
    // Fallback: try legacy fields or generate for first available color
    if (productWithColors.thumbnail_url_black) return productWithColors.thumbnail_url_black
    if (productWithColors.thumbnail_url_white) return productWithColors.thumbnail_url_white
    
    // Generate for first available color if no color selected yet
    if (selectedProduct.available_colors && selectedProduct.available_colors.length > 0) {
      const firstColor = selectedProduct.available_colors[0]
      const generatedPath = getProductImagePath(productWithColors.customer_item_number, firstColor)
      if (generatedPath) return generatedPath
    }
    
    return selectedProduct.thumbnail_url || null
  }

  useEffect(() => {
    // Check if user is authenticated (has email in sessionStorage)
    const userEmail = sessionStorage.getItem('userEmail')
    if (!userEmail) {
      router.push('/')
      return
    }

    // Load products
    loadProducts()
  }, [router])

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('syk_edt_products')
        .select('*, thumbnail_url_black, thumbnail_url_white, color_thumbnails, customer_item_number')
        .order('name')

      if (error) throw error
      setProducts(data || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  const handleContinue = () => {
    if (!selectedProductId) {
      setError('Please select a product')
      return
    }

    // Special validation for YETI Kit
    if (isYetiKit) {
      if (!yeti8ozColor || !yeti26ozColor || !yeti35ozColor) {
        setError('Please select a color for each size')
        return
      }
      
      // Store YETI Kit with individual colors
      sessionStorage.setItem('product', JSON.stringify({
        productId: selectedProductId,
        isYetiKit: true,
        yeti8ozColor,
        yeti26ozColor,
        yeti35ozColor
      }))
    } else {
      // Regular product validation
      if (selectedProduct?.requires_color && !selectedColor) {
        setError('Please select a color')
        return
      }

      if (selectedProduct?.requires_size && !selectedSize) {
        setError('Please select a size')
        return
      }

      // Store selection in sessionStorage
      sessionStorage.setItem('product', JSON.stringify({
        productId: selectedProductId,
        color: selectedColor || null,
        size: selectedSize || null
      }))
    }

    router.push('/shipping')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading products...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-50 py-12 px-4 relative">
      <AdminExportButton />
      <HelpIcon />
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-6">
            <StrykerLogo className="text-2xl mb-2" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Select Your Product</h1>
            <p className="text-gray-600">Choose your product and options</p>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
              {error}
            </div>
          )}

          <div className="mb-6">
            <label htmlFor="product-select" className="block text-sm font-medium text-gray-700 mb-2">
              Select Product
            </label>
            <select
              id="product-select"
              value={selectedProductId}
              onChange={(e) => {
                const productId = e.target.value
                setSelectedProductId(productId)
                setSelectedSize('')
                setSelectedColor('')
                setError('')
                
                // Reset YETI Kit state
                setActiveYetiSize('8oz')
                setYeti8ozColor('')
                setYeti26ozColor('')
                setYeti35ozColor('')
                
                const product = products.find(p => p.id === productId)
                
                // Only auto-select for non-YETI products
                if (product?.name !== 'YETI Kit') {
                  if (product?.requires_color && product.available_colors && product.available_colors.length > 0) {
                    setSelectedColor(product.available_colors[0])
                  } else if (product?.requires_color && product.available_colors?.includes('Black')) {
                    setSelectedColor('Black')
                  }
                  
                  if (product?.requires_size && product.available_sizes && product.available_sizes.length === 1) {
                    setSelectedSize(product.available_sizes[0])
                  }
                }
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#ffb500] focus:border-transparent text-black bg-white"
            >
              <option value="">-- Choose a product --</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>

          {selectedProduct && (
            <div className="border-t pt-6 space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  {getThumbnailUrl() ? (
                    <img
                      src={getThumbnailUrl() || ''}
                      alt={selectedProduct.name}
                      className="w-full rounded-lg shadow-md"
                    />
                  ) : (
                    <div className="w-full aspect-square bg-gray-100 rounded-lg shadow-md flex items-center justify-center border-2 border-gray-300">
                      <div className="text-center p-4">
                        {!isYetiKit && <div className="text-4xl mb-2">📦</div>}
                        <div className="text-sm text-gray-500 font-medium">{selectedProduct.name}</div>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                    {selectedProduct.name}
                  </h2>
                  {selectedProduct.description && (
                    <p className="text-gray-600 mb-3">{selectedProduct.description}</p>
                  )}
                  {isYetiKit && (
                    <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-sm font-medium text-blue-900 mb-2">Kit Includes:</p>
                      <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
                        <li>8oz YETI Rambler Stackable Cup</li>
                        <li>26oz YETI Rambler Straw Bottle</li>
                        <li>35oz YETI Rambler Tumbler with Straw Lid</li>
                      </ul>
                      <p className="text-sm text-blue-800 mt-2 font-medium">Select a color for each size.</p>
                    </div>
                  )}
                  {selectedProduct.specs && (
                    <div className="mb-4">
                      <h3 className="font-medium text-gray-900 mb-2">Specifications:</h3>
                      <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                        {selectedProduct.specs.split('\n').filter(line => line.trim().startsWith('•')).map((line, idx) => (
                          <li key={idx} className="ml-2">{line.replace('•', '').trim()}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* YETI Kit - Size buttons and individual color selection */}
              {isYetiKit && (
                <div className="space-y-4">
                  {/* Size selection buttons */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Size to Configure
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveYetiSize('8oz')
                          setError('')
                        }}
                        className={`px-4 py-3 rounded-md border-2 font-medium transition-colors ${
                          activeYetiSize === '8oz'
                            ? 'border-[#ffb500] bg-[#ffb500] text-black'
                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        8oz Cup
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveYetiSize('26oz')
                          setError('')
                        }}
                        className={`px-4 py-3 rounded-md border-2 font-medium transition-colors ${
                          activeYetiSize === '26oz'
                            ? 'border-[#ffb500] bg-[#ffb500] text-black'
                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        26oz Bottle
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveYetiSize('35oz')
                          setError('')
                        }}
                        className={`px-4 py-3 rounded-md border-2 font-medium transition-colors ${
                          activeYetiSize === '35oz'
                            ? 'border-[#ffb500] bg-[#ffb500] text-black'
                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        35oz Tumbler
                      </button>
                    </div>
                  </div>

                  {/* Color selection for active size */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Color for {activeYetiSize === '8oz' ? '8oz Cup' : activeYetiSize === '26oz' ? '26oz Bottle' : '35oz Tumbler'}
                      {activeYetiSize === '8oz' && yeti8ozColor && <span className="text-green-600 ml-2">✓</span>}
                      {activeYetiSize === '26oz' && yeti26ozColor && <span className="text-green-600 ml-2">✓</span>}
                      {activeYetiSize === '35oz' && yeti35ozColor && <span className="text-green-600 ml-2">✓</span>}
                    </label>
                    <select
                      value={
                        activeYetiSize === '8oz' ? yeti8ozColor :
                        activeYetiSize === '26oz' ? yeti26ozColor :
                        yeti35ozColor
                      }
                      onChange={(e) => {
                        const color = e.target.value
                        if (activeYetiSize === '8oz') {
                          setYeti8ozColor(color)
                        } else if (activeYetiSize === '26oz') {
                          setYeti26ozColor(color)
                        } else {
                          setYeti35ozColor(color)
                        }
                        setError('')
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#ffb500] focus:border-transparent text-black bg-white"
                    >
                      <option value="">-- Select color --</option>
                      {selectedProduct.available_colors
                        ?.filter(color => {
                          // White is not available for 26oz
                          if (activeYetiSize === '26oz' && color === 'White') {
                            return false
                          }
                          return true
                        })
                        .map(color => (
                          <option key={color} value={color}>{color}</option>
                        ))}
                    </select>
                  </div>

                  {/* Progress indicator */}
                  <div className="pt-2">
                    <p className="text-xs text-gray-600 mb-1">Selection Progress:</p>
                    <div className="flex gap-2">
                      <div className={`flex-1 h-2 rounded ${yeti8ozColor ? 'bg-green-500' : 'bg-gray-200'}`} title="8oz"></div>
                      <div className={`flex-1 h-2 rounded ${yeti26ozColor ? 'bg-green-500' : 'bg-gray-200'}`} title="26oz"></div>
                      <div className={`flex-1 h-2 rounded ${yeti35ozColor ? 'bg-green-500' : 'bg-gray-200'}`} title="35oz"></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Regular product color selection */}
              {!isYetiKit && selectedProduct.requires_color && selectedProduct.available_colors && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Color
                  </label>
                  <select
                    value={selectedColor}
                    onChange={(e) => {
                      setSelectedColor(e.target.value)
                      setError('')
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#ffb500] focus:border-transparent text-black bg-white"
                  >
                    <option value="">-- Select color --</option>
                    {selectedProduct.available_colors.map(color => (
                      <option key={color} value={color}>{color}</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedProduct.requires_size && selectedProduct.available_sizes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Size
                  </label>
                  <select
                    value={selectedSize}
                    onChange={(e) => {
                      setSelectedSize(e.target.value)
                      setError('')
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#ffb500] focus:border-transparent text-black bg-white"
                  >
                    <option value="">-- Select size --</option>
                    {selectedProduct.available_sizes.map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="mt-8 flex justify-between">
            <button
              onClick={() => router.push('/')}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              ← Back
            </button>
            <button
              onClick={handleContinue}
              className="px-6 py-2 text-black rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#ffb500] focus:ring-offset-2 font-medium"
              style={{ backgroundColor: '#ffb500' }}
            >
              Continue to Shipping →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


