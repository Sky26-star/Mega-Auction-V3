# MEGA AUCTION V1 — DATABASE DESIGN SPECIFICATION

> **Status:** APPROVED  
> **Version:** 1.1  
> **Date:** 2026-08-10  

---

## 1. Schema Summary (12 Tables)

| # | Table Name | Key Purpose | Primary Key | Foreign Keys | Constraints |
|---|---|---|---|---|---|
| 1 | `profiles` | User profiles | `id` (UUID) | `auth.users(id)` | UNIQUE(`username`) |
| 2 | `rooms` | Auction rooms | `id` (UUID) | `profiles(id)` | UNIQUE(`code`) |
| 3 | `room_participants` | Room members/bots | `id` (UUID) | `rooms`, `profiles`, `teams` | UNIQUE(`room_id`, `user_id`) |
| 4 | `player_sets` | Player pools | `id` (UUID) | `profiles(id)` | — |
| 5 | `players` | Catalog of players | `id` (UUID) | `player_sets(id)` | — |
| 6 | `auctions` | Auction sessions | `id` (UUID) | `rooms`, `player_sets`, `lots` | UNIQUE(`room_id`) |
| 7 | `teams` | Bidding teams | `id` (UUID) | `auctions(id)` | UNIQUE(`auction_id`, `name`), `purse >= 0` |
| 8 | `auction_lots` | Individual player lots | `id` (UUID) | `auctions`, `players`, `teams` | UNIQUE(`auction_id`, `lot_index`) |
| 9 | `squad_players` | Purchased players | `id` (UUID) | `teams`, `players`, `auctions` | UNIQUE(`auction_id`, `player_id`) |
| 10 | `bids` | Full bid history | `id` (UUID) | `auctions`, `lots`, `teams` | UNIQUE(`request_id`) |
| 11 | `auction_events` | Sequence audit log | `id` (UUID) | `auctions(id)` | UNIQUE(`auction_id`, `sequence`) |
| 12 | `bot_lot_state` | Bot decision state | `id` (UUID) | `auction_lots`, `teams` | UNIQUE(`lot_id`, `team_id`) |

---

## 2. Planned Migrations (Phase 2A & 2B)
- `00001_core_tables.sql` — Profiles, rooms, participants, player sets, players
- `00002_auction_tables.sql` — Auctions, teams, lots, squad players, bids, events, bot lot state
- `00003_rls_policies.sql` — Row Level Security policies
- `00004_functions_bid.sql` — `process_bid()`, `process_lot_expiry()`, `purchase_player()`, `process_expired_lots()`
- `00005_functions_auction.sql` — `start_auction()`, `advance_to_next_lot()`, `pause_auction()`, `resume_auction()`
- `00006_functions_bot.sql` — `evaluate_bot_interests()`, `check_and_execute_bot_bids()`
- `00007_triggers.sql` — Profile auto-creation & `updated_at` triggers
- `00008_cron_jobs.sql` — `expire-lots-backstop` (10s), `keep-alive` (6h), `clean-cron-logs` (daily)
