const Router = require("koa-router");
const schemas = require("../db/schemas");

const { UserModel, MusicModel } = schemas;
const router = new Router({ prefix: "/follow" });

router.post("/", async function(ctx) {
  const { body } = ctx.request;

  if (typeof body.from !== "string" || typeof body.to !== "string") {
    ctx.throw(400, "Invalid Input");
  }

  const to = await UserModel.findOne({ username: body.to });

  if (!to) {
    ctx.throw(400, "Invalid Input: User (to) not found");
  }

  const from = await UserModel.findOneAndUpdate(
    { username: body.from, following: { $ne: to.username } },
    { $push: { following: to.username } },
    { new: true }
  );

  if (!from) {
    ctx.throw(400, "Invalid Input: User (from) not found");
  }

  ctx.body = from;
});

module.exports = router;
