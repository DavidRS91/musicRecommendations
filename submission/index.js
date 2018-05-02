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
  let userPreferences = await tagFreq(user.listens);
  let followerPreferences = await followerFrequency(user.following);
  let aggregatePreferences = aggregateFrequency(
    userPreferences,
    followerPreferences
  );

  ctx.body = {
    list: sortSongs(songs, aggregatePreferences, user)
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

async function followerFrequency(followedUsers) {
  let followsTagFreq = {};
  for (let username of followedUsers) {
    const followedUser = await UserModel.findOne({ username: username });
    const followedUserTags = await tagFreq(
      followedUser.listens,
      followsTagFreq
    );

    Object.keys(followsTagFreq).forEach(
      k => (followsTagFreq[k] /= followedUsers.length)
    );
  }
  return followsTagFreq;
}

function sortSongs(songs, aggregatePreferences, user) {
  let top5Songs = [];
  let minScore = 2;
  for (let song of songs) {
    let songScore = song.tags // find average value of a song's tags in the aggregatePreferences object
      .map(
        t =>
          !!aggregatePreferences[t]
            ? aggregatePreferences[t] / song.tags.length
            : 0
      )
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
  return top5Songs.map(s => s[0]);
}

function aggregateFrequency(pref1, pref2) {
  let aggregatePreferences = pref1;
  Object.keys(pref2).forEach(
    k =>
      !!aggregatePreferences[k]
        ? (aggregatePreferences[k] += pref2[k])
        : (aggregatePreferences[k] = pref2[k])
  );
  return aggregatePreferences;
}
