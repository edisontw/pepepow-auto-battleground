"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COST_COLORS, ITEMS, SKILL_VFX, Trait, TRAIT_DETAILS, UNIT_MAP, UNITS, XP_TO_LEVEL } from "./game-data";
import { BattleEvent, BattleFrame, BattleResult, BOARD_COLS, BOARD_ROWS, buildCombatSnapshot, createSeededRandom, ENGINE_VERSION, mixSeed, OwnedUnit, REPLAY_FORMAT, REPLAY_VERSION, SeededRandom, simulateBattle, UnitBattleStats } from "./battle-engine";
import { applyXp, effectiveShopOdds, GAME_RULES, incomeFor, passiveXpForRound, resolveDropTarget } from "./game-rules";
import { useAdaptivePerformance } from "./performance";
import { trackAnonymous } from "./telemetry";
import { advanceAICommanders, aiBoard, AIDifficulty, AICommander, createAICommanders, migrateAICommanders, ownedBaseCopies } from "./ai-engine";

type Phase = "planning" | "battle" | "result" | "gameover";
type AIState = AICommander;
type RunStats = { wins: number; losses: number; unitsBought: number; rerolls: number; goldEarned: number; highestStar: number };
type SaveData = { round: number; gold: number; health: number; level: number; xp: number; units: OwnedUnit[]; items: string[]; ais: AIState[]; streak: number; stats: RunStats; shop: string[]; locked: boolean; difficulty?: AIDifficulty; sessionSeed?: number };
type ArchiveTab = "units" | "traits" | "items";
type MobilePanel = "synergies" | "equipment" | null;
type SynergyRow = { trait: Trait; count: number; tier: 0 | 1 | 2; threshold: number; nextThreshold: number | null; value: string };
type BattleRecord = {
  id: string;
  round: number;
  opponent: string;
  pve: boolean;
  createdAt: number;
  playerArmy: OwnedUnit[];
  enemyArmy: OwnedUnit[];
  result: BattleResult;
  sessionSeed?: number;
};

const SAVE_KEY = "pepepow-auto-battleground-save-v1";
const HISTORY_KEY = "pepepow-auto-battleground-history-v2";
const AUDIO_KEY = "pepepow-auto-battleground-audio-v1";
const DEPLOY_START = BOARD_COLS * 3;
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const newStats = (): RunStats => ({ wins: 0, losses: 0, unitsBought: 0, rerolls: 0, goldEarned: 0, highestStar: 1 });
const starText = (star: number) => "★".repeat(star);

function SynergyIcon({ trait, className = "trait-gem" }: { trait: Trait; className?: string }) {
  const detail = TRAIT_DETAILS[trait];
  return <span className={className} data-trait={trait} style={{ "--sigil": detail.color, "--sigil-accent": detail.accent } as React.CSSProperties}><i className="synergy-icon-mask" style={{ WebkitMaskImage: `url(${detail.icon})`, maskImage: `url(${detail.icon})` }} /></span>;
}

function skillVfxClass(skillId?: string) {
  if (!skillId) return "vfx-single";
  const kind = SKILL_VFX[skillId] ?? "single";
  return `skill-vfx-${skillId} vfx-${kind}`;
}

function completedUnitIds(units: OwnedUnit[]) {
  return new Set(units.filter((unit) => unit.star === 3).map((unit) => unit.unitId));
}

function weightedUnit(level: number, excluded = new Set<string>()) {
  const baseOdds = effectiveShopOdds(level, excluded);
  const eligibleCosts = baseOdds.map((weight, index) => ({ cost: index + 1, weight })).filter(({ cost, weight }) => weight > 0 && UNITS.some((unit) => unit.cost === cost && !excluded.has(unit.id)));
  const total = eligibleCosts.reduce((sum, entry) => sum + entry.weight, 0);
  if (!total) return "";
  const odds = eligibleCosts.map((entry) => ({ ...entry, weight: entry.weight / total * 100 }));
  let roll = Math.random() * 100;
  let cost = odds[odds.length - 1].cost;
  for (const entry of odds) { roll -= entry.weight; if (roll <= 0) { cost = entry.cost; break; } }
  const pool = UNITS.filter((unit) => unit.cost === cost && !excluded.has(unit.id));
  return pool[Math.floor(Math.random() * pool.length)]?.id ?? "";
}

function rollShop(level: number, units: OwnedUnit[] = []) {
  const excluded = completedUnitIds(units);
  return Array.from({ length: 5 }, () => weightedUnit(level, excluded));
}
function armyPower(units: OwnedUnit[]) { return Math.round(units.reduce((sum, unit) => sum + UNIT_MAP[unit.unitId].cost * (unit.star === 1 ? 9 : unit.star === 2 ? 28 : 85), 0)); }

function combineUnits(input: OwnedUnit[], idFactory = uid) {
  let units = [...input];
  const overflowItems: string[] = [];
  let combined = true;
  let highestStar = 1;
  while (combined) {
    combined = false;
    for (const def of UNITS) {
      for (const star of [1, 2] as const) {
        const matches = units.filter((unit) => unit.unitId === def.id && unit.star === star);
        if (matches.length >= 3) {
          const keep = matches.find((unit) => unit.position !== null) ?? matches[0];
          const fusionGroup = [keep, ...matches.filter((unit) => unit.uid !== keep.uid)].slice(0, 3);
          const consumed = new Set(fusionGroup.map((unit) => unit.uid));
          units = units.filter((unit) => !consumed.has(unit.uid));
          const mergedItems = fusionGroup.flatMap((unit) => unit.itemIds);
          units.push({ ...keep, uid: idFactory(), star: (star + 1) as 2 | 3, itemIds: mergedItems.slice(0, 2) });
          overflowItems.push(...mergedItems.slice(2));
          highestStar = Math.max(highestStar, star + 1);
          combined = true;
          break;
        }
      }
      if (combined) break;
    }
  }
  return { units, highestStar, overflowItems };
}

function previewPurchase(units: OwnedUnit[], unitId: string) {
  let previewId = 0;
  const combined = combineUnits([...units, { uid: "purchase-preview", unitId, star: 1 as const, position: null, itemIds: [] }], () => `preview-fusion-${previewId += 1}`);
  return { ...combined, allowed: combined.units.filter((unit) => unit.position === null).length <= GAME_RULES.benchSize };
}

function traitsFor(units: OwnedUnit[]) {
  const deployed = units.filter((unit) => unit.position !== null);
  const unique = new Map(deployed.map((unit) => [unit.unitId, unit]));
  const counts = new Map<Trait, number>();
  for (const unit of unique.values()) for (const trait of UNIT_MAP[unit.unitId].traits) counts.set(trait, (counts.get(trait) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function synergyRowsFor(units: OwnedUnit[]): SynergyRow[] {
  return traitsFor(units).map(([trait, count]) => {
    const detail = TRAIT_DETAILS[trait];
    const tier: 0 | 1 | 2 = count >= detail.thresholds[1] ? 2 : count >= detail.thresholds[0] ? 1 : 0;
    return {
      trait,
      count,
      tier,
      threshold: tier === 2 ? detail.thresholds[1] : detail.thresholds[0],
      nextThreshold: tier === 0 ? detail.thresholds[0] : tier === 1 ? detail.thresholds[1] : null,
      value: tier ? detail.tiers[tier - 1].replace(/\.$/, "") : `Needs ${detail.thresholds[0]} unique units`,
    };
  });
}

function enemyArmyFor(ai: AIState | null, round: number, pve: boolean, random: SeededRandom): OwnedUnit[] {
  if (!pve && ai) return aiBoard(ai);
  const count = Math.min(8, Math.max(2, 1 + Math.floor(round / 3)));
  const occupied = new Set<number>();
  const army: OwnedUnit[] = [];
  for (let index = 0; index < count; index += 1) {
    let pool = UNITS.filter((unit) => unit.cost <= Math.min(5, 1 + Math.floor((round + 2) / 5)));
    if (pve) pool = pool.filter((unit) => unit.traits.includes(round % 10 === 0 ? "Void" : "Wild"));
    const def = pool[random.int(pool.length)] ?? UNITS[0];
    let position = random.int(DEPLOY_START);
    while (occupied.has(position)) position = random.int(DEPLOY_START);
    occupied.add(position);
    const twoStarChance = pve ? Math.max(0, (round - 6) * 0.035) : Math.max(0, (round - 4) * 0.045);
    const threeStarChance = Math.max(0, (round - 20) * 0.018);
    const star = random.next() < threeStarChance ? 3 : random.next() < twoStarChance ? 2 : 1;
    army.push({ uid: `enemy-${round}-${index}-${random.int(1_000_000)}`, unitId: def.id, star, position, itemIds: round > 8 && random.next() < 0.2 ? [ITEMS[random.int(ITEMS.length)].id] : [] });
  }
  return army;
}

type UnitTokenProps = {
  unit: OwnedUnit;
  selected?: boolean;
  compact?: boolean;
  combat?: BattleFrame["units"][number];
  interactive?: boolean;
  invalid?: boolean;
  onSelect?: () => void;
  onInspect?: () => void;
  onDragStart?: () => void;
  onDragMove?: (x: number, y: number) => void;
  onDragFinish?: (x: number, y: number) => void;
};

function UnitToken({ unit, selected, compact, combat, interactive, invalid, onSelect, onInspect, onDragStart, onDragMove, onDragFinish }: UnitTokenProps) {
  const def = UNIT_MAP[unit.unitId];
  const hpPct = combat ? Math.max(0, (combat.hp / combat.maxHp) * 100) : 100;
  const press = useRef<{ id: number; x: number; y: number; dragging: boolean; inspected: boolean; timer: number } | null>(null);
  const clearPress = () => {
    if (press.current?.timer) window.clearTimeout(press.current.timer);
    press.current = null;
  };
  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const state = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false, inspected: false, timer: 0 };
    state.timer = window.setTimeout(() => {
      if (!press.current || press.current.dragging) return;
      press.current.inspected = true;
      onInspect?.();
    }, GAME_RULES.longPressMs);
    press.current = state;
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const state = press.current;
    if (!state || state.id !== event.pointerId) return;
    const moved = Math.hypot(event.clientX - state.x, event.clientY - state.y);
    if (interactive && !state.inspected && moved >= GAME_RULES.dragThresholdPx) {
      if (!state.dragging) {
        state.dragging = true;
        window.clearTimeout(state.timer);
        onDragStart?.();
      }
      event.preventDefault();
      onDragMove?.(event.clientX, event.clientY);
    }
  };
  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const state = press.current;
    if (!state || state.id !== event.pointerId) return;
    window.clearTimeout(state.timer);
    if (state.dragging) onDragFinish?.(event.clientX, event.clientY);
    else if (!state.inspected) onSelect?.();
    clearPress();
  };
  return (
    <button className={`unit-token cost-${def.cost} star-${unit.star} ${selected ? "selected" : ""} ${compact ? "compact" : ""} ${interactive ? "interactive" : ""} ${invalid ? "invalid-return" : ""} ${combat?.team ?? "player"} ${combat?.dead ? "dead" : ""} action-${combat?.action ?? "idle"} ${combat?.shield ? "shielded" : ""} ${combat?.stunned ? "stunned" : ""}`} style={{ "--unit": def.color } as React.CSSProperties} onClick={(event) => event.stopPropagation()} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={(event) => { event.stopPropagation(); if (press.current?.dragging) onDragFinish?.(-1, -1); clearPress(); }} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onInspect?.(); }} onKeyDown={(event) => { if (event.key.toLowerCase() === "i") onInspect?.(); }} aria-label={`${def.name}, ${unit.star} star. Tap to select, hold for details${interactive ? ", drag to move" : ""}.`}>
      <span className="unit-aura" />
      {compact && <span className="piece-base"><i className="class-emblem">{def.traits[1].slice(0, 1)}</i><i className="race-emblem">{def.traits[0].slice(0, 1)}</i></span>}
      <span className="unit-art"><img src={`/units/${def.id}.webp`} alt="" draggable={false} loading={compact ? "lazy" : "eager"} decoding="async" /><i>{def.icon}</i></span>
      <span className="star-evolution"><i /><i /><i /></span>
      <span className="stars">{starText(unit.star)}</span>
      {combat && <><span className="hp-track"><span style={{ width: `${hpPct}%` }} /></span><span className="mana-track"><span style={{ width: `${combat.mana}%` }} /></span></>}
      {!!unit.itemIds.length && <span className="unit-items">{unit.itemIds.map((id) => ITEMS.find((item) => item.id === id)?.icon).join("")}</span>}
    </button>
  );
}

export default function Game() {
  const performance = useAdaptivePerformance();
  const [active, setActive] = useState(false);
  const [hasSave, setHasSave] = useState(false);
  const [phase, setPhase] = useState<Phase>("planning");
  const [round, setRound] = useState(1);
  const [gold, setGold] = useState(10);
  const [health, setHealth] = useState(100);
  const [level, setLevel] = useState(2);
  const [xp, setXp] = useState(0);
  const [units, setUnits] = useState<OwnedUnit[]>([]);
  const [items, setItems] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<AIDifficulty>("Normal");
  const [ais, setAis] = useState<AIState[]>([]);
  const [shop, setShop] = useState<string[]>(() => rollShop(2));
  const [locked, setLocked] = useState(false);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [timer, setTimer] = useState(45);
  const [combatFrame, setCombatFrame] = useState<BattleFrame | null>(null);
  const [combatResult, setCombatResult] = useState<BattleResult | null>(null);
  const [opponent, setOpponent] = useState<AIState | null>(null);
  const [pve, setPve] = useState(true);
  const [stats, setStats] = useState<RunStats>(newStats);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [showGuide, setShowGuide] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showBattleArchive, setShowBattleArchive] = useState(false);
  const [battleHistory, setBattleHistory] = useState<BattleRecord[]>([]);
  const [replayRecord, setReplayRecord] = useState<BattleRecord | null>(null);
  const [archiveTab, setArchiveTab] = useState<ArchiveTab>("units");
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const [inspectedUnit, setInspectedUnit] = useState<OwnedUnit | null>(null);
  const [inspectedCombat, setInspectedCombat] = useState<BattleFrame["units"][number] | null>(null);
  const [draggedUid, setDraggedUid] = useState<string | null>(null);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [invalidDropUid, setInvalidDropUid] = useState<string | null>(null);
  const [pendingSaleUid, setPendingSaleUid] = useState<string | null>(null);
  const [revealingEnemy, setRevealingEnemy] = useState(false);
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [musicVolume, setMusicVolume] = useState(.34);
  const [audioReady, setAudioReady] = useState(false);
  const [sessionSeed, setSessionSeed] = useState(1);
  const [notice, setNotice] = useState("Deploy up to 2 units, then begin the expedition.");
  const frameIndex = useRef(0);
  const resultResolved = useRef(false);
  const audioContext = useRef<AudioContext | null>(null);
  const musicTracks = useRef<{ planning: HTMLAudioElement; combat: HTMLAudioElement } | null>(null);
  const musicFade = useRef<number | null>(null);
  const draggedUidRef = useRef<string | null>(null);
  const sessionStartedAt = useRef(0);
  const lastFpsReport = useRef(0);
  const advanceRoundRef = useRef<number | null>(null);

  const beginDrag = (unitUid: string) => { draggedUidRef.current = unitUid; setDraggedUid(unitUid); setInvalidDropUid(null); };
  const clearDrag = () => { draggedUidRef.current = null; setDraggedUid(null); setDragPoint(null); setDropTarget(null); };

  const inspectUnit = (unit: OwnedUnit, combat?: BattleFrame["units"][number]) => {
    setInspectedUnit(unit);
    setInspectedCombat(combat ?? null);
  };

  useEffect(() => {
    sessionStartedAt.current = Date.now();
    const handle = window.setTimeout(() => {
      setHasSave(Boolean(localStorage.getItem(SAVE_KEY)));
      try { setBattleHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]")); } catch { setBattleHistory([]); }
      try {
        const audio = JSON.parse(localStorage.getItem(AUDIO_KEY) ?? "{}");
        if (typeof audio.sfxEnabled === "boolean") setSfxEnabled(audio.sfxEnabled);
        if (typeof audio.musicEnabled === "boolean") setMusicEnabled(audio.musicEnabled);
        if (typeof audio.musicVolume === "number") setMusicVolume(Math.max(0, Math.min(1, audio.musicVolume)));
      } catch { /* keep safe defaults */ }
      setAudioReady(true);
    }, 0);
    return () => window.clearTimeout(handle);
  }, []);

  useEffect(() => {
    if (!audioReady) return;
    localStorage.setItem(AUDIO_KEY, JSON.stringify({ sfxEnabled, musicEnabled, musicVolume }));
  }, [audioReady, sfxEnabled, musicEnabled, musicVolume]);

  useEffect(() => {
    if (!active || Date.now() - lastFpsReport.current < 30000) return;
    lastFpsReport.current = Date.now();
    trackAnonymous("fps_sample", { fps: performance.measuredFps, targetFps: performance.targetFps, quality: performance.quality });
  }, [active, performance.measuredFps, performance.targetFps, performance.quality]);

  useEffect(() => {
    const closeSession = () => trackAnonymous("session_end", { sessionSeconds: Math.round((Date.now() - sessionStartedAt.current) / 1000), round }, true);
    window.addEventListener("pagehide", closeSession);
    return () => window.removeEventListener("pagehide", closeSession);
  }, [round]);

  const tone = useCallback((frequency: number, duration = 0.08, type: OscillatorType = "sine") => {
    if (!sfxEnabled) return;
    const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const context = audioContext.current ?? new AudioCtor();
    audioContext.current = context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.045, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + duration);
  }, [sfxEnabled]);

  const unlockMusic = useCallback(() => {
    const tracks = musicTracks.current;
    if (!tracks) return;
    const desired = phase === "planning" ? tracks.planning : tracks.combat;
    void desired.play().catch(() => undefined);
  }, [phase]);

  useEffect(() => {
    const planning = new Audio("/audio/planning.mp3");
    const combat = new Audio("/audio/combat.mp3");
    planning.loop = combat.loop = true;
    planning.preload = combat.preload = "auto";
    planning.volume = combat.volume = 0;
    musicTracks.current = { planning, combat };
    return () => {
      if (musicFade.current !== null) cancelAnimationFrame(musicFade.current);
      planning.pause(); combat.pause(); planning.removeAttribute("src"); combat.removeAttribute("src");
      musicTracks.current = null;
    };
  }, []);

  useEffect(() => {
    const tracks = musicTracks.current;
    if (!tracks) return;
    if (musicFade.current !== null) cancelAnimationFrame(musicFade.current);
    const target = active && musicEnabled ? (phase === "planning" ? "planning" : phase === "battle" || phase === "result" ? "combat" : null) : null;
    if (target) void tracks[target].play().catch(() => undefined);
    const started = window.performance.now();
    const from = { planning: tracks.planning.volume, combat: tracks.combat.volume };
    const to = { planning: target === "planning" ? musicVolume : 0, combat: target === "combat" ? musicVolume : 0 };
    const fade = (time: number) => {
      const ratio = Math.max(0, Math.min(1, (time - started) / 800));
      tracks.planning.volume = from.planning + (to.planning - from.planning) * ratio;
      tracks.combat.volume = from.combat + (to.combat - from.combat) * ratio;
      if (ratio < 1) musicFade.current = requestAnimationFrame(fade);
      else {
        musicFade.current = null;
        if (target !== "planning") tracks.planning.pause();
        if (target !== "combat") tracks.combat.pause();
      }
    };
    musicFade.current = requestAnimationFrame(fade);
    return () => { if (musicFade.current !== null) cancelAnimationFrame(musicFade.current); };
  }, [active, phase, musicEnabled, musicVolume]);

  const deployed = useMemo(() => units.filter((unit) => unit.position !== null), [units]);
  const bench = useMemo(() => units.filter((unit) => unit.position === null), [units]);
  const synergyRows = useMemo(() => synergyRowsFor(units), [units]);
  const planningSnapshot = useMemo(() => buildCombatSnapshot(deployed, "player"), [deployed]);
  const isBoss = round > 1 && round % 10 === 0;
  const isPveRound = round === 1 || round % 5 === 0;
  const xpNeeded = XP_TO_LEVEL[level] ?? 0;

  useEffect(() => {
    if (!active || phase !== "planning") return;
    const payload: SaveData = { round, gold, health, level, xp, units, items, ais, streak, stats, shop, locked, difficulty, sessionSeed };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  }, [active, phase, round, gold, health, level, xp, units, items, ais, streak, stats, shop, locked, difficulty, sessionSeed]);

  useEffect(() => {
    if (!active || phase !== "planning") return;
    const interval = window.setInterval(() => setTimer((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(interval);
  }, [active, phase, round]);

  const moveUnit = (unitUid: string, position: number) => {
    if (phase !== "planning" || position < DEPLOY_START) return false;
    const selected = units.find((unit) => unit.uid === unitUid);
    if (!selected) return false;
    const occupant = units.find((unit) => unit.position === position);
    if (selected.position === null && !occupant && deployed.length >= level) { setNotice(`Your level ${level} army is full.`); tone(130, 0.12, "square"); clearDrag(); return false; }
    setUnits((current) => current.map((unit) => unit.uid === selected.uid ? { ...unit, position } : occupant && unit.uid === occupant.uid ? { ...unit, position: selected.position } : unit));
    setSelectedUid(null); clearDrag(); setNotice("Formation updated."); tone(480);
    return true;
  };

  const reorderBench = (unitUid: string, targetIndex: number) => {
    if (phase !== "planning") return;
    setUnits((current) => {
      const boardUnits = current.filter((unit) => unit.position !== null);
      const benchUnits = current.filter((unit) => unit.position === null);
      const from = benchUnits.findIndex((unit) => unit.uid === unitUid);
      if (from < 0) return current;
      const [moving] = benchUnits.splice(from, 1);
      benchUnits.splice(Math.max(0, Math.min(targetIndex, benchUnits.length)), 0, moving);
      return [...boardUnits, ...benchUnits];
    });
    setSelectedUid(null); clearDrag(); setNotice("Bench order updated."); tone(420);
  };

  const deploySelected = (position: number) => {
    if (!selectedUid) return;
    moveUnit(selectedUid, position);
  };

  const selectUnit = (unit: OwnedUnit) => {
    clearDrag();
    if (phase !== "planning") { setSelectedUid(selectedUid === unit.uid ? null : unit.uid); return; }
    if (selectedItem) {
      if (unit.itemIds.length >= 2) { setNotice("This unit already carries two items."); tone(140, .12, "square"); return; }
      setUnits((current) => current.map((entry) => entry.uid === unit.uid ? { ...entry, itemIds: [...entry.itemIds, selectedItem] } : entry));
      setItems((current) => { const copy = [...current]; copy.splice(copy.indexOf(selectedItem), 1); return copy; });
      setNotice(`${ITEMS.find((item) => item.id === selectedItem)?.name} equipped to ${UNIT_MAP[unit.unitId].name}.`);
      setSelectedItem(null); tone(720, .16, "triangle"); return;
    }
    setSelectedUid(selectedUid === unit.uid ? null : unit.uid);
  };

  const buyUnit = (unitId: string, index: number) => {
    const def = UNIT_MAP[unitId];
    if (phase !== "planning" || gold < def.cost) { setNotice("Not enough gold."); tone(140, .12, "square"); return; }
    const candidate = [...units, { uid: uid(), unitId, star: 1 as const, position: null, itemIds: [] }];
    const combined = combineUnits(candidate);
    const finalBenchCount = combined.units.filter((unit) => unit.position === null).length;
    if (finalBenchCount > GAME_RULES.benchSize) { setNotice("Bench full. This purchase does not complete a fusion."); tone(140, .12, "square"); return; }
    const reachedThreeStar = combined.units.some((unit) => unit.unitId === unitId && unit.star === 3);
    setUnits(combined.units); if (combined.overflowItems.length) setItems((current) => [...current, ...combined.overflowItems]); setGold((value) => value - def.cost); setShop((current) => current.map((entry, slot) => slot === index || (reachedThreeStar && entry === unitId) ? "" : entry));
    setStats((current) => ({ ...current, unitsBought: current.unitsBought + 1, highestStar: Math.max(current.highestStar, combined.highestStar) }));
    setNotice(combined.highestStar > 1 ? `Fusion complete — ${def.name} reached ${starText(combined.highestStar)}!` : `${def.name} joined your bench.`);
    tone(combined.highestStar > 1 ? 880 : 610, combined.highestStar > 1 ? .22 : .08, "triangle");
  };

  const reroll = () => {
    if (phase !== "planning" || gold < GAME_RULES.rerollCost) { setNotice(`Rerolling costs ${GAME_RULES.rerollCost} gold.`); return; }
    setGold((value) => value - GAME_RULES.rerollCost); setShop(rollShop(level, units)); setStats((current) => ({ ...current, rerolls: current.rerolls + 1 })); setNotice("A new crew has arrived. Completed three-star units are excluded."); tone(390);
  };

  const buyXp = () => {
    if (phase !== "planning" || level >= GAME_RULES.maxLevel || gold < GAME_RULES.trainingCost) { setNotice(level >= GAME_RULES.maxLevel ? "Maximum level reached." : `Training costs ${GAME_RULES.trainingCost} gold.`); return; }
    const next = applyXp(level, xp, GAME_RULES.trainingXp);
    setGold((value) => value - GAME_RULES.trainingCost); setLevel(next.level); setXp(next.xp);
    if (next.levelsGained) { setNotice(`Level up! You can now deploy ${next.level} units.`); tone(920, .2, "triangle"); }
  };

  const refundFor = (unit?: OwnedUnit) => unit ? UNIT_MAP[unit.unitId].cost * (unit.star === 1 ? 1 : unit.star === 2 ? 3 : 9) : 0;

  const sellUnit = (unitUid: string, confirmed = false) => {
    const unit = units.find((entry) => entry.uid === unitUid);
    if (!unit || phase !== "planning") return;
    if (!confirmed && (unit.star > 1 || unit.itemIds.length > 0)) { setPendingSaleUid(unit.uid); clearDrag(); return; }
    const refund = refundFor(unit);
    setUnits((current) => current.filter((entry) => entry.uid !== unit.uid)); setItems((current) => [...current, ...unit.itemIds]); setGold((value) => value + refund); setSelectedUid(null);
    if (inspectedUnit?.uid === unit.uid) { setInspectedUnit(null); setInspectedCombat(null); }
    setPendingSaleUid(null); clearDrag();
    setNotice(`${UNIT_MAP[unit.unitId].name} sold for ${refund} gold.`); tone(230);
  };

  const sellSelected = () => { if (selectedUid) sellUnit(selectedUid); };

  const returnToBench = (unitUid = draggedUidRef.current ?? selectedUid) => {
    const moving = units.find((unit) => unit.uid === unitUid);
    if (!unitUid || !moving || (moving.position !== null && bench.length >= GAME_RULES.benchSize)) { setNotice("Bench full. Deploy or sell a unit first."); clearDrag(); return false; }
    setUnits((current) => current.map((unit) => unit.uid === unitUid ? { ...unit, position: null } : unit)); setSelectedUid(null); clearDrag(); setNotice("Unit returned to the bench."); tone(320);
    return true;
  };

  const updateDropTarget = (x: number, y: number) => {
    setDragPoint({ x, y });
    const element = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop-target]");
    setDropTarget(element?.dataset.dropTarget ?? null);
  };

  const finishPointerDrag = (x: number, y: number) => {
    const unitUid = draggedUidRef.current;
    const unit = units.find((entry) => entry.uid === unitUid);
    const targets = document.elementsFromPoint(x, y).map((element) => element.closest<HTMLElement>("[data-drop-target]")?.dataset.dropTarget).filter((target): target is string => Boolean(target));
    const target = resolveDropTarget(targets);
    if (!unitUid || !unit) { clearDrag(); return; }
    if (target?.startsWith("board:")) { moveUnit(unitUid, Number(target.split(":")[1])); return; }
    if (target?.startsWith("bench:")) {
      const index = Number(target.split(":")[1]);
      if (unit.position === null) reorderBench(unitUid, index); else returnToBench(unitUid);
      return;
    }
    if (target === "sell") { sellUnit(unitUid); return; }
    setInvalidDropUid(unitUid); clearDrag(); setNotice("Invalid destination — unit returned."); tone(140, .1, "square");
    window.setTimeout(() => setInvalidDropUid(null), 320);
  };

  const startBattle = useCallback(() => {
    if (phase !== "planning" || !deployed.length) { setNotice("Deploy at least one unit first."); tone(130, .15, "square"); return; }
    const pveBattle = isPveRound;
    const alive = ais.filter((ai) => ai.alive);
    const battleSeed = mixSeed(sessionSeed, round, armyPower(deployed), ais.filter((ai) => ai.alive).length);
    const rivalRandom = createSeededRandom(mixSeed(battleSeed, 0xa117));
    const rival = pveBattle ? null : alive[rivalRandom.int(alive.length)] ?? null;
    const enemy = enemyArmyFor(rival, round, pveBattle, createSeededRandom(mixSeed(battleSeed, 0xe11e)));
    const result = simulateBattle(deployed, enemy, mixSeed(battleSeed, 0xba77));
    const record: BattleRecord = { id: `${round}-${result.seed}-${Date.now()}`, round, opponent: pveBattle ? (isBoss ? "Void Foreman" : "Neutral Crew") : rival?.name ?? "Unknown", pve: pveBattle, createdAt: Date.now(), playerArmy: deployed.map((unit) => ({ ...unit, itemIds: [...unit.itemIds] })), enemyArmy: enemy, result };
    setBattleHistory((current) => { const next = [record, ...current].slice(0, 12); localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); return next; });
    setPve(pveBattle); setOpponent(rival); setCombatResult(result); setCombatFrame(result.frames[0]); setPhase("battle"); setRevealingEnemy(true); setSelectedUid(null); setSelectedItem(null); setInspectedUnit(null); setInspectedCombat(null); setBattleLog([pveBattle ? (isBoss ? "The Void Foreman descends." : "Scout the neutral crew before combat begins.") : `Scouting ${rival?.name}'s formation…`]);
    frameIndex.current = 0; resultResolved.current = false; tone(180, .25, "sawtooth");
  }, [phase, deployed, isPveRound, ais, round, isBoss, tone, sessionSeed]);

  useEffect(() => {
    if (phase !== "battle" || !revealingEnemy) return;
    const handle = window.setTimeout(() => {
      setRevealingEnemy(false);
      setBattleLog((log) => ["Auto combat engaged.", ...log].slice(0, 5));
    }, 1800);
    return () => window.clearTimeout(handle);
  }, [phase, revealingEnemy]);

  useEffect(() => {
    if (!active || phase !== "planning" || timer !== 0) return;
    const handle = window.setTimeout(startBattle, 0);
    return () => window.clearTimeout(handle);
  }, [active, phase, timer, startBattle]);

  const resolveAIField = useCallback((battleWon: boolean) => {
    setAis((current) => {
      const living = current.filter((ai) => ai.alive);
      return current.map((ai) => {
        if (!ai.alive) return ai;
        let damage = 0;
        if (!isPveRound && opponent?.name === ai.name && battleWon) damage = Math.max(3, (combatResult?.survivors ?? 1) * 2 + Math.floor(round / 5));
        else if (living.length > 1 && opponent?.name !== ai.name) {
          const rivalIndex = (living.findIndex((entry) => entry.name === ai.name) + 1) % living.length;
          const rival = living[rivalIndex];
          const duel = simulateBattle(aiBoard(ai), aiBoard(rival), mixSeed(sessionSeed, round, ai.name.length, rival.name.length));
          if (duel.winner === "enemy") damage = Math.max(3, duel.survivors * 2 + Math.floor(round / 5));
        }
        const nextHealth = Math.max(0, ai.health - damage);
        return { ...ai, health: nextHealth, alive: nextHealth > 0, streak: damage ? Math.min(-1, ai.streak - 1) : Math.max(1, ai.streak + 1) };
      });
    });
  }, [round, isPveRound, opponent, combatResult, sessionSeed]);

  const finishBattle = useCallback(() => {
    if (!combatResult || resultResolved.current) return;
    resultResolved.current = true;
    const won = combatResult.winner === "player";
    const draw = combatResult.winner === "draw";
    let damage = 0;
    if (!won && !draw) damage = Math.max(3, combatResult.survivors * 2 + Math.floor(round / 5));
    const nextHealth = Math.max(0, health - damage);
    setHealth(nextHealth);
    if (!pve) setStreak((current) => won ? Math.max(1, current + 1) : draw ? 0 : Math.min(-1, current - 1));
    setStats((current) => ({ ...current, wins: current.wins + (won ? 1 : 0), losses: current.losses + (!won && !draw ? 1 : 0) }));
    if (pve && won) {
      const drop = ITEMS[Math.floor(Math.random() * ITEMS.length)].id;
      setItems((current) => [...current, drop]); setNotice(`Victory! You recovered ${ITEMS.find((item) => item.id === drop)?.name}.`);
    } else setNotice(won ? `Victory — ${combatResult.survivors} allies survived.` : draw ? "The battle ended in a draw." : `Defeat — your commander took ${damage} damage.`);
    resolveAIField(won);
    if (nextHealth <= 0) { setPhase("gameover"); localStorage.removeItem(SAVE_KEY); setHasSave(false); tone(90, .6, "sawtooth"); }
    else { setPhase("result"); tone(won ? 760 : 110, won ? .3 : .45, won ? "triangle" : "sawtooth"); }
  }, [combatResult, round, health, pve, resolveAIField, tone]);

  useEffect(() => {
    if (phase !== "battle" || !combatResult || revealingEnemy) return;
    const interval = window.setInterval(() => {
      frameIndex.current += 1;
      const frame = combatResult.frames[frameIndex.current];
      if (!frame) { window.clearInterval(interval); window.setTimeout(finishBattle, 450); return; }
      setCombatFrame(frame); setBattleLog((log) => frame.message === log[0] ? log : [frame.message, ...log].slice(0, 5));
      if (frame.events.length) tone(frame.message.includes("!") ? 560 : 250, .045, frame.message.includes("!") ? "triangle" : "square");
    }, performance.targetFps === 30 ? 260 : 210);
    return () => window.clearInterval(interval);
  }, [phase, combatResult, finishBattle, tone, revealingEnemy, performance.targetFps]);

  const nextRound = () => {
    if (advanceRoundRef.current === round) return;
    advanceRoundRef.current = round;
    const survivingAI = ais.filter((ai) => ai.alive);
    if (!survivingAI.length) { setPhase("gameover"); setNotice("You are the last commander standing!"); localStorage.removeItem(SAVE_KEY); setHasSave(false); return; }
    const income = incomeFor(gold, streak);
    const passiveXp = passiveXpForRound(round);
    const progression = applyXp(level, xp, passiveXp);
    setGold((value) => value + income.total); setStats((current) => ({ ...current, goldEarned: current.goldEarned + income.total }));
    setAis((current) => advanceAICommanders(current, round + 1, createSeededRandom(mixSeed(sessionSeed, round + 1, 0xa1e0)), deployed));
    setLevel(progression.level); setXp(progression.xp);
    if (!locked) setShop(rollShop(progression.level, units));
    setRound((value) => value + 1); setTimer(GAME_RULES.planningSeconds); setCombatFrame(null); setCombatResult(null); setOpponent(null); setRevealingEnemy(false); setPhase("planning");
    setNotice(`+${passiveXp} passive XP · Income +${income.total}: base ${income.base}, interest ${income.interest}, streak ${income.streakBonus}.`);
    trackAnonymous("round_reached", { round: round + 1, fps: performance.measuredFps });
  };

  const startNew = () => {
    const nextSeed = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
    const starterRandom = createSeededRandom(mixSeed(nextSeed, 0x57a7));
    const starterPool = UNITS.filter((unit) => unit.cost === 1);
    const starters: OwnedUnit[] = [34, 37].map((position) => {
      const pickIndex = starterRandom.int(starterPool.length);
      const [def] = starterPool.splice(pickIndex, 1);
      return { uid: uid(), unitId: (def ?? UNITS[0]).id, star: 1 as const, position, itemIds: [] };
    });
    const restarting = active;
    advanceRoundRef.current = null;
    setSessionSeed(nextSeed); setRound(1); setGold(10); setHealth(100); setLevel(2); setXp(0); setUnits(starters); setItems([]); setAis(createAICommanders(difficulty, createSeededRandom(mixSeed(nextSeed, 0xa11)))); setShop(rollShop(2)); setLocked(false); setSelectedUid(null); setSelectedItem(null); setInspectedUnit(null); setInspectedCombat(null); setStreak(0); setTimer(GAME_RULES.planningSeconds); setStats(newStats()); setPhase("planning"); setActive(true); setHasSave(true); setNotice("Opening crew randomized. Your first neutral encounter is ahead."); tone(520, .16, "triangle"); unlockMusic();
    sessionStartedAt.current = Date.now();
    trackAnonymous(restarting ? "restart" : "start", { seed: nextSeed, fps: performance.measuredFps, quality: performance.quality });
  };

  const continueRun = () => {
    try {
      const save = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "") as SaveData;
      const completed = completedUnitIds(save.units);
      const restoredDifficulty = save.difficulty ?? "Normal";
      advanceRoundRef.current = null;
      setDifficulty(restoredDifficulty); setSessionSeed(save.sessionSeed ?? 1); setRound(save.round); setGold(save.gold); setHealth(save.health); setLevel(save.level); setXp(save.xp); setUnits(save.units); setItems(save.items); setAis(migrateAICommanders(save.ais, restoredDifficulty, createSeededRandom(mixSeed(save.sessionSeed ?? 1, 0x5a9e)))); setStreak(save.streak); setStats(save.stats); setShop(save.shop.map((unitId) => completed.has(unitId) ? "" : unitId)); setLocked(save.locked); setTimer(GAME_RULES.planningSeconds); setPhase("planning"); setActive(true); setNotice("Expedition restored."); unlockMusic();
    } catch { localStorage.removeItem(SAVE_KEY); setHasSave(false); startNew(); }
  };

  const displayedUnits = phase === "battle" && combatFrame ? combatFrame.units : null;
  const boardMap = useMemo(() => {
    const map = new Map<number, OwnedUnit>();
    if (displayedUnits) [...displayedUnits].sort((a, b) => Number(b.dead) - Number(a.dead)).forEach((combat) => map.set(combat.position, { uid: combat.uid, unitId: combat.unitId, star: combat.star, position: combat.position, itemIds: combat.itemIds }));
    else deployed.forEach((unit) => unit.position !== null && map.set(unit.position, unit));
    return map;
  }, [displayedUnits, deployed]);

  const placement = 1 + ais.filter((ai) => ai.alive).length;
  const economy = incomeFor(gold, streak);
  const currentOdds = effectiveShopOdds(level, completedUnitIds(units));
  const draggedUnit = units.find((unit) => unit.uid === draggedUid);
  const pendingSaleUnit = units.find((unit) => unit.uid === pendingSaleUid);
  const planningInspectedCombat = inspectedUnit && phase === "planning"
    ? inspectedUnit.position !== null
      ? planningSnapshot.find((entry) => entry.uid === inspectedUnit.uid)
      : buildCombatSnapshot([inspectedUnit], "player")[0]
    : null;
  const liveInspectedCombat = inspectedUnit ? combatFrame?.units.find((entry) => entry.uid === inspectedUnit.uid) ?? planningInspectedCombat ?? inspectedCombat : null;
  const boardNotFull = phase === "planning" && deployed.length < level;

  if (!active) return (
    <main className="landing-shell">
      <div className="ore-glow glow-one" /><div className="ore-glow glow-two" />
      <section className="landing-card">
        <div className="brand-lockup"><img src="/pepepow-symbol.png" alt="PEPEPOW symbol" width="58" height="58" fetchPriority="high" /><div><span>PEPEPOW</span><small>ART UNIFICATION · v0.9</small></div></div>
        <div className="hero-copy"><p className="eyebrow">PREMIUM 2.5D · DETERMINISTIC COMBAT</p><h1>AUTO<br/><em>BATTLEGROUND</em></h1><p>Recruit a crew. Forge powerful synergies. Watch every strike, spell and tactical choice unfold — then inspect or replay the battle.</p></div>
        <div className="feature-rail"><span><b>{UNITS.length}</b> original units</span><span><b>{Object.keys(TRAIT_DETAILS).length}</b> traits</span><span><b>7</b> commanders</span><span><b>∞</b> evolving rounds</span></div>
        <div className="difficulty-picker" aria-label="AI difficulty"><span>AI DIFFICULTY</span>{(["Easy", "Normal", "Hard"] as AIDifficulty[]).map((entry) => <button key={entry} className={difficulty === entry ? "active" : ""} onClick={() => setDifficulty(entry)} aria-pressed={difficulty === entry}>{entry.toUpperCase()}</button>)}</div>
        <div className="landing-actions"><button className="primary-action" onClick={startNew}>NEW EXPEDITION <span>→</span></button>{hasSave && <button className="secondary-action" onClick={continueRun}>CONTINUE RUN</button>}<button className="text-action" onClick={() => setShowGuide(true)}>HOW TO PLAY</button><button className="text-action" onClick={() => { setArchiveTab("units"); setShowArchive(true); }}>GAME ARCHIVE</button><button className="text-action" onClick={() => setShowBattleArchive(true)}>BATTLE ARCHIVE</button></div>
        <p className="level-zero">LEVEL 0 · PURE GAME · NO WALLET REQUIRED</p>
      </section>
      {showGuide && <Guide onClose={() => setShowGuide(false)} />}
      {showArchive && <Archive initialTab={archiveTab} onClose={() => setShowArchive(false)} />}
      {showBattleArchive && <BattleArchive records={battleHistory} performance={performance} onClose={() => setShowBattleArchive(false)} onReplay={(record) => setReplayRecord(record)} />}
      {replayRecord && <ReplayOverlay record={replayRecord} onClose={() => setReplayRecord(null)} />}
    </main>
  );

  return (
    <main className={`game-shell quality-${performance.quality} fps-${performance.targetFps}`} data-quality={performance.quality}>
      <header className="topbar">
        <button className="mini-brand" onClick={() => setActive(false)} aria-label="Main menu"><img src="/pepepow-symbol.png" alt="" width="40" height="40" /><span>PEPEPOW <b>AUTO BATTLEGROUND</b></span></button>
        <div className="round-label"><small>ROUND</small><strong>{round}</strong><span>{isPveRound ? (isBoss ? "VOID BOSS" : "NEUTRAL CREW") : opponent?.name ?? "RIVAL SCOUTING"}</span></div>
        <div className="resource-row"><div className="health"><small>CORE</small><b>♥ {health}</b></div><div className="gold"><small>GOLD</small><b>● {gold}</b></div><div className="level"><small>LEVEL</small><b>{level}</b><span>{level < GAME_RULES.maxLevel ? `${xp}/${xpNeeded} XP` : "MAX"}</span></div></div>
        <div className="header-actions"><span className="fps-chip" title={`${performance.quality} quality profile`}>{performance.measuredFps} FPS</span><button onClick={() => setSfxEnabled(!sfxEnabled)} aria-label={sfxEnabled ? "Mute SFX" : "Enable SFX"} aria-pressed={sfxEnabled}>SFX</button><button onClick={() => { setMusicEnabled(!musicEnabled); if (!musicEnabled) unlockMusic(); }} aria-label={musicEnabled ? "Mute music" : "Enable music"} aria-pressed={musicEnabled}>♪</button><input className="music-volume" aria-label="Music volume" type="range" min="0" max="1" step="0.05" value={musicVolume} onChange={(event) => setMusicVolume(Number(event.target.value))} /><button onClick={() => setShowGuide(true)} aria-label="Help">?</button><button onClick={() => { setArchiveTab("units"); setShowArchive(true); }} aria-label="Game archive">▦</button><button onClick={() => setShowBattleArchive(true)} aria-label="Battle archive">◫</button></div>
      </header>

      <div className="game-layout">
        <aside className="left-panel panel">
          <div className="panel-title"><span>ACTIVE SYNERGIES</span><b>{synergyRows.filter((row) => row.tier > 0).length} ACTIVE</b></div>
          <SynergyList rows={synergyRows} onOpenArchive={() => { setArchiveTab("traits"); setShowArchive(true); }} />
          <EquipmentInventory items={items} selectedItem={selectedItem} onSelect={(id) => { setSelectedItem(selectedItem === id ? null : id); setSelectedUid(null); }} />
          <div className="power-meter"><span>FORMATION POWER</span><strong>{armyPower(deployed)}</strong><i><em style={{ width: `${Math.min(100, armyPower(deployed) / 4)}%` }} /></i></div>
        </aside>

        <section className="arena-panel">
          <div className={`phase-banner ${phase} ${revealingEnemy ? "reveal" : ""}`}><span>{phase === "planning" ? "FORMATION PHASE" : revealingEnemy ? "SCOUTING ENEMY FORMATION" : phase === "battle" ? "AUTO COMBAT" : phase === "result" ? (combatResult?.winner === "player" ? "VICTORY" : combatResult?.winner === "draw" ? "DRAW" : "DEFEAT") : "EXPEDITION OVER"}</span>{boardNotFull && <strong className={`board-cap-warning ${bench.length ? "actionable" : ""}`}>BOARD NOT FULL — {deployed.length} / {level}</strong>}{phase === "planning" && <b>{timer}s</b>}{revealingEnemy && <b>1.8s</b>}</div>
          <div className={`battle-board ${phase === "battle" ? "in-combat" : ""}`}>
            <div className="enemy-nameplate"><span>{phase === "battle" ? (pve ? (isBoss ? "VOID FOREMAN" : "NEUTRAL CREW") : opponent?.name) : "ENEMY TERRITORY"}</span><i /></div>
            <SynergyTotems rows={synergyRows} />
            {Array.from({ length: BOARD_COLS * BOARD_ROWS }, (_, position) => {
              const unit = boardMap.get(position);
              const combat = displayedUnits?.find((entry) => entry.uid === unit?.uid);
              const cellEvents = combatFrame?.events.filter((event) => event.to === position) ?? [];
              return <div key={position} role="gridcell" tabIndex={position >= DEPLOY_START ? 0 : -1} data-drop-target={position >= DEPLOY_START && phase === "planning" ? `board:${position}` : undefined} className={`board-cell ${position >= DEPLOY_START ? "friendly" : "enemy"} ${(selectedUid || draggedUid) && position >= DEPLOY_START ? "available" : ""} ${dropTarget === `board:${position}` ? "drop-current" : ""} ${cellEvents.length ? "impact" : ""}`} onClick={() => deploySelected(position)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") deploySelected(position); }} aria-label={`Board cell ${position + 1}${unit ? `, ${UNIT_MAP[unit.unitId].name}` : ", empty"}`}>
                <span className="tile-lines" />
                {unit && <UnitToken unit={unit} selected={selectedUid === unit.uid} combat={combat} interactive={phase === "planning" && unit.position !== null} invalid={invalidDropUid === unit.uid} onDragStart={() => beginDrag(unit.uid)} onDragMove={updateDropTarget} onDragFinish={finishPointerDrag} onSelect={() => selectUnit(unit)} onInspect={() => inspectUnit(unit, combat)} />}
                <CellEffects events={cellEvents} units={combatFrame?.units ?? []} />
              </div>;
            })}
            {combatFrame && <ProjectileLayer events={combatFrame.events} units={combatFrame.units} />}
            {phase === "battle" && <div className="battle-message">{battleLog[0]}</div>}
          </div>

          <div className={`bench-wrap ${draggedUid ? "drop-ready" : ""}`}><div className="bench-label"><span>BENCH</span><small>{bench.length}/{GAME_RULES.benchSize}</small></div><div className="bench">{Array.from({ length: GAME_RULES.benchSize }, (_, index) => { const unit = bench[index]; return <div className={`bench-slot ${dropTarget === `bench:${index}` ? "drop-current" : ""}`} data-drop-target={`bench:${index}`} key={index}>{unit && <UnitToken unit={unit} selected={selectedUid === unit.uid} compact interactive={phase === "planning"} invalid={invalidDropUid === unit.uid} onDragStart={() => beginDrag(unit.uid)} onDragMove={updateDropTarget} onDragFinish={finishPointerDrag} onSelect={() => selectUnit(unit)} onInspect={() => inspectUnit(unit)} />}</div>; })}</div></div>
          <div className="notice-bar" role="status"><span className="notice-dot" />{notice}<div className="selection-actions">{selectedUid && phase === "planning" && <><button onClick={() => returnToBench()} disabled={bench.length >= GAME_RULES.benchSize}>TO BENCH</button><button onClick={sellSelected}>SELL · +{refundFor(units.find((unit) => unit.uid === selectedUid)!)}</button></>}{selectedItem && <span>SELECT A UNIT TO EQUIP</span>}</div></div>
          <MobileStatusDock panel={mobilePanel} onPanel={setMobilePanel} rows={synergyRows} items={items} selectedItem={selectedItem} onSelectItem={(id) => { setSelectedItem(selectedItem === id ? null : id); setSelectedUid(null); }} onOpenTraitArchive={() => { setArchiveTab("traits"); setShowArchive(true); }} onOpenItemArchive={() => { setArchiveTab("items"); setShowArchive(true); }} />
        </section>

        <aside className="right-panel panel">
          <div className="panel-title"><span>COMMANDERS</span><b>PLACE #{placement}</b></div>
          <div className="commander-list">
            <div className="commander player"><span className="avatar">P</span><div><b>YOU</b><small>Formation {armyPower(deployed)}</small></div><strong>{health}</strong></div>
            {[...ais].sort((a, b) => Number(b.alive) - Number(a.alive) || b.health - a.health).map((ai) => <div className={`commander ${ai.alive ? "" : "eliminated"}`} key={ai.name}><span className="avatar" style={{ "--avatar": ai.color } as React.CSSProperties}>{ai.icon}</span><div><b>{ai.name}</b><small>Lv.{ai.level} · {ai.personality} · {ai.difficulty}</small></div><strong>{ai.alive ? ai.health : "OUT"}</strong></div>)}
          </div>
          <div className="economy-card"><div><span>NEXT INCOME</span><b>+{economy.total}</b></div><small>Base {economy.base} · Interest {economy.interest} · Streak {economy.streakBonus}</small></div>
          <div className="streak-card"><span>{streak > 0 ? "WIN STREAK" : streak < 0 ? "LOSS STREAK" : "STREAK"}</span><b className={streak < 0 ? "loss" : ""}>{Math.abs(streak)}</b></div>
        </aside>
      </div>

      <footer className="shop-bar">
        <div className="shop-controls"><button onClick={reroll} disabled={phase !== "planning"}><span>↻</span><b>REROLL</b><small>{GAME_RULES.rerollCost} GOLD</small></button><button onClick={() => setLocked(!locked)} disabled={phase !== "planning"} className={locked ? "locked" : ""}><span>{locked ? "◆" : "◇"}</span><b>{locked ? "LOCKED" : "LOCK SHOP"}</b><small>KEEP NEXT ROUND</small></button><button onClick={buyXp} disabled={phase !== "planning" || level >= GAME_RULES.maxLevel}><span>↑</span><b>TRAIN CREW</b><small>{GAME_RULES.trainingCost} GOLD · +{GAME_RULES.trainingXp} XP</small></button></div>
        <div className="shop-market"><div className="shop-odds" aria-label={`Level ${level} shop odds`}>LV.{level} ODDS {currentOdds.map((value, index) => <span key={index} className={`tier-${index + 1}`}>{index + 1}● {value}%</span>)}</div><div className="shop-cards">{shop.map((unitId, index) => { const preview = unitId ? previewPurchase(units, unitId) : null; const copies = unitId ? ownedBaseCopies(units, unitId) : 0; const milestone = copies < 3 ? 3 : 9; const reminder = preview && preview.highestStar > 1 ? "UPGRADE!" : copies ? `${copies} / ${milestone}` : ""; return unitId ? <ShopCard key={`${unitId}-${index}`} unitId={unitId} onBuy={() => buyUnit(unitId, index)} affordable={gold >= UNIT_MAP[unitId].cost && phase === "planning" && Boolean(preview?.allowed)} blocked={!preview?.allowed} reminder={reminder} /> : <div className="shop-empty" key={index}>HIRED</div>; })}</div></div>
        <button className="battle-button" onClick={phase === "planning" ? startBattle : phase === "result" ? nextRound : undefined} disabled={phase === "battle" || phase === "gameover"}><small>{phase === "planning" ? "READY?" : phase === "result" ? "COLLECT INCOME" : "SIMULATING"}</small><b>{phase === "planning" ? "BEGIN BATTLE" : phase === "result" ? "NEXT ROUND" : "AUTO COMBAT"}</b><span>›</span></button>
      </footer>

      {phase === "result" && <ResultOverlay result={combatResult} pve={pve} damage={combatResult?.winner === "enemy" ? Math.max(3, (combatResult?.survivors ?? 1) * 2 + Math.floor(round / 5)) : 0} passiveXp={passiveXpForRound(round)} onReport={() => setShowBattleArchive(true)} onNext={nextRound} />}
      {phase === "gameover" && <GameOver victory={health > 0} placement={placement} round={round} stats={stats} onNew={startNew} onMenu={() => setActive(false)} />}
      {draggedUnit && <div className={`sell-drop-zone ${dropTarget === "sell" ? "active" : ""}`} data-drop-target="sell">SELL · +{refundFor(draggedUnit)} GOLD{(draggedUnit.star > 1 || draggedUnit.itemIds.length) && <small>CONFIRM REQUIRED</small>}</div>}
      {draggedUnit && dragPoint && <div className="drag-ghost" style={{ left: dragPoint.x, top: dragPoint.y }}><img src={`/units/${draggedUnit.unitId}.webp`} alt="" draggable={false} /><span>{UNIT_MAP[draggedUnit.unitId].name}</span></div>}
      {inspectedUnit && <UnitDetail unit={inspectedUnit} combat={liveInspectedCombat ?? undefined} battleStat={combatResult?.stats.find((entry) => entry.uid === inspectedUnit.uid)} activeSynergies={synergyRows.filter((row) => row.tier > 0)} onSell={phase === "planning" ? () => sellUnit(inspectedUnit.uid) : undefined} refund={refundFor(inspectedUnit)} onClose={() => { setInspectedUnit(null); setInspectedCombat(null); }} onArchive={() => { setArchiveTab("units"); setShowArchive(true); }} />}
      {pendingSaleUnit && <ConfirmSale unit={pendingSaleUnit} refund={refundFor(pendingSaleUnit)} onCancel={() => setPendingSaleUid(null)} onConfirm={() => sellUnit(pendingSaleUnit.uid, true)} />}
      {showGuide && <Guide onClose={() => setShowGuide(false)} />}
      {showArchive && <Archive initialTab={archiveTab} onClose={() => setShowArchive(false)} />}
      {showBattleArchive && <BattleArchive records={battleHistory} performance={performance} onClose={() => setShowBattleArchive(false)} onReplay={(record) => setReplayRecord(record)} />}
      {replayRecord && <ReplayOverlay record={replayRecord} onClose={() => setReplayRecord(null)} />}
    </main>
  );
}

function CellEffects({ events, units }: { events: BattleEvent[]; units: BattleFrame["units"] }) {
  return <div className="cell-effects" aria-hidden="true">{events.slice(-5).map((entry, index) => {
    const controlLabel = entry.skillId === "mire-chemist" ? "HEAL ↓" : entry.skillId === "signal-leech" ? "MANA ↓" : entry.skillId === "prism-hook" ? "PULL" : entry.skillId === "coil-ranger" ? "FEEDBACK" : entry.skillId === "rift-breaker" ? "SHIELD BREAK" : "CONTROL";
    const label = entry.type === "heal" ? `+${entry.amount ?? 0}` : entry.type === "shield" ? `+${entry.amount ?? 0}` : entry.type === "stun" ? "STUN" : entry.type === "control" ? controlLabel : entry.type === "critical" ? `${entry.amount ?? 0}!` : entry.type === "damage" ? `-${entry.amount ?? 0}` : "";
    const team = units.find((unit) => unit.uid === entry.sourceUid)?.team ?? "player";
    return <span key={entry.id} className={`combat-float ${entry.type} team-${team} ${skillVfxClass(entry.skillId)}`} style={{ "--fx-index": index } as React.CSSProperties}>{label}<i /><i /><i /></span>;
  })}</div>;
}

function ProjectileLayer({ events, units }: { events: BattleEvent[]; units: BattleFrame["units"] }) {
  const projectiles = events.filter((entry) => entry.type === "projectile" && entry.from !== undefined && entry.to !== undefined);
  return <div className="projectile-layer" aria-hidden="true">{projectiles.map((entry) => {
    const from = entry.from!, to = entry.to!;
    const x1 = ((from % BOARD_COLS) + .5) / BOARD_COLS * 100, y1 = (Math.floor(from / BOARD_COLS) + .5) / BOARD_ROWS * 100;
    const x2 = ((to % BOARD_COLS) + .5) / BOARD_COLS * 100, y2 = (Math.floor(to / BOARD_COLS) + .5) / BOARD_ROWS * 100;
    const dx = x2 - x1, dy = (y2 - y1) * .75;
    const team = units.find((unit) => unit.uid === entry.sourceUid)?.team ?? "player";
    return <span key={entry.id} className={`${entry.skillId ? skillVfxClass(entry.skillId) : "basic-projectile vfx-single"} team-${team}`} style={{ "--x1": `${x1}%`, "--y1": `${y1}%`, "--length": `${Math.hypot(dx, dy)}%`, "--angle": `${Math.atan2(dy, dx) * 180 / Math.PI}deg` } as React.CSSProperties}><i /></span>;
  })}</div>;
}

function SynergyList({ rows, compact = false, onOpenArchive }: { rows: SynergyRow[]; compact?: boolean; onOpenArchive: () => void }) {
  return <div className={`trait-list ${compact ? "compact" : ""}`}>
    {rows.length ? rows.map((row) => <button className={`trait tier-${row.tier} ${row.tier ? "active" : ""}`} key={row.trait} onClick={onOpenArchive}>
      <SynergyIcon trait={row.trait} />
      <span><b>{row.trait} <em>{TRAIT_DETAILS[row.trait].category}</em></b><small>{row.tier ? `TIER ${row.tier} · ${row.count}/${row.nextThreshold ?? row.threshold} · ${row.value}` : `${row.count}/${row.threshold} · ${row.value}`}</small></span>
      <strong>{row.tier ? `T${row.tier}` : row.count}</strong>
    </button>) : <p className="empty-copy">Deploy units to activate crew bonuses.</p>}
  </div>;
}

function SynergyTotems({ rows }: { rows: SynergyRow[] }) {
  const visible = rows.filter((row) => row.count > 0).slice(0, 5);
  if (!visible.length) return null;
  return <div className="synergy-totems" aria-label="Formation synergy progress">{visible.map((row) => {
    const goal = row.nextThreshold ?? row.threshold;
    return <div className={`synergy-totem tier-${row.tier}`} data-trait={row.trait} style={{ "--sigil": TRAIT_DETAILS[row.trait].color, "--sigil-accent": TRAIT_DETAILS[row.trait].accent } as React.CSSProperties} key={row.trait} title={`${row.trait}: ${row.count}/${goal}${row.tier ? ` · ${row.value}` : ""}`}>
      <SynergyIcon trait={row.trait} className="synergy-sigil" />
      <b>{row.count}/{goal}</b>
      <i><em style={{ width: `${Math.min(100, row.count / Math.max(1, goal) * 100)}%` }} /></i>
    </div>;
  })}</div>;
}

function MobileStatusDock({ panel, onPanel, rows, items, selectedItem, onSelectItem, onOpenTraitArchive, onOpenItemArchive }: { panel: MobilePanel; onPanel: (panel: MobilePanel) => void; rows: SynergyRow[]; items: string[]; selectedItem: string | null; onSelectItem: (id: string) => void; onOpenTraitArchive: () => void; onOpenItemArchive: () => void }) {
  const activeCount = rows.filter((row) => row.tier > 0).length;
  return <div className={`mobile-status-dock ${panel ? "expanded" : ""}`}>
    {panel && <div className="mobile-status-panel">
      <header><b>{panel === "synergies" ? "ACTIVE SYNERGIES & VALUES" : "EQUIPMENT"}</b><button onClick={() => onPanel(null)} aria-label="Close mobile status panel">CLOSE ×</button></header>
      {panel === "synergies" ? <SynergyList rows={rows} compact onOpenArchive={onOpenTraitArchive} /> : <EquipmentInventory items={items} selectedItem={selectedItem} mobile onSelect={onSelectItem} onOpenArchive={onOpenItemArchive} />}
    </div>}
    <button className={panel === "synergies" ? "active" : ""} onClick={() => onPanel(panel === "synergies" ? null : "synergies")} aria-expanded={panel === "synergies"}><span>◆</span><b>SYNERGIES</b><small>{activeCount} ACTIVE</small></button>
    <button className={panel === "equipment" ? "active" : ""} onClick={() => onPanel(panel === "equipment" ? null : "equipment")} aria-expanded={panel === "equipment"}><span>▤</span><b>EQUIPMENT</b><small>{items.length}/8</small></button>
  </div>;
}

function EquipmentInventory({ items, selectedItem, mobile = false, onSelect, onOpenArchive }: { items: string[]; selectedItem: string | null; mobile?: boolean; onSelect: (id: string) => void; onOpenArchive?: () => void }) {
  const selected = selectedItem ? ITEMS.find((item) => item.id === selectedItem) : null;
  return <>
    <div className="items-title"><span className="items-title-label">EQUIPMENT</span><span>{items.length}/8</span>{mobile && <button onClick={onOpenArchive} aria-label="Open equipment guide">ITEM GUIDE</button>}</div>
    <div className="item-grid">{items.length ? items.map((id, index) => { const item = ITEMS.find((entry) => entry.id === id)!; return <button key={`${id}-${index}`} className={selectedItem === id ? "selected" : ""} onClick={() => onSelect(id)} title={`${item.name}: ${item.text}`} aria-label={`${item.name}: ${item.text}`} aria-pressed={selectedItem === id}><span>{item.icon}</span><small>{item.name}</small></button>; }) : <p className="empty-copy">Defeat neutral crews to recover gear.</p>}</div>
    {selected && <div className="item-explainer"><b>{selected.name}</b><span>{selected.text}</span><small>Tap a unit to equip it. Each unit can carry two items.</small></div>}
  </>;
}

function BattleArchive({ records, performance, onClose, onReplay }: { records: BattleRecord[]; performance: ReturnType<typeof useAdaptivePerformance>; onClose: () => void; onReplay: (record: BattleRecord) => void }) {
  const [selectedId, setSelectedId] = useState(records[0]?.id ?? "");
  const [scope, setScope] = useState<"battle" | "campaign">("battle");
  const [enemyInspectUid, setEnemyInspectUid] = useState<string | null>(null);
  const selected = records.find((record) => record.id === selectedId) ?? records[0];
  const verification = useMemo(() => selected ? simulateBattle(selected.playerArmy, selected.enemyArmy, selected.result.seed) : null, [selected]);
  const verified = !!selected && selected.result.version === REPLAY_VERSION && selected.result.engineVersion === ENGINE_VERSION && JSON.stringify(verification?.stats) === JSON.stringify(selected.result.stats);
  const damage = selected ? [...selected.result.stats].sort((a, b) => b.damageDealt - a.damageDealt) : [];
  const enemySynergies = useMemo(() => selected ? synergyRowsFor(selected.enemyArmy).filter((row) => row.tier > 0) : [], [selected]);
  const enemyUnit = selected?.enemyArmy.find((unit) => unit.uid === enemyInspectUid);
  const enemyCombat = selected?.result.frames[0]?.units.find((unit) => unit.uid === enemyInspectUid);
  const enemyStat = selected?.result.stats.find((unit) => unit.uid === enemyInspectUid);
  const campaign = useMemo(() => {
    const totals = new Map<string, UnitBattleStats>();
    for (const record of records) for (const entry of record.result.stats.filter((unit) => unit.team === "player")) {
      const current = totals.get(entry.unitId) ?? { ...entry, uid: entry.unitId, star: entry.star, damageDealt: 0, damageTaken: 0, healing: 0, shielding: 0, kills: 0, casts: 0, criticals: 0 };
      current.star = Math.max(current.star, entry.star) as 1 | 2 | 3;
      current.damageDealt += entry.damageDealt; current.damageTaken += entry.damageTaken; current.healing += entry.healing; current.shielding += entry.shielding; current.kills += entry.kills; current.casts += entry.casts; current.criticals += entry.criticals;
      totals.set(entry.unitId, current);
    }
    return [...totals.values()];
  }, [records]);
  const performanceStats = scope === "battle" ? damage.filter((unit) => unit.team === "player") : campaign;
  return <div className="modal-backdrop" onClick={onClose}>
    <section className="modal battle-archive-modal" role="dialog" aria-modal="true" aria-label="Battle Archive" onClick={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={onClose}>×</button><p className="eyebrow">BATTLE ARCHIVE · REPLAY v{REPLAY_VERSION}</p><h2>Every round, measured and reproducible.</h2>
      <div className="archive-shell">
        <aside className="round-history"><h3>ROUND HISTORY</h3>{records.length ? records.map((record) => <button key={record.id} className={record.id === selected?.id ? "active" : ""} onClick={() => { setSelectedId(record.id); setEnemyInspectUid(null); }}><span>R{record.round}</span><div><b>{record.opponent}</b><small>Seed {record.result.seed} · {record.result.durationTicks} ticks</small></div><strong className={record.result.winner === "player" ? "win" : record.result.winner === "draw" ? "draw" : "loss"}>{record.result.winner === "player" ? "WIN" : record.result.winner.toUpperCase()}</strong></button>) : <p className="empty-copy">Complete a battle to create the first replay.</p>}</aside>
        <div className="battle-analysis">{selected ? <>
          <div className="analysis-hero"><div><small>ROUND {selected.round} · {new Date(selected.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small><h3>{selected.opponent}</h3><span className={verified ? "verified" : "invalid"}>{verified ? "◆ DETERMINISTIC REPLAY VERIFIED" : "◇ LEGACY / INVALID REPLAY"}</span></div><button className="replay-button" onClick={() => onReplay(selected)}>WATCH REPLAY <span>▶</span></button></div>
          <div className="damage-summary"><span><small>TEAM DAMAGE</small><b>{damage.filter((unit) => unit.team === "player").reduce((sum, unit) => sum + unit.damageDealt, 0).toLocaleString()}</b></span><span><small>HEALING DONE</small><b>{damage.filter((unit) => unit.team === "player").reduce((sum, unit) => sum + unit.healing, 0).toLocaleString()}</b></span><span><small>DAMAGE TAKEN</small><b>{damage.filter((unit) => unit.team === "player").reduce((sum, unit) => sum + unit.damageTaken, 0).toLocaleString()}</b></span><span><small>FORMAT</small><b>v{selected.result.version}</b></span></div>
          <section className="enemy-lineup"><header><b>ENEMY LINEUP</b><small>Tap a unit to inspect its historical battle snapshot.</small></header><div>{selected.enemyArmy.map((unit) => { const def = UNIT_MAP[unit.unitId]; const stat = selected.result.stats.find((entry) => entry.uid === unit.uid); return <button key={unit.uid} onClick={() => setEnemyInspectUid(unit.uid)} aria-label={`Inspect enemy ${def.name}`}><img src={`/units/${unit.unitId}.webp`} alt="" loading="lazy" /><span><b>{def.name}</b><small>{starText(unit.star)} · {def.traits.join(" · ")}</small><em>{unit.itemIds.length ? unit.itemIds.map((id) => ITEMS.find((item) => item.id === id)?.icon).join("") : "NO GEAR"}</em></span><strong>{Math.round(stat?.damageDealt ?? 0)} DMG</strong></button>; })}</div></section>
          <TeamPerformance stats={performanceStats} scope={scope} onScope={setScope} />
          <div className="unit-stat-table"><div className="stat-head"><span>UNIT STATISTICS</span><span>DMG</span><span>TAKEN</span><span>HEAL</span><span>CAST</span><span>KILLS</span></div>{damage.map((entry) => <div key={entry.uid} className={entry.team}><span><img src={`/units/${entry.unitId}.webp`} alt="" loading="lazy" /><b>{UNIT_MAP[entry.unitId].name}</b><small>{entry.team} · {starText(entry.star)}</small></span><strong>{Math.round(entry.damageDealt)}</strong><strong>{Math.round(entry.damageTaken)}</strong><strong>{Math.round(entry.healing)}</strong><strong>{entry.casts}</strong><strong>{entry.kills}</strong></div>)}</div>
        </> : <div className="empty-analysis"><span>◇</span><p>No battle data yet.</p></div>}</div>
      </div>
      <div className="diagnostics-strip"><span><small>ENGINE</small><b>{ENGINE_VERSION}</b></span><span><small>PROFILE</small><b>{performance.quality.toUpperCase()} · {performance.targetFps} FPS</b></span><span><small>MEASURED</small><b>{performance.measuredFps} FPS</b></span><span><small>DEVICE</small><b>{performance.device.toUpperCase()} · {performance.cores} CORES{performance.memoryGb ? ` · ${performance.memoryGb}GB` : ""}</b></span><span><small>ASSETS</small><b>LAZY WEBP</b></span></div>
    </section>
    {enemyUnit && <UnitDetail unit={enemyUnit} combat={enemyCombat} battleStat={enemyStat} activeSynergies={enemySynergies} refund={0} historical onClose={() => setEnemyInspectUid(null)} />}
  </div>;
}

function TeamPerformance({ stats, scope, onScope }: { stats: UnitBattleStats[]; scope: "battle" | "campaign"; onScope: (scope: "battle" | "campaign") => void }) {
  const categories: Array<[string, keyof Pick<UnitBattleStats, "damageDealt" | "healing" | "damageTaken">]> = [["DAMAGE DEALT", "damageDealt"], ["HEALING DONE", "healing"], ["DAMAGE TAKEN", "damageTaken"]];
  return <section className="team-performance"><header><b>TEAM PERFORMANCE · TOP 5</b><div><button className={scope === "battle" ? "active" : ""} onClick={() => onScope("battle")}>CURRENT BATTLE</button><button className={scope === "campaign" ? "active" : ""} onClick={() => onScope("campaign")}>EXPEDITION</button></div></header><div>{categories.map(([label, key]) => <article key={key}><small>{label}</small>{[...stats].filter((entry) => Number(entry[key]) > 0).sort((a, b) => Number(b[key]) - Number(a[key]) || (a.uid < b.uid ? -1 : 1)).slice(0, 5).map((entry, index) => <span key={entry.uid}><i>{index + 1}</i><img src={`/units/${entry.unitId}.webp`} alt="" /><b>{UNIT_MAP[entry.unitId].name}</b><strong>{Math.round(Number(entry[key]))}</strong></span>)}</article>)}</div></section>;
}

function ReplayOverlay({ record, onClose }: { record: BattleRecord; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const frame = record.result.frames[index] ?? record.result.frames[0];
  useEffect(() => {
    if (!playing) return;
    const handle = window.setInterval(() => setIndex((current) => {
      if (current >= record.result.frames.length - 1) { setPlaying(false); return current; }
      return current + 1;
    }), 210 / speed);
    return () => window.clearInterval(handle);
  }, [playing, speed, record]);
  const board = new Map([...frame.units].sort((a, b) => Number(b.dead) - Number(a.dead)).map((unit) => [unit.position, unit]));
  return <div className="replay-overlay"><header><div><p>ROUND {record.round} REPLAY</p><h2>{record.opponent}</h2><small>{REPLAY_FORMAT} · v{record.result.version} · seed {record.result.seed}</small></div><button onClick={onClose}>CLOSE ×</button></header><div className="replay-stage"><div className="replay-board battle-board in-combat">{Array.from({ length: BOARD_COLS * BOARD_ROWS }, (_, position) => { const combat = board.get(position); const events = frame.events.filter((entry) => entry.to === position); return <div key={position} className={`board-cell ${position >= DEPLOY_START ? "friendly" : "enemy"} ${events.length ? "impact" : ""}`}><span className="tile-lines" />{combat && <UnitToken unit={{ uid: combat.uid, unitId: combat.unitId, star: combat.star, position: combat.position, itemIds: combat.itemIds }} combat={combat} />}<CellEffects events={events} units={frame.units} /></div>; })}<ProjectileLayer events={frame.events} units={frame.units} /></div><div className="replay-message">{frame.message}</div></div><footer><button onClick={() => setIndex(0)}>↶</button><button onClick={() => setPlaying((value) => !value)}>{playing ? "Ⅱ" : "▶"}</button><input aria-label="Replay timeline" type="range" min="0" max={Math.max(0, record.result.frames.length - 1)} value={index} onChange={(event) => { setIndex(Number(event.target.value)); setPlaying(false); }} /><span>{frame.tick}/{record.result.durationTicks}</span><button onClick={() => setSpeed((value) => value === 2 ? .5 : value === .5 ? 1 : 2)}>{speed}×</button></footer></div>;
}

function ShopCard({ unitId, affordable, blocked, reminder, onBuy }: { unitId: string; affordable: boolean; blocked?: boolean; reminder?: string; onBuy: () => void }) {
  const unit = UNIT_MAP[unitId];
  return <button className={`shop-card ${affordable ? "" : "unaffordable"} ${blocked ? "bench-blocked" : ""} ${reminder === "UPGRADE!" ? "upgrade-ready" : reminder ? "owned-copy" : ""}`} onClick={onBuy} disabled={!affordable} title={blocked ? "Bench full — this recruit would not fuse immediately." : undefined} style={{ "--rarity": COST_COLORS[unit.cost], "--unit": unit.color } as React.CSSProperties}>
    <div className="shop-art"><img src={`/units/${unit.id}.webp`} alt="" loading="lazy" decoding="async" /><span>{unit.icon}</span><i /></div><div className="shop-info"><b>{unit.name}</b><div>{unit.traits.map((trait) => <small key={trait}>{trait}</small>)}</div><p>{unit.skill}: {unit.skillText}</p></div><strong>● {unit.cost}</strong>
    {reminder && <mark>{reminder}</mark>}
    {blocked && <em>BENCH FULL</em>}
  </button>;
}

function Guide({ onClose }: { onClose: () => void }) {
  return <div className="modal-backdrop" onClick={onClose}><section className="modal guide-modal" role="dialog" aria-modal="true" aria-label="How to play" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><p className="eyebrow">v0.9 FIELD MANUAL</p><h2>Build the crew. Read the fight. Counter the threat.</h2><div className="guide-grid"><article><span>01</span><b>Recruit & fuse</b><p>Three identical copies fuse into ★★; three ★★ become ★★★. A full Bench accepts a recruit only when it immediately fuses and returns to eight or fewer units. Fusion equipment overflow returns to inventory.</p></article><article><span>02</span><b>Move & inspect</b><p>Tap to select and drag between Bench and Board. Hold for 450 ms—or right-click—to open Unit Info. Selling only occurs after an explicit drop inside the red Sell zone.</p></article><article><span>03</span><b>Targeting & Taunt</b><p>Targets remain locked until invalid. Assassins open on the deepest enemy backline, prioritizing Rangers and then Arcanists at equal depth. Guardian Taunt can temporarily override the lock.</p></article><article><span>04</span><b>Synergy sigils</b><p>Every faction and class has a unique colored sigil. Only unique deployed units count. Open Game Archive to see each 2-tier threshold, exact effect and all eligible members.</p></article><article><span>05</span><b>Counter units</b><p>Rift Breaker destroys shields; Mire Chemist reduces healing; Signal Leech disrupts Mana; Lantern Warden protects the backline; Prism Hook pulls and stuns; Coil Ranger reflects repeated damage.</p></article><article><span>06</span><b>Read spell effects</b><p>Thin lines are normal shots, wide lines pierce, segmented bolts chain, and circles warn of areas. Healing is soft teal; control is purple or ice-blue. Friendly areas use cyan, enemy areas coral-red or violet.</p></article><article><span>07</span><b>Gold & income</b><p>Each round pays 5 base Gold. Keep 10/20/30/40/50 Gold for +1 to +5 Interest. PvP streaks pay +1 at 2, +2 at 3 and +3 at 5; neutral battles preserve the streak.</p></article><article><span>08</span><b>XP, Level & Shop</b><p>Completed battles grant rising passive XP up to +8. Training costs 4 Gold for +4 XP. Level controls the deployment cap and the exact Shop odds shown above the cards.</p></article><article><span>09</span><b>Adaptive commanders</b><p>AI uses the same economy and odds as you. Hard commanders scout your public Board, shift Assassins toward Ranger/Arcanist carries, protect their backline, abandon poor 3-star chases and vary strategy by personality.</p></article><article><span>10</span><b>Replay & performance</b><p>Battle Archive records Top 5 Damage, Healing and Damage Taken. Replay v{REPLAY_VERSION} is seed-reproducible. Visual quality adapts between 30/60 FPS without changing simulation results.</p></article></div><button className="primary-action" onClick={onClose}>ENTER BATTLEGROUND</button></section></div>;
}

function targetingText(unitId: string) {
  const def = UNIT_MAP[unitId];
  return def.traits[1] === "Assassin" ? "Battle Start: prioritizes the deepest enemy backline, then Rangers and Arcanists at equal depth. Target stays locked until invalid." : def.range > 1 ? "Targeting: an enemy already in range; otherwise nearest reachable enemy. Target stays locked until invalid." : "Targeting: nearest reachable enemy. Target stays locked until invalid.";
}

function UnitDetail({ unit, combat, battleStat, activeSynergies = [], refund, historical = false, onSell, onClose, onArchive }: { unit: OwnedUnit; combat?: BattleFrame["units"][number]; battleStat?: UnitBattleStats; activeSynergies?: SynergyRow[]; refund: number; historical?: boolean; onSell?: () => void; onClose: () => void; onArchive?: () => void }) {
  const def = UNIT_MAP[unit.unitId];
  const scale = unit.star === 1 ? 1 : unit.star === 2 ? 1.75 : 3.05;
  const equipment = unit.itemIds.map((id) => ITEMS.find((item) => item.id === id)).filter(Boolean);
  return <aside className={`unit-detail ${historical ? "archive-unit-detail" : ""}`} role="dialog" aria-label={`${def.name} unit information`} onClick={(event) => event.stopPropagation()} style={{ "--unit": def.color, "--rarity": COST_COLORS[def.cost] } as React.CSSProperties}><button className="detail-close" onClick={onClose} aria-label="Close unit details">×</button><div className="detail-heading"><span><img src={`/units/${def.id}.webp`} alt="" draggable={false} /></span><div><small>{historical ? "HISTORICAL ENEMY SNAPSHOT" : combat?.team === "enemy" ? "ENEMY UNIT" : unit.position === null ? "BENCH UNIT" : "DEPLOYED UNIT"}</small><h3>{def.name}</h3><b>{starText(unit.star)} · {def.traits[0]} Faction / {def.traits[1]} Class</b></div><em>● {def.cost}</em></div><p className="skill-copy"><strong>{def.skill}</strong>{def.skillText}</p><p className="targeting-copy">{targetingText(def.id)}</p><div className="detail-stats six"><span><small>HEALTH</small><b>{combat ? `${Math.round(combat.hp)}/${combat.maxHp}` : Math.round(def.hp * scale)}</b></span><span><small>ATTACK</small><b>{combat ? combat.attack : Math.round(def.attack * scale)}</b></span><span><small>ARMOR</small><b>{combat ? combat.armor : def.armor}</b></span><span><small>RANGE</small><b>{def.range}</b></span><span><small>MANA</small><b>{combat ? `${Math.round(combat.mana)}/100` : "0/100"}</b></span><span><small>ATTACK SPEED</small><b>1 / TICK</b></span></div><div className="detail-traits">{def.traits.map((trait) => <span key={trait}><SynergyIcon trait={trait} /><b>{trait}</b><small>{TRAIT_DETAILS[trait].category} · thresholds {TRAIT_DETAILS[trait].thresholds.join(" / ")}</small></span>)}</div>{activeSynergies.length > 0 && <div className="detail-buffs"><small>ACTIVE TEAM BUFFS</small>{activeSynergies.map((row) => <span key={row.trait}><b>{row.trait} T{row.tier}</b>{row.value}</span>)}</div>}{combat && <div className="status-chips">{combat.shield > 0 && <span>Shield +{Math.round(combat.shield)}</span>}{combat.stunned > 0 && <span>Stunned · {combat.stunned} tick{combat.stunned === 1 ? "" : "s"}</span>}{combat.healingReductionTicks > 0 && <span>Healing reduced · {combat.healingReductionTicks}</span>}{combat.feedbackTicks > 0 && <span>Feedback marked · {combat.feedbackTicks}</span>}</div>}{battleStat && <div className="detail-performance"><small>{historical ? "RECORDED COMBAT" : "CURRENT BATTLE"}</small><span>Damage {Math.round(battleStat.damageDealt)}</span><span>Healing {Math.round(battleStat.healing)}</span><span>Damage Taken {Math.round(battleStat.damageTaken)}</span></div>}<div className="detail-gear"><small>EQUIPMENT</small>{equipment.length ? equipment.map((item) => <span key={item!.id}>{item!.icon} <b>{item!.name}</b> · {item!.text}</span>) : <span>No equipment attached.</span>}</div>{onSell && <button className="detail-sell" onClick={onSell}>SELL · +{refund} GOLD</button>}{onArchive && <button className="detail-link" onClick={onArchive}>OPEN FULL GAME ARCHIVE →</button>}</aside>;
}

function Archive({ initialTab, onClose }: { initialTab: ArchiveTab; onClose: () => void }) {
  const [tab, setTab] = useState<ArchiveTab>(initialTab);
  return <div className="modal-backdrop" onClick={onClose}><section className="modal roster-modal archive-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><p className="eyebrow">GAME ARCHIVE</p><h2>Units, synergies & equipment</h2><div className="archive-tabs"><button className={tab === "units" ? "active" : ""} onClick={() => setTab("units")}>{UNITS.length} UNITS</button><button className={tab === "traits" ? "active" : ""} onClick={() => setTab("traits")}>{Object.keys(TRAIT_DETAILS).length} SYNERGIES</button><button className={tab === "items" ? "active" : ""} onClick={() => setTab("items")}>{ITEMS.length} ITEMS</button></div>{tab === "units" && <div className="roster-grid detailed">{UNITS.map((unit) => <article key={unit.id} style={{ "--unit": unit.color, "--rarity": COST_COLORS[unit.cost] } as React.CSSProperties}><span><img src={`/units/${unit.id}.webp`} alt="" loading="lazy" /></span><div><b>{unit.name}</b><small>{unit.traits.join(" · ")}</small><p><strong>{unit.skill}</strong> — {unit.skillText}</p><dl><div><dt>HP</dt><dd>{unit.hp}</dd></div><div><dt>ATK</dt><dd>{unit.attack}</dd></div><div><dt>ARM</dt><dd>{unit.armor}</dd></div><div><dt>RNG</dt><dd>{unit.range}</dd></div></dl></div><em>● {unit.cost}</em></article>)}</div>}{tab === "traits" && <div className="trait-archive">{(Object.entries(TRAIT_DETAILS) as [Trait, (typeof TRAIT_DETAILS)[Trait]][]).map(([trait, detail]) => <article key={trait}><div className="trait-archive-title"><SynergyIcon trait={trait} /><div><small>{detail.category} · {detail.appliesTo}</small><b>{trait}</b></div></div><p>{detail.summary}</p><div className="tier-row"><span><b>{detail.thresholds[0]}</b>{detail.tiers[0]}</span><span><b>{detail.thresholds[1]}</b>{detail.tiers[1]}</span></div><small className="members">UNITS · {UNITS.filter((unit) => unit.traits.includes(trait)).map((unit) => unit.name).join(" · ")}</small></article>)}</div>}{tab === "items" && <div className="gear-archive">{ITEMS.map((item) => <article key={item.id}><span>{item.icon}</span><div><b>{item.name}</b><p>{item.text}</p><small>Drops from neutral and boss victories · Stackable · Maximum 2 items per unit</small></div></article>)}</div>}<p className="archive-note">Upgrade scaling: ★★ units use 1.75× base Health and Attack; ★★★ units use 3.05×. Equipment and active synergies are applied afterward.</p></section></div>;
}

function ResultOverlay({ result, pve, damage, passiveXp, onReport, onNext }: { result: BattleResult | null; pve: boolean; damage: number; passiveXp: number; onReport: () => void; onNext: () => void }) {
  if (!result) return null;
  const won = result.winner === "player", draw = result.winner === "draw";
  const playerStats = result.stats.filter((entry) => entry.team === "player");
  const categories: Array<[string, keyof Pick<UnitBattleStats, "damageDealt" | "healing" | "damageTaken">]> = [["DAMAGE", "damageDealt"], ["HEALING", "healing"], ["TAKEN", "damageTaken"]];
  return <div className="result-overlay"><div className={`result-card ${won ? "won" : draw ? "draw" : "lost"}`} role="dialog" aria-modal="true" aria-labelledby="battle-result-title"><span className="result-mark" aria-hidden="true">{won ? "✦" : draw ? "◇" : "◆"}</span><p>{pve ? "EXPEDITION ENCOUNTER" : "COMMANDER DUEL"}</p><h2 id="battle-result-title">{won ? "VICTORY" : draw ? "DRAW" : "DEFEAT"}</h2><small>{won ? (pve ? "Equipment recovered." : "The rival Core takes damage.") : draw ? "Both formations hold the line." : `Your Core takes ${damage} damage.`} · +{passiveXp} XP next round</small><div className="top-five-summary">{categories.map(([label, key]) => <section key={key}><b>TOP 5 · {label}</b>{[...playerStats].filter((entry) => Number(entry[key]) > 0).sort((a, b) => Number(b[key]) - Number(a[key]) || (a.uid < b.uid ? -1 : 1)).slice(0, 5).map((entry, index) => <div key={entry.uid}><span>#{index + 1}</span><img src={`/units/${entry.unitId}.webp`} alt="" draggable={false} /><strong>{UNIT_MAP[entry.unitId].name}</strong><small>{Math.round(Number(entry[key]))}</small></div>)}</section>)}</div><div className="result-actions"><button className="report-button" onClick={onReport}>FULL REPORT</button><button onClick={onNext}>NEXT ROUND <span>→</span></button></div></div></div>;
}

function ConfirmSale({ unit, refund, onCancel, onConfirm }: { unit: OwnedUnit; refund: number; onCancel: () => void; onConfirm: () => void }) {
  const def = UNIT_MAP[unit.unitId];
  return <div className="modal-backdrop" role="presentation"><section className="modal confirm-sale" role="dialog" aria-modal="true" aria-label="Confirm sale"><p className="eyebrow">VALUABLE UNIT</p><h2>Sell {starText(unit.star)} {def.name}?</h2><p>You receive {refund} gold. {unit.itemIds.length ? `${unit.itemIds.length} equipped item${unit.itemIds.length > 1 ? "s" : ""} will return to inventory.` : "This cannot be undone."}</p><div><button className="secondary-action" onClick={onCancel}>CANCEL</button><button className="danger-action" onClick={onConfirm}>SELL · +{refund} GOLD</button></div></section></div>;
}

function GameOver({ victory, placement, round, stats, onNew, onMenu }: { victory: boolean; placement: number; round: number; stats: RunStats; onNew: () => void; onMenu: () => void }) {
  return <div className="modal-backdrop"><section className="modal end-modal"><p className="eyebrow">EXPEDITION REPORT</p><span className="end-symbol">{victory ? "✦" : "◇"}</span><h2>{victory ? "LAST CORE STANDING" : `PLACED #${placement}`}</h2><p>{victory ? "Every rival commander has fallen. The battleground is yours." : "The Core went dark, but every failed formation reveals a better one."}</p><div className="stat-grid"><div><b>{round}</b><small>ROUND</small></div><div><b>{stats.wins}</b><small>WINS</small></div><div><b>{stats.unitsBought}</b><small>RECRUITS</small></div><div><b>{starText(stats.highestStar)}</b><small>BEST UNIT</small></div></div><button className="primary-action" onClick={onNew}>NEW EXPEDITION</button><button className="text-action" onClick={onMenu}>RETURN TO MENU</button></section></div>;
}
