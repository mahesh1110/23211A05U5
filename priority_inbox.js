const fs = require("fs");

const API_URL = "http://4.224.186.213/evaluation-service/notifications";
const TOP_N = 10;

const TYPE_WEIGHT = {
  Placement: 3,
  Result: 2,
  Event: 1,
};

function readToken() {
  let match = null;

  if (fs.existsSync(".env")) {
    const envText = fs.readFileSync(".env", "utf8");
    match = envText.match(/(?:LOG_SERVICE_TOKEN|ACCESS_TOKEN)\s*=\s*"?([^"\r\n]+)"?/);
  }

  if (match) {
    return match[1].trim();
  }

  if (process.env.LOG_SERVICE_TOKEN || process.env.ACCESS_TOKEN) {
    return (process.env.LOG_SERVICE_TOKEN || process.env.ACCESS_TOKEN).trim();
  }

  throw new Error("LOG_SERVICE_TOKEN or ACCESS_TOKEN not found");
}

function warnIfTokenExpired(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return;

  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  if (!payload.exp) return;

  const expiry = payload.exp * 1000;
  if (Date.now() > expiry) {
    console.warn(`Token in .env expired at ${new Date(expiry).toISOString()}`);
  }
}

function normalize(notification) {
  return {
    id: notification.ID,
    type: notification.Type,
    message: notification.Message,
    timestamp: notification.Timestamp,
    weight: TYPE_WEIGHT[notification.Type] || 0,
    time: new Date(notification.Timestamp).getTime(),
  };
}

function isBetter(a, b) {
  if (a.weight !== b.weight) return a.weight > b.weight;
  if (a.time !== b.time) return a.time > b.time;
  return a.id > b.id;
}

class TopNotificationHeap {
  constructor(limit) {
    this.limit = limit;
    this.items = [];
  }

  add(notification) {
    if (this.items.length < this.limit) {
      this.items.push(notification);
      this.bubbleUp(this.items.length - 1);
      return;
    }

    if (isBetter(notification, this.items[0])) {
      this.items[0] = notification;
      this.bubbleDown(0);
    }
  }

  result() {
    return [...this.items].sort((a, b) => (isBetter(a, b) ? -1 : 1));
  }

  bubbleUp(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (!isBetter(this.items[parent], this.items[index])) break;
      [this.items[parent], this.items[index]] = [this.items[index], this.items[parent]];
      index = parent;
    }
  }

  bubbleDown(index) {
    while (true) {
      let smallest = index;
      const left = index * 2 + 1;
      const right = index * 2 + 2;

      if (left < this.items.length && isBetter(this.items[smallest], this.items[left])) {
        smallest = left;
      }

      if (right < this.items.length && isBetter(this.items[smallest], this.items[right])) {
        smallest = right;
      }

      if (smallest === index) break;
      [this.items[index], this.items[smallest]] = [this.items[smallest], this.items[index]];
      index = smallest;
    }
  }
}

async function fetchNotifications() {
  const token = readToken();
  warnIfTokenExpired(token);

  const response = await fetch(API_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `API request failed with status ${response.status}. The token was read from .env, but the server rejected it.`
    );
  }

  const body = await response.json();
  return body.notifications || [];
}

async function main() {
  const notifications = await fetchNotifications();
  const heap = new TopNotificationHeap(TOP_N);

  for (const notification of notifications) {
    const unread =
      notification.isRead === undefined &&
      notification.IsRead === undefined &&
      notification.read === undefined
        ? true
        : notification.isRead === false || notification.IsRead === false || notification.read === false;

    if (unread) {
      heap.add(normalize(notification));
    }
  }

  const topNotifications = heap.result();

  console.log(`Top ${TOP_N} Priority Notifications`);
  console.table(
    topNotifications.map((notification, index) => ({
      Rank: index + 1,
      Type: notification.type,
      Message: notification.message,
      Timestamp: notification.timestamp,
      Weight: notification.weight,
      ID: notification.id,
    }))
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
