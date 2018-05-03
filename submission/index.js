const Koa = require("koa");
const BodyParser = require("koa-bodyparser");
const Logger = require("koa-logger");
const mongoose = require("mongoose");

const music = require("../music");
const listens = require("../listen");

const schemas = require("./db/schemas");

const followRouter = require("./routes/follow");
const listenRouter = require("./routes/listen");
const recommendationsRouter = require("./routes/recommendations");

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

const routers = [followRouter, listenRouter, recommendationsRouter];
for (let r of routers) {
  app.use(r.routes());
  app.use(r.allowedMethods());
}

app.listen(3000);
