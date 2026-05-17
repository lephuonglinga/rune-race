/**
 * Board geometry and movement rules.
 * Defines the board layout, safe tiles, home lane rules, and position validation.
 */

import type { PlayerColor } from '@rune-race/shared'

/**
 * Board layout constants.
 * Standard Indian Ludo/Cá Ngựa board.
 */
export const BOARD_SIZE = 40 // Main ring positions (0-39)
export const HOME_LANE_SIZE = 4 // Positions in home lane before finish (0-3)
export const TOTAL_TOKENS_PER_PLAYER = 4
export const BASE_START_SIZE = 4 // Each base starts with 4 home positions (where tokens start)

/**
 * Safe tile positions on main board (can't be captured).
 * Typically at cardinal directions and entry/exit points.
 */
export const SAFE_POSITIONS = new Set([0, 5, 10, 15, 20, 25, 30, 35])

/**
 * Entry positions for each player color (where token enters main board when spawned).
 */
export const SPAWN_ENTRY_POSITION: Record<PlayerColor, number> = {
  red: 0,
  blue: 10,
  green: 20,
  yellow: 30,
}

/**
 * Home lane start position (where token enters home lane from main board).
 * This is the last regular position before home lane.
 */
export const HOME_LANE_ENTRY: Record<PlayerColor, number> = {
  red: 5,
  blue: 15,
  green: 25,
  yellow: 35,
}

/**
 * Check if a position is a safe tile (cannot be captured).
 * @param position - Main board position (0-39)
 * @returns true if position is safe
 */
export function isSafeTile(position: number): boolean {
  return SAFE_POSITIONS.has(position)
}

/**
 * Check if position is within valid main board range.
 * @param position - Position to check
 * @returns true if 0 <= position < BOARD_SIZE
 */
export function isValidBoardPosition(position: number): boolean {
  return position >= 0 && position < BOARD_SIZE
}

/**
 * Check if position is within valid home lane range.
 * @param position - Position to check
 * @returns true if 0 <= position < HOME_LANE_SIZE
 */
export function isValidHomeLanePosition(position: number): boolean {
  return position >= 0 && position < HOME_LANE_SIZE
}

/**
 * Advance position on main board with wraparound.
 * @param currentPos - Current position (0-39)
 * @param steps - Steps to advance (1-6)
 * @returns new position (0-39), or -1 if leaves main board (enters home lane)
 */
export function advanceMainBoardPosition(currentPos: number, steps: number): number {
  const newPos = currentPos + steps
  if (newPos < BOARD_SIZE) {
    return newPos
  }
  // Wraparound or entering home lane (return -1 to signal caller to move to home lane)
  return newPos >= BOARD_SIZE ? -1 : newPos
}

/**
 * Check if token can legally finish (exact move requirement).
 * Must be in home lane and land exactly on position HOME_LANE_SIZE - 1.
 * @param currentHomeLanePos - Current position in home lane (0-3)
 * @param diceRoll - Dice result (1-6)
 * @returns true if currentPos + diceRoll == HOME_LANE_SIZE - 1
 */
export function canFinishExactly(currentHomeLanePos: number, diceRoll: number): boolean {
  return currentHomeLanePos + diceRoll === HOME_LANE_SIZE - 1
}

/**
 * Advance position in home lane.
 * @param currentPos - Current home lane position (0-3)
 * @param steps - Steps to advance
 * @returns new position, or -1 if exceeds home lane (invalid move)
 */
export function advanceHomeLanePosition(currentPos: number, steps: number): number {
  const newPos = currentPos + steps
  return newPos <= HOME_LANE_SIZE - 1 ? newPos : -1
}

/**
 * Get entry position where a spawned token enters the main board.
 * @param color - Player color
 * @returns position on main board where token enters
 */
export function getSpawnEntryPosition(color: PlayerColor): number {
  return SPAWN_ENTRY_POSITION[color]
}

/**
 * Get position in home lane where token enters from main board.
 * @param color - Player color
 * @returns main board position where token enters home lane
 */
export function getHomeLaneEntryPosition(color: PlayerColor): number {
  return HOME_LANE_ENTRY[color]
}

/**
 * Represent board position in a human-readable way (for debugging).
 */
export function describePosition(
  tokenState: 'in_base' | 'on_track' | 'in_home_lane' | 'finished',
  position: number,
  playerColor?: PlayerColor
): string {
  switch (tokenState) {
    case 'in_base':
      return playerColor ? `Base (${playerColor})` : 'Base'
    case 'on_track':
      return `Track[${position}]${isSafeTile(position) ? ' (safe)' : ''}${playerColor ? ` (${playerColor})` : ''}`
    case 'in_home_lane':
      return `HomeLane[${position}]/${HOME_LANE_SIZE - 1}${playerColor ? ` (${playerColor})` : ''}`
    case 'finished':
      return playerColor ? `Finished (${playerColor})` : 'Finished'
    default:
      return 'Unknown'
  }
}
