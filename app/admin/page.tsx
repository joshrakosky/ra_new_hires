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
            order_id: null
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
      alert('No codes to save. Please generate codes first.')
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
        alert('All generated codes already exist in the database.')
        setSavingCodes(false)
        return
      }

      // Insert new codes
      const codesToInsert = newCodes.map(code => ({
        code,
        used: false,
        created_by: 'admin'
      }))

      const { error: insertError } = await supabase
        .from('ra_new_hire_access_codes')
        .insert(codesToInsert)

      if (insertError) throw insertError

      alert(`Successfully saved ${newCodes.length} code(s) to database.${existingCodeSet.size > 0 ? ` ${existingCodeSet.size} code(s) were already in the database.` : ''}`)
      
      // Remove saved codes from generated list
      setGeneratedCodes(generatedCodes.filter(code => existingCodeSet.has(code)))
    } catch (err: any) {
      console.error('Failed to save codes:', err)
      alert(`Failed to save codes: ${err.message || 'Unknown error'}`)
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
          <div className="mb-4">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="px-6 py-2 text-white rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#c8102e] focus:ring-offset-2 font-medium"
              style={{ backgroundColor: '#c8102e' }}
            >
              ← Back to Landing Page
            </button>
          </div>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Republic Airways New Hires - Order Management</h1>
              <p className="text-gray-600 mt-1">Total Orders: {orders.length}</p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setShowCodeGenerator(!showCodeGenerator)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                {showCodeGenerator ? 'Hide Code Generator' : 'Generate Codes'}
              </button>
              <button
                onClick={loadOrders}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Refresh
              </button>
              <button
                onClick={exportToExcel}
                disabled={orders.length === 0}
                className="px-4 py-2 text-white rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#c8102e' }}
                title="Exports two sheets: Detailed Orders and Distribution Summary"
              >
                Export to Excel
              </button>
            </div>
          </div>

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
                        <div key={index} className="px-2 py-1 bg-gray-50 rounded text-center">
                          {code}
                        </div>
                      ))}
                    </div>
                  </div>
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
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Program
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Products
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {order.order_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {order.code}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.first_name} {order.last_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.program}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <div className="space-y-1">
                          {order.items.map((item, idx) => (
                            <div key={idx}>
                              {item.product_name}
                              {item.customer_item_number && ` [${item.customer_item_number}]`}
                              {item.color && ` - ${item.color}`}
                              {item.size && ` (${item.size})`}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => setConfirmCancel({ orderId: order.id, orderNumber: order.order_number })}
                          disabled={cancelingOrderId === order.id}
                          className="px-3 py-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="Cancel this order"
                        >
                          {cancelingOrderId === order.id ? 'Canceling...' : 'Cancel'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

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

