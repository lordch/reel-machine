import type { Request, Response, NextFunction } from "express";

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || header !== `Bearer ${process.env.API_SECRET}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
