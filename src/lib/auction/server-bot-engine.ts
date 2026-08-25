import { V3Team, V3Player, V3AuctionState } from '../v3-auction-types';

// ============================================================
// TYPES
// ============================================================

export type BotPersonality = 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE' | 'OPPORTUNISTIC' | 'STRATEGIC';
export type BotDecision = 'SKIP' | 'ENTER' | 'HESITATE' | 'DROP' | 'ONE_LAST_BID';
export type RoleNeed = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW' | 'REDUNDANT';

export interface FuturePlayer {
  role: string;
  category: string;
  base_price: number;
  is_overseas: boolean;
}

export interface AuctionContext {
  maxSquadSize: number;
  maxOverseas: number;
  totalLots: number;
  futurePlayers: FuturePlayer[];
  futureByRole: Record<string, number>;
  futureOverseasCount: number;
  futureAvgBasePrice: number;
  futureMinBasePrice: number;
  teamPurchasePrices: Record<string, number[]>;
}

export const DEFAULT_CONTEXT: AuctionContext = {
  maxSquadSize: 25,
  maxOverseas: 8,
  totalLots: 50,
  futurePlayers: [],
  futureByRole: {},
  futureOverseasCount: 0,
  futureAvgBasePrice: 100,
  futureMinBasePrice: 20,
  teamPurchasePrices: {},
};

// ============================================================
// PRESERVED: getNextBidAmount (UNCHANGED)
// ============================================================

export function getNextBidAmount(currentBid: number, basePrice: number): number {
  if (currentBid === 0) return basePrice;
  let inc = 200;
  if (currentBid <= 300) inc = 25;
  else if (currentBid <= 600) inc = 50;
  else if (currentBid <= 1000) inc = 75;
  else if (currentBid <= 1500) inc = 100;
  else if (currentBid <= 2000) inc = 150;
  else if (currentBid <= 2500) inc = 175;
  return currentBid + inc;
}

// ============================================================
// PRESERVED: getBotPersonality (UNCHANGED)
// ============================================================

export function getBotPersonality(teamId: string): BotPersonality {
  // Deterministic pseudo-random personality assignment
  const hash = teamId.charCodeAt(0) + teamId.charCodeAt(teamId.length - 1) + teamId.length;
  const val = hash % 5;
  switch (val) {
    case 0: return 'CONSERVATIVE';
    case 1: return 'AGGRESSIVE';
    case 2: return 'OPPORTUNISTIC';
    case 3: return 'STRATEGIC';
    default: return 'BALANCED';
  }
}

// ============================================================
// NEW: Role Need Analysis
// ============================================================

export function getRoleNeed(
  role: string,
  roleCount: number,
  remainingSlots: number,
  maxSquadSize: number,
  personality: BotPersonality
): { need: RoleNeed; multiplier: number } {
  // Scale role targets proportionally to configured squad size
  const scale = Math.max(0.5, maxSquadSize / 25);

  let minTarget: number, idealTarget: number;
  switch (role) {
    case 'WICKET_KEEPER':
      minTarget = Math.max(1, Math.round(2 * scale));
      idealTarget = Math.max(2, Math.round(3 * scale));
      break;
    case 'BATSMAN':
      minTarget = Math.max(2, Math.round(5 * scale));
      idealTarget = Math.max(3, Math.round(7 * scale));
      break;
    case 'ALL_ROUNDER':
      minTarget = Math.max(2, Math.round(3 * scale));
      idealTarget = Math.max(3, Math.round(5 * scale));
      break;
    case 'BOWLER':
      minTarget = Math.max(2, Math.round(6 * scale));
      idealTarget = Math.max(3, Math.round(8 * scale));
      break;
    default:
      minTarget = Math.max(1, Math.round(2 * scale));
      idealTarget = Math.max(2, Math.round(4 * scale));
  }

  let need: RoleNeed;
  let multiplier: number;

  if (roleCount === 0 && minTarget >= 1) {
    need = 'CRITICAL';
    multiplier = role === 'WICKET_KEEPER' ? 1.50 : 1.35;
  } else if (roleCount < minTarget) {
    need = 'HIGH';
    multiplier = 1.15;
  } else if (roleCount <= idealTarget) {
    need = 'NORMAL';
    multiplier = 1.0;
  } else if (roleCount <= idealTarget + 2) {
    need = 'LOW';
    multiplier = 0.60;
  } else {
    need = 'REDUNDANT';
    multiplier = 0.25;
  }

  // STRATEGIC personality amplifies role need effects
  if (personality === 'STRATEGIC') {
    if (multiplier > 1) multiplier += 0.15;
    if (multiplier < 1) multiplier -= 0.10;
  }

  // Late-squad pressure: few slots remain → redundant roles are nearly worthless
  if (remainingSlots <= 5) {
    if (need === 'LOW') multiplier *= 0.50;
    if (need === 'REDUNDANT') multiplier = 0.10;
  }
  if (remainingSlots <= 3) {
    if (need === 'NORMAL') multiplier *= 0.80;
    if (need === 'LOW') multiplier = 0.10;
    if (need === 'REDUNDANT') multiplier = 0;
  }

  return { need, multiplier: Math.max(0, multiplier) };
}

// ============================================================
// NEW: Franchise Owner Valuation Engine
// Replaces calculateAdvancedValuation with full squad-building
// strategy, dynamic reserves, premium budgets, future player
// awareness, auction phase intelligence, and competition analysis.
// ============================================================

export function calculateFranchiseOwnerValuation(
  bot: V3Team,
  player: V3Player,
  difficulty: string,
  allTeams: V3Team[],
  botRoster: V3Player[],
  currentBid: number,
  ctx: AuctionContext
) {
  const personality = getBotPersonality(bot.id);

  // ===== 1. PLAYER MARKET VALUE (category bands in Lakhs — GUIDELINES) =====
  // These bands assume a ₹100Cr (10000L) purse auction. They scale proportionally.
  let mktMin: number, mktMax: number;
  switch (player.category) {
    case 'MARQUEE': mktMin = 1400; mktMax = 2000; break;
    case 'A':       mktMin = 1000; mktMax = 1600; break;
    case 'B':       mktMin = 700;  mktMax = 1200; break;
    case 'C':       mktMin = 500;  mktMax = 900;  break;
    case 'D':       mktMin = 300;  mktMax = 700;  break;
    default:        mktMin = player.base_price; mktMax = player.base_price * 3;
  }
  // Scale proportionally if purse differs from standard 10000L
  if (bot.initial_purse > 0 && bot.initial_purse !== 10000) {
    const ps = bot.initial_purse / 10000;
    mktMin = Math.round(mktMin * ps);
    mktMax = Math.round(mktMax * ps);
  }

  // ===== 2. PLAYER QUALITY (base_price within category as proxy) =====
  const catPeers = ctx.futurePlayers
    .filter(fp => fp.category === player.category)
    .map(fp => fp.base_price);
  catPeers.push(player.base_price);
  const maxBP = Math.max(...catPeers);
  const minBP = Math.min(...catPeers);
  const bpPos = maxBP > minBP ? (player.base_price - minBP) / (maxBP - minBP) : 0.5;

  let quality = 0.80 + bpPos * 0.40; // range: 0.80–1.20
  // Age factor (prime years = 24–31)
  if (player.age) {
    if (player.age >= 24 && player.age <= 31) quality *= 1.05;
    else if (player.age > 35) quality *= 0.85;
    else if (player.age >= 32) quality *= 0.95;
    else if (player.age < 22) quality *= 0.90;
  }

  // Spread within band using quality
  let marketValue = mktMin + (mktMax - mktMin) * Math.min(1, Math.max(0, (quality - 0.80) / 0.40));
  marketValue = Math.max(mktMin * 0.75, Math.min(mktMax * 1.1, marketValue));

  // ===== 3. DIFFICULTY =====
  const diffMult = difficulty === 'Aggressive' ? 1.10 : difficulty === 'Easy' ? 0.85 : 1.0;

  // ===== 4. PERSONALITY =====
  const persMult = personality === 'AGGRESSIVE' ? 1.15
    : personality === 'CONSERVATIVE' ? 0.85
    : 1.0;

  // ===== 5. ROLE NEED =====
  const roleCount = botRoster.filter(p => p.role === player.role).length;
  const remainingSlots = Math.max(0, ctx.maxSquadSize - bot.players_bought);
  const { need: roleNeed, multiplier: roleMult } = getRoleNeed(
    player.role, roleCount, remainingSlots, ctx.maxSquadSize, personality
  );

  // ===== 6. OVERSEAS CONSTRAINT (uses actual max_overseas from room settings) =====
  let overseasMult = 1.0;
  if (player.is_overseas) {
    const remOS = Math.max(0, ctx.maxOverseas - bot.overseas_count);
    if (remOS === 0) {
      overseasMult = 0; // cannot buy
    } else if (remOS === 1) {
      // Last overseas slot: only for exceptional/critical need
      overseasMult = roleNeed === 'CRITICAL' ? 0.80
        : (player.category === 'MARQUEE' || player.category === 'A') ? 0.50
        : 0.20;
    } else if (remOS === 2) {
      overseasMult = 0.85;
    }
  }

  // ===== 7. PURSE STRENGTH =====
  const moneySpent = bot.initial_purse - bot.purse;
  const spentRatio = bot.initial_purse > 0 ? moneySpent / bot.initial_purse : 0;

  const purseFactor = spentRatio < 0.20 ? 1.05  // financially confident
    : spentRatio < 0.50 ? 0.95                   // normal
    : spentRatio < 0.70 ? 0.78                   // cautious
    : spentRatio < 0.85 ? 0.58                   // defensive
    : 0.38;                                       // survival mode

  // ===== 8. STRATEGIC SQUAD RESERVE (dynamic, based on actual remaining player pool) =====
  let costPerSlot: number;
  if (ctx.futurePlayers.length > 0) {
    const sortedBPs = ctx.futurePlayers.map(fp => fp.base_price).sort((a, b) => a - b);
    const median = sortedBPs[Math.floor(sortedBPs.length / 2)] || 50;
    // Expected acquisition cost: base price × bidding premium (players sell above base)
    costPerSlot = Math.max(median * 1.8, ctx.futureAvgBasePrice * 1.4);
  } else {
    costPerSlot = Math.max(50, bot.initial_purse * 0.01);
  }

  // Personality adjusts reserve aggressiveness
  const resMult = personality === 'CONSERVATIVE' ? 1.50
    : personality === 'AGGRESSIVE' ? 0.90
    : personality === 'STRATEGIC' ? 1.30
    : personality === 'OPPORTUNISTIC' ? 1.10
    : 1.20;

  const slotsToReserve = Math.max(0, remainingSlots - 1);
  const reserve = slotsToReserve * costPerSlot * resMult;
  const available = Math.max(0, bot.purse - reserve);

  // ===== 9. PREMIUM BUDGET (tracks expensive spending to prevent repeat ₹20Cr+ blowouts) =====
  const premFrac = personality === 'CONSERVATIVE' ? 0.30
    : personality === 'AGGRESSIVE' ? 0.45
    : personality === 'STRATEGIC' ? 0.40
    : 0.35;

  const premBudget = bot.initial_purse * premFrac;
  const purchases = ctx.teamPurchasePrices[bot.id] || [];
  // "Premium purchase" = any purchase substantially above average base price
  const premThreshold = Math.max(ctx.futureAvgBasePrice * 3, bot.initial_purse * 0.05);
  const premSpent = purchases.filter(p => p > premThreshold).reduce((s, v) => s + v, 0);
  const premRemaining = Math.max(0, premBudget - premSpent);

  let premFactor = 1.0;
  if (marketValue > premThreshold) {
    const health = premBudget > 0 ? premRemaining / premBudget : 0;
    premFactor = health < 0.15 ? 0.40
      : health < 0.35 ? 0.65
      : health < 0.60 ? 0.85
      : 1.0;
  }

  // ===== 10. FUTURE PLAYER AWARENESS ("How many similar players are still coming?") =====
  const futureRoleCount = ctx.futureByRole[player.role] || 0;

  let futFactor = 1.0;
  if (futureRoleCount >= 10)      futFactor = 0.80;   // many alternatives — no rush
  else if (futureRoleCount >= 6)  futFactor = 0.88;
  else if (futureRoleCount >= 3)  futFactor = 0.95;
  else if (futureRoleCount === 2) futFactor = 1.05;
  else if (futureRoleCount === 1) futFactor = 1.15;   // rare
  else                            futFactor = 1.30;   // last chance for this role

  // Compound: critical need + scarce future = extreme urgency
  if (roleNeed === 'CRITICAL' && futureRoleCount <= 1) futFactor *= 1.15;
  // Compound: redundant + many alternatives = strong disinterest
  if ((roleNeed === 'LOW' || roleNeed === 'REDUNDANT') && futureRoleCount >= 4) futFactor *= 0.65;

  // ===== 11. AUCTION PHASE =====
  const completedLots = ctx.totalLots - ctx.futurePlayers.length;
  const progress = ctx.totalLots > 0 ? completedLots / ctx.totalLots : 0.5;

  let phaseFactor = 1.0;
  if (progress < 0.25) {
    // Early: protect purse, observe market
    phaseFactor = personality === 'CONSERVATIVE' ? 0.82 : 0.90;
  } else if (progress < 0.60) {
    phaseFactor = 1.0; // mid
  } else if (progress < 0.85) {
    // Late: urgency for gaps
    phaseFactor = (roleNeed === 'CRITICAL' || roleNeed === 'HIGH') ? 1.10 : 1.0;
  } else {
    // Final stretch
    if (roleNeed === 'CRITICAL' && remainingSlots > 3) phaseFactor = 1.20;
    else if (bot.purse > bot.initial_purse * 0.4 && bot.players_bought < ctx.maxSquadSize * 0.5) phaseFactor = 1.15;
    else phaseFactor = 0.95;
  }

  // ===== 12. COMPETITION =====
  const otherPurses = allTeams.filter(t => t.id !== bot.id).map(t => t.purse);
  const maxOppPurse = otherPurses.length > 0 ? Math.max(...otherPurses) : 0;

  let compFactor = 1.0;
  if (maxOppPurse > bot.purse * 1.5 && personality !== 'AGGRESSIVE') {
    compFactor = 0.90; // intimidated by whale
  } else if (bot.purse > maxOppPurse * 1.3) {
    compFactor = 1.08; // purse leader confidence
  }
  // OPPORTUNISTIC: avoid bidding wars when many teams can compete
  if (personality === 'OPPORTUNISTIC') {
    const rivals = allTeams.filter(t => t.id !== bot.id && t.purse > currentBid * 1.5).length;
    if (rivals >= 3) compFactor *= 0.85;
  }

  // ===== 13. CALCULATE FINAL MAX WILLING =====
  let maxWilling = marketValue
    * diffMult * persMult * roleMult * overseasMult
    * purseFactor * premFactor * futFactor * phaseFactor * compFactor;

  // ===== 14. OPPORTUNITY COST & STRATEGIC GUARDRAIL =====
  // Goal: Reduce top-end spending by ~₹2-3 Cr (200-300L) dynamically based on opportunity cost.
  let opportunityCost = 0;
  const previousMax = maxWilling;

  // Only apply to premium bids (e.g. > ₹10 Cr or > 10% of purse)
  const oppCostThreshold = Math.max(1000, bot.initial_purse * 0.10);

  if (maxWilling > oppCostThreshold) {
    // Expected future cost for remaining slots
    const futureExpectedCost = remainingSlots > 1 ? (remainingSlots - 1) * costPerSlot : 0;
    const purseHealthAfter = bot.purse - maxWilling;
    const isPurseStrained = purseHealthAfter < futureExpectedCost * 0.8;
    const purseImpactRatio = bot.purse > 0 ? maxWilling / bot.purse : 1;

    // Base strategic reduction for high-end players (~12% is approx 250-300L on a 2000-2500L bid)
    let reductionBase = maxWilling * 0.12;

    let oppCostMultiplier = 1.0;

    // Squad and Purse Reality
    if (isPurseStrained) oppCostMultiplier += 0.5;
    if (purseImpactRatio > 0.4) oppCostMultiplier += 0.3;
    if (remainingSlots > 10) oppCostMultiplier += 0.3;
    if (futureRoleCount > 3) oppCostMultiplier += 0.2;

    // Mitigating factors (strategic justification to spend heavily)
    if (roleNeed === 'CRITICAL') oppCostMultiplier -= 0.6;
    if (roleNeed === 'HIGH') oppCostMultiplier -= 0.3;
    if (personality === 'AGGRESSIVE') oppCostMultiplier -= 0.2;
    if (personality === 'CONSERVATIVE') oppCostMultiplier += 0.3;

    oppCostMultiplier = Math.max(0, oppCostMultiplier);
    opportunityCost = Math.round(reductionBase * oppCostMultiplier);

    // Cap reduction to prevent absurd drops (max ~4.5 Cr reduction)
    opportunityCost = Math.min(opportunityCost, 450);
  }

  maxWilling = Math.max(player.base_price, maxWilling - opportunityCost);

  // ===== 15. FINAL CLAMPING =====
  maxWilling = Math.min(maxWilling, available, bot.purse);
  // If premium-priced player and premium budget depleted, further clamp
  if (marketValue > premThreshold && premRemaining < maxWilling * 0.5) {
    maxWilling = Math.min(maxWilling, premRemaining);
  }
  maxWilling = Math.max(0, maxWilling);

  // ===== 16. FUTURE SQUAD VIABILITY GUARD (hard guardrail) =====
  // "If I buy this player, can I still complete my squad?"
  const nextBid = getNextBidAmount(currentBid, player.base_price);
  if (remainingSlots > 1 && nextBid > 0) {
    const purseAfter = bot.purse - nextBid;
    const futSlots = remainingSlots - 1;
    const perSlot = purseAfter / futSlots;
    const minViable = Math.max(ctx.futureMinBasePrice, 20);
    if (perSlot < minViable * 0.8) {
      maxWilling = 0; // purchase would make squad completion impossible
    }
  }

  const futureAvg = remainingSlots > 1 ? Math.round((bot.purse - nextBid) / (remainingSlots - 1)) : 0;

  return {
    maxValuation: Math.round(maxWilling),
    marketValue: Math.round(marketValue),
    personality,
    quality: Math.round(quality * 100) / 100,
    roleNeed,
    roleMult: Math.round(roleMult * 100) / 100,
    overseasMult: Math.round(overseasMult * 100) / 100,
    purseFactor: Math.round(purseFactor * 100) / 100,
    compFactor: Math.round(compFactor * 100) / 100,
    phaseFactor: Math.round(phaseFactor * 100) / 100,
    futFactor: Math.round(futFactor * 100) / 100,
    premFactor: Math.round(premFactor * 100) / 100,
    reserve: Math.round(reserve),
    available: Math.round(available),
    premRemaining: Math.round(premRemaining),
    futureAlts: futureRoleCount,
    futureAvg,
    spentPct: Math.round(spentRatio * 100),
    progressPct: Math.round(progress * 100),
    opportunityCost: Math.round(opportunityCost),
    previousMax: Math.round(previousMax),
  };
}

// ============================================================
// NEW: evaluateBotsForLot - Server orchestrator equivalent
// Returns a list of decisions (teamId, nextBidAmount, delayMs)
// Does NOT call RPCs - just evaluates bot brains.
// ============================================================

export function evaluateBotsForLot(
  botTeams: V3Team[],
  player: V3Player,
  currentBid: number,
  basePrice: number,
  highestBidderTeamId: string | undefined,
  botDifficulty: string,
  allTeams: V3Team[],
  teamRosters: Record<string, V3Player[]>,
  ctx: AuctionContext,
  timerExpiresAt: string | undefined | null
) {
  const nextBidAmount = getNextBidAmount(currentBid, basePrice);
  const validBids: { teamId: string; nextBidAmount: number; delayMs: number }[] = [];

  for (const bot of botTeams) {
    const roster = teamRosters[bot.id] || [];
    const val = calculateFranchiseOwnerValuation(
      bot, player, botDifficulty, allTeams, roster, currentBid, ctx
    );

    // ---- ELIGIBILITY GATES ----
    if (bot.purse < nextBidAmount || bot.id === highestBidderTeamId) continue;

    if (player.is_overseas && bot.overseas_count >= ctx.maxOverseas) continue;
    if (bot.players_bought >= ctx.maxSquadSize) continue;

    // ---- DECISION ENGINE ----
    let decision: BotDecision;

    if (val.maxValuation <= 0 || val.roleNeed === 'REDUNDANT') {
      decision = 'SKIP';
    } else if (nextBidAmount > val.maxValuation) {
      if (
        nextBidAmount <= val.maxValuation * 1.08
        && (val.roleNeed === 'CRITICAL' || val.roleNeed === 'HIGH')
        && val.purseFactor >= 0.70
        && Math.random() < (val.roleNeed === 'CRITICAL' ? 0.40 : 0.20)
      ) {
        decision = 'ONE_LAST_BID';
      } else {
        decision = 'DROP';
      }
    } else {
      const valueRatio = nextBidAmount / val.maxValuation;

      if (val.roleNeed === 'LOW' && valueRatio > 0.50 && Math.random() < 0.55) {
        decision = 'SKIP';
      }
      else if (valueRatio > 0.90 && Math.random() < 0.45) {
        decision = 'HESITATE';
      }
      else if (valueRatio > 0.75 && Math.random() < 0.22) {
        decision = 'HESITATE';
      }
      else if (val.personality === 'CONSERVATIVE' && valueRatio > 0.60 && Math.random() < 0.20) {
        decision = 'HESITATE';
      }
      else if (
        val.personality === 'OPPORTUNISTIC'
        && currentBid > 0
        && currentBid < val.marketValue * 0.35
        && Math.random() < 0.50
      ) {
        decision = 'HESITATE';
      }
      else if (val.personality === 'AGGRESSIVE' && valueRatio < 0.60) {
        decision = 'ENTER';
      }
      else {
        decision = 'ENTER';
      }
    }

    if (decision === 'SKIP' || decision === 'DROP' || decision === 'HESITATE') continue;

    // ---- TIMER CALCULATION ----
    let minDelay = 1000, maxDelay = 2500;
    switch (val.personality) {
      case 'AGGRESSIVE':    minDelay = 400;  maxDelay = 1500; break;
      case 'CONSERVATIVE':  minDelay = 1500; maxDelay = 3500; break;
      case 'OPPORTUNISTIC': minDelay = 1000; maxDelay = 3000; break;
      case 'STRATEGIC':     minDelay = 1000; maxDelay = 2500; break;
      case 'BALANCED':      minDelay = 1000; maxDelay = 2500; break;
    }
    if (val.roleMult >= 1.2) { minDelay *= 0.7; maxDelay *= 0.7; }
    if (decision === 'ONE_LAST_BID') { minDelay *= 1.3; maxDelay *= 1.3; }

    const remainingMs = timerExpiresAt ? new Date(timerExpiresAt).getTime() - Date.now() : 0;
    if (remainingMs > 0 && remainingMs < maxDelay + 300) {
      maxDelay = Math.max(minDelay, remainingMs - 300);
    }

    const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

    validBids.push({ teamId: bot.id, nextBidAmount, delayMs: delay });
  }

  return validBids;
}
