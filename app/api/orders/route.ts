import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Generate unique order number in format sykedt-001, sykedt-002, etc.
async function generateOrderNumber(): Promise<string> {
  // Get the highest existing order number
  const { data: orders, error } = await supabase
    .from('syk_edt_orders')
    .select('order_number')
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    console.error('Error fetching orders:', error)
    // Fallback: start from 1 if there's an error
    return 'sykedt-001'
  }

  if (!orders || orders.length === 0) {
    // First order
    return 'sykedt-001'
  }

  // Extract number from existing order (e.g., "sykedt-001" -> 1)
  const lastOrderNumber = orders[0].order_number
  const match = lastOrderNumber.match(/sykedt-(\d+)/i)
  
  if (match) {
    const lastNumber = parseInt(match[1], 10)
    const nextNumber = lastNumber + 1
    return `sykedt-${String(nextNumber).padStart(3, '0')}`
  }

  // If format doesn't match, start from 1
  return 'sykedt-001'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, shipping, product } = body

    // Validate required fields
    if (!email || !shipping || !product) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check for duplicate order by email (one order per email)
    const { data: existingOrder } = await supabase
      .from('syk_edt_orders')
      .select('id')
      .eq('email', email.toLowerCase())
      .single()

    if (existingOrder) {
      return NextResponse.json(
        { error: 'An order already exists for this email address. Only one order per email is allowed.' },
        { status: 400 }
      )
    }

    // Generate order number
    const orderNumber = await generateOrderNumber()

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('syk_edt_orders')
      .insert({
        email: email.toLowerCase(),
        order_number: orderNumber,
        shipping_name: shipping.name,
        shipping_address: shipping.address,
        shipping_address2: shipping.address2 || null,
        shipping_city: shipping.city,
        shipping_state: shipping.state,
        shipping_zip: shipping.zip,
        shipping_country: shipping.country || 'USA'
      })
      .select()
      .single()

    if (orderError) throw orderError

    // Get product details for order item
    const { data: productData } = await supabase
      .from('syk_edt_products')
      .select('name, customer_item_number')
      .eq('id', product.productId)
      .single()

    // Handle YETI Kit specially - creates 3 items (one for each size) with individual colors
    const isYetiKit = product.isYetiKit || productData?.name === 'YETI Kit'
    
    let orderItems: any[] = []
    
    if (isYetiKit && product.yeti8ozColor && product.yeti26ozColor && product.yeti35ozColor) {
      // Create 3 order items for YETI Kit - one for each size with its selected color
      const yetiItems = [
        {
          size: '8oz',
          name: 'YETI Rambler 8oz Stackable Cup',
          color: product.yeti8ozColor
        },
        {
          size: '26oz',
          name: 'YETI Rambler 26oz Straw Bottle',
          color: product.yeti26ozColor
        },
        {
          size: '35oz',
          name: 'YETI Rambler 35oz Tumbler with Straw Lid',
          color: product.yeti35ozColor
        }
      ]
      
      orderItems = yetiItems.map(item => ({
        order_id: order.id,
        product_id: product.productId,
        product_name: item.name,
        customer_item_number: productData?.customer_item_number || null,
        color: item.color,
        size: item.size
      }))
    } else {
      // Regular single product
      orderItems = [
        {
          order_id: order.id,
          product_id: product.productId,
          product_name: productData?.name || 'Unknown Product',
          customer_item_number: productData?.customer_item_number || null,
          color: product.color || null,
          size: product.size || null
        }
      ]
    }

    const { error: itemsError } = await supabase
      .from('syk_edt_order_items')
      .insert(orderItems)

    if (itemsError) throw itemsError

    return NextResponse.json({
      success: true,
      order_number: orderNumber,
      order_id: order.id
    })

  } catch (error: any) {
    console.error('Order creation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create order' },
      { status: 500 }
    )
  }
}

