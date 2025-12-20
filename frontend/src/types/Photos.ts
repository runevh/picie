export type Album = {
  id: string;
  name: string;
  photos: Photo[];
  collaborators: Collaborator[];
}

export type Photo = {
  id: string;
  url?: string;
  previewData?: string;
}

export type Collaborator = {
  email: string;
  editor: boolean;
  status: "invited" | "accepted" | "declined" | "left";
};
