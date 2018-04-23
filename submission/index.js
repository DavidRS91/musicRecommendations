const Koa = require("koa");
const BodyParser = require("koa-bodyparser");
const Logger = require("koa-logger");
const Router = require("koa-router");

const app = new Koa();
const router = new Router();

router.get("/recommendations", async function(ctx) {
  ctx.body = {
    list: ["<music ID>", "<music ID>", "<music ID>", "<music ID>", "<music ID>"]
  };
});

router.post("/follow", async function(ctx) {
  const { body } = ctx.request;
  let from = ctx.request.body.from || null;
  let to = ctx.request.body.to || null;
  if (from && to) {
    ctx.body = { message: `${from} now follows ${to}` };
  } else {
    ctx.body = { error: "Invalid Request" };
  }
});

router.post("/listen", async function(ctx) {
  const { body } = ctx.request;
  let user = ctx.request.body.user || null;
  let music = ctx.request.body.music || null;
  if (user && music) {
    ctx.body = { message: `${user} listened to ${music}` };
  } else {
    ctx.body = { error: "Invalid Request" };
  }
});

app.use(Logger());
app.use(BodyParser());
app.use(router.routes());

app.listen(3000);
