export type Frame = {
  id: string;
  name: string;
  description?: string;
  activeImage: string;
  status: "online" | "offline";
  currentAlbum: string | null;
  sharedWith?: string[];
  refreshSchedule: "hourly" | "four-hours" | "daily-midnight" | "daily-morning";
};
