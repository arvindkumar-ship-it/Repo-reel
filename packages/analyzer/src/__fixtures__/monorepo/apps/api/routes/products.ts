import {db} from "@atlas/db";
export function registerProducts(app){
 app.get("/products", async () => db.query("select id,name from products"));
}