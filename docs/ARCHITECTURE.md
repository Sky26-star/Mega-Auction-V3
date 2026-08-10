# MEGA AUCTION V1 — SYSTEM ARCHITECTURE

> **Status:** APPROVED  
> **Version:** 1.1  
> **Date:** 2026-08-10  

---

## 1. High-Level System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                       CLIENT (Browser)                        │
│                                                              │
│  Next.js React UI ← Zustand Store ← Supabase Realtime WS    │
│       │                                    │                  │
│  Presentation-only       Selective         Auto-reconnect     │
│  timer countdown         subscriptions    + Sequence Gap Check│
│       │                                    │                  │
└───────┼────────────────────────────────────┼──────────────────┘
        │ Server Actions                     │ WebSocket
        │ (with request_id)                  │ Subscription
        │ POST /api/heartbeat                │
        ▼                                    ▼
┌──────────────────────────────────────────────────────────────┐
│                     SERVER (Vercel)                            │
│                                                              │
│  Server Actions ──→ Auth Check ──→ Zod Validation            │
│       │                                                      │
│  Advisory Rule Engine (TypeScript, UX pre-validation)         │
│       │                                                      │
│  Supabase RPC call ──→ process_bid(..., p_request_id)        │
│       │                                                      │
│  Broadcast via Supabase Realtime REST API                     │
│  { sequence, event_type, payload }                           │
│       │                                                      │
└───────┼──────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────┐
│                  SUPABASE (PostgreSQL)                         │
│                                                              │
│  ┌────────────┐  ┌─────────────────────┐  ┌───────────────┐ │
│  │ 12 Tables  │  │ Database Functions   │  │ pg_cron       │ │
│  │ + RLS      │  │ (AUTHORITATIVE)      │  │               │ │
│  │ + Indexes  │  │                      │  │ Every 10s:    │ │
│  │ + Triggers │  │ process_bid()        │  │  expire lots  │ │
│  │            │  │ process_lot_expiry() │  │  execute bots │ │
│  │            │  │ purchase_player()    │  │               │ │
│  │            │  │ start_auction()      │  │ Every 6h:     │ │
│  │            │  │ advance_lot()        │  │  keep-alive   │ │
│  │            │  │ pause/resume()       │  │               │ │
│  │            │  │ evaluate_bots()      │  │ Daily:        │ │
│  │            │  │ execute_bot_bids()   │  │  clean logs   │ │
│  └────────────┘  └─────────────────────┘  └───────────────┘ │
│                                                              │
│  Authority: clock_timestamp() >= timer_expires_at            │
│  Concurrency: SELECT FOR UPDATE + pg_try_advisory_xact_lock  │
│  Idempotency: UNIQUE(request_id) on bids table               │
│  Sequence: Atomic increment on auctions.current_sequence     │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Key Architectural Tenets
1. **PostgreSQL Absolute Authority:** All state transitions, validations, and mutations occur inside database functions (`process_bid()`, `process_lot_expiry()`, etc.).
2. **Clock Timestamp Consistency:** `clock_timestamp()` is used exclusively for all business timing decisions (expiry, staleness, bot delays).
3. **Idempotent Mutations:** Every bid requires a client `request_id` enforced via `bids.request_id UNIQUE`.
4. **Sequence-Numbered Realtime:** Events carry authoritative `sequence` integers enabling client gap detection and full-state recovery.
5. **Heartbeat-Driven Bots:** Server-side bots execute via heartbeats and pg_cron backstop using the identical `process_bid()` pipeline.
