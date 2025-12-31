'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import AdminExportButton from '@/components/AdminExportButton'
import HelpIcon from '@/components/HelpIcon'

type Program = 'RA' | 'LIFT'

interface KitProduct {
  id: string
  name: string
  description?: string
  thumbnail_url?: string
  inventory: number
}

export default function KitSelectionPage() {
  const router = useRouter()
  const [program, setProgram] = useState<Program | null>(null)
  const [kits, setKits] = useState<KitProduct[]>([])
  const [selectedKitId, setSelectedKitId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    // Check if user has selected a program and t-shirt size
    const selectedProgram = sessionStorage.getItem('selectedProgram') as Program | null
    const tshirtSize = sessionStorage.getItem('tshirtSize')
    
    if (!selectedProgram || (selectedProgram !== 'RA' && selectedProgram !== 'LIFT')) {
      router.push('/program')
      return
    }

    if (!tshirtSize) {
      router.push('/tshirt-size')
      return
    }

    setProgram(selectedProgram)
    loadKits(selectedProgram)
  }, [router])

  const loadKits = async (programType: Program) => {
    try {
      // Fetch kit products for the selected program
      // Order by customer_item_number to ensure Kit 1, 2, 3, 4 order
      const { data, error } = await supabase
        .from('ra_new_hire_products')
        .select('id, name, description, thumbnail_url, inventory, customer_item_number')
        .eq('category', 'kit')
        .eq('program', programType)
        .order('customer_item_number')

      if (error) throw error

      setKits(data || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load kits')
    } finally {
      setLoading(false)
    }
  }

  const handleKitSelect = (kitId: string) => {
    const kit = kits.find(k => k.id === kitId)
    if (kit && kit.inventory > 0) {
      setSelectedKitId(kitId)
      setError('')
    } else {
      setError('This kit is out of stock')
    }
  }

  const handleContinue = () => {
    if (!selectedKitId) {
      setError('Please select a kit')
      return
    }

    const selectedKit = kits.find(k => k.id === selectedKitId)
    if (!selectedKit || selectedKit.inventory <= 0) {
      setError('Selected kit is out of stock')
      return
    }

    // Store selected kit ID
    sessionStorage.setItem('selectedKitId', selectedKitId)

    // Navigate to shipping page
    router.push('/shipping')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#00263a' }}>
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 relative" style={{ backgroundColor: '#00263a' }}>
      <AdminExportButton />
      <HelpIcon />
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-6">
            Select Your Kit
          </h1>
        </div>

        {kits.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <p className="text-gray-600">No kits available for this program.</p>
          </div>
        ) : (
          <>
            {/* 2x2 Grid of Kits */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {kits.map((kit) => {
                const isSelected = selectedKitId === kit.id
                const isOutOfStock = kit.inventory <= 0

                return (
                  <button
                    key={kit.id}
                    onClick={() => !isOutOfStock && handleKitSelect(kit.id)}
                    disabled={isOutOfStock}
                    className={`bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-all text-left ${
                      isSelected ? 'ring-4 ring-[#c8102e]' : ''
                    } ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {/* Kit Thumbnail */}
                    {kit.thumbnail_url && (
                      <div className="mb-4 flex justify-center">
                        <img
                          src={kit.thumbnail_url}
                          alt={kit.name}
                          className="max-w-full h-48 object-contain"
                        />
                      </div>
                    )}

                    {/* Kit Name */}
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {kit.name}
                    </h3>

                    {/* Kit Description */}
                    {kit.description && (
                      <p className="text-gray-600 text-sm mb-2">
                        {kit.description}
                      </p>
                    )}

                    {/* Inventory Status */}
                    <div className="mt-4">
                      {isOutOfStock ? (
                        <span className="text-red-600 font-semibold">Out of Stock</span>
                      ) : (
                        <span className="text-gray-600 text-sm">
                          {kit.inventory} available
                        </span>
                      )}
                    </div>

                    {/* Selected Indicator */}
                    {isSelected && (
                      <div className="mt-2 text-[#c8102e] font-semibold">
                        ✓ Selected
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {error && (
              <p className="text-center text-red-400 mb-4">{error}</p>
            )}

            <div className="mt-8 flex justify-between">
              <button
                type="button"
                onClick={() => router.push('/tshirt-size')}
                className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                ← Back
              </button>
              <button
                onClick={handleContinue}
                disabled={!selectedKitId}
                className="px-6 py-2 text-white rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#c8102e] focus:ring-offset-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#c8102e' }}
              >
                Continue to Shipping →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

