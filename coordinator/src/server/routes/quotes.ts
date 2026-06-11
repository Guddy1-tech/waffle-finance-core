import { Router } from "express";
import type { QuoteService } from "../../services/quote-service.js";

export function quotesRoutes(quotes: QuoteService): Router {
  const router = Router();

  router.get("/quotes/eth-xlm", async (_req, res) => {
    const quote = await quotes.quoteEthXlm();
    res.json(quote);
  });

  return router;
}
