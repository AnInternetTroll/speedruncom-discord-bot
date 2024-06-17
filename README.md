# What is this?

This is a really simple bot that is meant to help people in the Speedrun.com
[Discord server](https://discord.gg/0h6sul1ZwHVpXJmK) to assist new members.
So they can ask questions in the relevant place.

# Features

- It looks up a game or series and sends the Discord invite. If there isn't one, it
  sends a link to their forums
- Optionally, it's able to ping a user, to notify them as to where to ask
- Can send a link this source code on GitHub

# Setup

If you wish to run this yourself for development or your own server there are
2-3 enviormental variables that must be set

```env
PUBLIC_KEY="" # Application public key
TOKEN="" # Bot token
TEST_SERVER="a test server's ID here" # Fully optional and shouldn't be used if you plan to actually host this bot
```
