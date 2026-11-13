export type RoomStatus = "idle" | "active" | "finished" | "closed";

export interface TeamInfo { slot: number; color: string; name: string | null }
export interface PlayerInfo { id: string; name: string; teamSlot: number | null; isAdmin: boolean; hasAvatar: boolean }
export interface RoomState {
  roomId: string;
  code: string;
  status: RoomStatus;
  roundNumber: number;
  winner: { playerId: string | null; name: string; teamSlot: number } | null;
  teams: TeamInfo[];
  players: PlayerInfo[];
  me: { id: string; isAdmin: boolean; teamSlot: number | null } | null;
  /** Момент "СТАРТ" по часам базы данных; пока он в будущем — идёт обратный отсчёт. */
  goAt: string | null;
  serverNow: string;
  /** Текущий вопрос (виден всем во время раунда); ответ — только администратору. */
  question: { text: string; answer?: string } | null;
  /** Весь список вопросов — только администратору. */
  questions?: { id: string; text: string; answer: string | null }[];
}

export const TEAM_HEX = ["#E5484D", "#3B82F6", "#2FB86B", "#F5C518"];
export const TEAM_ON = ["#ffffff", "#ffffff", "#ffffff", "#1a1206"];
