# Merchant Shop 2.2.0

Standalone Merchant Shop for Foundry VTT v14 + D&D 5e 5.3.3.

## Standalone design

Merchant Shop does not require, recommend, detect, or call Item Piles or any other external module. The shop owns:

- Item listing and sale flags
- D&D 5e item pricing
- Stock quantity
- Buyer/seller currency transfer
- Item transfer
- Purchase confirmation
- Rollback attempts on failed transactions
- DialogV2 UI and event handling

Only the **D&D 5e game system** is required.

## 2.2.0 fixes

- Removed all Item Piles dependency and API usage.
- Removed Item Piles recommendation from module manifest.
- Added real merchant stock reduction after a successful purchase.
- Added buyer item creation/stacking.
- Added seller currency credit and buyer currency deduction.
- Added rollback attempts for failed transaction steps.
- Buy buttons use rendered DialogV2 DOM event delegation.
- Purchase state is re-resolved immediately before the transaction.
- Supports CP/SP/EP/GP/PP using the D&D 5e currency structure.
