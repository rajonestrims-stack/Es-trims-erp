# Security Specification: Inventory & Production Formulas

## Data Invariants
1. All documents must belong to a valid `businessId` that matches the user's profile.
2. `ownerId` must match the actual creator of the document.
3. Quantities and prices must be non-negative.
4. Production Formulas must have valid `piecesPerSheet` (>0).
5. Only 'editor' role can perform write operations.

## The Dirty Dozen (Attack Payloads)

| Attack Type | Target | Payload Snippet | Expected Result |
|-------------|--------|-----------------|-----------------|
| Type Poisoning | Formulas | `extraPercent: "high"` | DENY |
| UID Spoofing | Formulas | `ownerId: "other_user_id"` | DENY |
| Business Hijack| Items | `businessId: "rival_business"` | DENY |
| Shadow Update | Users | `{ role: "editor", isSuperAdmin: true }` | DENY |
| Resource Exhaust| Items | `name: "A" * 1024 * 1024` | DENY |
| Negative Value | Transact | `quantity: -100` | DENY |
| ID Poisoning | Formulas | Path: `/formulas/junk-char-$$$` | DENY |
| Access Breach | Formulas | `list` as user not in business | DENY |
| State Shortcut | Transact | `status: "active"` (from delete) | DENY |
| PII Scraper | Users | `list` all users | DENY (Isolated Profiles) |
| Orphan Creation| Transact | `itemId: "non_existent_id"` | DENY |
| Immutable Guard| Transact | Update `createdAt` | DENY |

## Implementation Plan
1. Define global helpers for Auth, ID validation, and Schema validation.
2. Implement strict `allow list` boundaries using `resource.data.businessId`.
3. use `affectedKeys().hasOnly()` for all updates.
4. Separate `get` and `list` permissions to satisfy the Query Enforcer pillar.
5. Deploy and verify.
