const Router = require("koa-router");
const schemas = require("../db/schemas");

const { UserModel, MusicModel } = schemas;
const router = new Router({ prefix: "/follow" });

router.post("/", async function(ctx) {
  const { body } = ctx.request;
  let response;
  const to = await UserModel.findOne({ username: body.to });
  const from = await UserModel.findOneAndUpdate(
    { username: body.from, following: { $ne: to.username } },
    { $push: { following: to.username } },
    { new: true }
  );
  ctx.body = from;
});

module.exports = router;
