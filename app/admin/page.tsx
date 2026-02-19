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
  const [codeManagerPage, setCodeManagerPage] = useState(1)
  const [codeManagerItemsPerPage, setCodeManagerItemsPerPage] = useState(25)
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [showProductsPopup, setShowProductsPopup] = useState<{
    orderId: string
    items: OrderWithItems['items']
    program: string
    code?: string
    email?: string
    first_name?: string
    last_name?: string
    class_date?: string
    class_type?: string
  } | null>(null)
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [bulkAction, setBulkAction] = useState<'status' | 'cancel' | null>(null)
  const [bulkStatus, setBulkStatus] = useState<'Pending' | 'Backorder' | 'Fulfillment' | 'Delivered'>('Pending')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [sortColumn, setSortColumn] = useState<keyof OrderWithItems>('created_at')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [statusFilter, setStatusFilter] = useState<'all' | 'Pending' | 'Backorder' | 'Fulfillment' | 'Delivered'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  // Inventory modal: t-shirt rows by size + one row per kit component (from kit_items), not kit-level
  const [showInventoryModal, setShowInventoryModal] = useState(false)
  type InventoryRow = {
    productId: string | null
    componentName: string | null
    name: string
    size: string | null
    sku: string | null
    inventory: number
    reorder_point: number | null
    category: 'tshirt' | 'component'
  }
  const [inventoryProducts, setInventoryProducts] = useState<InventoryRow[]>([])
  const [loadingInventory, setLoadingInventory] = useState(false)
  const [editingInventoryCell, setEditingInventoryCell] = useState<{ productId: string | null; componentName: string | null; field: 'inventory' | 'reorder_point'; size: string | null } | null>(null)
  const [inventoryEditDraft, setInventoryEditDraft] = useState<string>('')
  const [savingInventoryCell, setSavingInventoryCell] = useState<string | null>(null)
  const [inventorySearchQuery, setInventorySearchQuery] = useState('')
  const [inventorySort, setInventorySort] = useState<{ col: 'name' | 'sku' | 'inventory' | 'reorder_point'; dir: 'asc' | 'desc' }>({ col: 'name', dir: 'asc' })
  const [showExportModal, setShowExportModal] = useState(false)
  const [showKitPendingConfirm, setShowKitPendingConfirm] = useState(false)
  const [exportLoading, setExportLoading] = useState<'xml' | 'detailed' | 'distribution' | 'kit' | 'kitPending' | null>(null)

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

  const loadInventoryProducts = async () => {
    try {
      setLoadingInventory(true)
      const { data: productsData, error: productsError } = await supabase
        .from('ra_new_hire_products')
        .select('id, name, customer_item_number, inventory, inventory_by_size, reorder_point, category, kit_items')
        .in('category', ['tshirt', 'kit'])
        .order('name')
      if (productsError) throw productsError

      const componentNames = new Set<string>()
      for (const p of productsData ?? []) {
        if (p.category === 'kit' && p.kit_items && Array.isArray(p.kit_items)) {
          for (const item of p.kit_items as Array<{ name: string }>) {
            if (item?.name) componentNames.add(item.name)
          }
        }
      }

      const { data: componentData, error: componentError } = await supabase
        .from('ra_new_hire_component_inventory')
        .select('component_name, inventory, reorder_point')
      if (componentError) throw componentError
      const componentMap = new Map<string, { inventory: number; reorder_point: number | null }>()
      for (const row of componentData ?? []) {
        componentMap.set(row.component_name, { inventory: row.inventory ?? 0, reorder_point: row.reorder_point ?? null })
      }

      const rows: InventoryRow[] = []
      for (const p of productsData ?? []) {
        if (p.category === 'tshirt' && p.inventory_by_size && typeof p.inventory_by_size === 'object') {
          const bySize = p.inventory_by_size as Record<string, number>
          const sizes = Object.keys(bySize).sort()
          for (const size of sizes) {
            rows.push({
              productId: p.id,
              componentName: null,
              name: p.name,
              size,
              sku: p.customer_item_number ? `${p.customer_item_number}-${size}` : null,
              inventory: bySize[size] ?? 0,
              reorder_point: p.reorder_point ?? null,
              category: 'tshirt'
            })
          }
        }
      }
      for (const name of Array.from(componentNames).sort()) {
        const data = componentMap.get(name) ?? { inventory: 0, reorder_point: null }
        rows.push({
          productId: null,
          componentName: name,
          name,
          size: null,
          sku: null,
          inventory: data.inventory,
          reorder_point: data.reorder_point,
          category: 'component'
        })
      }
      setInventoryProducts(rows)
    } catch (err: any) {
      console.error('Failed to load inventory:', err)
      setInventoryProducts([])
    } finally {
      setLoadingInventory(false)
    }
  }

  useEffect(() => {
    if (showInventoryModal) {
      loadInventoryProducts()
    }
  }, [showInventoryModal])

  const saveInventoryCell = async (row: InventoryRow, field: 'inventory' | 'reorder_point', value: string) => {
    const match =
      editingInventoryCell &&
      editingInventoryCell.field === field &&
      (row.componentName
        ? editingInventoryCell.componentName === row.componentName
        : editingInventoryCell.productId === row.productId && editingInventoryCell.size === row.size)
    if (!match) return
    const trimmed = value.trim()
    const isNull = trimmed === '' || trimmed === '–'
    const num = isNull ? null : parseInt(trimmed, 10)
    if (!isNull && num !== null && (Number.isNaN(num) || num < -999999)) {
      setEditingInventoryCell(null)
      setInventoryEditDraft('')
      return
    }
    const cellKey = row.componentName
      ? `component-${row.componentName}-${field}`
      : `${row.productId}-${row.size}-${field}`
    setSavingInventoryCell(cellKey)
    try {
      if (row.componentName) {
        const { error } = await supabase.from('ra_new_hire_component_inventory').upsert(
          {
            component_name: row.componentName,
            inventory: field === 'inventory' ? (num ?? 0) : row.inventory,
            reorder_point: field === 'reorder_point' ? (isNull ? null : num) : row.reorder_point,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'component_name' }
        )
        if (error) throw error
        if (field === 'inventory') {
          setInventoryProducts(prev =>
            prev.map(r => (r.componentName === row.componentName ? { ...r, inventory: num ?? 0 } : r))
          )
        } else {
          setInventoryProducts(prev =>
            prev.map(r => (r.componentName === row.componentName ? { ...r, reorder_point: isNull ? null : num! } : r))
          )
        }
      } else if (row.productId && row.category === 'tshirt') {
        if (field === 'reorder_point') {
          const { error } = await supabase
            .from('ra_new_hire_products')
            .update({ reorder_point: isNull ? null : num })
            .eq('id', row.productId)
          if (error) throw error
          setInventoryProducts(prev =>
            prev.map(r => (r.productId === row.productId ? { ...r, reorder_point: isNull ? null : num! } : r))
          )
        } else {
          const { data: product, error: fetchErr } = await supabase
            .from('ra_new_hire_products')
            .select('inventory_by_size')
            .eq('id', row.productId)
            .single()
          if (fetchErr) throw fetchErr
          const bySize = (product?.inventory_by_size as Record<string, number>) ?? {}
          const newBySize = { ...bySize, [row.size!]: num ?? 0 }
          const newInventory = Object.values(newBySize).reduce((a, b) => a + b, 0)
          const { error } = await supabase
            .from('ra_new_hire_products')
            .update({ inventory_by_size: newBySize, inventory: newInventory })
            .eq('id', row.productId)
          if (error) throw error
          setInventoryProducts(prev =>
            prev.map(r => (r.productId === row.productId && r.size === row.size ? { ...r, inventory: num ?? 0 } : r))
          )
        }
      }
    } catch (err: any) {
      console.error('Failed to update inventory:', err)
    } finally {
      setSavingInventoryCell(null)
      setEditingInventoryCell(null)
      setInventoryEditDraft('')
    }
  }

  // Lock body scroll when Code Generator, Code Manager, Inventory modal, Export modal, or Kit Pending confirm is open
  useEffect(() => {
    if (showCodeGenerator || showCodeManager || showInventoryModal || showExportModal || showKitPendingConfirm) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [showCodeGenerator, showCodeManager, showInventoryModal, showExportModal, showKitPendingConfirm])

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

  // Restore inventory for a product (add quantity back). Used when cancelling orders so stock
  // stays accurate for t-shirts (inventory + inventory_by_size) and kits (inventory).
  const restoreInventory = async (productId: string, size: string | null, quantity: number = 1): Promise<void> => {
    try {
      const { data: product, error: fetchError } = await supabase
        .from('ra_new_hire_products')
        .select('inventory, inventory_by_size, category')
        .eq('id', productId)
        .single()

      if (fetchError) throw fetchError

      const newInventory = (product.inventory || 0) + quantity
      let newInventoryBySize = product.inventory_by_size || {}
      if (size && newInventoryBySize[size] !== undefined) {
        newInventoryBySize = {
          ...newInventoryBySize,
          [size]: (newInventoryBySize[size] || 0) + quantity
        }
      }

      const updateData: { inventory: number; inventory_by_size?: Record<string, number> } = {
        inventory: newInventory
      }
      if (size && newInventoryBySize[size] !== undefined) {
        updateData.inventory_by_size = newInventoryBySize
      }

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

  // Build list of (product_id, size) to restore: one unit per distinct product/size.
  // Kit orders have many order items (one per component) with the same product_id; we restore
  // the kit once, not once per component, so inventory stays correct.
  const getRestoreListFromOrderItems = (items: OrderWithItems['items']): { productId: string; size: string | null }[] => {
    const key = (productId: string, size: string | null) => `${productId}|${size ?? ''}`
    const seen = new Set<string>()
    const list: { productId: string; size: string | null }[] = []
    for (const item of items) {
      const k = key(item.product_id, item.size || null)
      if (seen.has(k)) continue
      seen.add(k)
      list.push({ productId: item.product_id, size: item.size || null })
    }
    return list
  }

  const handleCancelOrder = async (orderId: string) => {
    try {
      setCancelingOrderId(orderId)
      const order = orders.find(o => o.id === orderId)
      if (!order) {
        throw new Error('Order not found')
      }

      // Restore inventory first (one unit per product/size so kits aren’t over-restored)
      const toRestore = getRestoreListFromOrderItems(order.items)
      for (const { productId, size } of toRestore) {
        await restoreInventory(productId, size, 1)
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

      // Delete the order (cascade deletes order items). Inventory was already restored above.
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

  /** Export detailed orders (one row per item) to Excel. */
  const exportDetailedOrders = async () => {
    setShowExportModal(false)
    setExportLoading('detailed')
    try {
      const detailedData = orders.flatMap(order =>
        order.items.map((item) => ({
          'Order Number': order.order_number,
          'Code': order.code,
          'First Name': order.first_name,
          'Last Name': order.last_name,
          'Email': order.email,
          'Class Date': order.class_date ? new Date(order.class_date).toLocaleDateString() : '',
          'Class Type': order.class_type || '',
          'Program': order.program,
          'Status': order.status || 'Pending',
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
      )
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailedData), 'Detailed Orders')
      XLSX.writeFile(wb, `ra-new-hires-detailed-orders-${new Date().toISOString().split('T')[0]}.xlsx`)
    } catch (err: any) {
      console.error('Export error:', err)
      alert('Failed to export. Please try again.')
    } finally {
      setExportLoading(null)
    }
  }

  /** Export product usage (distribution summary) to Excel. */
  const exportDistributionSummary = async () => {
    setShowExportModal(false)
    setExportLoading('distribution')
    try {
      const { data: productsData, error: productsError } = await supabase
        .from('ra_new_hire_products')
        .select('id, deco, inventory, inventory_by_size, reorder_point')
      if (productsError) throw productsError

      type ProductInfo = { deco: string; inventory: number; inventory_by_size?: Record<string, number>; reorder_point: number | null }
      const productInfoMap = new Map<string, ProductInfo>()
      productsData?.forEach((p: { id: string; deco?: string; inventory?: number; inventory_by_size?: Record<string, number>; reorder_point?: number | null }) => {
        productInfoMap.set(p.id, {
          deco: p.deco || '',
          inventory: p.inventory ?? 0,
          inventory_by_size: p.inventory_by_size,
          reorder_point: p.reorder_point ?? null
        })
      })

      const summaryMap = new Map<string, { quantity: number; deco: string; product_id: string | null; size: string }>()
      orders.forEach(order => {
        order.items.forEach(item => {
          const key = [item.product_name, item.customer_item_number || '', item.color || 'N/A', item.size || 'N/A'].join('|')
          const productInfo = item.product_id ? productInfoMap.get(item.product_id) : null
          const deco = productInfo?.deco || ''
          const size = item.size || 'N/A'
          const existing = summaryMap.get(key)
          if (existing) {
            summaryMap.set(key, { quantity: existing.quantity + 1, deco: existing.deco, product_id: existing.product_id, size: existing.size })
          } else {
            summaryMap.set(key, { quantity: 1, deco, product_id: item.product_id || null, size })
          }
        })
      })

      const summaryData = Array.from(summaryMap.entries()).map(([key, data]) => {
        const [productName, customerItem, color, size] = key.split('|')
        const productInfo = data.product_id ? productInfoMap.get(data.product_id) : null
        // For t-shirts: use size-specific inventory; for kits/components: use overall inventory
        const currentInventory = productInfo
          ? (data.size !== 'N/A' && productInfo.inventory_by_size?.[data.size] !== undefined
            ? productInfo.inventory_by_size[data.size]
            : productInfo.inventory)
          : ''
        const reorderPoint = productInfo?.reorder_point ?? ''
        return {
          'Product Name': productName,
          'Customer Item #': customerItem,
          'Color': color,
          'Size': size,
          'Deco': data.deco || '',
          'Quantity': data.quantity,
          'Current Inventory': currentInventory,
          'Reorder Point': reorderPoint
        }
      }).sort((a, b) => {
        if (a['Product Name'] !== b['Product Name']) return a['Product Name'].localeCompare(b['Product Name'])
        if (a['Color'] !== b['Color']) return a['Color'].localeCompare(b['Color'])
        return a['Size'].localeCompare(b['Size'])
      })

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), 'Product Usage')
      XLSX.writeFile(wb, `ra-new-hires-product-usage-${new Date().toISOString().split('T')[0]}.xlsx`)
    } catch (err: any) {
      console.error('Export error:', err)
      alert('Failed to export. Please try again.')
    } finally {
      setExportLoading(null)
    }
  }

  /** Export orders as XML for Foremost Graphics fulfillment. */
  const exportToXml = async () => {
    setShowExportModal(false)
    setExportLoading('xml')
    try {
      const res = await fetch('/api/fulfillment/orders')
      if (!res.ok) throw new Error(res.statusText)
      const xml = await res.text()
      const blob = new Blob([xml], { type: 'application/xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ra-new-hires-fulfillment-${new Date().toISOString().split('T')[0]}.xml`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error('XML export error:', err)
      alert('Failed to export XML. Please try again.')
    } finally {
      setExportLoading(null)
    }
  }

  /** Shared kit export logic. Builds Kit Orders + Kit Counts sheets from the given orders. */
  const exportKitOrdersWithFilter = async (ordersToExport: OrderWithItems[], filenameSuffix: string) => {
    setShowExportModal(false)
    try {
      const { data: productsData, error: productsError } = await supabase
        .from('ra_new_hire_products')
        .select('id, category, customer_item_number')
      if (productsError) throw productsError

      const productMap = new Map(
        (productsData ?? []).map((p: { id: string; category: string; customer_item_number?: string }) => [p.id, p])
      )

      const kitData = ordersToExport.map((order) => {
        let kitType = ''
        for (const item of order.items) {
          const product = item.product_id ? productMap.get(item.product_id) : null
          if (product?.category === 'kit') {
            kitType = product.customer_item_number ?? ''
            break
          }
        }
        return {
          'Order Number': order.order_number,
          'Name': [order.first_name || '', order.last_name || ''].filter(Boolean).join(' ') || '',
          'Kit Type': kitType || 'N/A',
          'T-Shirt Size': order.tshirt_size ?? 'N/A'
        }
      })

      const kitCountMap = new Map<string, number>()
      for (const row of kitData) {
        const k = row['Kit Type'] as string
        kitCountMap.set(k, (kitCountMap.get(k) ?? 0) + 1)
      }
      const kitCountData = Array.from(kitCountMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([kitType, count]) => ({ 'Kit Type': kitType, 'Count': count }))

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kitData), 'Kit Orders')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kitCountData), 'Kit Counts')
      const date = new Date().toISOString().split('T')[0]
      XLSX.writeFile(wb, `ra-new-hires-kit-orders${filenameSuffix ? `-${filenameSuffix}` : ''}-${date}.xlsx`)
    } catch (err: any) {
      console.error('Export error:', err)
      alert('Failed to export. Please try again.')
    } finally {
      setExportLoading(null)
    }
  }

  /** Export all orders at kit level for production fulfillment. */
  const exportKitOrders = async () => {
    setExportLoading('kit')
    await exportKitOrdersWithFilter(orders, '')
  }

  /** Open Kit Orders (pending) confirmation before export. */
  const handleKitOrdersPendingClick = () => {
    setShowExportModal(false)
    setShowKitPendingConfirm(true)
  }

  /** Run Kit Orders (pending) export, optionally updating status to Fulfillment after download. */
  const runKitOrdersPendingExport = async (updateStatusAfterDownload: boolean) => {
    const pendingOrders = orders.filter((o) => (o.status || 'Pending') === 'Pending')
    if (pendingOrders.length === 0) {
      alert('No pending orders to export.')
      setShowKitPendingConfirm(false)
      return
    }
    try {
      setExportLoading('kitPending')
      await exportKitOrdersWithFilter(pendingOrders, 'pending')
      if (updateStatusAfterDownload) {
        const orderIds = pendingOrders.map((o) => o.id)
        const { error } = await supabase
          .from('ra_new_hire_orders')
          .update({ status: 'Fulfillment' })
          .in('id', orderIds)
        if (error) throw error
        await loadOrders()
        alert(`Exported ${pendingOrders.length} order(s) and updated their status to Fulfillment.`)
      }
    } catch (err: any) {
      console.error('Kit pending export error:', err)
      alert(`Failed: ${err.message || 'Unknown error'}`)
    } finally {
      setExportLoading(null)
      setShowKitPendingConfirm(false)
    }
  }

  // Filter orders by status, then by search (order number, code, name, email, class type)
  const filteredByStatus = statusFilter === 'all'
    ? orders
    : orders.filter(order => (order.status || 'Pending') === statusFilter)
  const filteredOrders = !searchQuery.trim()
    ? filteredByStatus
    : filteredByStatus.filter(order => {
        const q = searchQuery.trim().toLowerCase()
        const name = `${order.first_name || ''} ${order.last_name || ''}`.toLowerCase()
        const email = (order.email || '').toLowerCase()
        const orderNumber = (order.order_number || '').toLowerCase()
        const code = (order.code || '').toLowerCase()
        const classType = (order.class_type || '').toLowerCase()
        const classDate = order.class_date ? new Date(order.class_date).toLocaleDateString().toLowerCase() : ''
        return (
          name.includes(q) ||
          email.includes(q) ||
          orderNumber.includes(q) ||
          code.includes(q) ||
          classType.includes(q) ||
          classDate.includes(q)
        )
      })

  // Sorting logic
  const sortedOrders = filteredOrders.length > 0 ? [...filteredOrders].sort((a, b) => {
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
    } else if (sortColumn === 'class_date') {
      aValue = a.class_date ? new Date(a.class_date).getTime() : 0
      bValue = b.class_date ? new Date(b.class_date).getTime() : 0
    } else if (sortColumn === 'class_type') {
      aValue = (a.class_type || '').toLowerCase()
      bValue = (b.class_type || '').toLowerCase()
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

  // Code Manager: filtered list and pagination
  const filteredAccessCodes = accessCodes.filter(code => {
    if (codeFilter === 'used') return code.used
    if (codeFilter === 'unused') return !code.used
    return true
  })
  const codeManagerTotalPages = Math.max(1, Math.ceil(filteredAccessCodes.length / codeManagerItemsPerPage))
  const codeManagerStartIndex = (codeManagerPage - 1) * codeManagerItemsPerPage
  const codeManagerEndIndex = codeManagerStartIndex + codeManagerItemsPerPage
  const paginatedAccessCodes = filteredAccessCodes.slice(codeManagerStartIndex, codeManagerEndIndex)

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
                <div className="flex items-center gap-2">
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
                  <input
                    type="search"
                    placeholder="Search orders..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#c8102e] focus:border-transparent bg-white min-w-[180px]"
                    title="Search by order #, code, name, email, class type, or class date"
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value as typeof statusFilter)
                      setCurrentPage(1) // Reset to first page when filter changes
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#c8102e] focus:border-transparent bg-white"
                    title="Filter by status"
                  >
                    <option value="all">All Status</option>
                    <option value="Pending">Pending</option>
                    <option value="Backorder">Backorder</option>
                    <option value="Fulfillment">Fulfillment</option>
                    <option value="Delivered">Delivered</option>
                  </select>
                </div>
                <div className="text-center flex-1">
                  <h1 className="text-3xl font-bold text-gray-900">Order Management</h1>
                  <p className="text-gray-600 mt-1">Total Orders: {sortedOrders.length} {statusFilter !== 'all' && `(${orders.length} total)`}</p>
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
                  <button
                    onClick={() => {
                      setShowInventoryModal(!showInventoryModal)
                      if (!showInventoryModal) {
                        setShowCodeGenerator(false)
                        setShowCodeManager(false)
                      }
                    }}
                    className="p-2 rounded-md bg-[#c8102e] text-white hover:bg-[#e63946] hover:scale-110 transition-all"
                    title="Inventory"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" />
                      <path d="M2 7l10 5 10-5" />
                      <path d="M12 22V12" />
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
                    onClick={() => setShowExportModal(true)}
                    disabled={orders.length === 0 || exportLoading !== null}
                    className="p-2 rounded-md bg-[#c8102e] text-white hover:bg-[#e63946] hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#c8102e] disabled:hover:scale-100 transition-all"
                    title="Export orders"
                  >
                    {exportLoading ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
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
                      onClick={() => handleSort('class_type')}
                    >
                      <div className="flex items-center justify-center">
                        Class Type
                        <SortIndicator column="class_type" />
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('class_date')}
                    >
                      <div className="flex items-center justify-center">
                        Class Date
                        <SortIndicator column="class_date" />
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
                        {order.class_type || '–'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {order.class_date ? new Date(order.class_date).toLocaleDateString() : '–'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => setShowProductsPopup({
                              orderId: order.id,
                              items: order.items,
                              program: order.program,
                              code: order.code,
                              email: order.email,
                              first_name: order.first_name,
                              last_name: order.last_name,
                              class_date: order.class_date,
                              class_type: order.class_type
                            })}
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

      {/* Code Generator Modal */}
      {showCodeGenerator && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowCodeGenerator(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b pb-4 mb-4">
              <h2 className="text-xl font-bold text-gray-900">Access Code Generator</h2>
              <button
                onClick={() => setShowCodeGenerator(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0">
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
                  <div className="overflow-x-auto overflow-y-auto max-h-[40vh] border border-gray-300 rounded-md">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                        <tr>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            #
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Code
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {generatedCodes.map((code, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                              {index + 1}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 text-center">
                              {code}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Code Manager Modal */}
      {showCodeManager && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowCodeManager(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-5xl w-full mx-4 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b pb-4 mb-4 flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-900">Access Code Manager</h2>
              <div className="flex items-center gap-2">
                <select
                  value={codeFilter}
                  onChange={(e) => {
                    setCodeFilter(e.target.value as 'all' | 'used' | 'unused')
                    setCodeManagerPage(1)
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#c8102e] focus:border-transparent bg-white"
                >
                  <option value="all">All Codes</option>
                  <option value="used">Used Only</option>
                  <option value="unused">Unused Only</option>
                </select>
                <button
                  onClick={loadAccessCodes}
                  disabled={loadingCodes}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm disabled:opacity-50"
                >
                  {loadingCodes ? 'Loading...' : 'Refresh'}
                </button>
                <button
                  onClick={() => setShowCodeManager(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 flex flex-col">
              {loadingCodes ? (
                <div className="text-center py-8 text-gray-600">Loading codes...</div>
              ) : (
                <>
                  <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                        <tr>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Code
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Created
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Used At
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredAccessCodes.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-600">
                              No codes found.
                            </td>
                          </tr>
                        ) : (
                          paginatedAccessCodes.map((code) => (
                            <tr key={code.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 text-center">
                                {code.code}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
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
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                                {code.email || '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                                {new Date(code.created_at).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                                {code.used_at ? new Date(code.used_at).toLocaleDateString() : '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                <div className="flex gap-2 justify-center">
                                  <button
                                    onClick={() => handleToggleCodeStatus(code.id, code.used)}
                                    disabled={editingCodeId === code.id}
                                    className="p-2 rounded-md bg-[#c8102e] text-white hover:bg-[#e63946] hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#c8102e] disabled:hover:scale-100 transition-all"
                                    title={code.used ? 'Mark as unused' : 'Mark as used'}
                                  >
                                    {editingCodeId === code.id ? (
                                      <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                      </svg>
                                    ) : code.used ? (
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                                      </svg>
                                    ) : (
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteCode(code.id, code.code)}
                                    disabled={editingCodeId === code.id}
                                    className="p-2 rounded-md bg-[#c8102e] text-white hover:bg-[#e63946] hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#c8102e] disabled:hover:scale-100 transition-all"
                                    title="Delete code"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {/* Code Manager pagination */}
                  {filteredAccessCodes.length > 0 && (
                    <div className="mt-4 flex items-center justify-between flex-shrink-0 border-t pt-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-700">Show:</span>
                        <select
                          value={codeManagerItemsPerPage}
                          onChange={(e) => {
                            setCodeManagerItemsPerPage(Number(e.target.value))
                            setCodeManagerPage(1)
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
                          Showing {codeManagerStartIndex + 1} to {Math.min(codeManagerEndIndex, filteredAccessCodes.length)} of {filteredAccessCodes.length} codes
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setCodeManagerPage(1)}
                          disabled={codeManagerPage === 1}
                          className="px-3 py-1 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
                          title="First page"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setCodeManagerPage(prev => Math.max(1, prev - 1))}
                          disabled={codeManagerPage === 1}
                          className="px-3 py-1 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
                          title="Previous page"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <span className="px-3 py-1 text-sm text-gray-700">
                          Page {codeManagerPage} of {codeManagerTotalPages}
                        </span>
                        <button
                          onClick={() => setCodeManagerPage(prev => Math.min(codeManagerTotalPages, prev + 1))}
                          disabled={codeManagerPage === codeManagerTotalPages}
                          className="px-3 py-1 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
                          title="Next page"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setCodeManagerPage(codeManagerTotalPages)}
                          disabled={codeManagerPage === codeManagerTotalPages}
                          className="px-3 py-1 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
                          title="Last page"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Kit Inventory Modal */}
      {showInventoryModal && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowInventoryModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-4xl w-full mx-4 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-4 border-b pb-4 mb-4 flex-shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={loadInventoryProducts}
                  disabled={loadingInventory}
                  className="p-2 rounded-md bg-[#c8102e] text-white hover:bg-[#e63946] hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#c8102e] disabled:hover:scale-100 transition-all"
                  title="Refresh"
                >
                  {loadingInventory ? (
                    <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                </button>
                <input
                  type="search"
                  placeholder="Search inventory..."
                  value={inventorySearchQuery}
                  onChange={(e) => setInventorySearchQuery(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#c8102e] focus:border-transparent bg-white min-w-[180px]"
                  title="Search by name or SKU"
                />
              </div>
              <h2 className="text-xl font-bold text-gray-900 flex-1 text-center">Inventory</h2>
              <div className="flex items-center gap-2 min-w-[80px] justify-end">
                <button
                  onClick={() => setShowInventoryModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {loadingInventory ? (
                <div className="text-center py-8 text-gray-600">Loading...</div>
              ) : (
                <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
                  {(() => {
                    const q = inventorySearchQuery.trim().toLowerCase()
                    const filtered = !q ? inventoryProducts : inventoryProducts.filter(row =>
                      (row.name || '').toLowerCase().includes(q) || (row.sku || '').toLowerCase().includes(q)
                    )
                    const toggleSort = (col: 'name' | 'sku' | 'inventory' | 'reorder_point') => {
                      setInventorySort(prev => prev.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
                    }
                    const sorted = [...filtered].sort((a, b) => {
                      const { col, dir } = inventorySort
                      const mult = dir === 'asc' ? 1 : -1
                      if (col === 'name') return mult * (a.name || '').localeCompare(b.name || '')
                      if (col === 'sku') return mult * (a.sku || '').localeCompare(b.sku || '')
                      if (col === 'inventory') return mult * (a.inventory - b.inventory)
                      return mult * ((a.reorder_point ?? 0) - (b.reorder_point ?? 0))
                    })
                    const SortIndicator = ({ c }: { c: 'name' | 'sku' | 'inventory' | 'reorder_point' }) =>
                      inventorySort.col === c ? <span className="ml-1">{inventorySort.dir === 'asc' ? '↑' : '↓'}</span> : null
                    return (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th
                          className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                          onClick={() => toggleSort('name')}
                        >
                          Name <SortIndicator c="name" />
                        </th>
                        <th
                          className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                          onClick={() => toggleSort('sku')}
                        >
                          SKU <SortIndicator c="sku" />
                        </th>
                        <th
                          className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                          onClick={() => toggleSort('inventory')}
                        >
                          Inventory <SortIndicator c="inventory" />
                        </th>
                        <th
                          className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                          onClick={() => toggleSort('reorder_point')}
                        >
                          Reorder Point <SortIndicator c="reorder_point" />
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-600">
                            {inventoryProducts.length === 0 ? 'No products found.' : 'No matches for search.'}
                          </td>
                        </tr>
                      ) : (
                        sorted.map((row) => {
                          const rowKey = row.componentName ? `component-${row.componentName}` : `${row.productId}-${row.size}`
                          const isEditingInventory =
                            editingInventoryCell?.field === 'inventory' &&
                            (row.componentName ? editingInventoryCell?.componentName === row.componentName : editingInventoryCell?.productId === row.productId && editingInventoryCell?.size === row.size)
                          const isEditingReorder =
                            editingInventoryCell?.field === 'reorder_point' &&
                            (row.componentName ? editingInventoryCell?.componentName === row.componentName : editingInventoryCell?.productId === row.productId && editingInventoryCell?.size === row.size)
                          const savingKey = row.componentName ? `component-${row.componentName}-inventory` : `${row.productId}-${row.size}-inventory`
                          const savingReorderKey = row.componentName ? `component-${row.componentName}-reorder_point` : `${row.productId}-${row.size}-reorder_point`
                          return (
                            <tr key={rowKey}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                                {row.name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono text-center">
                                {row.sku ?? '–'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                {isEditingInventory ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <input
                                      type="number"
                                      value={inventoryEditDraft}
                                      onChange={(e) => setInventoryEditDraft(e.target.value)}
                                      onBlur={() => saveInventoryCell(row, 'inventory', inventoryEditDraft)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveInventoryCell(row, 'inventory', inventoryEditDraft)
                                        if (e.key === 'Escape') {
                                          setEditingInventoryCell(null)
                                          setInventoryEditDraft('')
                                        }
                                      }}
                                      className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#c8102e] focus:border-transparent"
                                      autoFocus
                                    />
                                    {savingInventoryCell === savingKey && (
                                      <span className="text-xs text-gray-500">Saving…</span>
                                    )}
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingInventoryCell({ productId: row.productId, componentName: row.componentName, field: 'inventory', size: row.size })
                                      setInventoryEditDraft(String(row.inventory))
                                    }}
                                    className="text-gray-900 hover:bg-gray-100 px-2 py-1 rounded"
                                  >
                                    {row.inventory}
                                  </button>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                {isEditingReorder ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <input
                                      type="number"
                                      value={inventoryEditDraft}
                                      onChange={(e) => setInventoryEditDraft(e.target.value)}
                                      onBlur={() => saveInventoryCell(row, 'reorder_point', inventoryEditDraft)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveInventoryCell(row, 'reorder_point', inventoryEditDraft)
                                        if (e.key === 'Escape') {
                                          setEditingInventoryCell(null)
                                          setInventoryEditDraft('')
                                        }
                                      }}
                                      placeholder="–"
                                      className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#c8102e] focus:border-transparent"
                                      autoFocus
                                    />
                                    {savingInventoryCell === savingReorderKey && (
                                      <span className="text-xs text-gray-500">Saving…</span>
                                    )}
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingInventoryCell({ productId: row.productId, componentName: row.componentName, field: 'reorder_point', size: row.size })
                                      setInventoryEditDraft(row.reorder_point != null ? String(row.reorder_point) : '')
                                    }}
                                    className="text-gray-900 hover:bg-gray-100 px-2 py-1 rounded"
                                  >
                                    {row.reorder_point != null ? row.reorder_point : '–'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                    )
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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

      {/* Kit Orders Pending - Confirm before download */}
      {showKitPendingConfirm && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => exportLoading === null && setShowKitPendingConfirm(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-gray-900 mb-4">Kit Orders (pending)</h2>
            <p className="text-gray-600 mb-6">
              Do you want to update the status of these {orders.filter((o) => (o.status || 'Pending') === 'Pending').length} order(s) to Fulfillment after download?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => runKitOrdersPendingExport(false)}
                disabled={exportLoading !== null}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                No, just download
              </button>
              <button
                onClick={() => runKitOrdersPendingExport(true)}
                disabled={exportLoading !== null}
                className="flex-1 px-4 py-2 text-white rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#c8102e' }}
              >
                Yes, update after download
              </button>
            </div>
            <button
              onClick={() => setShowKitPendingConfirm(false)}
              className="mt-4 w-full px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowExportModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-gray-900 mb-4">Export</h2>
            <div className="space-y-2">
              <button
                onClick={exportToXml}
                disabled={orders.length === 0}
                className="w-full px-4 py-3 text-left rounded-md bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                XML (Foremost fulfillment)
              </button>
              <button
                onClick={exportDistributionSummary}
                disabled={orders.length === 0}
                className="w-full px-4 py-3 text-left rounded-md bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Product Usage (distribution summary)
              </button>
              <button
                onClick={exportDetailedOrders}
                disabled={orders.length === 0}
                className="w-full px-4 py-3 text-left rounded-md bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Detailed Orders
              </button>
              <button
                onClick={exportKitOrders}
                disabled={orders.length === 0}
                className="w-full px-4 py-3 text-left rounded-md bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Kit Orders (fulfillment)
              </button>
              <button
                onClick={handleKitOrdersPendingClick}
                disabled={orders.filter((o) => (o.status || 'Pending') === 'Pending').length === 0}
                className="w-full px-4 py-3 text-left rounded-md bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Kit Orders (pending)
              </button>
            </div>
            <button
              onClick={() => setShowExportModal(false)}
              className="mt-4 w-full px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Products Popup Modal */}
      {showProductsPopup && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Order Details</h2>
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
            {/* Contact and class info (code, name, email, class date, class type) */}
            <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-1">
              {showProductsPopup.code != null && showProductsPopup.code !== '' && (
                <p className="text-sm text-gray-900"><span className="font-medium">Code:</span> <span className="font-mono">{showProductsPopup.code}</span></p>
              )}
              {showProductsPopup.first_name != null && showProductsPopup.last_name != null && (
                <p className="text-sm text-gray-900"><span className="font-medium">Name:</span> {showProductsPopup.first_name} {showProductsPopup.last_name}</p>
              )}
              {showProductsPopup.email != null && showProductsPopup.email !== '' && (
                <p className="text-sm text-gray-900"><span className="font-medium">Email:</span> {showProductsPopup.email}</p>
              )}
              {showProductsPopup.class_date != null && showProductsPopup.class_date !== '' && (
                <p className="text-sm text-gray-900"><span className="font-medium">Class Date:</span> {new Date(showProductsPopup.class_date).toLocaleDateString()}</p>
              )}
              {showProductsPopup.class_type != null && showProductsPopup.class_type !== '' && (
                <p className="text-sm text-gray-900"><span className="font-medium">Class Type:</span> {showProductsPopup.class_type}</p>
              )}
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Products Ordered</h3>
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
                        // Cancel each selected order; restore inventory then delete
                        for (const orderId of Array.from(selectedOrders)) {
                          const order = orders.find(o => o.id === orderId)
                          if (!order) continue
                          const toRestore = getRestoreListFromOrderItems(order.items)
                          for (const { productId, size } of toRestore) {
                            await restoreInventory(productId, size, 1)
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

