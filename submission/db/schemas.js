const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const Schema = mongoose.Schema;

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

module.exports = { MusicModel, UserModel };
