## Description
An MVP designed to recommend music to users based on the music they have listened to in the past, and music that the people they follow have listened to.

## Instructions for use
1. Clone this repo to your local machine
2. `$ mongod` to start MongoDB
3. Navigate to the submission directory
4. `$ npm install` to install all project dependencies
4. `$ npm run start` to startup the server and seed it with music and users
5. in a new terminal window, `$ npm run test` to send follow and listen requests to the server, as well as get music recommendations for user a.

**Note:** The server is re-seeded every time `$ npm run start` is executed. Running `$ npm run test` multiple times without restarting the server, will cause users to listen to songs multiple times.

