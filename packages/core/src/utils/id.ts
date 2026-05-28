import { nanoid } from "nanoid";

export type ID = string & { readonly __brand: "id" };

export const newId = (): ID => nanoid(12) as ID;
export const asId = (s: string): ID => s as ID;
