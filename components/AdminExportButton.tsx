'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'
import { OrderWithItems } from '@/types'

export default function AdminExportButton() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Check if admin code was used (stored in sessionStorage)
    const adminAuth = sessionStorage.getItem('adminAuth')
    const userCode = sessionStorage.getItem('userCode')
    const ADMIN_CODE = 'ADMIN'
    
    // User is admin if adminAuth is set OR if their code matches admin code
    const isAdminUser = adminAuth === 'true' || (userCode !== null && userCode.toUpperCase() === ADMIN_CODE)
    setIsAdmin(Boolean(isAdminUser))
  }, [])

  const exportToExcel = async () => {
    if (!isAdmin) return

    try {
      setLoading(true)

      // Fetch all orders with their items
      const { data: ordersData, error: ordersError } = await supabase
        .from('ra_new_hire_orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (ordersError) throw ordersError

      // Fetch all products to get deco information
      const { data: productsData, error: productsError } = await supabase
        .from('ra_new_hire_products')
        .select('id, deco')

      if (productsError) throw productsError

      // Create a map of product_id -> deco for quick lookup
      const productDecoMap = new Map<string, string>()
      productsData?.forEach(product => {
        if (product.deco) {
          productDecoMap.set(product.id, product.deco)
        }
      })

      // Fetch order items for each order
      const ordersWithItems: OrderWithItems[] = await Promise.all(
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

      // Sheet 1: Detailed Orders (one row per item)
      const detailedData = ordersWithItems.flatMap(order => {
        return order.items.map((item) => ({
          'Order Number': order.order_number,
          'Email': order.email,
          'Product Name': item.product_name,
          'Customer Item #': item.customer_item_number || '',
          'Color': item.color || '',
          'Size': item.size || '',
          'Shipping Name': order.shipping_name,
          'Shipping Address': order.shipping_address,
          'Shipping City': order.shipping_city,
          'Shipping State': order.shipping_state,
          'Shipping ZIP': order.shipping_zip,
          'Shipping Country': order.shipping_country,
          'Order Date': new Date(order.created_at).toLocaleDateString()
        }))
      })

      // Sheet 2: Distribution Summary (grouped by product/color/size)
      const summaryMap = new Map<string, { quantity: number; deco: string }>()
      
      ordersWithItems.forEach(order => {
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
    } catch (error: any) {
      console.error('Export error:', error)
      alert('Failed to export orders. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isAdmin) return null

  return (
    <button
      onClick={exportToExcel}
      disabled={loading}
      className="fixed top-4 right-4 z-50 px-4 py-2 text-white rounded-md shadow-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
      style={{ backgroundColor: '#c8102e' }}
      title="Export all orders to Excel (Admin only)"
    >
      {loading ? (
        <>
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"></circle>
            <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Exporting...
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="white" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export Orders
        </>
      )}
    </button>
  )
}

