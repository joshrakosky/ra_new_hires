'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import StrykerLogo from '@/components/StrykerLogo'
import AdminExportButton from '@/components/AdminExportButton'
import HelpIcon from '@/components/HelpIcon'

export default function LandingPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  // Passwords for site access
  const SITE_PASSWORD = 'sykedt25'
  const ADMIN_PASSWORD = 'sykedtadmin'

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!password) {
      setError('Please enter the password')
      return
    }

    // Check if admin password
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('adminAuth', 'true')
      // Still navigate to product page, but admin export button will be enabled
      router.push('/product')
      return
    }

    // Check if regular password is correct
    if (password !== SITE_PASSWORD) {
      setError('Incorrect password. Please try again.')
      return
    }

    // Clear admin auth if regular user
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
            Stryker Enterprise Digital and Technology
          </h1>
          <p className="text-gray-600">
            Enter password to start shopping
          </p>
        </div>

        <form onSubmit={handleStart} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#ffb500] focus:border-transparent text-black bg-white"
              placeholder="Enter password"
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
