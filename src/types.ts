export interface PoolXEvent {
  name: string;
  poolType: string;
  totalReward: string;
  startTime: string;
  endTime: string;
  url: string;
}

export interface KnownEvent {
  name: string;
  firstSeen: string;
  status: "notified";
}

export interface JoinedEvent {
  name: string;
  joinedAt: string;
}

export interface AppState {
  known_events: Record<string, KnownEvent>;
  joined_events: Record<string, JoinedEvent>;
}
