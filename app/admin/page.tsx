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
        'T-Shirt Size': order.tshirt_size || '',
        'Product Name': item.product_name,
        'Customer Item #': item.customer_item_number || '',
        'Color': item.color || '',
        'Size': item.size || '',
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

