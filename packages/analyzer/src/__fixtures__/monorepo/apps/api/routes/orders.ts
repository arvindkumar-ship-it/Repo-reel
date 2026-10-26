import {db} from "@atlas/db";
import {orderQueue} from "@atlas/jobs";
export function registerOrders(app){
 app.post("/orders", async request => {
  const order = await db.query("insert into orders default values returning id");
  await orderQueue.add("receipt", {id:order.rows[0].id});
  return order.rows[0];
 });
}