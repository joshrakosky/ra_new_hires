'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import StrykerLogo from '@/components/StrykerLogo'
import AdminExportButton from '@/components/AdminExportButton'
import HelpIcon from '@/components/HelpIcon'

// Allowed email addresses (case-insensitive)
const ALLOWED_EMAILS = [
  'abhishek.choudhary01@stryker.com',
  'ruchika.sikri@stryker.com',
  'ravindra.singh@stryker.com',
  'sunil.malodia@stryker.com',
  'shaun.wernette@stryker.com',
  'diane.riepl@stryker.com',
  'heather.maurer@stryker.com',
  'raghu.birru@stryker.com',
  'roger.pluijm@stryker.com',
  'patrice.poirier@stryker.com',
  'cindy.lutz@stryker.com',
  'debatra.sengupta@stryker.com',
  'khadiza.hussain@stryker.com',
  'shalini.ramesh@stryker.com',
  'michelle.yarger@stryker.com',
  'john.rossman@stryker.com',
  'epaphra.sattenapalli@stryker.com',
  'bobby.dack@stryker.com'
]

const ADMIN_EMAIL = 'josh.rakosky@proforma.com'

export default function LandingPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email) {
      setError('Please enter your email address')
      return
    }

    // Normalize email to lowercase for comparison
    const normalizedEmail = email.toLowerCase().trim()

    // Check if admin email
    if (normalizedEmail === ADMIN_EMAIL.toLowerCase()) {
      sessionStorage.setItem('userEmail', normalizedEmail)
      sessionStorage.setItem('adminAuth', 'true')
      router.push('/product')
      return
    }

    // Check if email is in allowed list (case-insensitive)
    const isAllowed = ALLOWED_EMAILS.some(
      allowedEmail => allowedEmail.toLowerCase() === normalizedEmail
    )

    if (!isAllowed) {
      setError('This email is not authorized to access the site. Please contact support.')
      return
    }

    // Store user email and clear admin auth for regular users
    sessionStorage.setItem('userEmail', normalizedEmail)
    sessionStorage.removeItem('adminAuth')

    // Navigate to product selection page
    router.push('/product')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-yellow-50 px-4 relative">
      <AdminExportButton />
      <HelpIcon />
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="mb-4 flex justify-center">
            <StrykerLogo className="text-3xl" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Enterprise Digital and Technology
          </h1>
          <p className="text-gray-600">
            Enter your email to start shopping
          </p>
        </div>

        <form onSubmit={handleStart} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError('')
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#ffb500] focus:border-transparent text-black bg-white"
              placeholder="Enter your email"
              required
            />
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full text-black py-3 px-4 rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#ffb500] focus:ring-offset-2 transition-colors font-medium"
            style={{ backgroundColor: '#ffb500' }}
          >
            Start Shopping →
          </button>
        </form>
      </div>
    </div>
  )
}
