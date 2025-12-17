'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import StrykerLogo from '@/components/StrykerLogo'
import AdminExportButton from '@/components/AdminExportButton'
import HelpIcon from '@/components/HelpIcon'

export default function ReviewPage() {
  const router = useRouter()
  const [product, setProduct] = useState<any>(null)
  const [productData, setProductData] = useState<any>(null)
  const [shipping, setShipping] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Check if email, product selection, and shipping exist
    const email = sessionStorage.getItem('orderEmail')
    const productData = sessionStorage.getItem('product')
    const shippingData = sessionStorage.getItem('shipping')
    
    if (!email || !productData || !shippingData) {
      router.push('/')
      return
    }

    // Parse stored data
    const parsedProduct = JSON.parse(productData)
    const parsedShipping = JSON.parse(shippingData)

    setProduct(parsedProduct)
    setShipping(parsedShipping)

    // Load product details
    loadProduct(parsedProduct.productId)
  }, [router])

  const loadProduct = async (productId: string) => {
    try {
      const { data, error } = await supabase
        .from('syk_edt_products')
        .select('*')
        .eq('id', productId)
        .single()

      if (error) throw error

      setProductData(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load product information')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    setError('')
    setSubmitting(true)

    try {
      const email = sessionStorage.getItem('orderEmail')!

      // Submit order to API
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          shipping,
          product
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to submit order')
      }

      const orderData = await response.json()
      
      // Store order number for confirmation page
      sessionStorage.setItem('orderNumber', orderData.order_number)
      
      // Clear selections
      sessionStorage.removeItem('product')
      sessionStorage.removeItem('shipping')
      
      router.push('/confirmation')
    } catch (err: any) {
      setError(err.message || 'Failed to submit order. Please try again.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-50 py-12 px-4 relative">
      <AdminExportButton />
      <HelpIcon />
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-6">
            <StrykerLogo className="text-2xl mb-2" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Review Your Order</h1>
              <p className="text-gray-600">Please review your product selection and shipping information before submitting, and feel free to screenshot this information for your convenience.</p>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
              {error}
            </div>
          )}

          {/* Product Section */}
          <div className="mb-6 pb-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Selected Product</h2>
            {productData && (
              <div className="bg-gray-50 rounded-lg p-4">
                {product.isYetiKit || productData.name === 'YETI Kit' ? (
                  <div className="space-y-3">
                    <p className="font-medium text-gray-900">{productData.name}</p>
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-xs font-medium text-gray-600 mb-2">Kit Items:</p>
                      <ul className="text-sm text-gray-600 space-y-2">
                        <li className="flex justify-between">
                          <span>• YETI Rambler 8oz Stackable Cup</span>
                          <span className="font-medium">{product.yeti8ozColor || 'Not selected'}</span>
                        </li>
                        <li className="flex justify-between">
                          <span>• YETI Rambler 26oz Straw Bottle</span>
                          <span className="font-medium">{product.yeti26ozColor || 'Not selected'}</span>
                        </li>
                        <li className="flex justify-between">
                          <span>• YETI Rambler 35oz Tumbler with Straw Lid</span>
                          <span className="font-medium">{product.yeti35ozColor || 'Not selected'}</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="font-medium text-gray-900">{productData.name}</p>
                    {product.color && <p className="text-sm text-gray-600">Color: {product.color}</p>}
                    {product.size && <p className="text-sm text-gray-600">Size: {product.size}</p>}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Shipping Information Section */}
          <div className="mb-6 pb-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Shipping Information</h2>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="font-medium text-gray-900">{shipping.email}</p>
              <p className="font-medium text-gray-900">{shipping.name}</p>
              <p className="text-sm text-gray-600">{shipping.address}</p>
              {shipping.address2 && <p className="text-sm text-gray-600">{shipping.address2}</p>}
              <p className="text-sm text-gray-600">
                {shipping.city}, {shipping.state} {shipping.zip}
              </p>
              <p className="text-sm text-gray-600">{shipping.country}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex justify-between">
            <button
              type="button"
              onClick={() => router.push('/shipping')}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              ← Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2 text-black rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#ffb500] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              style={{ backgroundColor: '#ffb500' }}
            >
              {submitting ? 'Submitting...' : 'Submit Order →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

