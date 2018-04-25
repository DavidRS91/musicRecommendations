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

router.post("/user/new", async function(ctx) {
  let newUser = await new UserModel(ctx.request.body);
  await newUser.save();
  ctx.body = newUser;
});

router.post("/music/new", async function(ctx) {
  let newMusic = await new MusicModel(ctx.request.body);
  await newMusic.save();
  ctx.body = newMusic;
});

router.post("/seed", async function(ctx) {
  const { body } = ctx.request;
  const numUsers = body.users || 10;
  const numSongs = body.songs || 50;
  let users = [],
    songIds = [],
    songs = [],
    userDocs = [];
  const tags = [
    "60s",
    "alternative",
    "dance",
    "electronic",
    "instrumental",
    "jazz",
    "old school",
    "pop",
    "rock",
    "samba"
  ];

  //clear any existing records
  UserModel.collection.drop();
  MusicModel.collection.drop();

  //create desired number of songs with randomized tags
  for (let i = 0; i < numSongs; i += 1) {
    let genres = tags.filter(tag => Math.random() > 0.8);
    if (genres.length === 0) {
      genres.push("hipster");
    }
    songs.push({ name: `Song ${i}`, tags: genres });
  }
  //save songs and track ids for seeding users
  for (const song of songs) {
    await new MusicModel(song).save();
  }
  //create desired number of users
  for (let i = 0; i < numUsers; i += 1) {
    users.push({ username: `User${i}` });
  }
  // create documents to represent each user and assign 15 song ids to 'listens' array
  for (const user of users) {
    const newUser = await new UserModel(user);
    let userSongs = [];
    for (let i = 0; i < 15; i += 1) {
      userSongs.push(songIds[Math.floor(Math.random() * songIds.length)]);
    }
    newUser["listens"] = userSongs;
    userDocs.push(newUser);
  }

  //assign user documentss to follow ~25% of other users and save users
  for (const user of userDocs) {
    user.following = userDocs
      .filter(u => Math.random() > 0.75 && u !== user)
      .map(u => u.username);
    user.save();
  }

  const allSongs = await MusicModel.find({});
  ctx.body = { music: allSongs };
});

router.get("/recommendations", async function(ctx) {
  const user = await UserModel.findOne({ username: ctx.query.user });
  const songs = await MusicModel.find({});
  let top20Songs = [],
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
    for (let i = 0; i < 20; i += 1) {
      if (
        user.listens.indexOf(song.name) === -1 && // check if user has heard song
        (songScore > minScore || top20Songs.length < 20) //ensure song is scored high enough
      ) {
        if (top20Songs[i] === undefined || top20Songs[i][1] < songScore) {
          //insert song into proper position of top20 songs
          top20Songs.splice(i, 0, [song.name, songScore]);
          if (top20Songs.length > 20) {
            top20Songs.pop();
          }
          minScore = Math.min(minScore, songScore);
          break;
        }
      }
    }
  }
  let recommendations = [];
  while (recommendations.length < 5) {
    recommendations.push(
      top20Songs.splice(Math.floor(Math.random() * top20Songs.length), 1)[0][0]
    );
  }

  ctx.body = {
    list: recommendations
  };
});

router.post("/follow", async function(ctx) {
  const { body } = ctx.request;
  console.log("CTX: ", ctx);
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
    console.log("SONGNAME: ", songName);
    const song = await MusicModel.findOne({ name: songName });
    console.log("SONG: ", song);
    for (let tag of song.tags) {
      tagWeighting[tag] =
        tagWeighting[tag] + 1 / song.tags.length / songs.length ||
        1 / song.tags.length / songs.length;
    }
  }
  return tagWeighting;
}
