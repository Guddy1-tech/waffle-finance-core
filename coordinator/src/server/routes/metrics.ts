import { Router } from "express";
import { registry } from "../../metrics.js";

export function metricsRoutes(): Router {
  const router = Router();

  router.get("/metrics", async (_req, res) => {
    try {
      res.set("Content-Type", registry.contentType);
      res.end(await registry.metrics());
    } catch (err) {
      res.status(500).end(String(err));
    }
  });

  return router;
}
