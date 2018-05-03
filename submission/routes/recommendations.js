const Router = require("koa-router");
const schemas = require("../db/schemas");
const logic = require("../lib/logic");

const { UserModel, MusicModel } = schemas;
const {
  aggregateFrequency,
  followerFrequency,
  tagFrequency,
  sortSongs
} = logic;
const router = new Router({ prefix: "/recommendations" });

router.get("/", async function(ctx) {
  const user = await UserModel.findOne({ username: ctx.query.user });
  if (!user) {
    ctx.throw(400, "User Not Found");
  }
  const songs = await MusicModel.find({});
  let userPreferences = await tagFrequency(user.listens);
  let followerPreferences = await followerFrequency(user.following);
  let aggregatePreferences = aggregateFrequency(
    userPreferences,
    followerPreferences
  );

  ctx.body = {
    list: sortSongs(songs, aggregatePreferences, user)
  };
});

module.exports = router;
