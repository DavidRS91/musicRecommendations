module.exports = {
  tagFreq: async function(songs, tagWeighting = {}) {
    for (let songName of songs) {
      const song = await MusicModel.findOne({ name: songName });
      for (let tag of song.tags) {
        tagWeighting[tag] =
          tagWeighting[tag] + 1 / song.tags.length / songs.length ||
          1 / song.tags.length / songs.length;
      }
    }
    return tagWeighting;
  },

  followerFrequency: async function(followedUsers) {
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
  },

  sortSongs: function(songs, aggregatePreferences, user) {
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
  },

  aggregateFrequency: function(pref1, pref2) {
    let aggregatePreferences = pref1;
    Object.keys(pref2).forEach(
      k =>
        !!aggregatePreferences[k]
          ? (aggregatePreferences[k] += pref2[k])
          : (aggregatePreferences[k] = pref2[k])
    );
    return aggregatePreferences;
  }
};
