# Changelog

## 2.2.2
- Verified against Foundry VTT 14.368 and D&D 5e 5.3.3 (manifest `verified` set to 14.368).
- Token HUD hook now reads the actor from `app.document` first and falls back to `app.object`, and locates the button column more defensively.
- Purchased items no longer carry the seller's `system.container` reference, equipped/attuned state, or the shop's own `forSale` flag.
- Console-only warning when running on versions older than the verified ones.
- Fixed version strings so manifest, script and docs all agree.

## 2.2.1
- แสดงสินค้าทุกชิ้นแม้ผู้ซื้อมีเงินไม่พอ; ตรวจยอดเงินตอน transaction เท่านั้น เพื่อรองรับการรวมเงินกันซื้อ

## 2.2.0
- Converted Merchant Shop to a truly standalone module.
- Removed all Item Piles references, APIs, detection and recommendation.
- Implemented native merchant-to-buyer transaction flow.
- Merchant stock now decreases when an item is purchased.
- Currency moves from buyer to merchant.
- Added buyer item stacking/creation and rollback attempts.

## 2.1.0
- Repaired DialogV2 buy-button event binding.
- Previous release supported an Item Piles integration; that integration is removed in 2.2.0.
