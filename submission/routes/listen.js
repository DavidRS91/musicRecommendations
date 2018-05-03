const Router = require("koa-router");
const schemas = require("../db/schemas");

const { UserModel, MusicModel } = schemas;
const router = new Router({ prefix: "/listen" });

router.post("/", async function(ctx) {
  const { body } = ctx.request;

  if (typeof body.music !== "string" || typeof body.user !== "string") {
    ctx.throw(400, "Invalid Input: from and to must be strings");
  }

  const music = await MusicModel.findOne({ name: body.music });

  if (!music) {
    ctx.throw(400, "Invalid Input: Song not found");
  }

  const user = await UserModel.findOneAndUpdate(
    { username: body.user },
    { $push: { listens: music.name } },
    { new: true }
  );

  if (!user) {
    ctx.throw(400, "Invalid Input: User not found");
  }

  ctx.body = user;
});

module.exports = router;
