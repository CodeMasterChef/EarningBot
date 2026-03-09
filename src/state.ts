import fs from "fs";
import path from "path";
import { AppState, JoinedEvent, KnownEvent } from "./types";

const STATE_PATH = path.resolve(__dirname, "../data/state.json");

function ensureStateFile(): void {
  const dir = path.dirname(STATE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(STATE_PATH)) {
    fs.writeFileSync(
      STATE_PATH,
      JSON.stringify({ known_events: {}, joined_events: {} }, null, 2)
    );
  }
}

export function loadState(): AppState {
  ensureStateFile();
  const raw = fs.readFileSync(STATE_PATH, "utf-8");
  return JSON.parse(raw);
}

export function saveState(state: AppState): void {
  ensureStateFile();
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

export function isKnown(state: AppState, name: string): boolean {
  return name in state.known_events;
}

export function isJoined(state: AppState, name: string): boolean {
  return name in state.joined_events;
}

export function markKnown(state: AppState, name: string): void {
  state.known_events[name] = {
    name,
    firstSeen: new Date().toISOString(),
    status: "notified",
  };
}

export function markJoined(state: AppState, name: string): void {
  state.joined_events[name] = {
    name,
    joinedAt: new Date().toISOString(),
  };
}

export function removeJoined(state: AppState, name: string): boolean {
  if (name in state.joined_events) {
    delete state.joined_events[name];
    return true;
  }
  return false;
}

export function getJoinedList(state: AppState): string[] {
  return Object.keys(state.joined_events);
}
