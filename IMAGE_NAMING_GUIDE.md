# Image Naming Convention Guide

## Pattern
All product images follow this naming pattern:
```
SYKEDT_{item#}_{color}.jpg
```

## Examples
- `SYKEDT_NKFQ4762_AnthraciteHeather.jpg`
- `SYKEDT_NKFQ4762_Black.jpg`
- `SYKEDT_NKFQ4762_Darkgrey heather.jpg` (note: this one has a space)

## How It Works

1. **Item Number Extraction**: 
   - From `customer_item_number` field (e.g., "SYKEDT-AP-NKFQ4762")
   - Extract the last part after dashes: "NKFQ4762"

2. **Color Normalization**:
   - Database color: "Anthracite Heather" → Image: "AnthraciteHeather"
   - Database color: "Dark Grey Heather" → Image: "Darkgrey heather" (special case with space)
   - Database color: "Black" → Image: "Black"

3. **Path Generation**:
   - Final path: `/images/SYKEDT_NKFQ4762_AnthraciteHeather.jpg`

## Color Mappings

The `lib/imageUtils.ts` file handles color name normalization:

| Database Color | Image Filename |
|---------------|----------------|
| Anthracite Heather | AnthraciteHeather |
| Dark Grey Heather | Darkgrey heather |
| Black | Black |
| Graphite Heather | GraphiteHeather |
| TNF Black | TNFBlack |
| Cape Taupe | CapeTaupe |

## Adding New Products

When adding products to the database:
1. Ensure `customer_item_number` matches the item number in your image filenames
2. Use exact color names as they appear in the database
3. The system will automatically generate image paths

## File Location

All images should be placed in:
```
public/images/
```

## Testing

To verify image paths are correct:
1. Check browser console for 404 errors
2. Verify the generated path matches your actual filename
3. Update `normalizeColorForImage()` if you encounter mismatches

