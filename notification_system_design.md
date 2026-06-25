# Stage 1

## Notification System REST API Design

The notification system will show logged-in users their alerts, updates, reminders, and account-related messages. The API should allow the front end to fetch notifications, update read status, dismiss messages, and receive new notifications in real time.

## Core Actions

1. Get all notifications of the logged-in user.
2. Get unread notifications.
3. Get unread notification count.
4. Mark one notification as read.
5. Mark all notifications as read.
6. Delete or dismiss a notification.
7. Receive notifications in real time.

## Common Headers

```http
Authorization: Bearer <access_token>
Content-Type: application/json
Accept: application/json
```

## Common Response Format

```json
{
  "success": true,
  "message": "Request completed successfully",
  "data": {}
}
```

For errors:

```json
{
  "success": false,
  "message": "Something went wrong",
  "error": {
    "code": "ERROR_CODE",
    "details": "Error details"
  }
}
```

## Notification JSON Schema

```json
{
  "id": "notif_1001",
  "title": "Payment Successful",
  "message": "Your payment has been completed successfully.",
  "type": "payment",
  "priority": "normal",
  "isRead": false,
  "actionUrl": "/payments/txn_8901",
  "createdAt": "2026-06-25T09:30:00Z",
  "readAt": null
}
```
## REST Endpoints

| Action | Method | Endpoint |
|---|---|---|
| Get notifications | GET | `/api/v1/notifications?page=1&limit=20&status=all` |
| Get unread notifications | GET | `/api/v1/notifications?status=unread` |
| Get unread count | GET | `/api/v1/notifications/unread-count` |
| Get one notification | GET | `/api/v1/notifications/{notificationId}` |
| Mark one as read | PATCH | `/api/v1/notifications/{notificationId}/read` |
| Mark all as read | PATCH | `/api/v1/notifications/read-all` |
| Delete/dismiss notification | DELETE | `/api/v1/notifications/{notificationId}` |

## Sample API Contracts

### 1. Get Notifications

```http
GET /api/v1/notifications?page=1&limit=20&status=all
```

Response:

```json
{
  "success": true,
  "message": "Notifications fetched successfully",
  "data": {
    "notifications": [
      {
        "id": "notif_1001",
        "title": "Payment Successful",
        "message": "Your payment has been completed successfully.",
        "type": "payment",
        "priority": "normal",
        "isRead": false,
        "actionUrl": "/payments/txn_8901",
        "createdAt": "2026-06-25T09:30:00Z",
        "readAt": null
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 30
    }
  }
}
```
### 2. Mark Notification as Read

```http
PATCH /api/v1/notifications/{notificationId}/read
```

Response:

```json
{
  "success": true,
  "message": "Notification marked as read",
  "data": {
    "id": "notif_1001",
    "isRead": true,
    "readAt": "2026-06-25T10:00:00Z"
  }
}
```

### 3. Mark All as Read

```http
PATCH /api/v1/notifications/read-all
```

Request:

```json
{
  "before": "2026-06-25T10:00:00Z"
}
```

Response:

```json
{
  "success": true,
  "message": "All notifications marked as read",
  "data": {
    "updatedCount": 8
  }
}
```

### 4. Delete Notification

```http
DELETE /api/v1/notifications/{notificationId}
```

Response:

```json
{
  "success": true,
  "message": "Notification dismissed successfully",
  "data": {
    "notificationId": "notif_1001"
  }
}
```

### 5. Get Unread Count

```http
GET /api/v1/notifications/unread-count
```

Response:

```json
{
  "success": true,
  "message": "Unread count fetched successfully",
  "data": {
    "unreadCount": 5
  }
}
```
## Real-Time Notification Design

For real-time updates, I would use WebSocket. After login, the client connects to:

```http
GET /ws/notifications
```

The access token should be verified before the connection is accepted. When a new notification is created, the server pushes this message:

```json
{
  "event": "notification.created",
  "data": {
    "id": "notif_1002",
    "title": "New Login Detected",
    "message": "A new login was detected on your account.",
    "type": "security",
    "priority": "high",
    "isRead": false,
    "createdAt": "2026-06-25T10:30:00Z"
  }
}
```

The server can also send count updates:

```json
{
  "event": "notification.unread_count_updated",
  "data": {
    "unreadCount": 6
  }
}
```

If WebSocket is not supported, Server-Sent Events can be used as a fallback through:

```http
GET /api/v1/notifications/stream
```

## Status Codes

| Code | Meaning |
|---|---|
| 200 | Success |
| 400 | Bad request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Notification not found |
| 500 | Server error |

## Note

The backend should identify the user from the access token, so normal notification APIs do not need `userId` in the request. This also prevents users from accessing another user's notifications.

# Stage 2

## Persistent Storage Choice

I would use **PostgreSQL** for storing notifications. Notifications need reliable storage, filtering by user, read/unread status, sorting by time, and safe updates. PostgreSQL fits well because it supports transactions, indexing, JSON fields if needed, and strong consistency.

## Database Schema

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  priority VARCHAR(20) DEFAULT 'normal',
  action_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL,
  deleted_at TIMESTAMP NULL
);

CREATE INDEX idx_notifications_user_created
ON notifications (user_id, created_at DESC);

CREATE INDEX idx_notifications_user_unread
ON notifications (user_id, is_read)
WHERE deleted_at IS NULL;
```

## Problems as Data Increases and Solutions

| Problem | Solution |
|---|---|
| Slow notification listing | Add indexes on `user_id`, `created_at`, and `is_read` |
| Too many old records | Archive or delete old notifications after a fixed retention period |
| Expensive unread count | Cache unread count in Redis and update it when read status changes |
| Large table size | Partition table by month using `created_at` |
| High real-time load | Use a message queue like Kafka/RabbitMQ before pushing through WebSocket |

## Queries Based on REST APIs

### 1. Get Notifications

```sql
SELECT id, title, message, type, priority, action_url, is_read, created_at, read_at
FROM notifications
WHERE user_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;
```

### 2. Get Unread Notifications

```sql
SELECT id, title, message, type, priority, action_url, created_at
FROM notifications
WHERE user_id = $1
  AND is_read = FALSE
  AND deleted_at IS NULL
ORDER BY created_at DESC;
```

### 3. Get Unread Count

```sql
SELECT COUNT(*) AS unread_count
FROM notifications
WHERE user_id = $1
  AND is_read = FALSE
  AND deleted_at IS NULL;
```

### 4. Mark One Notification as Read

```sql
UPDATE notifications
SET is_read = TRUE,
    read_at = CURRENT_TIMESTAMP
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL;
```

### 5. Mark All Notifications as Read

```sql
UPDATE notifications
SET is_read = TRUE,
    read_at = CURRENT_TIMESTAMP
WHERE user_id = $1
  AND is_read = FALSE
  AND deleted_at IS NULL;
```

### 6. Dismiss Notification

```sql
UPDATE notifications
SET deleted_at = CURRENT_TIMESTAMP
WHERE id = $1
  AND user_id = $2;
```

### 7. Create Notification

```sql
INSERT INTO notifications (user_id, title, message, type, priority, action_url)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, title, message, type, priority, action_url, is_read, created_at;
```

## Real-Time Storage Flow

When a notification is inserted into PostgreSQL, the backend can publish the same notification to a queue. A WebSocket service then pushes it to the correct logged-in user. This keeps storage reliable and real-time delivery fast.

# Stage 3

The query is logically correct if the requirement is to fetch all unread notifications of student `1042`. However, it is not ideal for production scale.

```sql
SELECT *
FROM notifications
WHERE studentID = 1042
  AND isRead = false
ORDER BY createdAt ASC;
```

## Why It Is Slow

With 5,000,000 notifications, the database may scan a large number of rows, filter by `studentID` and `isRead`, then sort the result by `createdAt`. Also, `SELECT *` fetches every column even if the API needs only a few fields.

## Better Approach

Create a composite index that matches the filter and sort pattern:

```sql
CREATE INDEX idx_notifications_student_unread_created
ON notifications (studentID, isRead, createdAt);
```

Then fetch only required columns:

```sql
SELECT id, title, message, notificationType, createdAt
FROM notifications
WHERE studentID = 1042
  AND isRead = false
ORDER BY createdAt ASC
LIMIT 50;
```

The expected cost becomes close to `O(log N + K)`, where `N` is total rows and `K` is the number of unread notifications returned. Without a useful index, it can behave closer to `O(N log N)` because of scanning and sorting.

## Should We Index Every Column?

No. Indexing every column is not effective. Indexes improve reads, but they also consume storage and slow down inserts, updates, and deletes. Indexes should be created based on real query patterns, such as `(studentID, isRead, createdAt)` for this API.

## Query for Placement Notifications in Last 7 Days

```sql
SELECT DISTINCT studentID
FROM notifications
WHERE notificationType = 'Placement'
  AND createdAt >= CURRENT_TIMESTAMP - INTERVAL '7 days';
```

For this query, the useful index would be:

```sql
CREATE INDEX idx_notifications_type_created_student
ON notifications (notificationType, createdAt, studentID);
```

This helps the database quickly find recent placement notifications without scanning the full notifications table.

# Stage 4

Fetching notifications from the database on every page load is wasteful. Most of the time, notifications do not change between two page visits, so repeatedly hitting the DB creates unnecessary load and slows down the user experience.

## Suggested Solution

I would use a mix of **cache + real-time updates + pagination**.

## 1. Cache Notification Count and Recent Notifications

Store unread count and latest notifications in Redis.

```text
Key: user:1042:unread_count
Key: user:1042:recent_notifications
```

The API first checks Redis. If data is available, it returns from cache. If not, it reads from DB and refreshes the cache.

**Tradeoff:** Cache makes reads much faster, but it adds cache invalidation work. Whenever a notification is created or marked as read, Redis must also be updated.

## 2. Use WebSocket Instead of Fetching Every Time

After login, the client should open a WebSocket connection. New notifications can be pushed directly to the student instead of waiting for the next page load.

**Tradeoff:** WebSocket improves real-time experience and reduces polling, but it requires connection management and fallback handling for disconnected users.

## 3. Fetch Only What Is Needed

Do not fetch all notifications. Load only the latest records first.

```sql
SELECT id, title, message, notificationType, createdAt
FROM notifications
WHERE studentID = $1
ORDER BY createdAt DESC
LIMIT 20;
```

Older notifications can be loaded using pagination or infinite scroll.

**Tradeoff:** This reduces DB and network load, but the front end must handle pagination properly.

## 4. Use Conditional Fetching

The client can send the latest notification timestamp it already has.

```http
GET /api/v1/notifications?after=2026-06-25T10:00:00Z
```

The backend returns only new notifications after that time.

**Tradeoff:** This avoids repeated full fetches, but the client must maintain the last fetched timestamp correctly.

## Final Approach

The best solution is not one single change. I would keep PostgreSQL as the source of truth, use Redis for fast repeated reads, push new notifications through WebSocket, and fetch only limited records from the API. This reduces database pressure while keeping the notification experience fast and reliable.

# Stage 5

The current implementation is simple but not reliable for 50,000 students. It runs everything in one loop, so one slow email API or one failure can delay or break the whole process. It also mixes three different responsibilities: sending email, saving to DB, and pushing in-app notifications.

## Shortcomings

1. No retry mechanism for failed emails.
2. No tracking of which students succeeded or failed.
3. The process is slow because work is done one by one.
4. If the server crashes midway, remaining students may never receive the notification.
5. Email sending and DB saving are tightly coupled.

If `send_email` fails for 200 students, those failures should be stored and retried. We should not rerun the whole campaign blindly, because that may send duplicate emails to students who already received it.

## Better Design

The reliable approach is to create a notification campaign, save notification records in DB, and publish jobs to a queue. Separate workers can process email and in-app delivery in parallel.

Saving to DB and sending email should not happen as one combined operation. DB save is the source of truth and should happen first. Email is an external side effect, so it should be handled asynchronously with retries.

## Revised Pseudocode

```text
function notify_all(student_ids, message):
    campaign_id = create_campaign(message)

    for batch in split(student_ids, size=1000):
        notifications = []

        for student_id in batch:
            notifications.append({
                campaign_id: campaign_id,
                student_id: student_id,
                message: message,
                status: "pending"
            })

        bulk_insert_notifications(notifications)
        publish_queue("notification.created", notifications)

function notification_worker(job):
    for notification in job.notifications:
        push_to_app(notification.student_id, notification.message)
        publish_queue("email.send", notification)

function email_worker(notification):
    try:
        send_email(notification.student_id, notification.message)
        mark_email_status(notification.id, "sent")
    except error:
        increase_retry_count(notification.id)

        if retry_count < 3:
            publish_queue_later("email.send", notification)
        else:
            mark_email_status(notification.id, "failed")
```

## Why This Is Better

This design is faster because workers process many notifications in parallel. It is also safer because failures are visible, retryable, and limited to only the affected students. The database remains the permanent record, while queues handle large-volume delivery without overwhelming the API server.

# Stage 6

For the Priority Inbox, I ranked notifications using two factors: notification type and recency. The type weight is:

```text
Placement = 3
Result = 2
Event = 1
```

If two notifications have the same type weight, the newer one gets higher priority. This keeps placement-related notifications at the top while still respecting recent updates.

I implemented the solution in `priority_inbox.js`. It fetches notifications from the given API, applies the priority rule, and prints the top 10 notifications.

To maintain the top 10 efficiently when new notifications keep coming in, I used a min-heap of size 10. The heap keeps the weakest notification at the top. When a new notification arrives, it is compared with the weakest item. If it has higher priority, it replaces that item. This avoids sorting the full list every time.

The cost is:

```text
Building top 10 from N notifications: O(N log 10), practically close to O(N)
Adding one new notification later: O(log 10), practically constant time
```

This approach is fast, simple, and suitable for a real-time notification inbox.
