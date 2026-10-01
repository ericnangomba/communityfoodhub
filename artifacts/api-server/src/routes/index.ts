import { Router, type IRouter } from "express";
import healthRouter from "./health";
import communityRouter from "./community";
import authRouter from "./auth";
import inventoryRouter from "./inventory";
import ordersRouter from "./orders";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use("/api/inventory", inventoryRouter);
router.use("/api/orders", ordersRouter);
router.use(communityRouter);

export default router;
