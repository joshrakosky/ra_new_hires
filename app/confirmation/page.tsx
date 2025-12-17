'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import StrykerLogo from '@/components/StrykerLogo'
import AdminExportButton from '@/components/AdminExportButton'
import HelpIcon from '@/components/HelpIcon'

export default function ConfirmationPage() {
  const router = useRouter()
  const [orderNumber, setOrderNumber] = useState<string>('')

  useEffect(() => {
    const orderNum = sessionStorage.getItem('orderNumber')
    if (!orderNum) {
      router.push('/')
      return
    }
    setOrderNumber(orderNum)
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-50 flex items-center justify-center px-4 relative">
      <AdminExportButton />
      <HelpIcon />
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <div className="mb-4 flex justify-center">
            <StrykerLogo className="text-2xl mb-4" />
          </div>
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Order Confirmed!</h1>
          <p className="text-gray-600">
            Thank you for your order
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <p className="text-sm text-gray-600 mb-2">Your Order Number:</p>
          <p className="text-2xl font-bold" style={{ color: '#ffb500' }}>{orderNumber}</p>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          A confirmation email has been sent. You can close this page.
        </p>

        <a
          href={`mailto:?subject=Stryker Enterprise Digital and Technology Order Confirmation - ${orderNumber}&body=Thank you for your order!%0D%0A%0D%0AYour Order Number: ${orderNumber}%0D%0A%0D%0AThank you`}
          onClick={() => {
            // Clear session after a short delay to allow mailto to open
            setTimeout(() => {
              sessionStorage.clear()
            }, 100)
          }}
          className="w-full px-6 py-2 text-black rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#ffb500] focus:ring-offset-2 font-medium inline-block text-center"
          style={{ backgroundColor: '#ffb500' }}
        >
          Email Order Confirmation
        </a>
      </div>
    </div>
  )
}

