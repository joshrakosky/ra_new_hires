'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'
import { OrderWithItems } from '@/types'
import HelpIcon from '@/components/HelpIcon'

export default function AdminPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState<{ orderId: string; orderNumber: string } | null>(null)
  const [cancelMessage, setCancelMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [showCodeGenerator, setShowCodeGenerator] = useState(false)
  const [codeQuantity, setCodeQuantity] = useState<number>(10)
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([])
  const [savingCodes, setSavingCodes] = useState(false)
  const [generatingCodes, setGeneratingCodes] = useState(false)
  const [codeMessage, setCodeMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [showCodeManager, setShowCodeManager] = useState(false)
  const [accessCodes, setAccessCodes] = useState<any[]>([])
  const [loadingCodes, setLoadingCodes] = useState(false)
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null)
  const [codeFilter, setCodeFilter] = useState<'all' | 'used' | 'unused'>('all')
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [showProductsPopup, setShowProductsPopup] = useState<{ orderId: string; items: OrderWithItems['items']; program: string } | null>(null)
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [bulkAction, setBulkAction] = useState<'status' | 'cancel' | null>(null)
  const [bulkStatus, setBulkStatus] = useState<'Pending' | 'Backorder' | 'Fulfillment' | 'Delivered'>('Pending')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [sortColumn, setSortColumn] = useState<keyof OrderWithItems>('created_at')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    // Check if user is admin (ADMIN code)
    const adminAuth = sessionStorage.getItem('adminAuth')
    const userCode = sessionStorage.getItem('userCode')
    const ADMIN_CODE = 'ADMIN'
    
    const isAdmin = adminAuth === 'true' || (userCode !== null && userCode.toUpperCase() === ADMIN_CODE)
    
    if (isAdmin) {
      setAuthenticated(true)
      loadOrders()
    } else {
      // Redirect to landing page if not admin
      window.location.href = '/'
    }
  }, [])

  useEffect(() => {
    if (showCodeManager) {
      loadAccessCodes()
    }
  }, [showCodeManager])

  const loadOrders = async () => {
    try {
      setLoading(true)
      
      // Fetch orders with their items
      const { data: ordersData, error: ordersError } = await supabase
        .from('ra_new_hire_orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (ordersError) throw ordersError

      // Fetch order items for each order
      const ordersWithItems = await Promise.all(
        (ordersData || []).map(async (order) => {
          const { data: items, error: itemsError } = await supabase
            .from('ra_new_hire_order_items')
            .select('*')
            .eq('order_id', order.id)
            .order('created_at')

          if (itemsError) throw itemsError

          return {
            ...order,
            items: items || []
          }
        })
      )

      setOrders(ordersWithItems)
    } catch (err: any) {
      console.error('Failed to load orders:', err)
    } finally {
      setLoading(false)
    }
  }

  // Restore inventory for a product (reverse the order)
  const restoreInventory = async (productId: string, size: string | null, quantity: number = 1): Promise<void> => {
    try {
      // Get current product data
      const { data: product, error: fetchError } = await supabase
        .from('ra_new_hire_products')
        .select('inventory, inventory_by_size, category')
        .eq('id', productId)
        .single()

      if (fetchError) throw fetchError

      // Restore inventory (add back the quantity)
      const newInventory = (product.inventory || 0) + quantity

      // Update size-specific inventory if size is provided
      let newInventoryBySize = product.inventory_by_size || {}
      if (size && newInventoryBySize[size] !== undefined) {
        newInventoryBySize = {
          ...newInventoryBySize,
          [size]: (newInventoryBySize[size] || 0) + quantity
        }
      }

      // Prepare update object - only include inventory_by_size if it was modified
      const updateData: { inventory: number; inventory_by_size?: Record<string, number> } = {
        inventory: newInventory
      }
      
      // Only update inventory_by_size if size was provided (for t-shirts)
      // For kits (size is null), preserve the existing inventory_by_size value
      if (size && newInventoryBySize[size] !== undefined) {
        updateData.inventory_by_size = newInventoryBySize
      }

      // Update product inventory
      const { error: updateError } = await supabase
        .from('ra_new_hire_products')
        .update(updateData)
        .eq('id', productId)

      if (updateError) throw updateError
    } catch (error) {
      console.error('Error restoring inventory:', error)
      throw error
    }
  }

  const handleCancelOrder = async (orderId: string) => {
    try {
      setCancelingOrderId(orderId)
      
      // Find the order to get its items
      const order = orders.find(o => o.id === orderId)
      if (!order) {
        throw new Error('Order not found')
      }

      console.log('Canceling order:', order.order_number, 'with', order.items.length, 'items')

      // Restore inventory for each item in the order
      for (const item of order.items) {
        console.log('Restoring inventory for item:', item.product_name, 'product_id:', item.product_id)
        await restoreInventory(item.product_id, item.size || null, 1)
      }

      // Mark code as unused in access codes table if it exists
      const { data: accessCode } = await supabase
        .from('ra_new_hire_access_codes')
        .select('id')
        .eq('code', order.code)
        .single()

      if (accessCode) {
        await supabase
          .from('ra_new_hire_access_codes')
          .update({
            used: false,
            used_at: null,
            order_id: null,
            email: null
          })
          .eq('id', accessCode.id)
      }

      // Delete the order (cascade will delete order items)
      // This also frees up the entry code to be used again (removes UNIQUE constraint)
      const { data: deletedData, error: deleteError } = await supabase
        .from('ra_new_hire_orders')
        .delete()
        .eq('id', orderId)
        .select()

      if (deleteError) {
        console.error('Delete error:', deleteError)
        throw deleteError
      }

      if (!deletedData || deletedData.length === 0) {
        console.error('No rows deleted - order may not exist')
        throw new Error('Order could not be deleted. It may have already been deleted.')
      }

      console.log('Order deleted successfully:', deletedData)

      // Refresh orders list
      await loadOrders()
      
      // Show success message in modal
      setCancelMessage({
        type: 'success',
        message: `Order ${order.order_number} has been canceled successfully. Inventory has been restored.`
      })
      
      // Close confirmation dialog
      setConfirmCancel(null)
    } catch (err: any) {
      console.error('Failed to cancel order:', err)
      // Show error message in modal
      setCancelMessage({
        type: 'error',
        message: `Failed to cancel order: ${err.message || 'Unknown error'}`
      })
      // Keep confirmation dialog open so user can try again or close
    } finally {
      setCancelingOrderId(null)
    }
  }

  // Generate random 6-letter codes
  const generateCodes = (quantity: number): string[] => {
    const codes: string[] = []
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    
    while (codes.length < quantity) {
      let code = ''
      for (let i = 0; i < 6; i++) {
        code += letters.charAt(Math.floor(Math.random() * letters.length))
      }
      
      // Ensure code is unique and not ADMIN
      if (code !== 'ADMIN' && !codes.includes(code)) {
        codes.push(code)
      }
    }
    
    return codes
  }

  const handleGenerateCodes = () => {
    if (codeQuantity < 1 || codeQuantity > 1000) {
      alert('Please enter a quantity between 1 and 1000')
      return
    }
    
    setGeneratingCodes(true)
    const codes = generateCodes(codeQuantity)
    setGeneratedCodes(codes)
    setGeneratingCodes(false)
  }

  const handleSaveCodes = async () => {
    if (generatedCodes.length === 0) {
      setCodeMessage({
        type: 'error',
        message: 'No codes to save. Please generate codes first.'
      })
      return
    }

    try {
      setSavingCodes(true)
      
      // Check which codes already exist in database
      const { data: existingCodes } = await supabase
        .from('ra_new_hire_access_codes')
        .select('code')
        .in('code', generatedCodes)

      const existingCodeSet = new Set(existingCodes?.map(c => c.code) || [])
      const newCodes = generatedCodes.filter(code => !existingCodeSet.has(code))

      if (newCodes.length === 0) {
        setCodeMessage({
          type: 'error',
          message: 'All generated codes already exist in the database.'
        })
        setSavingCodes(false)
        return
      }

      // Insert new codes
      const codesToInsert = newCodes.map(code => ({
        code,
        used: false,
        created_by: 'admin'
      }))

      const { data: insertedData, error: insertError } = await supabase
        .from('ra_new_hire_access_codes')
        .insert(codesToInsert)
        .select()

      if (insertError) {
        console.error('Insert error details:', insertError)
        throw new Error(insertError.message || `Database error: ${JSON.stringify(insertError)}`)
      }

      setCodeMessage({
        type: 'success',
        message: `Successfully saved ${newCodes.length} code(s) to database.${existingCodeSet.size > 0 ? ` ${existingCodeSet.size} code(s) were already in the database.` : ''}`
      })
      
      // Remove saved codes from generated list
      setGeneratedCodes(generatedCodes.filter(code => existingCodeSet.has(code)))
    } catch (err: any) {
      console.error('Failed to save codes:', err)
      const errorMessage = err.message || err.toString() || JSON.stringify(err) || 'Unknown error occurred'
      setCodeMessage({
        type: 'error',
        message: `Failed to save codes: ${errorMessage}`
      })
    } finally {
      setSavingCodes(false)
    }
  }

  const handleExportCodes = () => {
    if (generatedCodes.length === 0) {
      alert('No codes to export. Please generate codes first.')
      return
    }

    const wb = XLSX.utils.book_new()
    const codesData = generatedCodes.map((code, index) => ({
      'Code': code,
      'Status': 'Generated',
      'Generated Date': new Date().toLocaleDateString()
    }))

    const ws = XLSX.utils.json_to_sheet(codesData)
    XLSX.utils.book_append_sheet(wb, ws, 'Access Codes')

    const filename = `ra-new-hire-access-codes-${new Date().toISOString().split('T')[0]}.xlsx`
    XLSX.writeFile(wb, filename)
  }

  const loadAccessCodes = async () => {
    try {
      setLoadingCodes(true)
      const { data, error } = await supabase
        .from('ra_new_hire_access_codes')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setAccessCodes(data || [])
    } catch (err: any) {
      console.error('Failed to load access codes:', err)
      setCodeMessage({
        type: 'error',
        message: `Failed to load codes: ${err.message || 'Unknown error'}`
      })
    } finally {
      setLoadingCodes(false)
    }
  }

  const handleToggleCodeStatus = async (codeId: string, currentStatus: boolean) => {
    try {
      setEditingCodeId(codeId)
      const { error } = await supabase
        .from('ra_new_hire_access_codes')
        .update({
          used: !currentStatus,
          used_at: !currentStatus ? new Date().toISOString() : null,
          email: !currentStatus ? null : undefined,
          order_id: !currentStatus ? null : undefined
        })
        .eq('id', codeId)

      if (error) throw error

      await loadAccessCodes()
      setCodeMessage({
        type: 'success',
        message: `Code ${!currentStatus ? 'marked as used' : 'marked as unused'} successfully.`
      })
    } catch (err: any) {
      console.error('Failed to update code:', err)
      setCodeMessage({
        type: 'error',
        message: `Failed to update code: ${err.message || 'Unknown error'}`
      })
    } finally {
      setEditingCodeId(null)
    }
  }

  const handleDeleteCode = async (codeId: string, code: string) => {
    if (!confirm(`Are you sure you want to delete code ${code}? This cannot be undone.`)) {
      return
    }

    try {
      setEditingCodeId(codeId)
      const { error } = await supabase
        .from('ra_new_hire_access_codes')
        .delete()
        .eq('id', codeId)

      if (error) throw error

      await loadAccessCodes()
      setCodeMessage({
        type: 'success',
        message: `Code ${code} deleted successfully.`
      })
    } catch (err: any) {
      console.error('Failed to delete code:', err)
      setCodeMessage({
        type: 'error',
        message: `Failed to delete code: ${err.message || 'Unknown error'}`
      })
    } finally {
      setEditingCodeId(null)
    }
  }

  useEffect(() => {
    if (showCodeManager && accessCodes.length === 0) {
      loadAccessCodes()
    }
  }, [showCodeManager])

  const exportToExcel = async () => {
    // Fetch all products to get deco information
    const { data: productsData, error: productsError } = await supabase
      .from('ra_new_hire_products')
      .select('id, deco')

    if (productsError) {
      alert('Failed to load product information. Please try again.')
      return
    }

    // Create a map of product_id -> deco for quick lookup
    const productDecoMap = new Map<string, string>()
    productsData?.forEach(product => {
      if (product.deco) {
        productDecoMap.set(product.id, product.deco)
      }
    })

    // Sheet 1: Detailed Orders (one row per item)
    const detailedData = orders.flatMap(order => {
      return order.items.map((item) => ({
        'Order Number': order.order_number,
        'Code': order.code,
        'First Name': order.first_name,
        'Last Name': order.last_name,
        'Email': order.email,
        'Program': order.program,
        'Product Name': item.product_name,
        'Customer Item #': item.customer_item_number || '',
        'Color': item.color || '',
        'Size': item.size || '', // Only shows size for t-shirts, empty for kits
        'Shipping Name': order.shipping_name,
        'Shipping Attention': order.shipping_attention || '',
        'Shipping Address': order.shipping_address,
        'Shipping Address 2': order.shipping_address2 || '',
        'Shipping City': order.shipping_city,
        'Shipping State': order.shipping_state,
        'Shipping ZIP': order.shipping_zip,
        'Shipping Country': order.shipping_country,
        'Order Date': new Date(order.created_at).toLocaleDateString()
      }))
    })

    // Sheet 2: Distribution Summary (grouped by product/color/size)
    const summaryMap = new Map<string, { quantity: number; deco: string }>()
    
    orders.forEach(order => {
      order.items.forEach(item => {
        // Create a unique key for product/color/size combination
        const key = [
          item.product_name,
          item.customer_item_number || '',
          item.color || 'N/A',
          item.size || 'N/A'
        ].join('|')
        
        // Get deco from product
        let deco = item.product_id ? (productDecoMap.get(item.product_id) || '') : ''
        
        // Add any product-specific deco logic here if needed
        
        const existing = summaryMap.get(key)
        if (existing) {
          summaryMap.set(key, { quantity: existing.quantity + 1, deco: existing.deco })
        } else {
          summaryMap.set(key, { quantity: 1, deco })
        }
      })
    })

    // Convert map to array for Excel
    const summaryData = Array.from(summaryMap.entries()).map(([key, data]) => {
      const [productName, customerItem, color, size] = key.split('|')
      return {
        'Product Name': productName,
        'Customer Item #': customerItem,
        'Color': color,
        'Size': size,
        'Deco': data.deco || '',
        'Quantity': data.quantity
      }
    }).sort((a, b) => {
      // Sort by product name, then color, then size
      if (a['Product Name'] !== b['Product Name']) {
        return a['Product Name'].localeCompare(b['Product Name'])
      }
      if (a['Color'] !== b['Color']) {
        return a['Color'].localeCompare(b['Color'])
      }
      return a['Size'].localeCompare(b['Size'])
    })

    // Create workbook with two sheets
    const wb = XLSX.utils.book_new()
    
    // Detailed Orders sheet
    const wsDetailed = XLSX.utils.json_to_sheet(detailedData)
    XLSX.utils.book_append_sheet(wb, wsDetailed, 'Detailed Orders')
    
    // Distribution Summary sheet
    const wsSummary = XLSX.utils.json_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Distribution Summary')

    // Generate filename with current date
    const filename = `ra-new-hires-orders-${new Date().toISOString().split('T')[0]}.xlsx`

    // Write file
    XLSX.writeFile(wb, filename)
  }

  // Sorting logic
  const sortedOrders = orders.length > 0 ? [...orders].sort((a, b) => {
    let aValue: any = a[sortColumn]
    let bValue: any = b[sortColumn]
    
    // Handle nested properties
    if (sortColumn === 'created_at') {
      aValue = new Date(a.created_at).getTime()
      bValue = new Date(b.created_at).getTime()
    } else if (sortColumn === 'first_name' || sortColumn === 'last_name') {
      // For name sorting, combine first and last name
      aValue = `${a.first_name} ${a.last_name}`.toLowerCase()
      bValue = `${b.first_name} ${b.last_name}`.toLowerCase()
    } else if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase()
      bValue = bValue.toLowerCase()
    }
    
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
    return 0
  }) : []

  // Pagination calculations
  const totalPages = Math.ceil(sortedOrders.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedOrders = sortedOrders.slice(startIndex, endIndex)
  const currentPageSelectedOrders = paginatedOrders.filter(o => selectedOrders.has(o.id))
  const allCurrentPageSelected = paginatedOrders.length > 0 && currentPageSelectedOrders.length === paginatedOrders.length

  // Handle column header click
  const handleSort = (column: keyof OrderWithItems) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('desc')
    }
    setCurrentPage(1) // Reset to first page when sorting changes
  }

  // Sort indicator component
  const SortIndicator = ({ column }: { column: keyof OrderWithItems }) => {
    if (sortColumn !== column) {
      return (
        <svg className="w-4 h-4 ml-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      )
    }
    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 ml-1 text-[#c8102e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 ml-1 text-[#c8102e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    )
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 relative" style={{ backgroundColor: '#00263a' }}>
        <div className="text-white text-xl">Checking admin access...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8 px-4 relative" style={{ backgroundColor: '#00263a' }}>
      <HelpIcon />
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">

          {/* Code Generator Section */}
          {showCodeGenerator && (
            <div className="mb-6 p-6 bg-gray-50 rounded-lg border border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Access Code Generator</h2>
              
              <div className="flex gap-4 items-end mb-4">
                <div className="flex-1">
                  <label htmlFor="codeQuantity" className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Codes to Generate
                  </label>
                  <input
                    type="number"
                    id="codeQuantity"
                    min="1"
                    max="1000"
                    value={codeQuantity}
                    onChange={(e) => setCodeQuantity(parseInt(e.target.value) || 10)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#c8102e] focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handleGenerateCodes}
                  disabled={generatingCodes}
                  className="px-6 py-2 text-white rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#c8102e' }}
                >
                  {generatingCodes ? 'Generating...' : 'Generate Codes'}
                </button>
              </div>

              {generatedCodes.length > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm font-medium text-gray-700">
                      Generated {generatedCodes.length} code(s)
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveCodes}
                        disabled={savingCodes || generatedCodes.length === 0}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        {savingCodes ? 'Saving...' : 'Save to Database'}
                      </button>
                      <button
                        onClick={handleExportCodes}
                        disabled={generatedCodes.length === 0}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        Export to Excel
                      </button>
                    </div>
                  </div>
                  <div className="bg-white rounded-md border border-gray-300 p-4 max-h-60 overflow-y-auto">
                    <div className="grid grid-cols-6 gap-2 font-mono text-sm">
                      {generatedCodes.map((code, index) => (
                        <div key={index} className="px-2 py-1 bg-gray-50 rounded text-center text-gray-900">
                          {code}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Code Manager Section */}
          {showCodeManager && (
            <div className="mb-6 p-6 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Access Code Manager</h2>
                <div className="flex gap-2">
                  <select
                    value={codeFilter}
                    onChange={(e) => setCodeFilter(e.target.value as 'all' | 'used' | 'unused')}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="all">All Codes</option>
                    <option value="used">Used Only</option>
                    <option value="unused">Unused Only</option>
                  </select>
                  <button
                    onClick={loadAccessCodes}
                    disabled={loadingCodes}
                    className="px-4 py-1 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm disabled:opacity-50"
                  >
                    {loadingCodes ? 'Loading...' : 'Refresh'}
                  </button>
                </div>
              </div>

              {loadingCodes ? (
                <div className="text-center py-8 text-gray-600">Loading codes...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 bg-white rounded-md">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Code
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Created
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Used At
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {accessCodes
                        .filter(code => {
                          if (codeFilter === 'used') return code.used
                          if (codeFilter === 'unused') return !code.used
                          return true
                        })
                        .map((code) => (
                          <tr key={code.id}>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-900">
                              {code.code}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              {code.used ? (
                                <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                                  Used
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                                  Available
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                              {code.email || '-'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                              {new Date(code.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                              {code.used_at ? new Date(code.used_at).toLocaleDateString() : '-'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleToggleCodeStatus(code.id, code.used)}
                                  disabled={editingCodeId === code.id}
                                  className={`px-2 py-1 text-xs rounded-md ${
                                    code.used
                                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                      : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                                  title={code.used ? 'Mark as unused' : 'Mark as used'}
                                >
                                  {editingCodeId === code.id ? 'Updating...' : code.used ? 'Mark Unused' : 'Mark Used'}
                                </button>
                                <button
                                  onClick={() => handleDeleteCode(code.id, code.code)}
                                  disabled={editingCodeId === code.id}
                                  className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-md hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Delete code"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {accessCodes.filter(code => {
                    if (codeFilter === 'used') return code.used
                    if (codeFilter === 'unused') return !code.used
                    return true
                  }).length === 0 && (
                    <div className="text-center py-8 text-gray-600">No codes found.</div>
                  )}
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="text-lg text-gray-600">Loading orders...</div>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-lg text-gray-600">No orders yet</div>
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-4">
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="p-2 rounded-md bg-[#c8102e] text-white hover:bg-[#e63946] hover:scale-110 transition-all"
                  title="Back to Landing Page"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
                <div className="text-center flex-1">
                  <h1 className="text-3xl font-bold text-gray-900">Order Management</h1>
                  <p className="text-gray-600 mt-1">Total Orders: {orders.length}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowCodeGenerator(!showCodeGenerator)
                      if (!showCodeGenerator) setShowCodeManager(false)
                    }}
                    className="p-2 rounded-md bg-[#c8102e] text-white hover:bg-[#e63946] hover:scale-110 transition-all"
                    title={showCodeGenerator ? 'Hide Code Generator' : 'Generate Codes'}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      setShowCodeManager(!showCodeManager)
                      if (!showCodeManager) setShowCodeGenerator(false)
                    }}
                    className="p-2 rounded-md bg-[#c8102e] text-white hover:bg-[#e63946] hover:scale-110 transition-all"
                    title={showCodeManager ? 'Hide Code Manager' : 'Manage Codes'}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <button
                    onClick={loadOrders}
                    className="p-2 rounded-md bg-[#c8102e] text-white hover:bg-[#e63946] hover:scale-110 transition-all"
                    title="Refresh orders"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  {selectedOrders.size > 0 && (
                    <button
                      onClick={() => setShowBulkEdit(true)}
                      className="p-2 rounded-md bg-[#c8102e] text-white hover:bg-[#e63946] hover:scale-110 transition-all"
                      title={`Bulk edit ${selectedOrders.size} selected order(s)`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={exportToExcel}
                    disabled={orders.length === 0}
                    className="p-2 rounded-md bg-[#c8102e] text-white hover:bg-[#e63946] hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#c8102e] disabled:hover:scale-100 transition-all"
                    title="Exports two sheets: Detailed Orders and Distribution Summary"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)]">
                <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={allCurrentPageSelected}
                        onChange={(e) => {
                          const newSelected = new Set(selectedOrders)
                          if (e.target.checked) {
                            paginatedOrders.forEach(order => newSelected.add(order.id))
                          } else {
                            paginatedOrders.forEach(order => newSelected.delete(order.id))
                          }
                          setSelectedOrders(newSelected)
                        }}
                        className="rounded border-gray-300 text-[#c8102e] focus:ring-[#c8102e]"
                      />
                    </th>
                    <th 
                      className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('created_at')}
                    >
                      <div className="flex items-center justify-center">
                        Date
                        <SortIndicator column="created_at" />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('order_number')}
                    >
                      <div className="flex items-center justify-center">
                        Order #
                        <SortIndicator column="order_number" />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('code')}
                    >
                      <div className="flex items-center justify-center">
                        Code
                        <SortIndicator column="code" />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center justify-center">
                        Status
                        <SortIndicator column="status" />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('first_name')}
                    >
                      <div className="flex items-center justify-center">
                        Name
                        <SortIndicator column="first_name" />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('email')}
                    >
                      <div className="flex items-center justify-center">
                        Email
                        <SortIndicator column="email" />
                      </div>
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedOrders.map((order) => (
                    <tr key={order.id} className={selectedOrders.has(order.id) ? 'bg-blue-50' : ''}>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <input
                          type="checkbox"
                          checked={selectedOrders.has(order.id)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedOrders)
                            if (e.target.checked) {
                              newSelected.add(order.id)
                            } else {
                              newSelected.delete(order.id)
                            }
                            setSelectedOrders(newSelected)
                          }}
                          className="rounded border-gray-300 text-[#c8102e] focus:ring-[#c8102e]"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-center">
                        {order.order_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono text-center">
                        {order.code}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <select
                          value={order.status || 'Pending'}
                          onChange={async (e) => {
                            const newStatus = e.target.value as 'Pending' | 'Backorder' | 'Fulfillment' | 'Delivered'
                            try {
                              const { error } = await supabase
                                .from('ra_new_hire_orders')
                                .update({ status: newStatus })
                                .eq('id', order.id)
                              
                              if (error) throw error
                              await loadOrders()
                            } catch (err: any) {
                              console.error('Failed to update status:', err)
                              alert(`Failed to update status: ${err.message || 'Unknown error'}`)
                            }
                          }}
                          className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-[#c8102e] focus:border-transparent"
                        >
                          <option value="Pending">Pending</option>
                          <option value="Backorder">Backorder</option>
                          <option value="Fulfillment">Fulfillment</option>
                          <option value="Delivered">Delivered</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {order.first_name} {order.last_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {order.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => setShowProductsPopup({ orderId: order.id, items: order.items, program: order.program })}
                            className="p-2 rounded-md bg-[#c8102e] text-white hover:bg-[#e63946] hover:scale-110 transition-all"
                            title="View products"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setConfirmCancel({ orderId: order.id, orderNumber: order.order_number })}
                            disabled={cancelingOrderId === order.id}
                            className="p-2 rounded-md bg-[#c8102e] text-white hover:bg-[#e63946] hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#c8102e] disabled:hover:scale-100 transition-all"
                            title="Cancel this order"
                          >
                            {cancelingOrderId === order.id ? (
                              <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              
              {/* Pagination Controls */}
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">Show:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-[#c8102e] focus:border-transparent"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-sm text-gray-700">per page</span>
                </div>
                <div className="flex-1 text-center">
                  <span className="text-sm text-gray-700">
                    Showing {startIndex + 1} to {Math.min(endIndex, sortedOrders.length)} of {sortedOrders.length} orders
                  </span>
                </div>
                <div className="flex gap-1">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
                      title="First page"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
                      title="Previous page"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="px-3 py-1 text-sm text-gray-700">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
                      title="Next page"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
                      title="Last page"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
            </div>
          )}
        </div>
      </div>

      {/* Code Save Message Modal */}
      {codeMessage && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="mb-4">
              {codeMessage.type === 'success' ? (
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Success</h2>
                </div>
              ) : (
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Error</h2>
                </div>
              )}
            </div>
            <p className={`mb-6 ${codeMessage.type === 'success' ? 'text-gray-600' : 'text-red-600'}`}>
              {codeMessage.message}
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setCodeMessage(null)}
                className="px-4 py-2 text-white rounded-md hover:opacity-90"
                style={{ backgroundColor: '#c8102e' }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Products Popup Modal */}
      {showProductsPopup && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Products Ordered</h2>
                <p className="text-sm text-gray-600 mt-1">Program: {showProductsPopup.program}</p>
              </div>
              <button
                onClick={() => setShowProductsPopup(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-2">
              {showProductsPopup.items.map((item, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-md">
                  <div className="font-medium text-gray-900">{item.product_name}</div>
                  {item.customer_item_number && (
                    <div className="text-sm text-gray-600">SKU: {item.customer_item_number}</div>
                  )}
                  {item.color && (
                    <div className="text-sm text-gray-600">Color: {item.color}</div>
                  )}
                  {item.size && (
                    <div className="text-sm text-gray-600">Size: {item.size}</div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowProductsPopup(null)}
                className="px-4 py-2 text-white rounded-md hover:opacity-90"
                style={{ backgroundColor: '#c8102e' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {showBulkEdit && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Bulk Edit {selectedOrders.size} Order(s)
            </h2>
            {!bulkAction ? (
              <>
                <p className="text-gray-600 mb-6">What would you like to do with the selected orders?</p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => setBulkAction('status')}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-left"
                  >
                    Update Status
                  </button>
                  <button
                    onClick={() => setBulkAction('cancel')}
                    className="px-4 py-2 border border-gray-300 rounded-md text-red-700 hover:bg-red-50 text-left"
                  >
                    Cancel Orders
                  </button>
                </div>
                <div className="mt-6 flex justify-end gap-4">
                  <button
                    onClick={() => {
                      setShowBulkEdit(false)
                      setBulkAction(null)
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : bulkAction === 'status' ? (
              <>
                <p className="text-gray-600 mb-4">Select new status for {selectedOrders.size} order(s):</p>
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value as typeof bulkStatus)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#c8102e] focus:border-transparent mb-6"
                >
                  <option value="Pending">Pending</option>
                  <option value="Backorder">Backorder</option>
                  <option value="Fulfillment">Fulfillment</option>
                  <option value="Delivered">Delivered</option>
                </select>
                <div className="flex justify-end gap-4">
                  <button
                    onClick={() => {
                      setBulkAction(null)
                      setBulkStatus('Pending')
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const orderIds = Array.from(selectedOrders)
                        if (orderIds.length === 0) {
                          alert('No orders selected')
                          return
                        }
                        
                        console.log('Updating orders:', orderIds, 'to status:', bulkStatus)
                        
                        const { data, error } = await supabase
                          .from('ra_new_hire_orders')
                          .update({ status: bulkStatus })
                          .in('id', orderIds)
                          .select()
                        
                        if (error) {
                          console.error('Supabase error:', error)
                          throw error
                        }
                        
                        console.log('Update result:', data)
                        
                        if (data && data.length > 0) {
                          await loadOrders()
                          setSelectedOrders(new Set())
                          setShowBulkEdit(false)
                          setBulkAction(null)
                          setBulkStatus('Pending')
                          alert(`Successfully updated ${data.length} order(s) to ${bulkStatus}`)
                        } else {
                          alert('No orders were updated. Please check your selection.')
                        }
                      } catch (err: any) {
                        console.error('Failed to update status:', err)
                        alert(`Failed to update status: ${err.message || 'Unknown error'}`)
                      }
                    }}
                    className="px-4 py-2 text-white rounded-md hover:opacity-90"
                    style={{ backgroundColor: '#c8102e' }}
                  >
                    Update Status
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-red-600 mb-6">
                  Are you sure you want to cancel {selectedOrders.size} order(s)? This will restore inventory and cannot be undone.
                </p>
                <div className="flex justify-end gap-4">
                  <button
                    onClick={() => {
                      setBulkAction(null)
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        // Cancel each selected order
                        for (const orderId of Array.from(selectedOrders)) {
                          const order = orders.find(o => o.id === orderId)
                          if (!order) continue
                          
                          // Restore inventory for each item
                          for (const item of order.items) {
                            await restoreInventory(item.product_id, item.size || null, 1)
                          }
                          
                          // Mark code as unused
                          const { data: accessCode } = await supabase
                            .from('ra_new_hire_access_codes')
                            .select('id')
                            .eq('code', order.code)
                            .single()
                          
                          if (accessCode) {
                            await supabase
                              .from('ra_new_hire_access_codes')
                              .update({
                                used: false,
                                used_at: null,
                                order_id: null,
                                email: null
                              })
                              .eq('id', accessCode.id)
                          }
                          
                          // Delete the order
                          await supabase
                            .from('ra_new_hire_orders')
                            .delete()
                            .eq('id', orderId)
                        }
                        
                        await loadOrders()
                        setSelectedOrders(new Set())
                        setShowBulkEdit(false)
                        setBulkAction(null)
                      } catch (err: any) {
                        console.error('Failed to cancel orders:', err)
                        alert(`Failed to cancel orders: ${err.message || 'Unknown error'}`)
                      }
                    }}
                    className="px-4 py-2 text-white rounded-md hover:opacity-90"
                    style={{ backgroundColor: '#c8102e' }}
                  >
                    Yes, Cancel Orders
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {(confirmCancel || cancelMessage) && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            {cancelMessage ? (
              // Success/Error Message
              <>
                <div className="mb-4">
                  {cancelMessage.type === 'success' ? (
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h2 className="text-xl font-bold text-gray-900">Order Canceled</h2>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <h2 className="text-xl font-bold text-gray-900">Error</h2>
                    </div>
                  )}
                </div>
                <p className={`mb-6 ${cancelMessage.type === 'success' ? 'text-gray-600' : 'text-red-600'}`}>
                  {cancelMessage.message}
                </p>
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setCancelMessage(null)
                      setConfirmCancel(null)
                    }}
                    className="px-4 py-2 text-white rounded-md hover:opacity-90"
                    style={{ backgroundColor: '#c8102e' }}
                  >
                    OK
                  </button>
                </div>
              </>
            ) : confirmCancel ? (
              // Confirmation Dialog
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-4">Cancel Order?</h2>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to cancel order <strong>{confirmCancel.orderNumber}</strong>? 
                  This will restore inventory and cannot be undone.
                </p>
                <div className="flex justify-end gap-4">
                  <button
                    onClick={() => setConfirmCancel(null)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    disabled={cancelingOrderId !== null}
                  >
                    No, Keep Order
                  </button>
                  <button
                    onClick={() => handleCancelOrder(confirmCancel.orderId)}
                    disabled={cancelingOrderId !== null}
                    className="px-4 py-2 text-white rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#c8102e' }}
                  >
                    {cancelingOrderId === confirmCancel.orderId ? 'Canceling...' : 'Yes, Cancel Order'}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

