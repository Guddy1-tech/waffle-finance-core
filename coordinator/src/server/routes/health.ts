import { Router } from "express";

export function healthRoutes(): Router {
  const router = Router();
  const startedAt = Date.now();

  router.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "stelleth-coordinator",
      version: process.env.npm_package_version ?? "0.1.0",
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString()
    });
  });

  return router;
}
