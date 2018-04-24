const Koa = require("koa");
const BodyParser = require("koa-bodyparser");
const Logger = require("koa-logger");
const Router = require("koa-router");
const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const Schema = mongoose.Schema;
mongoose.Promise = global.Promise;
mongoose.connect("mongodb://localhost/musicRecommendations");

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
    songs = [];
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
  //create desired number of users
  for (let i = 0; i < numUsers; i += 1) {
    users.push({ username: `User${i}` });
  }
  //assign users to follow ~40% of other users
  for (let user of users) {
    user = user.following = users
      .filter(u => Math.random() > 0.6 && u !== user)
      .map(u => u.username);
  }
  //assign users to listen to 15 random songs
  for (let i = 0; i < users.length; i += 1) {
    let userSongs = [];

    for (let i = 0; i < 15; i += 1) {
      userSongs.push(songs[Math.floor(Math.random() * songs.length)]["name"]);
    }
    users[i]["listens"] = userSongs;
  }

  async function seed(users, songs) {
    let userDocs = [];
    for (const song of songs) {
      const newSong = await new MusicModel(song).save();
      song["id"] = newSong._id;
      songIds.push(newSong._id);
    }

    for (const user of users) {
      user["listens"] = user["listens"].map(
        x => songs.filter(s => s.name === x).map(s => s.id)[0]
      );
      const newUser = await new UserModel(user);
      userDocs.push(newUser);
    }

    for (const user of userDocs) {
      user.following = user.following
        .map(u => userDocs.filter(uD => uD["username"] === u))
        .map(u => u[0]._id);
      user.save();
    }
  }

  seed(users, songs);

  ctx.body = { users: users, songs: songs };
});

router.get("/recommendations", async function(ctx) {
  const user = await UserModel.findOne({ username: ctx.query.user });

  async function tagFrequency(songIds, tagWeighting = {}) {
    for (let songId of songIds) {
      const song = await MusicModel.findById(songId);
      for (let tag of song.tags) {
        tagWeighting[tag] =
          tagWeighting[tag] + 1 / song.tags.length / songIds.length ||
          1 / song.tags.length / songIds.length;
      }
    }
    return tagWeighting;
  }

  let listensTagFrequency = await tagFrequency(user.listens);
  let followsTagFrequency = {};
  for (let userId of user.following) {
    const followedUser = await UserModel.findById(userId);
    const followedUserTags = await tagFrequency(
      followedUser.listens,
      followsTagFrequency
    );
  }
  Object.keys(followsTagFrequency).forEach(
    k => (followsTagFrequency[k] /= user.following.length)
  );

  let aggregateTagFrequency = listensTagFrequency;
  Object.keys(followsTagFrequency).forEach(
    tag =>
      !!aggregateTagFrequency[tag]
        ? (aggregateTagFrequency[tag] += followsTagFrequency[tag])
        : (aggregateTagFrequency[tag] = followsTagFrequency[tag])
  );
  Object.keys(followsTagFrequency).forEach(
    tag => (aggregateTagFrequency[tag] /= 2)
  );

  async function rankUnheardSongs(tagPreferences = {}) {
    const songs = await MusicModel.find({});
    let rankedTop20Songs = [];
    for (let song of songs) {
      let songscore = song.tags
        .map(
          t => (!!tagPreferences[t] ? tagPreferences[t] / song.tags.length : 0)
        )
        .reduce((a, b) => a + b);
      for (let i = 0; i < 20; i += 1) {
        if (user.listens.indexOf(song._id) === -1) {
          if (
            rankedTop20Songs[i] === undefined ||
            rankedTop20Songs[i][1] < songscore
          ) {
            rankedTop20Songs.splice(i, 0, [song.name, songscore]);
            if (rankedTop20Songs.length > 20) {
              rankedTop20Songs.pop();
            }
            console.log(`song: ${song.name}, score: ${songscore}, i: ${i}`);
            console.log("ranked10: ", rankedTop20Songs);
            break;
          }
        }
      }
    }
    let random5Songs = [];
    while (random5Songs.length < 5) {
      random5Songs.push(
        rankedTop20Songs.splice(
          Math.floor(Math.random() * rankedTop20Songs.length),
          1
        )[0][0]
      );
    }
    return random5Songs;
  }

  let recommendations = await rankUnheardSongs(aggregateTagFrequency);
  console.log(aggregateTagFrequency);

  ctx.body = {
    list: recommendations
  };
});

router.post("/follow", async function(ctx) {
  const { body } = ctx.request;
  const to = await UserModel.findOne({ username: body.to });
  await UserModel.findOneAndUpdate(
    { username: body.from, following: { $ne: to._id } },
    { $push: { following: to._id } }
  );
  const from = await UserModel.findOne({ username: body.from });
  ctx.body = from;
});

router.post("/listen", async function(ctx) {
  const { body } = ctx.request;
  const music = await MusicModel.findOne({ name: body.music });
  await UserModel.findOneAndUpdate(
    { username: body.user },
    { $push: { listens: music._id } }
  );
  const user = await UserModel.findOne({ username: body.user });
  ctx.body = user;
});

app.use(Logger());
app.use(BodyParser());
app.use(router.routes());

app.listen(3000);
