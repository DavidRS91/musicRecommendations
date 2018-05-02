const Koa = require("koa");
const BodyParser = require("koa-bodyparser");
const Logger = require("koa-logger");
const Router = require("koa-router");
const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const music = require("../music");
const listens = require("../listen");
const schemas = require("./db/schemas");
const logic = require("./lib/logic");
const followRouter = require("./routes/follow");
const listenRouter = require("./routes/listen");
const recommendationsRouter = require("./routes/recommendations");

const {
  aggregateFrequency,
  followerFrequency,
  tagFrequency,
  sortSongs
} = logic;
const { UserModel, MusicModel } = schemas;

mongoose.Promise = global.Promise;
mongoose.connect("mongodb://localhost/musicRecommendations");

mongoose.connection.on("open", async function() {
  console.log("connected to MongoDB");
  UserModel.collection.drop();
  MusicModel.collection.drop();

  for (const songTitle in music) {
    await new MusicModel({ name: songTitle, tags: music[songTitle] }).save();
  }

  for (const user in listens["userIds"]) {
    await new UserModel({ username: user }).save();
  }
});

const app = new Koa();
const router = new Router();

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.status = err.status || 500;
    ctx.body = err;
    ctx.app.emit("error", err, ctx);
  }
});

app.use(Logger());
app.use(BodyParser());
app.use(followRouter.routes());
app.use(followRouter.allowedMethods());
app.use(listenRouter.routes());
app.use(listenRouter.allowedMethods());
app.use(recommendationsRouter.routes());
app.use(recommendationsRouter.allowedMethods());
app.use(router.routes());
app.use(router.allowedMethods());

app.listen(3000);
