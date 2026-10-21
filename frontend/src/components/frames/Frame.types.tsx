export type Frame = {
  id: string;
  name: string;
  description?: string;
  activeImage?: string;
  currentPhotoId?: string | number | null;
  nextPhotoId?: string | number | null;
  status: "online" | "offline" | "updating" | "pairing" | "error" | "updating_frame";
  currentAlbum: string | null;
  album?: { id: string; name?: string | null } | null;
  scheduleMode?: "interval" | "times" | null;
  intervalMinutes?: number | null;
  timesOfDay?: string[];
  timeZone?: string;
  sharedWith?: string[];
  refreshSchedule?: "hourly" | "four-hours" | "daily-midnight" | "daily-morning";
  lastSeen?: string | Date | null;
  nextUpdate?: string;
};
