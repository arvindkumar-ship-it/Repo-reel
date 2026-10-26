import Fastify from "fastify";
import {registerProducts} from "./routes/products";
import {registerOrders} from "./routes/orders";
export const app = Fastify();
registerProducts(app);
registerOrders(app);
app.get("/health", async () => ({ok:true}));