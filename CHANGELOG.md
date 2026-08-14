# Changelog

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

- v2.2.1: แสดงสินค้าทุกชิ้นแม้ผู้ซื้อมีเงินไม่พอ; ตรวจยอดเงินตอน transaction เท่านั้น เพื่อรองรับการรวมเงินกันซื้อ
