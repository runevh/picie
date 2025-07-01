export type Album = {
    id: string;
    title: string;
    photos: string[];
    collaborators: Collaborator[];
}

export type Collaborator = {
  email: string;
  editor: boolean;
  status: "invited" | "accepted" | "declined" | "left";
};