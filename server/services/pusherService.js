const console = require("console");
const Pusher = require("pusher");

let pusher;

try {
  pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID || "app-id",
    key: process.env.PUSHER_KEY || "key",
    secret: process.env.PUSHER_SECRET || "secret",
    cluster: process.env.PUSHER_CLUSTER || "mt1",
    useTLS: true
  });
} catch (error) {
  console.error("Failed to initialize Pusher:", error);
}

const triggerNotification = (channel, event, data) => {
  if (!pusher) return;
  pusher.trigger(channel, event, data).catch(err => {
    console.error("Error triggering Pusher event:", err);
  });
};

module.exports = {
  pusher,
  triggerNotification
};
