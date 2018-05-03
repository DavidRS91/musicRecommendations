const Router = require("koa-router");
const schemas = require("../db/schemas");

const { UserModel, MusicModel } = schemas;
const router = new Router({ prefix: "/listen" });

router.post("/", async function(ctx) {
  const { body } = ctx.request;
  const music = await MusicModel.findOne({ name: body.music });
  const user1 = await UserModel.findOneAndUpdate(
    { username: body.user },
    { $push: { listens: music.name } },
    { new: true }
  );
  ctx.body = user1;
});

module.exports = router;
