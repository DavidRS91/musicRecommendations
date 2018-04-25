const assert = require("assert");
const fetch = require("isomorphic-fetch");
const followRequests = require("../follows");
const listens = require("../listen");

const FOLLOW_URL = "http://localhost:3000/follow";
const LISTEN_URL = "http://localhost:3000/listen";
const RECOMMENDATION_URL = "http://localhost:3000/recommendations?user=";

describe("Adding followers", async () => {
  for (let follow of followRequests.operations) {
    it(`${follow[0]} now follows ${follow[1]}`, async () => {
      const followReq = await fetch(FOLLOW_URL, {
        headers: { "Content-Type": "application/json" },
        method: "POST",
        body: JSON.stringify({ from: follow[0], to: follow[1] })
      });
      const response = await followReq.json();
      assert.ok(response.following.includes(follow[1]));
    });
  }
});

describe("Listening to music", async () => {
  for (let user in listens.userIds) {
    for (let song of listens.userIds[user]) {
      it(`${user} listened to ${song}`, async () => {
        const listenReq = await fetch(LISTEN_URL, {
          headers: { "Content-Type": "application/json" },
          method: "POST",
          body: JSON.stringify({ user: user, music: song })
        });
        const response = await listenReq.json();
        assert.ok(response.listens.includes(song));
      });
    }
  }
});

describe("get recommendations", async () => {
  for (let user in listens.userIds) {
    it(`Recommendations for ${user}`, async () => {
      const recommendations = await fetch(`${RECOMMENDATION_URL}${user}`);
      const response = await recommendations.json();
      assert.equal(response.list.length, 5);
      console.log(`Recommended songs for ${user}: `, response);
    });
  }
});
