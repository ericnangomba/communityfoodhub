import { Router, type IRouter } from "express";
import healthRouter from "./health";
import communityRouter from "./community";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(communityRouter);

export default router;
