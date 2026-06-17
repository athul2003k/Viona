import { Response } from "express";

type UserId = string;
const clients = new Map<UserId, Set<Response>>();

export const addClient = (userId: string, res: Response) => {
  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  clients.get(userId)!.add(res);
};

export const removeClient = (userId: string, res: Response) => {
  const set = clients.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) {
    clients.delete(userId);
  }
};

export const pushToUser = (userId: string, data: any) => {
  const set = clients.get(userId);
  if (!set) return;

  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    res.write(payload);
  }
};
