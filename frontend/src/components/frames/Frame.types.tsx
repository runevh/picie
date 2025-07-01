export type Frame = {
    name: string;
    description?: string;
    activeImage: string;
    status: "online" | "offline";
    currentAlbum: string;
    sharedWith?: string[];
}