const Koa = require("koa");
const BodyParser = require("koa-bodyparser");
const Logger = require("koa-logger");
const Router = require("koa-router");
const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const music = require("../music");
const listens = require("../listen");

const Schema = mongoose.Schema;
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

const Music = new Schema({
  name: { type: String, required: true, unique: true },
  tags: Array
});

const User = new Schema({
  username: { type: String, required: true, unique: true },
  listens: Array,
  following: Array
});

Music.plugin(uniqueValidator);
User.plugin(uniqueValidator);

const MusicModel = mongoose.model("Music", Music);
const UserModel = mongoose.model("User", User);

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

router.get("/recommendations", async function(ctx) {
  const user = await UserModel.findOne({ username: ctx.query.user });
  const songs = await MusicModel.find({});
  let top5Songs = [],
    minScore = 2,
    followsTagFreq = {};
  let listensTagFreq = await tagFreq(user.listens);

  for (let username of user.following) {
    const followedUser = await UserModel.findOne({ username: username });
    const followedUserTags = await tagFreq(
      followedUser.listens,
      followsTagFreq
    );
  }
  Object.keys(followsTagFreq).forEach(
    k => (followsTagFreq[k] /= user.following.length)
  );

  let avgTagFreq = listensTagFreq;
  // aggregate tag frequency of listensTags and followsTags
  Object.keys(followsTagFreq).forEach(
    k =>
      !!avgTagFreq[k]
        ? (avgTagFreq[k] += followsTagFreq[k])
        : (avgTagFreq[k] = followsTagFreq[k])
  );

  for (let song of songs) {
    let songScore = song.tags // find average value of a song's tags in the avgTagFreq object
      .map(t => (!!avgTagFreq[t] ? avgTagFreq[t] / song.tags.length : 0))
      .reduce((a, b) => a + b);
    for (let i = 0; i < 5; i += 1) {
      if (
        user.listens.indexOf(song.name) === -1 // check if user has heard song
      ) {
        if (top5Songs[i] === undefined || top5Songs[i][1] < songScore) {
          //insert song into proper position of top5 songs
          top5Songs.splice(i, 0, [song.name, songScore]);
          if (top5Songs.length > 5) {
            top5Songs.pop();
          }
          minScore = Math.min(minScore, songScore);
          break;
        }
      }
    }
  }

  ctx.body = {
    list: top5Songs.map(s => s[0])
  };
});

router.post("/follow", async function(ctx) {
  const { body } = ctx.request;
  const to = await UserModel.findOne({ username: body.to });
  await UserModel.findOneAndUpdate(
    { username: body.from, following: { $ne: to.username } },
    { $push: { following: to.username } }
  );
  const from = await UserModel.findOne({ username: body.from });
  ctx.body = from;
});

router.post("/listen", async function(ctx) {
  const { body } = ctx.request;
  const music = await MusicModel.findOne({ name: body.music });
  await UserModel.findOneAndUpdate(
    { username: body.user },
    { $push: { listens: music.name } }
  );
  const user = await UserModel.findOne({ username: body.user });
  ctx.body = user;
});

app.use(Logger());
app.use(BodyParser());
app.use(router.routes());

app.listen(3000);

async function tagFreq(songs, tagWeighting = {}) {
  for (let songName of songs) {
    const song = await MusicModel.findOne({ name: songName });
    for (let tag of song.tags) {
      tagWeighting[tag] =
        tagWeighting[tag] + 1 / song.tags.length / songs.length ||
        1 / song.tags.length / songs.length;
    }
  }
  return tagWeighting;
}
